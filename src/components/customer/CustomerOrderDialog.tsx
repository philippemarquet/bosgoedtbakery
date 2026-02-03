import { useEffect, useMemo, useState } from "react";
import { Calendar, ExternalLink, Hash, Lock, MapPin, Package, Plus, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface OrderItem {
  id: string;
  order_id?: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  total: number;
  is_weekly_menu_item: boolean;
  product: { id: string; name: string; image_url?: string | null } | null;
}

interface WeeklyMenu {
  id: string;
  name: string;
  delivery_date: string | null;
  week_start_date?: string;
  week_end_date?: string;
  price?: number;
  description?: string | null;
}

interface Order {
  id: string;
  order_number: number;
  status: string;
  notes: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  created_at?: string;
  invoice_date: string;
  pickup_location_id: string | null;

  weekly_menu_id?: string | null;
  weekly_menu: WeeklyMenu | null;

  pickup_location?: { id: string; title: string } | null;

  items: OrderItem[];
}

interface Product {
  id: string;
  name: string;
  selling_price: number;
}

interface PickupLocation {
  id: string;
  title: string;
  street: string;
  house_number: string | null;
  postal_code: string;
  city: string;
  is_active: boolean;
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
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const canEdit = order?.status === "confirmed";
  // Only show edit UI when both canEdit is true AND user clicked "Wijzig"
  const isReadOnly = !canEdit || !isEditing;

  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [selectedPickupLocationId, setSelectedPickupLocationId] = useState<string>("");
  const [customPickupLocation, setCustomPickupLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [extraItemsDraft, setExtraItemsDraft] = useState<{ product_id: string; quantity: number }[]>([]);

  // --- Helpers ---
  const formatCurrency = (value: number) => `€${Number(value || 0).toFixed(2)}`;

  const generatePaymentLink = () => {
    if (!order) return "";
    const amount = Number(order.total || 0).toFixed(2);
    return `https://bunq.me/BosgoedtBakery/${amount}/${order.order_number}`;
  };

  const weeklyItems = useMemo(() => (order?.items || []).filter((i) => i.is_weekly_menu_item), [order]);
  const extraOrderItems = useMemo(() => (order?.items || []).filter((i) => !i.is_weekly_menu_item), [order]);

  const menuPrice = useMemo(() => {
    const p = order?.weekly_menu?.price;
    return typeof p === "number" ? p : p ? Number(p) : 0;
  }, [order]);

  const extrasTotalFromItems = useMemo(() => {
    // Som van extra items; als totals niet gevuld zijn, val terug op unit_price * qty
    const sum = extraOrderItems.reduce((acc, it) => {
      const line = Number(it.total ?? 0);
      if (line > 0) return acc + line;
      return acc + Number(it.unit_price ?? 0) * Number(it.quantity ?? 0);
    }, 0);
    return sum;
  }, [extraOrderItems]);

  const extrasTotalFallback = useMemo(() => {
    // Als item totals 0 zijn, probeer uit subtotal een redelijke schatting te halen
    const subtotal = Number(order?.subtotal ?? 0);
    const estimate = Math.max(0, subtotal - (menuPrice || 0));
    return estimate;
  }, [order, menuPrice]);

  const extrasTotal = useMemo(() => {
    return extrasTotalFromItems > 0 ? extrasTotalFromItems : extrasTotalFallback;
  }, [extrasTotalFromItems, extrasTotalFallback]);

  // --- Fetch pickup locations (altijd) ---
  useEffect(() => {
    if (!open) return;
    const fetchPickupLocations = async () => {
      const { data, error } = await supabase
        .from("pickup_locations")
        .select("*")
        .eq("is_active", true)
        .order("title");

      if (!error && data) setPickupLocations(data as any);
    };
    fetchPickupLocations();
  }, [open]);

  // --- Fetch products (alleen nodig als editable extra items) ---
  useEffect(() => {
    if (!open || !isEditing) return;
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, selling_price")
        .eq("is_orderable", true)
        .order("name");
      if (!error && data) {
        setProducts(
          (data as any[]).map((p) => ({
            id: p.id,
            name: p.name,
            selling_price: Number(p.selling_price),
          }))
        );
      }
    };
    fetchProducts();
  }, [open, isEditing]);

  // --- Reset editing mode when dialog closes ---
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
    }
  }, [open]);

  // --- Init form state from order ---
  useEffect(() => {
    if (!open) return;

    if (!order) {
      setSelectedPickupLocationId("");
      setCustomPickupLocation("");
      setNotes("");
      setExtraItemsDraft([]);
      return;
    }

    setSelectedPickupLocationId(order.pickup_location_id || "anders");
    setNotes(order.notes || "");

    // init editable extras from existing extra order items
    const draft = extraOrderItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
    setExtraItemsDraft(draft);
  }, [open, order, extraOrderItems]);

  // --- Editable extras actions ---
  const addExtraItem = () => {
    if (isReadOnly) return;
    setExtraItemsDraft([...extraItemsDraft, { product_id: "", quantity: 1 }]);
  };

  const removeExtraItem = (index: number) => {
    if (isReadOnly) return;
    setExtraItemsDraft(extraItemsDraft.filter((_, i) => i !== index));
  };

  const updateExtraItem = (index: number, field: "product_id" | "quantity", value: string | number) => {
    if (isReadOnly) return;
    const updated = [...extraItemsDraft];
    updated[index] = { ...updated[index], [field]: value };
    setExtraItemsDraft(updated);
  };

  // --- Save ---
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

    const newItems = extraItemsDraft
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

  // --- UI: rows ---
  const WeeklyRow = ({ item }: { item: OrderItem }) => {
    const name = item.product?.name || "Onbekend product";
    return (
      <div className="flex items-start justify-between py-2">
        <div className="min-w-0">
          <div className="text-sm text-foreground truncate">{name}</div>
          <div className="text-xs text-muted-foreground">{item.quantity}× • Inbegrepen</div>
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">Inbegrepen</div>
      </div>
    );
  };

  const ExtraRow = ({ item }: { item: OrderItem }) => {
    const name = item.product?.name || "Onbekend product";
    const lineTotal =
      Number(item.total ?? 0) > 0 ? Number(item.total) : Number(item.unit_price ?? 0) * Number(item.quantity ?? 0);

    return (
      <div className="flex items-start justify-between py-2">
        <div className="min-w-0">
          <div className="text-sm text-foreground truncate">{name}</div>
          <div className="text-xs text-muted-foreground">{item.quantity}×</div>
        </div>
        <div className="text-sm text-foreground whitespace-nowrap tabular-nums">{formatCurrency(lineTotal)}</div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-baseline justify-between gap-4">
            <DialogTitle className="font-serif text-2xl">Bestelling</DialogTitle>
            {order?.order_number && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Hash className="w-3.5 h-3.5" />
                <span className="tabular-nums">{order.order_number}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {order && (
          <div className="py-2 space-y-6">
            {/* Slimme, rustige header info */}
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="rounded-md">
                {ORDER_STATUS_LABELS[order.status] || order.status}
              </Badge>

              <div className="text-xs text-muted-foreground">
                Factuurdatum{" "}
                <span className="text-foreground">
                  {format(parseISO(order.invoice_date), "d MMM yyyy", { locale: nl })}
                </span>
              </div>

              {order.weekly_menu?.delivery_date && (
                <div className="text-xs text-muted-foreground">
                  Leverdatum{" "}
                  <span className="text-foreground">
                    {format(parseISO(order.weekly_menu.delivery_date), "d MMM yyyy", { locale: nl })}
                  </span>
                </div>
              )}
            </div>

            {/* Read-only notice or Edit button */}
            {!canEdit && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="w-4 h-4" />
                Deze bestelling kan niet meer worden aangepast.
              </div>
            )}
            {canEdit && !isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Bestelling wijzigen
              </Button>
            )}
            {canEdit && isEditing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-primary font-medium">Bewerkingsmodus actief</span>
                <span>—</span>
                <button 
                  type="button" 
                  onClick={() => setIsEditing(false)} 
                  className="underline hover:no-underline"
                >
                  Annuleren
                </button>
              </div>
            )}

            {/* Weekmenu block (minimal, no card) */}
            {(order.weekly_menu || order.weekly_menu_id) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="w-4 h-4" />
                    Weekmenu
                  </div>
                  {/* menuprijs 1x tonen */}
                  <div className="text-sm text-foreground tabular-nums">
                    {menuPrice > 0 ? formatCurrency(menuPrice) : ""}
                  </div>
                </div>

                <div className="text-sm text-foreground">
                  {order.weekly_menu?.name || "Weekmenu"}
                </div>

                {weeklyItems.length > 0 && (
                  <div className="mt-2 divide-y divide-border/40">
                    {weeklyItems.map((it) => (
                      <WeeklyRow key={it.id} item={it} />
                    ))}
                  </div>
                )}

                {weeklyItems.length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    Geen inbegrepen producten gevonden voor deze bestelling.
                  </div>
                )}
              </div>
            )}

            {/* Extra producten */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="w-4 h-4" />
                  Extra producten
                </div>
                {/* geen harde waarheid, maar netjes: extra’s totaal */}
                <div className="text-sm text-foreground tabular-nums">
                  {extraOrderItems.length > 0 ? formatCurrency(extrasTotal) : ""}
                </div>
              </div>

              {extraOrderItems.length === 0 ? (
                <div className="text-xs text-muted-foreground">Geen extra producten.</div>
              ) : (
                <div className="divide-y divide-border/40">
                  {extraOrderItems.map((it) => (
                    <ExtraRow key={it.id} item={it} />
                  ))}
                </div>
              )}

              {/* Editable extra items (confirmed only) */}
              {!isReadOnly && (
                <div className="pt-3 space-y-3">
                  {extraItemsDraft.map((item, idx) => (
                    <div key={`${item.product_id}-${idx}`} className="flex gap-2 items-center">
                      <Select value={item.product_id} onValueChange={(v) => updateExtraItem(idx, "product_id", v)}>
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

                      <Button type="button" variant="ghost" size="icon" onClick={() => removeExtraItem(idx)} title="Verwijderen">
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
            </div>

            <Separator />

            {/* Afhaallocatie + notes (clean) */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="w-4 h-4" />
                  Afhaallocatie
                </Label>

                {isReadOnly ? (
                  <div className="text-sm text-foreground">
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
                            {location.title}
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

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">
                  Opmerkingen
                </Label>
                {isReadOnly ? (
                  <div className="text-sm text-muted-foreground">
                    {order.notes || "Geen opmerkingen"}
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
            </div>

            <Separator />

            {/* Overzicht (menuprijs 1x, geen productprijzen in menu) */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Overzicht</div>

              {order.weekly_menu_id && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Weekmenu</span>
                  <span className="tabular-nums">{formatCurrency(menuPrice)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Extra producten</span>
                <span className="tabular-nums">{formatCurrency(extrasTotal)}</span>
              </div>

              {Number(order.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Korting</span>
                  <span className="tabular-nums">-{formatCurrency(order.discount_amount)}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-semibold pt-2">
                <span>Totaal</span>
                <span className="tabular-nums">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Sluiten
          </Button>
          {isEditing && (
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
