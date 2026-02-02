import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  Calendar,
  Package,
  MapPin,
  Image as ImageIcon,
  Lock,
  Hash,
  ExternalLink,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  total: number;
  is_weekly_menu_item: boolean;
  product: { id: string; name: string; image_url?: string | null } | null;
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
  invoice_date: string;
  pickup_location_id: string | null;

  weekly_menu: {
    id: string;
    name: string;
    delivery_date: string | null;
    week_start_date?: string;
    week_end_date?: string;
    price?: number;
    description?: string | null;
  } | null;

  pickup_location?: { id: string; title: string } | null;

  items: OrderItem[];
}

interface Product {
  id: string;
  name: string;
  selling_price: number;
  category_name?: string;
  image_url?: string | null;
}

interface PickupLocation {
  id: string;
  title: string;
  street: string;
  house_number: string | null;
  postal_code: string;
  city: string;
}

interface CustomerOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onSave: () => void;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  confirmed: "Bevestigd",
  in_production: "In productie",
  ready: "Gereed",
  paid: "Betaald",
};

const CustomerOrderDialog = ({ open, onOpenChange, order, onSave }: CustomerOrderDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);

  const [selectedPickupLocationId, setSelectedPickupLocationId] = useState<string>("");
  const [customPickupLocation, setCustomPickupLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [extraItems, setExtraItems] = useState<{ product_id: string; quantity: number }[]>([]);

  const { toast } = useToast();

  const canEdit = order?.status === "confirmed";
  const isReadOnly = !canEdit;

  // Fetch products (only needed for editable mode)
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, selling_price, image_url, category:categories(name)")
        .eq("is_orderable", true)
        .order("name");

      if (data) {
        setProducts(
          data.map((p: any) => ({
            id: p.id,
            name: p.name,
            selling_price: Number(p.selling_price),
            category_name: p.category?.name || "Zonder categorie",
            image_url: p.image_url,
          }))
        );
      }
    };

    if (open && !isReadOnly) fetchProducts();
  }, [open, isReadOnly]);

  // Fetch pickup locations
  useEffect(() => {
    const fetchPickupLocations = async () => {
      const { data } = await supabase
        .from("pickup_locations")
        .select("*")
        .eq("is_active", true)
        .order("title");
      if (data) setPickupLocations(data as any);
    };

    if (open) fetchPickupLocations();
  }, [open]);

  // Initialize form state from order
  useEffect(() => {
    if (!open) return;

    if (!order) {
      setSelectedPickupLocationId("");
      setCustomPickupLocation("");
      setNotes("");
      setExtraItems([]);
      return;
    }

    setSelectedPickupLocationId(order.pickup_location_id || "anders");
    setNotes(order.notes || "");

    // init editable extra items from the order items
    const extras = (order.items || [])
      .filter((i) => !i.is_weekly_menu_item)
      .map((i) => ({ product_id: i.product_id, quantity: i.quantity }));

    setExtraItems(extras.length ? extras : []);
  }, [order, open]);

  const weeklyItems = useMemo(() => {
    return (order?.items || []).filter((i) => i.is_weekly_menu_item);
  }, [order]);

  const extraOrderItems = useMemo(() => {
    return (order?.items || []).filter((i) => !i.is_weekly_menu_item);
  }, [order]);

  const addExtraItem = () => {
    if (isReadOnly) return;
    setExtraItems([...extraItems, { product_id: "", quantity: 1 }]);
  };

  const removeExtraItem = (index: number) => {
    if (isReadOnly) return;
    setExtraItems(extraItems.filter((_, i) => i !== index));
  };

  const updateExtraItem = (index: number, field: "product_id" | "quantity", value: string | number) => {
    if (isReadOnly) return;
    const updated = [...extraItems];
    updated[index] = { ...updated[index], [field]: value };
    setExtraItems(updated);
  };

  const generatePaymentLink = () => {
    if (!order) return "";
    const amount = order.total.toFixed(2);
    return `https://bunq.me/BosgoedtBakery/${amount}/${order.order_number}`;
  };

  const handleSave = async () => {
    if (!order || isReadOnly) return;

    if (!selectedPickupLocationId || (selectedPickupLocationId === "anders" && !customPickupLocation.trim())) {
      toast({ title: "Fout", description: "Selecteer een afhaallocatie", variant: "destructive" });
      return;
    }

    setLoading(true);

    const orderPayload = {
      pickup_location_id: selectedPickupLocationId === "anders" ? null : selectedPickupLocationId,
      notes:
        selectedPickupLocationId === "anders"
          ? `Afhaallocatie: ${customPickupLocation.trim()}${notes ? `\n${notes}` : ""}`
          : notes.trim() || null,
      subtotal: order.subtotal,
      discount_amount: order.discount_amount,
      total: order.total,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("orders").update(orderPayload).eq("id", order.id);

    if (error) {
      toast({ title: "Fout", description: "Kon bestelling niet bijwerken", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Replace only extra items (non-weekly)
    await supabase.from("order_items").delete().eq("order_id", order.id).eq("is_weekly_menu_item", false);

    const newItems = extraItems
      .filter((item) => item.product_id && item.quantity > 0)
      .map((item) => {
        const product = products.find((p) => p.id === item.product_id);
        const unit = product?.selling_price || 0;
        return {
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: unit,
          discount_amount: 0,
          total: unit * item.quantity,
          is_weekly_menu_item: false,
        };
      });

    if (newItems.length > 0) {
      await supabase.from("order_items").insert(newItems);
    }

    setLoading(false);
    toast({ title: "Opgeslagen", description: "Bestelling bijgewerkt" });
    onOpenChange(false);
    onSave();
  };

  const formatCurrency = (value: number) => `€${value.toFixed(2)}`;

  const renderItemRow = (item: OrderItem) => {
    const name = item.product?.name || "Onbekend product";
    const img = item.product?.image_url || null;

    return (
      <div key={item.id} className="flex gap-3 items-center p-2 border rounded-lg bg-muted/30">
        <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
          {img ? (
            <img src={img} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{name}</div>
          {!item.product && (
            <div className="text-xs text-muted-foreground">
              (product-id: {item.product_id.slice(0, 8)}…)
            </div>
          )}
        </div>

        <span className="text-sm text-muted-foreground">{item.quantity}x</span>
        <span className="text-sm font-medium w-16 text-right">{formatCurrency(item.total)}</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Bestelling details</DialogTitle>
            {order?.order_number && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-normal">
                <Hash className="w-3.5 h-3.5" />
                {order.order_number}
              </span>
            )}
          </div>
        </DialogHeader>

        {isReadOnly && order && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 border rounded-lg">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Deze bestelling heeft de status <strong>{ORDER_STATUS_LABELS[order.status]}</strong> en kan niet meer worden
              aangepast.
            </span>
          </div>
        )}

        {order && (
          <div className="space-y-6 py-4">
            {/* Status / dates */}
            <div className="flex flex-wrap gap-4">
              <div>
                <Label className="text-xs text-muted-foreground uppercase">Status</Label>
                <div className="mt-1">
                  <Badge variant="secondary" className="text-sm">
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground uppercase">Factuurdatum</Label>
                <p className="mt-1 text-sm">{format(parseISO(order.invoice_date), "EEEE d MMMM yyyy", { locale: nl })}</p>
              </div>

              {order.weekly_menu?.delivery_date && (
                <div>
                  <Label className="text-xs text-muted-foreground uppercase">Leverdatum</Label>
                  <p className="mt-1 text-sm">
                    {format(parseISO(order.weekly_menu.delivery_date), "EEEE d MMMM yyyy", { locale: nl })}
                  </p>
                </div>
              )}
            </div>

            {/* Weekly Menu */}
            {order.weekly_menu && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Weekmenu
                </Label>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="font-medium">{order.weekly_menu.name}</div>
                  {(order.weekly_menu.week_start_date || order.weekly_menu.week_end_date) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Week: {order.weekly_menu.week_start_date || "?"} – {order.weekly_menu.week_end_date || "?"}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pickup location */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Afhaallocatie
              </Label>

              {isReadOnly ? (
                <div className="p-3 bg-muted/30 rounded-lg">
                  {pickupLocations.find((l) => l.id === order.pickup_location_id)?.title ||
                    order.pickup_location?.title ||
                    (order.notes?.includes("Afhaallocatie:") ? order.notes.split("\n")[0] : "Niet opgegeven")}
                </div>
              ) : (
                <>
                  <Select value={selectedPickupLocationId} onValueChange={setSelectedPickupLocationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer afhaallocatie" />
                    </SelectTrigger>
                    <SelectContent>
                      {pickupLocations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{location.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {location.street} {location.house_number}, {location.city}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="anders">
                        <span className="italic">Anders (zelf invullen)</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {selectedPickupLocationId === "anders" && (
                    <Input
                      placeholder="Vul je gewenste afhaallocatie in..."
                      value={customPickupLocation}
                      onChange={(e) => setCustomPickupLocation(e.target.value)}
                      className="mt-2"
                    />
                  )}
                </>
              )}
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Producten
              </Label>

              {/* Weekmenu producten */}
              {order.weekly_menu && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Inbegrepen in weekmenu</div>
                  {weeklyItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Geen weekmenu-producten gevonden voor deze bestelling.
                    </p>
                  ) : (
                    <div className="space-y-2">{weeklyItems.map(renderItemRow)}</div>
                  )}
                </div>
              )}

              {/* Extra producten */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Extra producten</div>

                {extraOrderItems.length === 0 && extraItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Geen extra producten.</p>
                ) : (
                  <>
                    {/* Read-only list (altijd tonen) */}
                    <div className="space-y-2">
                      {extraOrderItems.map(renderItemRow)}
                    </div>

                    {/* Editable controls */}
                    {!isReadOnly && (
                      <div className="space-y-3 pt-2">
                        {extraItems.map((item, idx) => (
                          <div key={`${item.product_id}-${idx}`} className="flex gap-2 items-center">
                            <Select
                              value={item.product_id}
                              onValueChange={(v) => updateExtraItem(idx, "product_id", v)}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Kies product" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} ({formatCurrency(p.selling_price)})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateExtraItem(idx, "quantity", Number(e.target.value))}
                              className="w-20"
                            />

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeExtraItem(idx)}
                              title="Verwijderen"
                            >
                              <Trash2 className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </div>
                        ))}

                        <Button type="button" variant="outline" size="sm" onClick={addExtraItem}>
                          <Plus className="w-4 h-4 mr-1" />
                          Product toevoegen
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Hint wanneer product null is (typisch RLS) */}
              {(order.items || []).some((i) => !i.product) && (
                <div className="text-xs text-muted-foreground">
                  Sommige productdetails konden niet worden geladen. Dit wijst meestal op rechten (RLS) op de products-tabel.
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Opmerkingen</Label>
              {isReadOnly ? (
                <div className="p-3 bg-muted/30 rounded-lg text-sm min-h-[60px]">
                  {order.notes || <span className="text-muted-foreground">Geen opmerkingen</span>}
                </div>
              ) : (
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optionele opmerkingen..."
                  rows={2}
                />
              )}
            </div>

            <Separator />

            {/* Totals */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Overzicht</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotaal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Korting</span>
                    <span>-{formatCurrency(order.discount_amount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Totaal</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>

                {order.status !== "paid" && (
                  <Button className="w-full mt-4" onClick={() => window.open(generatePaymentLink(), "_blank")}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Nu betalen
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Sluiten
          </Button>
          {!isReadOnly && (
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Opslaan..." : "Wijzigingen opslaan"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerOrderDialog;
