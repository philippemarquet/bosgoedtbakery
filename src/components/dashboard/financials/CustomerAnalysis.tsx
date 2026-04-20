import { useState, useEffect, useMemo } from "react";
import { User, ShoppingCart, Package } from "lucide-react";
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
      // Get baker user_ids to exclude
      const { data: bakerRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "baker");

      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, user_id")
        .eq("is_archived", false)
        .order("full_name");

      const bakerUserIds = new Set(bakerRoles?.map((r) => r.user_id) || []);
      const customerProfiles = (allProfiles || []).filter(
        (p) => !p.user_id || !bakerUserIds.has(p.user_id),
      );

      setCustomers(customerProfiles.map((p) => ({ id: p.id, full_name: p.full_name })));
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

      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, status, total, created_at")
        .eq("customer_id", selectedCustomerId)
        .order("created_at", { ascending: false });

      setOrders(ordersData || []);

      // order_items is the single source of truth — legacy orders that once
      // pointed at a weekly_menu still have their items denormalised here,
      // so no special-casing needed.
      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map((o) => o.id);
        const { data: items } = await supabase
          .from("order_items")
          .select("product_id, quantity, total, product:products(name)")
          .in("order_id", orderIds);

        const statsMap = new Map<string, ProductStats>();

        for (const item of items || []) {
          const existing = statsMap.get(item.product_id);
          if (existing) {
            existing.total_quantity += Number(item.quantity || 0);
            existing.total_revenue += Number(item.total || 0);
          } else {
            statsMap.set(item.product_id, {
              product_id: item.product_id,
              product_name: item.product?.name || "Onbekend",
              total_quantity: Number(item.quantity || 0),
              total_revenue: Number(item.total || 0),
            });
          }
        }

        setProductStats(
          Array.from(statsMap.values()).sort(
            (a, b) => b.total_quantity - a.total_quantity,
          ),
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
    const paidOrders = orders.filter((o) => o.status === "paid");
    const openOrders = orders.filter((o) => o.status !== "paid");
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const paidRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const openRevenue = openOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

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
    const configs: Record<
      string,
      { label: string; variant: "default" | "secondary" | "destructive"; className: string }
    > = {
      confirmed: { label: "Bevestigd", variant: "default", className: "bg-blue-500" },
      ready: { label: "Gereed", variant: "default", className: "bg-purple-500" },
      paid: { label: "Betaald", variant: "default", className: "bg-emerald-600" },
    };
    const config = configs[status] || { label: status, variant: "secondary", className: "" };
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

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
          {/* Stats Overview - Clean minimal layout */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Bestellingen
              </p>
              <p className="text-2xl font-light tabular-nums">{stats.totalOrders}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Totale omzet
              </p>
              <p className="text-2xl font-light tabular-nums">
                {formatCurrency(stats.totalRevenue)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Betaald
              </p>
              <p className="text-2xl font-light tabular-nums text-emerald-600">
                {formatCurrency(stats.paidRevenue)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stats.paidOrders} bestellingen</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Openstaand
              </p>
              <p
                className={`text-2xl font-light tabular-nums ${
                  stats.openRevenue > 0 ? "text-orange-600" : ""
                }`}
              >
                {formatCurrency(stats.openRevenue)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stats.openOrders} bestellingen</p>
            </div>
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
                  <p className="text-center py-8 text-muted-foreground">Nog geen bestellingen</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
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
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(Number(order.total || 0))}
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
