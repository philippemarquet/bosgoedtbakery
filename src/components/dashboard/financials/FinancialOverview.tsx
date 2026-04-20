import { useState, useEffect, useMemo } from "react";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isWithinInterval,
} from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
} from "recharts";
import {
  costPerSellUnit,
  type ProductForPricing,
} from "@/lib/pricing";
import type { MeasurementUnit } from "@/lib/units";

interface Order {
  id: string;
  total: number;
  subtotal: number;
  discount_amount: number;
  status: string;
  created_at: string;
  invoice_date: string;
}

interface OrderItem {
  order_id: string;
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
  // costPerSellUnitByProductId — the per-sell-unit production cost for each
  // product, computed once via pricing-lib and reused across all aggregations.
  const [productUnitCosts, setProductUnitCosts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [periodView, setPeriodView] = useState<"week" | "month">("week");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [ordersRes, itemsRes, productsRes, recipeIngredientsRes, recipeFixedCostsRes] =
        await Promise.all([
          supabase
            .from("orders")
            .select(
              "id, total, subtotal, discount_amount, status, created_at, invoice_date",
            )
            .order("invoice_date", { ascending: false }),
          supabase.from("order_items").select("order_id, product_id, quantity"),
          supabase
            .from("products")
            .select(
              "id, selling_price, recipe_yield_quantity, recipe_yield_unit, sell_unit_quantity, sell_unit_unit",
            ),
          supabase.from("recipe_ingredients").select(`
            product_id,
            quantity,
            ingredient:ingredients(price_per_unit)
          `),
          supabase.from("recipe_fixed_costs").select(`
            product_id,
            quantity,
            fixed_cost:fixed_costs(price_per_unit)
          `),
        ]);

      setOrders((ordersRes.data as Order[]) || []);
      setOrderItems((itemsRes.data as OrderItem[]) || []);

      // Recipe-batch cost per product (ingredients + fixed costs).
      const batchCostByProductId = new Map<string, number>();
      const addCost = (productId: string, amount: number) => {
        batchCostByProductId.set(
          productId,
          (batchCostByProductId.get(productId) ?? 0) + amount,
        );
      };
      for (const ri of recipeIngredientsRes.data || []) {
        const price =
          (ri.ingredient as { price_per_unit: number } | null)?.price_per_unit ?? 0;
        addCost(ri.product_id, Number(ri.quantity || 0) * Number(price));
      }
      for (const fc of recipeFixedCostsRes.data || []) {
        const price =
          (fc.fixed_cost as { price_per_unit: number } | null)?.price_per_unit ?? 0;
        addCost(fc.product_id, Number(fc.quantity || 0) * Number(price));
      }

      // Cost per sell-unit, via the shared pricing lib.
      const unitCostMap = new Map<string, number>();
      for (const p of productsRes.data || []) {
        const forPricing: ProductForPricing = {
          id: p.id,
          selling_price: Number(p.selling_price || 0),
          recipe_yield_quantity: Number(p.recipe_yield_quantity || 0),
          recipe_yield_unit: p.recipe_yield_unit as MeasurementUnit,
          sell_unit_quantity: Number(p.sell_unit_quantity || 0),
          sell_unit_unit: p.sell_unit_unit as MeasurementUnit,
        };
        const batchCost = batchCostByProductId.get(p.id) ?? 0;
        unitCostMap.set(p.id, costPerSellUnit(forPricing, batchCost));
      }
      setProductUnitCosts(unitCostMap);

      setLoading(false);
    };
    fetchData();
  }, []);

  // Order-cost lookup: sum unit-cost × quantity across all order_items for an order.
  // order_items is the single source of truth — legacy weekly-menu orders also
  // have their items denormalised here, so no special-casing needed.
  const orderCostById = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of orderItems) {
      const unitCost = productUnitCosts.get(item.product_id) ?? 0;
      map.set(
        item.order_id,
        (map.get(item.order_id) ?? 0) + unitCost * Number(item.quantity || 0),
      );
    }
    return map;
  }, [orderItems, productUnitCosts]);

  const calculateOrderCost = (orderId: string): number => orderCostById.get(orderId) ?? 0;

  const overallStats = useMemo(() => {
    const paidOrders = orders.filter((o) => o.status === "paid");
    const openOrders = orders.filter((o) => o.status !== "paid");

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const totalCost = orders.reduce((sum, o) => sum + calculateOrderCost(o.id), 0);
    const totalMargin = totalRevenue - totalCost;
    const marginPercentage = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCost,
      totalMargin,
      marginPercentage,
      totalSubtotal: orders.reduce((sum, o) => sum + Number(o.subtotal || 0), 0),
      totalDiscounts: orders.reduce((sum, o) => sum + Number(o.discount_amount || 0), 0),
      paidRevenue: paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
      openRevenue: openOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      avgOrderValue:
        orders.length > 0 ? totalRevenue / orders.length : 0,
    };
  }, [orders, orderCostById]);

  // Generate period stats based on invoice_date
  const periodStats: PeriodStats[] = useMemo(() => {
    if (orders.length === 0) return [];

    const now = new Date();
    const sixMonthsAgo = subMonths(startOfMonth(now), 5);

    if (periodView === "month") {
      const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });

      return months.map((month) => {
        const start = startOfMonth(month);
        const end = endOfMonth(month);

        const periodOrders = orders.filter((o) => {
          const invoiceDate = parseISO(o.invoice_date);
          return isWithinInterval(invoiceDate, { start, end });
        });

        const revenue = periodOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const cost = periodOrders.reduce((sum, o) => sum + calculateOrderCost(o.id), 0);
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
      const weeks = eachWeekOfInterval(
        { start: twelveWeeksAgo, end: now },
        { weekStartsOn: 1 },
      );

      return weeks.slice(-12).map((week) => {
        const start = startOfWeek(week, { weekStartsOn: 1 });
        const end = endOfWeek(week, { weekStartsOn: 1 });

        const periodOrders = orders.filter((o) => {
          const invoiceDate = parseISO(o.invoice_date);
          return isWithinInterval(invoiceDate, { start, end });
        });

        const revenue = periodOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const cost = periodOrders.reduce((sum, o) => sum + calculateOrderCost(o.id), 0);
        const margin = revenue - cost;

        return {
          period: format(start, "yyyy-'W'ww"),
          periodLabel: `Week ${format(start, "w")} (${format(start, "d MMM", {
            locale: nl,
          })})`,
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
  }, [orders, orderCostById, periodView]);

  const chartData = useMemo(() => {
    return periodStats.map((p) => ({
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
    <div className="space-y-8">
      {/* Key Metrics - Clean minimal cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Totale omzet
          </p>
          <p className="text-2xl font-light tabular-nums tracking-tight">
            {formatCurrency(overallStats.totalRevenue)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {overallStats.totalOrders} bestellingen
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Marge
          </p>
          <p
            className={`text-2xl font-light tabular-nums tracking-tight ${
              overallStats.marginPercentage >= 60
                ? "text-emerald-600"
                : overallStats.marginPercentage >= 30
                  ? "text-orange-600"
                  : "text-red-600"
            }`}
          >
            {formatCurrency(overallStats.totalMargin)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {overallStats.marginPercentage.toFixed(1)}%
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Ontvangen
          </p>
          <p className="text-2xl font-light tabular-nums tracking-tight text-emerald-600">
            {formatCurrency(overallStats.paidRevenue)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {overallStats.paidOrders} betaald
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Openstaand
          </p>
          <p
            className={`text-2xl font-light tabular-nums tracking-tight ${
              overallStats.openRevenue > 0 ? "text-orange-600" : ""
            }`}
          >
            {formatCurrency(overallStats.openRevenue)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {overallStats.totalOrders - overallStats.paidOrders} open
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Gem. bestelling
          </p>
          <p className="text-2xl font-light tabular-nums tracking-tight">
            {formatCurrency(overallStats.avgOrderValue)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(overallStats.totalDiscounts)} korting
          </p>
        </div>
      </div>

      {/* Revenue & Margin Chart */}
      <div className="border-t border-border pt-8">
        <div className="mb-6">
          <h3 className="text-lg font-serif font-medium">Omzet & Marge</h3>
          <p className="text-sm text-muted-foreground">Per periode</p>
        </div>
        {chartData.some((m) => m.revenue > 0) ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="periodLabel"
                tick={{ fontSize: 11 }}
                angle={-20}
                textAnchor="end"
                height={60}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tickFormatter={(value) => `€${value}`}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
              />
              <Bar dataKey="Omzet" fill="hsl(var(--primary))" opacity={0.8} radius={[2, 2, 0, 0]} />
              <Bar
                dataKey="Kosten"
                fill="hsl(var(--muted-foreground))"
                opacity={0.4}
                radius={[2, 2, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="Marge"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                dot={{ fill: "hsl(142, 76%, 36%)", r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center py-12 text-muted-foreground">
            Nog geen historische data
          </p>
        )}
      </div>

      {/* Period-based Results */}
      <div className="border-t border-border pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-serif font-medium">Resultaten per periode</h3>
            <p className="text-sm text-muted-foreground">
              Per {periodView === "week" ? "week" : "maand"}
            </p>
          </div>
          <Tabs value={periodView} onValueChange={(v) => setPeriodView(v as "week" | "month")}>
            <TabsList>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Maand</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Periode
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  #
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Omzet
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Kosten
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Marge
                </th>
                <th className="text-right py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Gem.
                </th>
              </tr>
            </thead>
            <tbody>
              {periodStats
                .slice()
                .reverse()
                .map((period) => (
                  <tr key={period.period} className="border-b border-border/50 last:border-0">
                    <td className="py-3 px-0 text-foreground">{period.periodLabel}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                      {period.orders}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium">
                      {formatCurrency(period.revenue)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(period.cost)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`tabular-nums font-medium ${
                          period.marginPercentage >= 60
                            ? "text-emerald-600"
                            : period.marginPercentage >= 30
                              ? "text-orange-600"
                              : "text-red-600"
                        }`}
                      >
                        {formatCurrency(period.margin)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({period.marginPercentage.toFixed(0)}%)
                      </span>
                    </td>
                    <td className="py-3 px-0 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(period.avgOrderValue)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {periodStats.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">Nog geen bestellingen</p>
        )}
      </div>
    </div>
  );
};

export default FinancialOverview;
