import { useState, useEffect, useMemo } from "react";
import { User, ShoppingCart, CreditCard, TrendingUp, Package, AlertCircle, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Customer {
  id: string;
  full_name: string | null;
}

interface OrderWithItems {
  id: string;
  status: string;
  total: number;
  created_at: string;
  weekly_menu: { name: string } | null;
}

interface ProductStats {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

const CustomerAnalysis = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [productStats, setProductStats] = useState<ProductStats[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all customers
  useEffect(() => {
    const fetchCustomers = async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_archived", false)
        .order("full_name");

      // Get baker user_ids to exclude
      const { data: bakerRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "baker");

      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, user_id")
        .eq("is_archived", false);

      const bakerUserIds = new Set(bakerRoles?.map(r => r.user_id) || []);
      const customerProfiles = (allProfiles || []).filter(p => 
        !p.user_id || !bakerUserIds.has(p.user_id)
      );

      setCustomers(customerProfiles.map(p => ({ id: p.id, full_name: p.full_name })));
    };
    fetchCustomers();
  }, []);

  // Fetch customer data when selected
  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!selectedCustomerId) {
        setOrders([]);
        setProductStats([]);
        return;
      }

      setLoading(true);

      // Fetch orders with weekly menu price
      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, status, total, created_at, weekly_menu_id, weekly_menu:weekly_menus(name, price)")
        .eq("customer_id", selectedCustomerId)
        .order("created_at", { ascending: false });

      setOrders(ordersData || []);

      // Fetch order items for product stats
      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id);
        const { data: items } = await supabase
          .from("order_items")
          .select("product_id, quantity, total, product:products(name)")
          .in("order_id", orderIds);

        const statsMap = new Map<string, ProductStats>();

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
                total_quantity: item.quantity,
                total_revenue: item.total,
              });
            }
          });
        }

        // Add weekly menu orders as "Weekmenu" product
        const weeklyMenuOrders = ordersData.filter(o => o.weekly_menu);
        if (weeklyMenuOrders.length > 0) {
          const weeklyMenuRevenue = weeklyMenuOrders.reduce((sum, o) => {
            // Use the weekly menu price from the joined data
            const menuPrice = (o.weekly_menu as { name: string; price: number } | null)?.price || 0;
            return sum + menuPrice;
          }, 0);

          statsMap.set("weekmenu", {
            product_id: "weekmenu",
            product_name: "Weekmenu",
            total_quantity: weeklyMenuOrders.length,
            total_revenue: weeklyMenuRevenue,
          });
        }

        setProductStats(
          Array.from(statsMap.values()).sort((a, b) => b.total_quantity - a.total_quantity)
        );
      } else {
        setProductStats([]);
      }

      setLoading(false);
    };
    fetchCustomerData();
  }, [selectedCustomerId]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const paidOrders = orders.filter(o => o.status === "paid");
    const openOrders = orders.filter(o => o.status !== "paid");
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const paidRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const openRevenue = openOrders.reduce((sum, o) => sum + o.total, 0);
    
    return {
      totalOrders,
      paidOrders: paidOrders.length,
      openOrders: openOrders.length,
      totalRevenue,
      paidRevenue,
      openRevenue,
    };
  }, [orders]);

  const formatCurrency = (value: number) => `€${value.toFixed(2)}`;

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; className: string }> = {
      confirmed: { label: "Bevestigd", variant: "default", className: "bg-blue-500" },
      ready: { label: "Gereed", variant: "default", className: "bg-purple-500" },
      paid: { label: "Betaald", variant: "default", className: "bg-emerald-600" },
    };
    const config = configs[status] || { label: status, variant: "secondary", className: "" };
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="space-y-6">
      {/* Customer Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Selecteer klant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Kies een klant om te analyseren" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.full_name || "Naamloos"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCustomerId && !loading && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Totaal bestellingen</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">{stats.totalOrders}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Totale omzet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Betaald
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(stats.paidRevenue)}
                </div>
                <p className="text-sm text-muted-foreground">{stats.paidOrders} bestellingen</p>
              </CardContent>
            </Card>

            <Card className={stats.openRevenue > 0 ? "border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20" : ""}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertCircle className={`w-4 h-4 ${stats.openRevenue > 0 ? "text-orange-600" : "text-muted-foreground"}`} />
                  Openstaand
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stats.openRevenue > 0 ? "text-orange-700 dark:text-orange-400" : ""}`}>
                  {formatCurrency(stats.openRevenue)}
                </div>
                <p className="text-sm text-muted-foreground">{stats.openOrders} bestellingen</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Order History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Bestelgeschiedenis
                </CardTitle>
                <CardDescription>
                  Alle bestellingen van {selectedCustomer?.full_name || "deze klant"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nog geen bestellingen
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Menu</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Totaal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.slice(0, 10).map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="text-sm">
                            {format(parseISO(order.created_at), "d MMM yyyy", { locale: nl })}
                          </TableCell>
                          <TableCell className="text-sm">
                            {order.weekly_menu?.name || "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(order.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {orders.length > 10 && (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    +{orders.length - 10} meer bestellingen
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Favorite Products */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Favoriete producten
                </CardTitle>
                <CardDescription>
                  Meest bestelde producten door {selectedCustomer?.full_name || "deze klant"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {productStats.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nog geen producten besteld
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Aantal</TableHead>
                        <TableHead className="text-right">Omzet</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productStats.slice(0, 10).map((stat, idx) => (
                        <TableRow key={stat.product_id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {idx < 3 && (
                                <Badge variant="outline" className="text-xs">
                                  #{idx + 1}
                                </Badge>
                              )}
                              {stat.product_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{stat.total_quantity}x</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(stat.total_revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
};

export default CustomerAnalysis;
