import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, ExternalLink, Eye } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import CustomerOrderDialog from "./CustomerOrderDialog";

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total: number;
  is_weekly_menu_item: boolean;
  product: { id: string; name: string; image_url?: string | null } | null;
}

interface WeeklyMenu {
  id: string;
  name: string;
  delivery_date: string | null;
  week_start_date: string;
  week_end_date: string;
  price: number;
  description: string | null;
}

interface Order {
  id: string;
  order_number: number;
  status: string;
  notes: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  created_at: string;
  updated_at: string;
  pickup_location_id: string | null;
  invoice_date: string;
  weekly_menu_id: string | null;
  weekly_menu: WeeklyMenu | null;
  pickup_location: { id: string; title: string } | null;
  items: OrderItem[];
}

const ORDER_STATUSES = [
  { value: "confirmed", label: "Bevestigd" },
  { value: "in_production", label: "In productie" },
  { value: "ready", label: "Gereed" },
  { value: "paid", label: "Betaald" },
] as const;

/** Status-chip — rustige tinten, subtiele ring. Geen felle kleurvlakken. */
const StatusChip = ({ status }: { status: string }) => {
  const cls: Record<string, string> = {
    confirmed: "bg-muted/50 text-foreground ring-1 ring-inset ring-border/70",
    in_production: "bg-[hsl(var(--ember))]/10 text-[hsl(var(--ember))] ring-1 ring-inset ring-[hsl(var(--ember))]/30",
    ready: "bg-accent/10 text-foreground ring-1 ring-inset ring-accent/40",
    paid: "bg-foreground text-background ring-1 ring-inset ring-foreground",
  };
  const label = ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium tracking-[0.02em]",
        cls[status] ?? "bg-muted/40 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
};

const CustomerOrdersTab = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("confirmed");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { toast } = useToast();

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data: ordersData, error: ordersErr } = await supabase
      .from("orders")
      .select(`
        id, order_number, status, notes, subtotal, discount_amount, total,
        created_at, updated_at, pickup_location_id, invoice_date, weekly_menu_id,
        pickup_location:pickup_locations ( id, title )
      `)
      .eq("customer_id", profile.id)
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (ordersErr) {
      toast({
        title: "Fout",
        description: ordersErr.message || "Kon bestellingen niet laden",
        variant: "destructive",
      });
      setOrders([]);
      setLoading(false);
      return;
    }

    const baseOrders: Order[] = (ordersData || []).map((o: any) => ({
      ...o,
      weekly_menu: null,
      items: [],
    }));

    if (baseOrders.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const orderIds = baseOrders.map((o) => o.id);

    const { data: itemsData } = await supabase
      .from("order_items")
      .select(
        `id, order_id, product_id, quantity, unit_price, discount_amount, total, is_weekly_menu_item, product:products ( id, name, image_url )`,
      )
      .in("order_id", orderIds);

    const items = (itemsData || []) as any as OrderItem[];
    const itemsByOrderId: Record<string, OrderItem[]> = {};
    for (const it of items) {
      if (!itemsByOrderId[it.order_id]) itemsByOrderId[it.order_id] = [];
      itemsByOrderId[it.order_id].push(it);
    }

    const menuIds = Array.from(
      new Set(baseOrders.map((o) => o.weekly_menu_id).filter(Boolean)),
    ) as string[];
    const menusById: Record<string, WeeklyMenu> = {};
    if (menuIds.length > 0) {
      const { data: menusData } = await supabase
        .from("weekly_menus")
        .select(
          "id, name, delivery_date, week_start_date, week_end_date, price, description",
        )
        .in("id", menuIds);
      for (const m of (menusData || []) as any[]) {
        menusById[m.id] = m as WeeklyMenu;
      }
    }

    const merged = baseOrders.map((o) => ({
      ...o,
      items: itemsByOrderId[o.id] || [],
      weekly_menu: o.weekly_menu_id ? menusById[o.weekly_menu_id] || null : null,
    }));

    setOrders(merged);
    setLoading(false);
  };

  const refreshOrders = useCallback(() => {
    fetchOrders();
  }, [user]);
  useEffect(() => {
    fetchOrders();
  }, [user]);
  useVisibilityRefresh(refreshOrders);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const menuName = o.weekly_menu?.name?.toLowerCase() || "";
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        menuName.includes(query) || o.order_number.toString().includes(query);
      const matchesStatus = o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const getOrderCountByStatus = (status: string) =>
    orders.filter((o) => o.status === status).length;
  const openOrderDialog = (order: Order) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };
  const generatePaymentLink = (order: Order) =>
    `https://bunq.me/BosgoedtBakery/${Number(order.total || 0).toFixed(2)}/${order.order_number}`;
  const formatCurrency = (value: number) => `€${Number(value || 0).toFixed(2)}`;

  const canEditOrder = (order: Order) => order.status === "confirmed";
  const needsPayment = (order: Order) => order.status === "ready";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op ordernummer…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="h-auto flex-wrap">
            {ORDER_STATUSES.map((status) => (
              <TabsTrigger key={status.value} value={status.value} className="text-xs sm:text-sm">
                {isMobile
                  ? `${status.label.split(" ")[0]} (${getOrderCountByStatus(status.value)})`
                  : `${status.label} · ${getOrderCountByStatus(status.value)}`}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Mobile: cards */}
      {isMobile ? (
        <div className="space-y-3">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Laden…</div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed border-border/70 bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
              Geen bestellingen gevonden
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="paper-card space-y-3 px-4 py-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    #{order.order_number}
                  </span>
                  <StatusChip status={order.status} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    {format(parseISO(order.invoice_date), "d MMM yyyy", { locale: nl })}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatCurrency(order.total)}
                  </span>
                </div>
                {order.weekly_menu && (
                  <p className="text-sm text-muted-foreground truncate">{order.weekly_menu.name}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openOrderDialog(order)}
                    className="flex-1"
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    {canEditOrder(order) ? "Bekijk" : "Details"}
                  </Button>
                  {needsPayment(order) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(generatePaymentLink(order), "_blank")}
                      className="flex-1"
                    >
                      <ExternalLink className="mr-1 h-4 w-4" />
                      Betalen
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Desktop: tabel */
        <div className="paper-card overflow-hidden">
          <div className="overflow-x-auto scroll-soft">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30">
                  <th className="py-3.5 px-5 text-left text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Order
                  </th>
                  <th className="py-3.5 px-4 text-left text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Datum
                  </th>
                  <th className="py-3.5 px-4 text-left text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Inhoud
                  </th>
                  <th className="py-3.5 px-4 text-right text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Totaal
                  </th>
                  <th className="py-3.5 px-4 text-left text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Status
                  </th>
                  <th className="py-3.5 px-5 w-40"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-sm text-muted-foreground">
                      Laden…
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-sm text-muted-foreground">
                      Geen bestellingen gevonden
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-border/50 last:border-0 transition-colors hover:bg-muted/30"
                    >
                      <td className="py-4 px-5">
                        <span className="text-sm font-medium tabular-nums text-foreground">
                          #{order.order_number}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground tabular-nums">
                        {format(parseISO(order.invoice_date), "d MMM yyyy", { locale: nl })}
                      </td>
                      <td className="py-4 px-4 text-sm text-foreground">
                        {order.weekly_menu ? (
                          order.weekly_menu.name
                        ) : order.weekly_menu_id ? (
                          <span className="text-muted-foreground">Weekmenu</span>
                        ) : (
                          <span className="text-muted-foreground">Losse producten</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right text-sm font-medium tabular-nums">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="py-4 px-4">
                        <StatusChip status={order.status} />
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openOrderDialog(order)}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            {canEditOrder(order) ? "Bekijk" : "Details"}
                          </Button>
                          {needsPayment(order) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                window.open(generatePaymentLink(order), "_blank")
                              }
                            >
                              <ExternalLink className="mr-1 h-4 w-4" />
                              Betalen
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CustomerOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        order={selectedOrder}
        onSave={fetchOrders}
      />
    </div>
  );
};

export default CustomerOrdersTab;
