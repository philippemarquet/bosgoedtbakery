import { useState, useEffect, useMemo } from "react";
import { Package, TrendingUp, Award, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface ProductStats {
  product_id: string;
  product_name: string;
  category_name: string;
  total_quantity: number;
  total_orders: number;
  total_revenue: number;
}

const ProductAnalysis = () => {
  const [productStats, setProductStats] = useState<ProductStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProductStats = async () => {
      setLoading(true);

      // Fetch all order items with product info
      const { data: items } = await supabase
        .from("order_items")
        .select(`
          product_id,
          quantity,
          total,
          order_id,
          product:products(name, category:categories(name))
        `);

      // Fetch all orders to get weekly menu info with price
      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, total, weekly_menu_id, weekly_menu:weekly_menus(price)");

      const statsMap = new Map<string, ProductStats>();
      const orderProductMap = new Map<string, Set<string>>();

      // Calculate totals per order from items to determine weekly menu portion
      const orderItemTotals = new Map<string, number>();
      if (items) {
        items.forEach(item => {
          const current = orderItemTotals.get(item.order_id) || 0;
          orderItemTotals.set(item.order_id, current + item.total);
        });
      }

      // Add individual product items
      if (items) {
        items.forEach(item => {
          const existing = statsMap.get(item.product_id);
          if (existing) {
            existing.total_quantity += item.quantity;
            existing.total_revenue += item.total;
          } else {
            statsMap.set(item.product_id, {
              product_id: item.product_id,
              product_name: item.product?.name || "Onbekend",
              category_name: item.product?.category?.name || "Zonder categorie",
              total_quantity: item.quantity,
              total_orders: 0,
              total_revenue: item.total,
            });
          }

          // Track unique orders per product
          if (!orderProductMap.has(item.product_id)) {
            orderProductMap.set(item.product_id, new Set());
          }
          orderProductMap.get(item.product_id)!.add(item.order_id);
        });
      }

      // Add weekly menu orders as "Weekmenu" product
      if (ordersData) {
        const weeklyMenuOrders = ordersData.filter(o => o.weekly_menu_id);
        if (weeklyMenuOrders.length > 0) {
          const weeklyMenuRevenue = weeklyMenuOrders.reduce((sum, order) => {
            // Use the weekly menu price from the joined data
            const menuPrice = (order.weekly_menu as { price: number } | null)?.price || 0;
            return sum + menuPrice;
          }, 0);

          statsMap.set("weekmenu", {
            product_id: "weekmenu",
            product_name: "Weekmenu",
            category_name: "Weekmenu's",
            total_quantity: weeklyMenuOrders.length,
            total_orders: weeklyMenuOrders.length,
            total_revenue: weeklyMenuRevenue,
          });
          orderProductMap.set("weekmenu", new Set(weeklyMenuOrders.map(o => o.id)));
        }
      }

      // Add order counts
      orderProductMap.forEach((orders, productId) => {
        const stat = statsMap.get(productId);
        if (stat && productId !== "weekmenu") {
          stat.total_orders = orders.size;
        }
      });

      setProductStats(
        Array.from(statsMap.values()).sort((a, b) => b.total_quantity - a.total_quantity)
      );

      setLoading(false);
    };
    fetchProductStats();
  }, []);

  const topProducts = productStats.slice(0, 10);
  const maxQuantity = topProducts[0]?.total_quantity || 1;

  const chartData = topProducts.slice(0, 8).map(p => ({
    name: p.product_name.length > 15 ? p.product_name.substring(0, 15) + "..." : p.product_name,
    quantity: p.total_quantity,
  }));

  const totalStats = useMemo(() => ({
    totalProducts: productStats.length,
    totalQuantity: productStats.reduce((sum, p) => sum + p.total_quantity, 0),
    totalRevenue: productStats.reduce((sum, p) => sum + p.total_revenue, 0),
  }), [productStats]);

  const formatCurrency = (value: number) => `€${value.toFixed(2)}`;

  const categoryStats = useMemo(() => {
    const catMap = new Map<string, { quantity: number; revenue: number }>();
    productStats.forEach(p => {
      const existing = catMap.get(p.category_name);
      if (existing) {
        existing.quantity += p.total_quantity;
        existing.revenue += p.total_revenue;
      } else {
        catMap.set(p.category_name, { quantity: p.total_quantity, revenue: p.total_revenue });
      }
    });
    return Array.from(catMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [productStats]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unieke producten verkocht</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{totalStats.totalProducts}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Totaal stuks verkocht</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{totalStats.totalQuantity}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Totale productomzet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{formatCurrency(totalStats.totalRevenue)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Top 8 Hardlopers
            </CardTitle>
            <CardDescription>
              Meest verkochte producten op aantal
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => [`${value} stuks`, "Verkocht"]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="quantity" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-8 text-muted-foreground">Nog geen data</p>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Per categorie
            </CardTitle>
            <CardDescription>
              Verkoop verdeeld over categorieën
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryStats.map((cat, idx) => (
                <div key={cat.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="font-medium">{cat.name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {cat.quantity} stuks · {formatCurrency(cat.revenue)}
                    </div>
                  </div>
                  <Progress 
                    value={(cat.quantity / (categoryStats[0]?.quantity || 1)) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
              {categoryStats.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">Nog geen data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Product Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Alle producten
          </CardTitle>
          <CardDescription>
            Gesorteerd op aantal verkocht
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Categorie</TableHead>
                <TableHead className="text-right">Aantal</TableHead>
                <TableHead className="text-right">Bestellingen</TableHead>
                <TableHead className="text-right">Omzet</TableHead>
                <TableHead className="w-32">Populariteit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productStats.map((product, idx) => (
                <TableRow key={product.product_id}>
                  <TableCell>
                    {idx < 3 ? (
                      <Badge variant={idx === 0 ? "default" : "secondary"} className={idx === 0 ? "bg-amber-500" : ""}>
                        {idx + 1}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{idx + 1}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.product_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{product.category_name}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{product.total_quantity}x</Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {product.total_orders}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(product.total_revenue)}
                  </TableCell>
                  <TableCell>
                    <Progress 
                      value={(product.total_quantity / maxQuantity) * 100} 
                      className="h-2"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {productStats.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">
              Nog geen producten verkocht
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductAnalysis;
