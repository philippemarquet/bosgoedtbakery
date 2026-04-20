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

const marginColorClass = (pct: number): string => {
  if (pct >= 60) return "text-foreground";
  if (pct >= 30) return "text-[hsl(var(--ember))]";
  return "text-destructive";
};

const MetricCard = ({
  label,
  value,
  hint,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
}) => (
  <div className="paper-card px-5 py-4">
    <p className="bakery-eyebrow mb-2">{label}</p>
    <p
      className={`font-serif text-2xl md:text-3xl font-medium tabular-nums leading-tight ${
        valueClass ?? "text-foreground"
      }`}
      style={{ letterSpacing: "-0.02em" }}
    >
      {value}
    </p>
    {hint && <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>}
  </div>
);

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
          periodLabel: `W${format(start, "w")} · ${format(start, "d MMM", {
            locale: nl,
          })}`,
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
      <div className="paper-card py-16 text-center">
        <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
        <p className="text-sm text-muted-foreground">Laden…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          label="Totale omzet"
          value={formatCurrency(overallStats.totalRevenue)}
          hint={`${overallStats.totalOrders} bestellingen`}
        />
        <MetricCard
          label="Marge"
          value={formatCurrency(overallStats.totalMargin)}
          valueClass={marginColorClass(overallStats.marginPercentage)}
          hint={`${overallStats.marginPercentage.toFixed(1)}%`}
        />
        <MetricCard
          label="Ontvangen"
          value={formatCurrency(overallStats.paidRevenue)}
          hint={`${overallStats.paidOrders} betaald`}
        />
        <MetricCard
          label="Openstaand"
          value={formatCurrency(overallStats.openRevenue)}
          valueClass={overallStats.openRevenue > 0 ? "text-[hsl(var(--ember))]" : "text-foreground"}
          hint={`${overallStats.totalOrders - overallStats.paidOrders} open`}
        />
        <MetricCard
          label="Gem. bestelling"
          value={formatCurrency(overallStats.avgOrderValue)}
          hint={`${formatCurrency(overallStats.totalDiscounts)} korting`}
        />
      </div>

      {/* Revenue & Margin Chart */}
      <div className="paper-card p-5 md:p-6">
        <div className="mb-5">
          <p className="bakery-eyebrow mb-1.5">Grafiek</p>
          <h3
            className="font-serif text-xl md:text-2xl font-medium text-foreground leading-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            Omzet &amp; marge
          </h3>
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
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                angle={-20}
                textAnchor="end"
                height={60}
                stroke="hsl(var(--border))"
              />
              <YAxis
                tickFormatter={(value) => `€${value}`}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                  boxShadow: "0 4px 16px -2px hsl(var(--ink) / 0.12)",
                }}
              />
              <Bar dataKey="Omzet" fill="hsl(var(--foreground))" opacity={0.85} radius={[2, 2, 0, 0]} />
              <Bar
                dataKey="Kosten"
                fill="hsl(var(--muted-foreground))"
                opacity={0.35}
                radius={[2, 2, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="Marge"
                stroke="hsl(var(--ember))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--ember))", r: 3, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center py-12 text-muted-foreground text-sm">
            Nog geen historische data
          </p>
        )}
      </div>

      {/* Period-based Results */}
      <div className="paper-card p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="bakery-eyebrow mb-1.5">Overzicht</p>
            <h3
              className="font-serif text-xl md:text-2xl font-medium text-foreground leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              Resultaten per {periodView === "week" ? "week" : "maand"}
            </h3>
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
              <tr className="border-b border-border/60">
                <th className="text-left py-3 px-0 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em]">
                  Periode
                </th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em]">
                  #
                </th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em]">
                  Omzet
                </th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em]">
                  Kosten
                </th>
                <th className="text-right py-3 px-4 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em]">
                  Marge
                </th>
                <th className="text-right py-3 px-0 text-[11px] font-medium text-muted-foreground uppercase tracking-[0.08em]">
                  Gem.
                </th>
              </tr>
            </thead>
            <tbody>
              {periodStats
                .slice()
                .reverse()
                .map((period) => (
                  <tr key={period.period} className="border-b border-border/40 last:border-0">
                    <td className="py-3 px-0 text-sm text-foreground">{period.periodLabel}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground text-sm">
                      {period.orders}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium text-foreground text-sm">
                      {formatCurrency(period.revenue)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground text-sm">
                      {formatCurrency(period.cost)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`tabular-nums font-medium text-sm ${marginColorClass(period.marginPercentage)}`}
                      >
                        {formatCurrency(period.margin)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({period.marginPercentage.toFixed(0)}%)
                      </span>
                    </td>
                    <td className="py-3 px-0 text-right tabular-nums text-muted-foreground text-sm">
                      {formatCurrency(period.avgOrderValue)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {periodStats.length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-sm">Nog geen bestellingen</p>
        )}
      </div>
    </div>
  );
};

export default FinancialOverview;
