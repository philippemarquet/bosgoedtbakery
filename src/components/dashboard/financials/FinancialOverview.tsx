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

interface WeeklyMenuStats {
  id: string;
  name: string;
  delivery_date: string | null;
  menu_price: number;
  total_orders: number;
  total_revenue: number;
  total_discounts: number;
}

interface MonthlyStats {
  month: string;
  monthLabel: string;
  revenue: number;
  orders: number;
  avgOrderValue: number;
}

const FinancialOverview = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [weeklyMenuStats, setWeeklyMenuStats] = useState<WeeklyMenuStats[]>([]);
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

      // Fetch weekly menus
      const { data: menus } = await supabase
        .from("weekly_menus")
        .select("id, name, delivery_date, price")
        .order("delivery_date", { ascending: false });

      if (menus && ordersData) {
        const menuStats = menus.map(menu => {
          const menuOrders = ordersData.filter(o => o.weekly_menu_id === menu.id);
          return {
            id: menu.id,
            name: menu.name,
            delivery_date: menu.delivery_date,
            menu_price: menu.price,
            total_orders: menuOrders.length,
            total_revenue: menuOrders.reduce((sum, o) => sum + o.total, 0),
            total_discounts: menuOrders.reduce((sum, o) => sum + o.discount_amount, 0),
          };
        });
        setWeeklyMenuStats(menuStats);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  const overallStats = useMemo(() => {
    const paidOrders = orders.filter(o => o.status === "paid");
    const openOrders = orders.filter(o => o.status !== "paid");
    
    return {
      totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
      totalSubtotal: orders.reduce((sum, o) => sum + o.subtotal, 0),
      totalDiscounts: orders.reduce((sum, o) => sum + o.discount_amount, 0),
      paidRevenue: paidOrders.reduce((sum, o) => sum + o.total, 0),
      openRevenue: openOrders.reduce((sum, o) => sum + o.total, 0),
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      avgOrderValue: orders.length > 0 ? orders.reduce((sum, o) => sum + o.total, 0) / orders.length : 0,
    };
  }, [orders]);

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
      
      return {
        month: monthStr,
        monthLabel: format(month, "MMM yyyy", { locale: nl }),
        revenue,
        orders: monthOrders.length,
        avgOrderValue: monthOrders.length > 0 ? revenue / monthOrders.length : 0,
      };
    });
  }, [orders]);

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <TableHead className="text-right">Korting</TableHead>
                <TableHead className="text-right">Omzet</TableHead>
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
                  <TableCell className="text-right text-green-600">
                    {menu.total_discounts > 0 ? `-${formatCurrency(menu.total_discounts)}` : "-"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(menu.total_revenue)}
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
