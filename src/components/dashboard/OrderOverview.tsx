import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, ShoppingCart, Calendar, User, MapPin, Settings, ExternalLink } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import OrderDialog from "./OrderDialog";
import PickupLocationsTab from "@/components/backoffice/PickupLocationsTab";

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
  customer: {
    id: string;
    full_name: string | null;
  } | null;
  weekly_menu: {
    id: string;
    name: string;
    delivery_date: string | null;
  } | null;
  pickup_location: {
    id: string;
    title: string;
  } | null;
}

const ORDER_STATUSES = [
  { value: "confirmed", label: "Bevestigd", color: "blue" },
  { value: "ready", label: "Gereed", color: "purple" },
  { value: "paid", label: "Betaald", color: "emerald" },
] as const;

const OrderOverview = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState("orders");
  const [statusFilter, setStatusFilter] = useState<string>("confirmed");
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const fetchOrders = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        customer:profiles!orders_customer_id_fkey(id, full_name),
        weekly_menu:weekly_menus(id, name, delivery_date),
        pickup_location:pickup_locations(id, title)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Fout", description: "Kon bestellingen niet laden", variant: "destructive" });
      setLoading(false);
      return;
    }

    setOrders(data || []);
    setLoading(false);
  };

  const refreshOrders = useCallback(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, []);

  // Refresh data when tab becomes visible again
  useVisibilityRefresh(refreshOrders);

  const filteredOrders = orders.filter((o) => {
    const customerName = o.customer?.full_name?.toLowerCase() || "";
    const menuName = o.weekly_menu?.name?.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    const matchesSearch = customerName.includes(query) || menuName.includes(query);
    const matchesStatus = o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getOrderCountByStatus = (status: string) => {
    return orders.filter(o => o.status === status).length;
  };

  const openCreateDialog = () => {
    setEditingOrder(null);
    setDialogOpen(true);
  };

  const openEditDialog = (order: Order) => {
    setEditingOrder(order);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Weet je zeker dat je deze bestelling wilt verwijderen?")) return;

    const { error } = await supabase.from("orders").delete().eq("id", id);

    if (error) {
      toast({ title: "Fout", description: "Kon bestelling niet verwijderen", variant: "destructive" });
      return;
    }
    toast({ title: "Verwijderd", description: "Bestelling verwijderd" });
    fetchOrders();
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId);

    if (error) {
      toast({ title: "Fout", description: "Kon status niet wijzigen", variant: "destructive" });
      return;
    }

    toast({ title: "Bijgewerkt", description: "Status gewijzigd" });
    fetchOrders();
  };

  const formatCurrency = (value: number) => `€${value.toFixed(2)}`;

  const generatePaymentLink = (order: Order) => {
    // Format: https://bunq.me/BosgoedtBakery/{total}/{order_number}
    const amount = order.total.toFixed(2).replace(',', '.');
    return `https://bunq.me/BosgoedtBakery/${amount}/${order.order_number}`;
  };

  const openPaymentLink = (order: Order) => {
    const link = generatePaymentLink(order);
    window.open(link, '_blank');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = ORDER_STATUSES.find(s => s.value === status);
    if (!statusConfig) return <Badge variant="secondary">{status}</Badge>;

    const colorClasses: Record<string, string> = {
      blue: "bg-blue-500 hover:bg-blue-600 text-white",
      purple: "bg-purple-500 hover:bg-purple-600 text-white",
      emerald: "bg-emerald-600 hover:bg-emerald-700 text-white",
    };

    return (
      <Badge 
        variant="default"
        className={colorClasses[statusConfig.color] || ""}
      >
        {statusConfig.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {!isMobile && (
          <TabsList>
            <TabsTrigger value="orders" className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              Bestellingen
            </TabsTrigger>
            <TabsTrigger value="pickup-locations" className="gap-2">
              <MapPin className="w-4 h-4" />
              Afhaallocaties
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="orders" className={isMobile ? "mt-0" : "mt-6"} forceMount={isMobile ? true : undefined} hidden={!isMobile && activeTab !== "orders"}>
          <div className="space-y-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Zoek op klant of weekmenu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {!isMobile && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nieuwe bestelling
                  </Button>
                )}
              </div>
              
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList>
                  {ORDER_STATUSES.map((status) => (
                    <TabsTrigger key={status.value} value={status.value} className="text-xs sm:text-sm">
                      {isMobile ? status.label : `${status.label} (${getOrderCountByStatus(status.value)})`}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">Klant</th>
                    {!isMobile && <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Datum</th>}
                    {!isMobile && <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Menu</th>}
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Totaal</th>
                    {!isMobile && <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>}
                    <th className="text-right py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isMobile ? 3 : 6} className="text-center py-12 text-muted-foreground">
                        Laden...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={isMobile ? 3 : 6} className="text-center py-12 text-muted-foreground">
                        <ShoppingCart className="w-6 h-6 mx-auto mb-2 opacity-50" />
                        {searchQuery ? "Geen bestellingen gevonden" : "Nog geen bestellingen"}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-0">
                          <div className="flex flex-col">
                            <span className="text-foreground text-sm font-light">
                              {order.customer?.full_name || "Onbekend"}
                            </span>
                            {isMobile && (
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(order.invoice_date), "d MMM", { locale: nl })}
                              </span>
                            )}
                          </div>
                        </td>
                        {!isMobile && (
                          <td className="py-4 px-4 text-muted-foreground tabular-nums text-sm font-light">
                            {format(parseISO(order.invoice_date), "d MMM", { locale: nl })}
                          </td>
                        )}
                        {!isMobile && (
                          <td className="py-4 px-4">
                            {order.weekly_menu ? (
                              <span className="text-foreground text-sm font-light">{order.weekly_menu.name}</span>
                            ) : (
                              <span className="text-muted-foreground text-sm font-light">—</span>
                            )}
                          </td>
                        )}
                        <td className="py-4 px-4 text-right tabular-nums font-medium text-sm">
                          {formatCurrency(order.total)}
                        </td>
                        {!isMobile && (
                          <td className="py-4 px-4">
                            <Select
                              value={order.status}
                              onValueChange={(value) => handleStatusChange(order.id, value)}
                            >
                              <SelectTrigger className="w-28 h-8 border-0 bg-transparent px-0 focus:ring-0">
                                <SelectValue>
                                  {getStatusBadge(order.status)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {ORDER_STATUSES.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        )}
                        <td className="py-4 px-0">
                          <div className="flex justify-end gap-1">
                            {order.status === "ready" && (
                              <button
                                onClick={() => openPaymentLink(order)}
                                className="p-2 text-purple-500 hover:text-purple-700 transition-colors"
                                title="Betaallink openen"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                            {!isMobile && (
                              <>
                                <button
                                  onClick={() => openEditDialog(order)}
                                  className="p-2 text-muted-foreground hover:text-primary transition-colors"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(order.id)}
                                  className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
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
        </TabsContent>

        {!isMobile && (
          <TabsContent value="pickup-locations" className="mt-6">
            <PickupLocationsTab />
          </TabsContent>
        )}
      </Tabs>

      <OrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingOrder={editingOrder}
        onSave={fetchOrders}
      />
    </div>
  );
};

export default OrderOverview;
