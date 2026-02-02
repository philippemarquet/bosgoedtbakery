import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, ExternalLink, Eye } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
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
  { value: "confirmed", label: "Bevestigd", color: "blue" },
  { value: "in_production", label: "In productie", color: "orange" },
  { value: "ready", label: "Gereed", color: "purple" },
  { value: "paid", label: "Betaald", color: "emerald" },
] as const;

const CustomerOrdersTab = () => {
  const { user } = useAuth();
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

    // 1) Orders (incl weekly_menu_id), geen nested weekly_menus join meer
    const { data: ordersData, error: ordersErr } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        notes,
        subtotal,
        discount_amount,
        total,
        created_at,
        updated_at,
        pickup_location_id,
        invoice_date,
        weekly_menu_id,
        pickup_location:pickup_locations (
          id,
          title
        )
      `)
      .eq("customer_id", profile.id)
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (ordersErr) {
      console.error("Orders fetch error:", ordersErr);
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

    // 2) Items + products
    const { data: itemsData, error: itemsErr } = await supabase
      .from("order_items")
      .select(`
        id,
        order_id,
        product_id,
        quantity,
        unit_price,
        discount_amount,
        total,
        is_weekly_menu_item,
        product:products (
          id,
          name,
          image_url
        )
      `)
      .in("order_id", orderIds);

    if (itemsErr) {
      console.error("Order items fetch error:", itemsErr);
      toast({
        title: "Let op",
        description: "Bestellingen geladen, maar productdetails konden niet worden opgehaald.",
        variant: "destructive",
      });
    }

    const items = (itemsData || []) as OrderItem[];
    const itemsByOrderId: Record<string, OrderItem[]> = {};
    for (const it of items) {
      if (!itemsByOrderId[it.order_id]) itemsByOrderId[it.order_id] = [];
      itemsByOrderId[it.order_id].push(it);
    }

    // 3) Weekly menus apart ophalen
    const menuIds = Array.from(
      new Set(baseOrders.map((o) => o.weekly_menu_id).filter(Boolean))
    ) as string[];

    let menusById: Record<string, WeeklyMenu> = {};
    if (menuIds.length > 0) {
      const { data: menusData, error: menusErr } = await supabase
        .from("weekly_menus")
        .select("id, name, delivery_date, week_start_date, week_end_date, price, description")
        .in("id", menuIds);

      if (menusErr) {
        console.error("Weekly menus fetch error:", menusErr);
        toast({
          title: "Let op",
          description: "Weekmenu informatie kon niet worden geladen (rechten?).",
          variant: "destructive",
        });
      } else {
        for (const m of menusData || []) {
          menusById[m.id] = m as WeeklyMenu;
        }
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
      const matchesSearch = menuName.includes(query) || o.order_number.toString().includes(query);
      const matchesStatus = o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const getOrderCountByStatus = (status: string) => orders.filter((o) => o.status === status).length;

  const openOrderDialog = (order: Order) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const generatePaymentLink = (order: Order) => {
    const amount = order.total.toFixed(2);
    return `https://bunq.me/BosgoedtBakery/${amount}/${order.order_number}`;
  };

  const openPaymentLink = (order: Order) => window.open(generatePaymentLink(order), "_blank");

  const formatCurrency = (value: number) => `€${value.toFixed(2)}`;

  const getStatusBadge = (status: string) => {
    const statusConfig = ORDER_STATUSES.find((s) => s.value === status);
    if (!statusConfig) return <Badge variant="secondary">{status}</Badge>;

    const colorClasses: Record<string, string> = {
      blue: "bg-blue-500 hover:bg-blue-600 text-white",
      orange: "bg-orange-500 hover:bg-orange-600 text-white",
      purple: "bg-purple-500 hover:bg-purple-600 text-white",
      emerald: "bg-emerald-600 hover:bg-emerald-700 text-white",
    };

    return (
      <Badge variant="default" className={colorClasses[statusConfig.color] || ""}>
        {statusConfig.label}
      </Badge>
    );
  };

  const canEditOrder = (order: Order) => order.status === "confirmed";
  const needsPayment = (order: Order) => order.status !== "paid";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op ordernummer of weekmenu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="flex-wrap">
            {ORDER_STATUSES.map((status) => (
              <TabsTrigger key={status.value} value={status.value} className="text-xs sm:text-sm">
                {status.label} ({getOrderCountByStatus(status.value)})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Order
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Datum
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                Weekmenu
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Totaal
              </th>
              <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                Status
              </th>
              <th className="w-32"></th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  Laden...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  Geen bestellingen gevonden
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-4 px-0">
                    <span className="text-foreground text-sm font-medium tabular-nums">
                      #{order.order_number}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-muted-foreground tabular-nums text-sm font-light">
                    {format(parseISO(order.invoice_date), "d MMM yyyy", { locale: nl })}
                  </td>
                  <td className="py-4 px-4 hidden md:table-cell">
                    {order.weekly_menu ? (
                      <span className="text-foreground text-sm font-light">{order.weekly_menu.name}</span>
                    ) : order.weekly_menu_id ? (
                      <span className="text-muted-foreground text-sm font-light">Weekmenu (details niet geladen)</span>
                    ) : (
                      <span className="text-muted-foreground text-sm font-light">Losse producten</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right tabular-nums font-medium text-sm">
                    {formatCurrency(order.total)}
                  </td>
                  <td className="py-4 px-4 text-center hidden sm:table-cell">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="py-4 px-0">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openOrderDialog(order)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        {canEditOrder(order) ? "Bekijk" : "Details"}
                      </Button>

                      {needsPayment(order) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPaymentLink(order)}
                          className="text-primary hover:text-primary"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
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
