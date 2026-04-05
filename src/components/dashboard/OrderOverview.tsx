import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Search, ShoppingCart, MapPin, MessageCircle, Banknote, StickyNote } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import OrderDialog from "./OrderDialog";
import PickupLocationsTab from "@/components/backoffice/PickupLocationsTab";
import WhatsAppSettingsTab from "./WhatsAppSettingsTab";
import TransactionsTab from "./TransactionsTab";

type SortOption = "date-desc" | "date-asc" | "customer-asc" | "customer-desc";
type GroupOption = "none" | "date" | "customer";

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
    phone: string | null;
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
  { value: "in_production", label: "In productie", color: "orange" },
  { value: "ready", label: "Gereed", color: "purple" },
  { value: "paid", label: "Betaald", color: "emerald" },
] as const;

// Extracted OrderRow component for reusability
interface OrderRowProps {
  order: Order;
  isMobile: boolean;
  isMatched: boolean;
  onEdit: (order: Order) => void;
  onDelete: (id: string) => void;
  onStatusChange: (orderId: string, newStatus: string) => void;
  onWhatsApp: (order: Order) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  formatCurrency: (value: number) => string;
}

const OrderRow = ({ 
  order, 
  isMobile, 
  isMatched,
  onEdit, 
  onDelete, 
  onStatusChange, 
  onWhatsApp,
  getStatusBadge,
  formatCurrency 
}: OrderRowProps) => {
  if (isMobile) {
    return (
      <tr 
        className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => onEdit(order)}
      >
        <td className="py-3 px-0">
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground text-sm font-light">
              {order.customer?.full_name || "Onbekend"}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(parseISO(order.invoice_date), "d MMM", { locale: nl })}
            </span>
          </div>
        </td>
        <td className="py-3 px-2 text-right tabular-nums font-medium text-sm">
          {formatCurrency(order.total)}
        </td>
        <td className="py-3 px-1" onClick={(e) => e.stopPropagation()}>
          <Select
            value={order.status}
            onValueChange={(value) => onStatusChange(order.id, value)}
          >
            <SelectTrigger className="w-auto h-7 border-0 bg-transparent px-0 focus:ring-0">
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
        <td className="py-3 px-0 w-10" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end gap-0.5">
            {order.notes && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="p-1.5 text-amber-500 hover:text-amber-600 transition-colors"
                    title="Notities bekijken"
                  >
                    <StickyNote className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 text-sm" side="left">
                  <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">Notities</p>
                  <p className="text-foreground whitespace-pre-wrap">{order.notes}</p>
                </PopoverContent>
              </Popover>
            )}
            {(order.status === "ready" || order.status === "in_production") && (
              <button
                onClick={() => onWhatsApp(order)}
                className="p-1.5 text-green-500 hover:text-green-700 transition-colors"
                title="WhatsApp openen"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-4 px-0">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-sm font-light">
            {order.customer?.full_name || "Onbekend"}
          </span>
          {order.notes && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="p-0.5 text-amber-500 hover:text-amber-600 transition-colors"
                  title="Notities bekijken"
                >
                  <StickyNote className="w-3.5 h-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 text-sm">
                <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-1">Notities</p>
                <p className="text-foreground whitespace-pre-wrap">{order.notes}</p>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </td>
      <td className="py-4 px-4 text-muted-foreground tabular-nums text-sm font-light">
        {format(parseISO(order.invoice_date), "d MMM", { locale: nl })}
      </td>
      <td className="py-4 px-4">
        {order.weekly_menu ? (
          <span className="text-foreground text-sm font-light">{order.weekly_menu.name}</span>
        ) : (
          <span className="text-muted-foreground text-sm font-light">—</span>
        )}
      </td>
      <td className="py-4 px-4 text-right tabular-nums font-medium text-sm">
        {formatCurrency(order.total)}
      </td>
      <td className="py-4 px-4">
        <Select
          value={order.status}
          onValueChange={(value) => onStatusChange(order.id, value)}
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
      <td className="py-4 px-0">
        <div className="flex justify-end gap-1">
          {(order.status === "ready" || order.status === "in_production") && (
            <button
              onClick={() => onWhatsApp(order)}
              className="p-2 text-green-500 hover:text-green-700 transition-colors"
              title="WhatsApp openen"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onEdit(order)}
            className="p-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(order.id)}
            className="p-2 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

const OrderOverview = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [matchedOrderIds, setMatchedOrderIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState("orders");
  const [statusFilter, setStatusFilter] = useState<string>("confirmed");
  const [sortOption, setSortOption] = useState<SortOption>("date-desc");
  const [groupOption, setGroupOption] = useState<GroupOption>("none");
  const [whatsappTemplate, setWhatsappTemplate] = useState("");
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const fetchOrders = async () => {
    setLoading(true);

    const [ordersResult, paymentsResult] = await Promise.all([
      supabase
        .from("orders")
        .select(`
          *,
          customer:profiles!orders_customer_id_fkey(id, full_name, phone),
          weekly_menu:weekly_menus(id, name, delivery_date),
          pickup_location:pickup_locations(id, title)
        `)
        .order("created_at", { ascending: false }),
      supabase
        .from("payment_logs")
        .select("order_id")
        .eq("status", "matched")
        .not("order_id", "is", null),
    ]);

    if (ordersResult.error) {
      toast({ title: "Fout", description: "Kon bestellingen niet laden", variant: "destructive" });
      setLoading(false);
      return;
    }

    const matched = new Set<string>();
    (paymentsResult.data || []).forEach((p: any) => { if (p.order_id) matched.add(p.order_id); });
    setMatchedOrderIds(matched);

    setOrders(ordersResult.data || []);
    setLoading(false);
  };

  const fetchWhatsAppTemplate = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "whatsapp_message_template")
      .single();
    
    if (data) {
      setWhatsappTemplate(data.value);
    }
  };

  const refreshOrders = useCallback(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchWhatsAppTemplate();
  }, []);

  // Refresh data when tab becomes visible again
  useVisibilityRefresh(refreshOrders);

  // Filter, sort, and group orders
  const { processedOrders, groupedOrders } = useMemo(() => {
    // First filter
    let filtered = orders.filter((o) => {
      const customerName = o.customer?.full_name?.toLowerCase() || "";
      const menuName = o.weekly_menu?.name?.toLowerCase() || "";
      const query = searchQuery.toLowerCase();
      const matchesSearch = customerName.includes(query) || menuName.includes(query);
      const matchesStatus = o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    // Then sort
    filtered.sort((a, b) => {
      switch (sortOption) {
        case "date-desc":
          return new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime();
        case "date-asc":
          return new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime();
        case "customer-asc":
          return (a.customer?.full_name || "").localeCompare(b.customer?.full_name || "");
        case "customer-desc":
          return (b.customer?.full_name || "").localeCompare(a.customer?.full_name || "");
        default:
          return 0;
      }
    });

    // Group if needed
    if (groupOption === "none") {
      return { processedOrders: filtered, groupedOrders: null };
    }

    const groups: Record<string, Order[]> = {};
    filtered.forEach((order) => {
      let key: string;
      if (groupOption === "date") {
        key = format(parseISO(order.invoice_date), "EEEE d MMMM yyyy", { locale: nl });
      } else {
        key = order.customer?.full_name || "Onbekend";
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    });

    // Sort group keys
    const sortedGroups: Record<string, Order[]> = {};
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (groupOption === "date") {
        // For date grouping, use the first order's date in each group
        const dateA = groups[a][0]?.invoice_date || "";
        const dateB = groups[b][0]?.invoice_date || "";
        return sortOption.includes("desc") 
          ? new Date(dateB).getTime() - new Date(dateA).getTime()
          : new Date(dateA).getTime() - new Date(dateB).getTime();
      }
      return sortOption.includes("desc") ? b.localeCompare(a) : a.localeCompare(b);
    });
    sortedKeys.forEach(key => {
      sortedGroups[key] = groups[key];
    });

    return { processedOrders: filtered, groupedOrders: sortedGroups };
  }, [orders, searchQuery, statusFilter, sortOption, groupOption]);

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

  const openWhatsApp = (order: Order) => {
    const phone = order.customer?.phone;
    if (!phone) {
      toast({ title: "Fout", description: "Klant heeft geen telefoonnummer", variant: "destructive" });
      return;
    }

    // Clean phone number (remove spaces, dashes, etc.) and ensure it starts with country code
    let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    // Remove leading 0 if present and add +31 for Dutch numbers
    if (cleanPhone.startsWith('0') && !cleanPhone.startsWith('00')) {
      cleanPhone = '+31' + cleanPhone.substring(1);
    }
    // Remove leading + for wa.me format
    cleanPhone = cleanPhone.replace(/^\+/, '');

    const paymentLink = generatePaymentLink(order);
    const message = whatsappTemplate.replace('{{betaallink}}', paymentLink);
    const encodedMessage = encodeURIComponent(message);
    
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = ORDER_STATUSES.find(s => s.value === status);
    if (!statusConfig) return <Badge variant="secondary">{status}</Badge>;

    const colorClasses: Record<string, string> = {
      blue: "bg-blue-500 hover:bg-blue-600 text-white",
      orange: "bg-orange-500 hover:bg-orange-600 text-white",
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
            <TabsTrigger value="transactions" className="gap-2">
              <Banknote className="w-4 h-4" />
              Transacties
            </TabsTrigger>
            <TabsTrigger value="pickup-locations" className="gap-2">
              <MapPin className="w-4 h-4" />
              Afhaallocaties
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              WhatsApp
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

              {/* Sort & Group Options - only for paid orders */}
              {statusFilter === "paid" && !isMobile && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">Sorteer</span>
                    <Select value={sortOption} onValueChange={(val) => setSortOption(val as SortOption)}>
                      <SelectTrigger className="h-8 w-auto min-w-[120px] border-0 bg-transparent px-2 text-sm font-light hover:bg-muted/50 focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="date-desc">Datum ↓</SelectItem>
                        <SelectItem value="date-asc">Datum ↑</SelectItem>
                        <SelectItem value="customer-asc">Klant A-Z</SelectItem>
                        <SelectItem value="customer-desc">Klant Z-A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">Groepeer</span>
                    <Select value={groupOption} onValueChange={(val) => setGroupOption(val as GroupOption)}>
                      <SelectTrigger className="h-8 w-auto min-w-[100px] border-0 bg-transparent px-2 text-sm font-light hover:bg-muted/50 focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start">
                        <SelectItem value="none">Geen</SelectItem>
                        <SelectItem value="date">Op datum</SelectItem>
                        <SelectItem value="customer">Op klant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">Klant</th>
                    {!isMobile && <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Datum</th>}
                    {!isMobile && <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Menu</th>}
                    <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Totaal</th>
                    <th className="text-left py-3 px-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">{isMobile ? "" : "Status"}</th>
                    <th className="text-right py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider w-10 sm:w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isMobile ? 4 : 6} className="text-center py-12 text-muted-foreground">
                        Laden...
                      </td>
                    </tr>
                  ) : processedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={isMobile ? 4 : 6} className="text-center py-12 text-muted-foreground">
                        <ShoppingCart className="w-6 h-6 mx-auto mb-2 opacity-50" />
                        {searchQuery ? "Geen bestellingen gevonden" : "Nog geen bestellingen"}
                      </td>
                    </tr>
                  ) : groupedOrders ? (
                    // Grouped view
                    Object.entries(groupedOrders).map(([groupKey, groupOrders]) => (
                      <>
                        <tr key={`group-${groupKey}`} className="bg-muted/50">
                          <td colSpan={isMobile ? 4 : 6} className="py-2 px-2">
                            <span className="font-medium text-sm">{groupKey}</span>
                            <span className="text-muted-foreground text-xs ml-2">
                              ({groupOrders.length} {groupOrders.length === 1 ? "bestelling" : "bestellingen"})
                            </span>
                          </td>
                        </tr>
                        {groupOrders.map((order) => (
                          <OrderRow 
                            key={order.id} 
                            order={order} 
                            isMobile={isMobile}
                            onEdit={openEditDialog}
                            onDelete={handleDelete}
                            onStatusChange={handleStatusChange}
                            onWhatsApp={openWhatsApp}
                            getStatusBadge={getStatusBadge}
                            formatCurrency={formatCurrency}
                          />
                        ))}
                      </>
                    ))
                  ) : (
                    // Flat view
                    processedOrders.map((order) => (
                      <OrderRow 
                        key={order.id} 
                        order={order} 
                        isMobile={isMobile}
                        onEdit={openEditDialog}
                        onDelete={handleDelete}
                        onStatusChange={handleStatusChange}
                        onWhatsApp={openWhatsApp}
                        getStatusBadge={getStatusBadge}
                        formatCurrency={formatCurrency}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {!isMobile && (
          <>
            <TabsContent value="transactions" className="mt-6">
              <TransactionsTab />
            </TabsContent>
            <TabsContent value="pickup-locations" className="mt-6">
              <PickupLocationsTab />
            </TabsContent>
            <TabsContent value="whatsapp" className="mt-6">
              <WhatsAppSettingsTab />
            </TabsContent>
          </>
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
