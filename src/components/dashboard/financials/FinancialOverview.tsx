import { useState, useEffect, useMemo } from "react";
import { Euro, TrendingUp, TrendingDown, Calendar, PiggyBank, Receipt, Percent } from "lucide-react";
import { format, parseISO, startOfMonth, subMonths, eachMonthOfInterval } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";

interface Order {
  id: string;
  total: number;
  subtotal: number;
  discount_amount: number;
  status: string;
  created_at: string;
  weekly_menu_id: string | null;
}

interface OrderItem {
  order_id: string;
  product_id: string;
  quantity: number;
  total: number;
}

interface WeeklyMenuStats {
  id: string;
  name: string;
  delivery_date: string | null;
  menu_price: number;
  total_orders: number;
  total_revenue: number;
  total_discounts: number;
  total_cost: number;
  margin: number;
  margin_percentage: number;
}

interface MonthlyStats {
  month: string;
  monthLabel: string;
  revenue: number;
  cost: number;
  margin: number;
  orders: number;
  avgOrderValue: number;
}

interface ProductCost {
  product_id: string;
  cost_per_unit: number;
}

const FinancialOverview = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [weeklyMenuStats, setWeeklyMenuStats] = useState<WeeklyMenuStats[]>([]);
  const [productCosts, setProductCosts] = useState<Map<string, number>>(new Map());
  const [weeklyMenuCosts, setWeeklyMenuCosts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch all orders
      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, total, subtotal, discount_amount, status, created_at, weekly_menu_id")
        .order("created_at", { ascending: false });

      setOrders(ordersData || []);

      // Fetch order items
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("order_id, product_id, quantity, total");

      setOrderItems(itemsData || []);

      // Fetch products to get yield info
      const { data: productsData } = await supabase
        .from("products")
        .select("id, yield_quantity, yield_unit");

      const productYieldMap = new Map<string, { yield_quantity: number; yield_unit: string }>();
      if (productsData) {
        productsData.forEach(p => {
          productYieldMap.set(p.id, { yield_quantity: p.yield_quantity, yield_unit: p.yield_unit });
        });
      }

      // Fetch recipe ingredients with costs to calculate product costs
      const { data: recipeData } = await supabase
        .from("recipe_ingredients")
        .select(`
          product_id,
          quantity,
          ingredient:ingredients(price_per_unit)
        `);

      // Fetch fixed costs for recipes
      const { data: fixedCostsData } = await supabase
        .from("recipe_fixed_costs")
        .select(`
          product_id,
          quantity,
          fixed_cost:fixed_costs(price_per_unit)
        `);

      // Calculate total recipe cost per product (ingredients + fixed costs)
      const recipeTotalCostMap = new Map<string, number>();
      
      // Add ingredient costs
      if (recipeData) {
        recipeData.forEach(ri => {
          const ingredientCost = (ri.ingredient as { price_per_unit: number } | null)?.price_per_unit || 0;
          const lineCost = ri.quantity * ingredientCost;
          recipeTotalCostMap.set(ri.product_id, (recipeTotalCostMap.get(ri.product_id) || 0) + lineCost);
        });
      }
      
      // Add fixed costs
      if (fixedCostsData) {
        fixedCostsData.forEach(fc => {
          const fixedCostPrice = (fc.fixed_cost as { price_per_unit: number } | null)?.price_per_unit || 0;
          const lineCost = fc.quantity * fixedCostPrice;
          recipeTotalCostMap.set(fc.product_id, (recipeTotalCostMap.get(fc.product_id) || 0) + lineCost);
        });
      }

      // Calculate cost per unit based on yield logic
      const costMap = new Map<string, number>();
      recipeTotalCostMap.forEach((totalRecipeCost, productId) => {
        const yieldInfo = productYieldMap.get(productId);
        if (yieldInfo && yieldInfo.yield_unit === 'stuks' && yieldInfo.yield_quantity > 0) {
          // For "stuks" products: divide total recipe cost by yield quantity
          costMap.set(productId, totalRecipeCost / yieldInfo.yield_quantity);
        } else {
          // For weight-based products: total recipe cost is the batch cost
          costMap.set(productId, totalRecipeCost);
        }
      });
      setProductCosts(costMap);

      // Fetch weekly menus with their products
      const { data: menus } = await supabase
        .from("weekly_menus")
        .select("id, name, delivery_date, price")
        .order("delivery_date", { ascending: false });

      // Fetch weekly menu products to calculate menu cost
      const { data: menuProductsData } = await supabase
        .from("weekly_menu_products")
        .select("weekly_menu_id, product_id, quantity");

      // Calculate cost per weekly menu (sum of product costs × quantities)
      const menuCostMap = new Map<string, number>();
      if (menuProductsData) {
        menuProductsData.forEach(mp => {
          const productCost = costMap.get(mp.product_id) || 0;
          const lineCost = productCost * mp.quantity;
          menuCostMap.set(mp.weekly_menu_id, (menuCostMap.get(mp.weekly_menu_id) || 0) + lineCost);
        });
      }
      setWeeklyMenuCosts(menuCostMap);

      if (menus && ordersData) {
        const menuStats = menus.map(menu => {
          const menuOrders = ordersData.filter(o => o.weekly_menu_id === menu.id);
          const totalRevenue = menuOrders.reduce((sum, o) => sum + o.total, 0);
          const totalDiscounts = menuOrders.reduce((sum, o) => sum + o.discount_amount, 0);
          const menuCost = menuCostMap.get(menu.id) || 0;
          const totalCost = menuCost * menuOrders.length;
          const margin = totalRevenue - totalCost;
          const marginPercentage = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;
          
          return {
            id: menu.id,
            name: menu.name,
            delivery_date: menu.delivery_date,
            menu_price: menu.price,
            total_orders: menuOrders.length,
            total_revenue: totalRevenue,
            total_discounts: totalDiscounts,
            total_cost: totalCost,
            margin,
            margin_percentage: marginPercentage,
          };
        });
        setWeeklyMenuStats(menuStats);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  // Calculate total costs for all orders
  const calculateOrderCost = (orderId: string, weeklyMenuId: string | null): number => {
    let cost = 0;
    
    // Add cost for individual order items
    const items = orderItems.filter(item => item.order_id === orderId);
    items.forEach(item => {
      const productCost = productCosts.get(item.product_id) || 0;
      cost += productCost * item.quantity;
    });
    
    // Add cost for weekly menu products
    if (weeklyMenuId) {
      cost += weeklyMenuCosts.get(weeklyMenuId) || 0;
    }
    
    return cost;
  };

  const overallStats = useMemo(() => {
    const paidOrders = orders.filter(o => o.status === "paid");
    const openOrders = orders.filter(o => o.status !== "paid");
    
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalCost = orders.reduce((sum, o) => sum + calculateOrderCost(o.id, o.weekly_menu_id), 0);
    const totalMargin = totalRevenue - totalCost;
    const marginPercentage = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
    
    return {
      totalRevenue,
      totalCost,
      totalMargin,
      marginPercentage,
      totalSubtotal: orders.reduce((sum, o) => sum + o.subtotal, 0),
      totalDiscounts: orders.reduce((sum, o) => sum + o.discount_amount, 0),
      paidRevenue: paidOrders.reduce((sum, o) => sum + o.total, 0),
      openRevenue: openOrders.reduce((sum, o) => sum + o.total, 0),
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
    };
  }, [orders, orderItems, productCosts, weeklyMenuCosts]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = subMonths(startOfMonth(now), 5);
    const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });

    return months.map(month => {
      const monthStr = format(month, "yyyy-MM");
      const monthOrders = orders.filter(o => 
        format(parseISO(o.created_at), "yyyy-MM") === monthStr
      );
      const revenue = monthOrders.reduce((sum, o) => sum + o.total, 0);
      const cost = monthOrders.reduce((sum, o) => sum + calculateOrderCost(o.id, o.weekly_menu_id), 0);
      const margin = revenue - cost;
      
      return {
        month: monthStr,
        monthLabel: format(month, "MMM yyyy", { locale: nl }),
        revenue,
        cost,
        margin,
        orders: monthOrders.length,
        avgOrderValue: monthOrders.length > 0 ? revenue / monthOrders.length : 0,
      };
    });
  }, [orders, orderItems, productCosts, weeklyMenuCosts]);

  const formatCurrency = (value: number) => `€${value.toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardDescription>Totale omzet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Euro className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold">{formatCurrency(overallStats.totalRevenue)}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {overallStats.totalOrders} bestellingen
            </p>
          </CardContent>
        </Card>

        <Card className={
          overallStats.marginPercentage >= 60 
            ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
            : overallStats.marginPercentage >= 30
            ? "border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20"
            : "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
        }>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className={`w-4 h-4 ${
                overallStats.marginPercentage >= 60 ? "text-emerald-600" 
                : overallStats.marginPercentage >= 30 ? "text-orange-600" 
                : "text-red-600"
              }`} />
              Marge
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className={`text-2xl font-bold ${
              overallStats.marginPercentage >= 60 ? "text-emerald-700 dark:text-emerald-400" 
              : overallStats.marginPercentage >= 30 ? "text-orange-700 dark:text-orange-400" 
              : "text-red-700 dark:text-red-400"
            }`}>
              {formatCurrency(overallStats.totalMargin)}
            </span>
            <p className="text-sm text-muted-foreground mt-1">
              {overallStats.marginPercentage.toFixed(1)}% · kosten {formatCurrency(overallStats.totalCost)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <PiggyBank className="w-4 h-4 text-emerald-600" />
              Ontvangen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatCurrency(overallStats.paidRevenue)}
            </span>
            <p className="text-sm text-muted-foreground mt-1">
              {overallStats.paidOrders} betaald
            </p>
          </CardContent>
        </Card>

        <Card className={overallStats.openRevenue > 0 ? "border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20" : ""}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Receipt className="w-4 h-4" />
              Openstaand
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className={`text-2xl font-bold ${overallStats.openRevenue > 0 ? "text-orange-700 dark:text-orange-400" : ""}`}>
              {formatCurrency(overallStats.openRevenue)}
            </span>
            <p className="text-sm text-muted-foreground mt-1">
              {overallStats.totalOrders - overallStats.paidOrders} open
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Percent className="w-4 h-4" />
              Gem. bestelling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {formatCurrency(overallStats.avgOrderValue)}
            </span>
            <p className="text-sm text-muted-foreground mt-1">
              {formatCurrency(overallStats.totalDiscounts)} korting gegeven
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Omzet per maand
          </CardTitle>
          <CardDescription>
            Laatste 6 maanden
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData.some(m => m.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                <YAxis 
                  tickFormatter={(value) => `€${value}`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (name === "revenue") return [formatCurrency(value), "Omzet"];
                    if (name === "orders") return [value, "Bestellingen"];
                    return [value, name];
                  }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-12 text-muted-foreground">
              Nog geen historische data beschikbaar
            </p>
          )}
        </CardContent>
      </Card>

      {/* Orders per Month */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Bestellingen per maand
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.some(m => m.orders > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="orders" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-2))' }}
                    name="Bestellingen"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-8 text-muted-foreground">Nog geen data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Gem. bestelwaarde per maand
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.some(m => m.avgOrderValue > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `€${v}`} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), "Gemiddeld"]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avgOrderValue" 
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-3))' }}
                    name="Gem. waarde"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-8 text-muted-foreground">Nog geen data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per Weekly Menu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Resultaten per weekmenu
          </CardTitle>
          <CardDescription>
            Overzicht van omzet per weekmenu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Weekmenu</TableHead>
                <TableHead>Leverdag</TableHead>
                <TableHead className="text-right">Menu prijs</TableHead>
                <TableHead className="text-right">Bestellingen</TableHead>
                <TableHead className="text-right">Omzet</TableHead>
                <TableHead className="text-right">Kosten</TableHead>
                <TableHead className="text-right">Marge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeklyMenuStats.map((menu) => (
                <TableRow key={menu.id}>
                  <TableCell className="font-medium">{menu.name}</TableCell>
                  <TableCell>
                    {menu.delivery_date ? (
                      format(parseISO(menu.delivery_date), "EEEE d MMM yyyy", { locale: nl })
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(menu.menu_price)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{menu.total_orders}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(menu.total_revenue)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(menu.total_cost)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`font-semibold ${
                        menu.margin_percentage >= 60 ? "text-emerald-600" 
                        : menu.margin_percentage >= 30 ? "text-orange-600" 
                        : "text-red-600"
                      }`}>
                        {formatCurrency(menu.margin)}
                      </span>
                      <Badge variant="outline" className={
                        menu.margin_percentage >= 60 ? "border-emerald-300 text-emerald-700" 
                        : menu.margin_percentage >= 30 ? "border-orange-300 text-orange-700" 
                        : "border-red-300 text-red-700"
                      }>
                        {menu.margin_percentage.toFixed(0)}%
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {weeklyMenuStats.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">
              Nog geen weekmenu's
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialOverview;
