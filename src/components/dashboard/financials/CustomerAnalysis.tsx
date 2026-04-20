import { useState, useEffect, useMemo } from "react";
import { User, ShoppingCart, Package } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
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

const StatusChip = ({ status }: { status: string }) => {
  const configs: Record<string, { label: string; cls: string }> = {
    confirmed: {
      label: "Bevestigd",
      cls: "bg-muted/60 text-foreground ring-border/70",
    },
    in_production: {
      label: "In productie",
      cls: "bg-[hsl(var(--ember))]/10 text-[hsl(var(--ember))] ring-[hsl(var(--ember))]/30",
    },
    ready: {
      label: "Gereed",
      cls: "bg-accent/10 text-foreground ring-accent/40",
    },
    paid: {
      label: "Betaald",
      cls: "bg-foreground text-background ring-foreground",
    },
  };
  const config = configs[status] || {
    label: status,
    cls: "bg-muted/60 text-muted-foreground ring-border/60",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] uppercase rounded-[calc(var(--radius)-4px)] ring-1 ring-inset ${config.cls}`}
    >
      {config.label}
    </span>
  );
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

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="space-y-6">
      {/* Customer Selector */}
      <div className="paper-card p-5 md:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="bakery-eyebrow mb-1">Analyse</p>
            <h3
              className="font-serif text-xl font-medium text-foreground leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              Selecteer klant
            </h3>
          </div>
        </div>
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
      </div>

      {selectedCustomerId && !loading && (
        <>
          {/* Stats overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Bestellingen"
              value={String(stats.totalOrders)}
            />
            <MetricCard
              label="Totale omzet"
              value={formatCurrency(stats.totalRevenue)}
            />
            <MetricCard
              label="Betaald"
              value={formatCurrency(stats.paidRevenue)}
              hint={`${stats.paidOrders} bestellingen`}
            />
            <MetricCard
              label="Openstaand"
              value={formatCurrency(stats.openRevenue)}
              valueClass={stats.openRevenue > 0 ? "text-[hsl(var(--ember))]" : "text-foreground"}
              hint={`${stats.openOrders} bestellingen`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Order History */}
            <div className="paper-card overflow-hidden">
              <div className="flex items-start gap-3 px-5 md:px-6 pt-5 pb-4 border-b border-border/50">
                <div className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="bakery-eyebrow mb-1">Geschiedenis</p>
                  <h3
                    className="font-serif text-xl font-medium text-foreground leading-tight"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    Bestellingen
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Van {selectedCustomer?.full_name || "deze klant"}.
                  </p>
                </div>
              </div>
              {orders.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground text-sm">
                  Nog geen bestellingen
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Datum
                      </TableHead>
                      <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="text-right text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Totaal
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.slice(0, 10).map((order) => (
                      <TableRow key={order.id} className="border-b border-border/40 hover:bg-muted/40">
                        <TableCell className="py-3 pl-6 text-sm text-foreground">
                          {format(parseISO(order.created_at), "d MMM yyyy", { locale: nl })}
                        </TableCell>
                        <TableCell className="py-3">
                          <StatusChip status={order.status} />
                        </TableCell>
                        <TableCell className="py-3 pr-6 text-right text-sm text-foreground tabular-nums font-medium">
                          {formatCurrency(Number(order.total || 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {orders.length > 10 && (
                <p className="text-center text-xs text-muted-foreground py-3 border-t border-border/40">
                  +{orders.length - 10} meer bestellingen
                </p>
              )}
            </div>

            {/* Favorite Products */}
            <div className="paper-card overflow-hidden">
              <div className="flex items-start gap-3 px-5 md:px-6 pt-5 pb-4 border-b border-border/50">
                <div className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="bakery-eyebrow mb-1">Favorieten</p>
                  <h3
                    className="font-serif text-xl font-medium text-foreground leading-tight"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    Producten
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Meest besteld door {selectedCustomer?.full_name || "deze klant"}.
                  </p>
                </div>
              </div>
              {productStats.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground text-sm">
                  Nog geen producten besteld
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Product
                      </TableHead>
                      <TableHead className="text-right text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Aantal
                      </TableHead>
                      <TableHead className="text-right text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Omzet
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productStats.slice(0, 10).map((stat, idx) => (
                      <TableRow key={stat.product_id} className="border-b border-border/40 hover:bg-muted/40">
                        <TableCell className="py-3 pl-6 text-sm text-foreground">
                          <div className="flex items-center gap-2">
                            {idx < 3 && (
                              <span
                                className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-medium tabular-nums rounded-full ${
                                  idx === 0
                                    ? "bg-foreground text-background"
                                    : "bg-muted/60 text-foreground ring-1 ring-inset ring-border/60"
                                }`}
                              >
                                {idx + 1}
                              </span>
                            )}
                            {stat.product_name}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm text-foreground tabular-nums font-medium">
                          {stat.total_quantity}×
                        </TableCell>
                        <TableCell className="py-3 pr-6 text-right text-sm text-foreground tabular-nums font-medium">
                          {formatCurrency(stat.total_revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </>
      )}

      {loading && (
        <div className="paper-card py-16 text-center">
          <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
          <p className="text-sm text-muted-foreground">Laden…</p>
        </div>
      )}
    </div>
  );
};

export default CustomerAnalysis;
