import { useState, useEffect, useMemo } from "react";
import { Euro, TrendingUp, Calendar, PiggyBank, Receipt, Percent } from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, eachWeekOfInterval, eachMonthOfInterval, isWithinInterval } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ComposedChart, Bar } from "recharts";

interface Order {
  id: string;
  total: number;
  subtotal: number;
  discount_amount: number;
  status: string;
  created_at: string;
  invoice_date: string;
  weekly_menu_id: string | null;
}

interface OrderItem {
  order_id: string;
  product_id: string;
  quantity: number;
  total: number;
}

interface WeeklyMenuProduct {
  weekly_menu_id: string;
  product_id: string;
  quantity: number;
}

interface PeriodStats {
  period: string;
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  revenue: number;
  cost: number;
  margin: number;
  marginPercentage: number;
  orders: number;
  avgOrderValue: number;
}

const FinancialOverview = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [weeklyMenuProducts, setWeeklyMenuProducts] = useState<WeeklyMenuProduct[]>([]);
  const [productCosts, setProductCosts] = useState<Map<string, number>>(new Map());
  const [weeklyMenuPrices, setWeeklyMenuPrices] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [periodView, setPeriodView] = useState<"week" | "month">("week");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch all orders with invoice_date
      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, total, subtotal, discount_amount, status, created_at, invoice_date, weekly_menu_id")
        .order("invoice_date", { ascending: false });

      setOrders(ordersData || []);

      // Fetch order items
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("order_id, product_id, quantity, total");

      setOrderItems(itemsData || []);

      // Fetch weekly menu products
      const { data: menuProductsData } = await supabase
        .from("weekly_menu_products")
        .select("weekly_menu_id, product_id, quantity");

      setWeeklyMenuProducts(menuProductsData || []);

      // Fetch weekly menu prices
      const { data: menusData } = await supabase
        .from("weekly_menus")
        .select("id, price");

      const menuPriceMap = new Map<string, number>();
      if (menusData) {
        menusData.forEach(m => menuPriceMap.set(m.id, m.price));
      }
      setWeeklyMenuPrices(menuPriceMap);

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

      // Fetch recipe ingredients with costs
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
      
      if (recipeData) {
        recipeData.forEach(ri => {
          const ingredientCost = (ri.ingredient as { price_per_unit: number } | null)?.price_per_unit || 0;
          const lineCost = ri.quantity * ingredientCost;
          recipeTotalCostMap.set(ri.product_id, (recipeTotalCostMap.get(ri.product_id) || 0) + lineCost);
        });
      }
      
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
          costMap.set(productId, totalRecipeCost / yieldInfo.yield_quantity);
        } else {
          costMap.set(productId, totalRecipeCost);
        }
      });
      setProductCosts(costMap);

      setLoading(false);
    };
    fetchData();
  }, []);

  // Calculate cost for a single order (including weekly menu products and extra items)
  const calculateOrderCost = (orderId: string, weeklyMenuId: string | null): number => {
    let cost = 0;
    
    // Cost from order items (extra products)
    const items = orderItems.filter(item => item.order_id === orderId);
    items.forEach(item => {
      const productCost = productCosts.get(item.product_id) || 0;
      cost += productCost * item.quantity;
    });
    
    // Cost from weekly menu products
    if (weeklyMenuId) {
      const menuProducts = weeklyMenuProducts.filter(mp => mp.weekly_menu_id === weeklyMenuId);
      menuProducts.forEach(mp => {
        const productCost = productCosts.get(mp.product_id) || 0;
        cost += productCost * mp.quantity;
      });
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
  }, [orders, orderItems, productCosts, weeklyMenuProducts]);

  // Generate period stats based on invoice_date
  const periodStats = useMemo(() => {
    if (orders.length === 0) return [];

    const now = new Date();
    const sixMonthsAgo = subMonths(startOfMonth(now), 5);

    if (periodView === "month") {
      const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });
      
      return months.map(month => {
        const start = startOfMonth(month);
        const end = endOfMonth(month);
        
        const periodOrders = orders.filter(o => {
          const invoiceDate = parseISO(o.invoice_date);
          return isWithinInterval(invoiceDate, { start, end });
        });

        const revenue = periodOrders.reduce((sum, o) => sum + o.total, 0);
        const cost = periodOrders.reduce((sum, o) => sum + calculateOrderCost(o.id, o.weekly_menu_id), 0);
        const margin = revenue - cost;
        
        return {
          period: format(month, "yyyy-MM"),
          periodLabel: format(month, "MMM yyyy", { locale: nl }),
          startDate: start,
          endDate: end,
          revenue,
          cost,
          margin,
          marginPercentage: revenue > 0 ? (margin / revenue) * 100 : 0,
          orders: periodOrders.length,
          avgOrderValue: periodOrders.length > 0 ? revenue / periodOrders.length : 0,
        };
      });
    } else {
      // Weekly view - last 12 weeks
      const twelveWeeksAgo = subMonths(now, 3);
      const weeks = eachWeekOfInterval({ start: twelveWeeksAgo, end: now }, { weekStartsOn: 1 });
      
      return weeks.slice(-12).map(week => {
        const start = startOfWeek(week, { weekStartsOn: 1 });
        const end = endOfWeek(week, { weekStartsOn: 1 });
        
        const periodOrders = orders.filter(o => {
          const invoiceDate = parseISO(o.invoice_date);
          return isWithinInterval(invoiceDate, { start, end });
        });

        const revenue = periodOrders.reduce((sum, o) => sum + o.total, 0);
        const cost = periodOrders.reduce((sum, o) => sum + calculateOrderCost(o.id, o.weekly_menu_id), 0);
        const margin = revenue - cost;
        
        return {
          period: format(start, "yyyy-'W'ww"),
          periodLabel: `Week ${format(start, "w")} (${format(start, "d MMM", { locale: nl })})`,
          startDate: start,
          endDate: end,
          revenue,
          cost,
          margin,
          marginPercentage: revenue > 0 ? (margin / revenue) * 100 : 0,
          orders: periodOrders.length,
          avgOrderValue: periodOrders.length > 0 ? revenue / periodOrders.length : 0,
        };
      });
    }
  }, [orders, orderItems, productCosts, weeklyMenuProducts, periodView]);

  const chartData = useMemo(() => {
    return periodStats.map(p => ({
      ...p,
      Omzet: p.revenue,
      Kosten: p.cost,
      Marge: p.margin,
    }));
  }, [periodStats]);

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

      {/* Revenue & Margin Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Omzet & Marge
          </CardTitle>
          <CardDescription>
            Omzet, kosten en marge per periode
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.some(m => m.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                <YAxis 
                  tickFormatter={(value) => `€${value}`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="Omzet" fill="hsl(var(--primary))" opacity={0.8} />
                <Bar dataKey="Kosten" fill="hsl(var(--muted-foreground))" opacity={0.5} />
                <Line 
                  type="monotone" 
                  dataKey="Marge" 
                  stroke="hsl(142, 76%, 36%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(142, 76%, 36%)' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-12 text-muted-foreground">
              Nog geen historische data beschikbaar
            </p>
          )}
        </CardContent>
      </Card>

      {/* Period-based Results */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Resultaten per periode
              </CardTitle>
              <CardDescription>
                Overzicht van omzet, kosten en marge per {periodView === "week" ? "week" : "maand"}
              </CardDescription>
            </div>
            <Tabs value={periodView} onValueChange={(v) => setPeriodView(v as "week" | "month")}>
              <TabsList>
                <TabsTrigger value="week">Per week</TabsTrigger>
                <TabsTrigger value="month">Per maand</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periode</TableHead>
                <TableHead className="text-right">Bestellingen</TableHead>
                <TableHead className="text-right">Omzet</TableHead>
                <TableHead className="text-right">Kosten</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead className="text-right">Gem. bestelling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periodStats.slice().reverse().map((period) => (
                <TableRow key={period.period}>
                  <TableCell className="font-medium">{period.periodLabel}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{period.orders}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(period.revenue)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(period.cost)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`font-semibold ${
                        period.marginPercentage >= 60 ? "text-emerald-600" 
                        : period.marginPercentage >= 30 ? "text-orange-600" 
                        : "text-red-600"
                      }`}>
                        {formatCurrency(period.margin)}
                      </span>
                      <Badge variant="outline" className={
                        period.marginPercentage >= 60 ? "border-emerald-300 text-emerald-700" 
                        : period.marginPercentage >= 30 ? "border-orange-300 text-orange-700" 
                        : "border-red-300 text-red-700"
                      }>
                        {period.marginPercentage.toFixed(0)}%
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(period.avgOrderValue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {periodStats.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">
              Nog geen bestellingen
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialOverview;