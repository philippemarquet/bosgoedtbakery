import { useState, useEffect, useMemo } from "react";
import { Package, TrendingUp, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ProductStats {
  product_id: string;
  product_name: string;
  category_name: string;
  total_quantity: number;
  total_orders: number;
  total_revenue: number;
}

const MetricCard = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="paper-card px-5 py-4">
    <p className="bakery-eyebrow mb-2">{label}</p>
    <p
      className="font-serif text-2xl md:text-3xl font-medium tabular-nums text-foreground leading-tight"
      style={{ letterSpacing: "-0.02em" }}
    >
      {value}
    </p>
    {hint && <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>}
  </div>
);

const ProductAnalysis = () => {
  const [productStats, setProductStats] = useState<ProductStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProductStats = async () => {
      setLoading(true);

      // order_items is single source of truth — legacy orders that once had a
      // weekly_menu_id still have all their items denormalised here, so no
      // special-casing needed.
      const { data: items } = await supabase.from("order_items").select(`
          product_id,
          quantity,
          total,
          order_id,
          product:products(name, category:categories(name))
        `);

      const statsMap = new Map<string, ProductStats>();
      const orderProductMap = new Map<string, Set<string>>();

      for (const item of items || []) {
        const existing = statsMap.get(item.product_id);
        if (existing) {
          existing.total_quantity += Number(item.quantity || 0);
          existing.total_revenue += Number(item.total || 0);
        } else {
          statsMap.set(item.product_id, {
            product_id: item.product_id,
            product_name: item.product?.name || "Onbekend",
            category_name: item.product?.category?.name || "Zonder categorie",
            total_quantity: Number(item.quantity || 0),
            total_orders: 0,
            total_revenue: Number(item.total || 0),
          });
        }

        if (!orderProductMap.has(item.product_id)) {
          orderProductMap.set(item.product_id, new Set());
        }
        orderProductMap.get(item.product_id)!.add(item.order_id);
      }

      // Fill in total_orders (unique orders per product).
      for (const [productId, orders] of orderProductMap) {
        const stat = statsMap.get(productId);
        if (stat) stat.total_orders = orders.size;
      }

      setProductStats(
        Array.from(statsMap.values()).sort(
          (a, b) => b.total_quantity - a.total_quantity,
        ),
      );

      setLoading(false);
    };
    fetchProductStats();
  }, []);

  const topProducts = productStats.slice(0, 10);
  const maxQuantity = topProducts[0]?.total_quantity || 1;

  const chartData = topProducts.slice(0, 8).map((p) => ({
    name:
      p.product_name.length > 15
        ? p.product_name.substring(0, 15) + "..."
        : p.product_name,
    quantity: p.total_quantity,
  }));

  const totalStats = useMemo(
    () => ({
      totalProducts: productStats.length,
      totalQuantity: productStats.reduce((sum, p) => sum + p.total_quantity, 0),
      totalRevenue: productStats.reduce((sum, p) => sum + p.total_revenue, 0),
    }),
    [productStats],
  );

  const formatCurrency = (value: number) => `€${value.toFixed(2)}`;

  const categoryStats = useMemo(() => {
    const catMap = new Map<string, { quantity: number; revenue: number }>();
    productStats.forEach((p) => {
      const existing = catMap.get(p.category_name);
      if (existing) {
        existing.quantity += p.total_quantity;
        existing.revenue += p.total_revenue;
      } else {
        catMap.set(p.category_name, {
          quantity: p.total_quantity,
          revenue: p.total_revenue,
        });
      }
    });
    return Array.from(catMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [productStats]);

  // Warm Japandi palette for chart bars
  const BAR_COLORS = [
    "hsl(var(--foreground))",
    "hsl(var(--ember))",
    "hsl(var(--clay))",
    "hsl(var(--sage))",
    "hsl(var(--stone))",
    "hsl(var(--foreground) / 0.65)",
    "hsl(var(--ember) / 0.7)",
    "hsl(var(--clay) / 0.7)",
  ];

  if (loading) {
    return (
      <div className="paper-card py-16 text-center">
        <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
        <p className="text-sm text-muted-foreground">Laden…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Unieke producten"
          value={String(totalStats.totalProducts)}
          hint="verkocht in totaal"
        />
        <MetricCard
          label="Totaal verkocht"
          value={String(totalStats.totalQuantity)}
          hint="stuks"
        />
        <MetricCard
          label="Productomzet"
          value={formatCurrency(totalStats.totalRevenue)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products Chart */}
        <div className="paper-card p-5 md:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
              <Award className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="bakery-eyebrow mb-1">Top 8</p>
              <h3
                className="font-serif text-xl font-medium text-foreground leading-tight"
                style={{ letterSpacing: "-0.02em" }}
              >
                Hardlopers
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Op aantal verkocht.</p>
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 0, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                />
                <Tooltip
                  formatter={(value: number) => [`${value} stuks`, "Verkocht"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                    boxShadow: "0 4px 16px -2px hsl(var(--ink) / 0.12)",
                  }}
                />
                <Bar dataKey="quantity" radius={[0, 3, 3, 0]}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-8 text-muted-foreground text-sm">Nog geen data</p>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="paper-card p-5 md:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="bakery-eyebrow mb-1">Verdeling</p>
              <h3
                className="font-serif text-xl font-medium text-foreground leading-tight"
                style={{ letterSpacing: "-0.02em" }}
              >
                Per categorie
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Verkoop per groep.</p>
            </div>
          </div>
          <div className="space-y-4">
            {categoryStats.map((cat, idx) => (
              <div key={cat.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: BAR_COLORS[idx % BAR_COLORS.length] }}
                    />
                    <span className="text-sm font-medium text-foreground">{cat.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {cat.quantity} stuks · {formatCurrency(cat.revenue)}
                  </div>
                </div>
                <Progress
                  value={(cat.quantity / (categoryStats[0]?.quantity || 1)) * 100}
                  className="h-1.5"
                />
              </div>
            ))}
            {categoryStats.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">Nog geen data</p>
            )}
          </div>
        </div>
      </div>

      {/* Full Product Table */}
      <div className="paper-card overflow-hidden">
        <div className="flex items-start gap-3 px-5 md:px-6 pt-5 pb-4 border-b border-border/50">
          <div className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="bakery-eyebrow mb-1">Overzicht</p>
            <h3
              className="font-serif text-xl font-medium text-foreground leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              Alle producten
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Gesorteerd op aantal verkocht.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-12 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  #
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Product
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Categorie
                </TableHead>
                <TableHead className="text-right text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Aantal
                </TableHead>
                <TableHead className="text-right text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Orders
                </TableHead>
                <TableHead className="text-right text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Omzet
                </TableHead>
                <TableHead className="w-32 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Populariteit
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productStats.map((product, idx) => (
                <TableRow key={product.product_id} className="border-b border-border/40 hover:bg-muted/40">
                  <TableCell className="py-3 pl-6">
                    {idx < 3 ? (
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 text-[11px] font-medium tabular-nums rounded-full ${
                          idx === 0
                            ? "bg-foreground text-background"
                            : "bg-muted/60 text-foreground ring-1 ring-inset ring-border/60"
                        }`}
                      >
                        {idx + 1}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm tabular-nums">{idx + 1}</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-foreground">{product.product_name}</TableCell>
                  <TableCell className="py-3">
                    <span className="inline-flex items-center px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground bg-muted/60 rounded-[calc(var(--radius)-4px)] ring-1 ring-inset ring-border/60">
                      {product.category_name}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm text-foreground tabular-nums font-medium">
                    {product.total_quantity}×
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm text-muted-foreground tabular-nums">
                    {product.total_orders}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm text-foreground tabular-nums font-medium">
                    {formatCurrency(product.total_revenue)}
                  </TableCell>
                  <TableCell className="py-3 pr-6">
                    <Progress
                      value={(product.total_quantity / maxQuantity) * 100}
                      className="h-1.5"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {productStats.length === 0 && (
          <p className="text-center py-12 text-muted-foreground text-sm">
            Nog geen producten verkocht
          </p>
        )}
      </div>
    </div>
  );
};

export default ProductAnalysis;
