import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, ShoppingCart, Calendar, User, MapPin, Settings } from "lucide-react";
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
  status: string;
  notes: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  created_at: string;
  updated_at: string;
  pickup_location_id: string | null;
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
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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

        <TabsContent value="orders" className="mt-4 space-y-4">
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
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Nieuwe bestelling
              </Button>
            </div>
            
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                {ORDER_STATUSES.map((status) => (
                  <TabsTrigger key={status.value} value={status.value}>
                    {status.label} ({getOrderCountByStatus(status.value)})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="bakery-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klant</TableHead>
                  <TableHead>Weekmenu / Leverdag</TableHead>
                  <TableHead className="text-right">Subtotaal</TableHead>
                  <TableHead className="text-right">Korting</TableHead>
                  <TableHead className="text-right">Totaal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="w-[100px]">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Laden...
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <ShoppingCart className="w-8 h-8 text-muted-foreground/50" />
                        {searchQuery ? "Geen bestellingen gevonden" : "Nog geen bestellingen. Maak er een aan!"}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {order.customer?.full_name || "Onbekende klant"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.weekly_menu ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <span className="font-medium">{order.weekly_menu.name}</span>
                              {order.weekly_menu.delivery_date && (
                                <p className="text-xs text-muted-foreground">
                                  {format(parseISO(order.weekly_menu.delivery_date), "EEEE d MMM", { locale: nl })}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Geen weekmenu</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(order.subtotal)}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {order.discount_amount > 0 ? `-${formatCurrency(order.discount_amount)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(order.total)}</TableCell>
                      <TableCell>
                        <Select
                          value={order.status}
                          onValueChange={(value) => handleStatusChange(order.id, value)}
                        >
                          <SelectTrigger className="w-[150px] h-8">
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
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(parseISO(order.created_at), "d MMM yyyy", { locale: nl })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(order)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(order.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pickup-locations" className="mt-4">
          <PickupLocationsTab />
        </TabsContent>
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
