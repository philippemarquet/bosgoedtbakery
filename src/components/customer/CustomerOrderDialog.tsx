import { useEffect, useMemo, useState } from "react";
import { Calendar, Hash, Lock, MapPin, Package, Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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

const StatusChip = ({ status }: { status: string }) => {
  const label = ORDER_STATUS_LABELS[status] || status;
  const cls: Record<string, string> = {
    confirmed: "bg-muted/50 text-foreground ring-1 ring-inset ring-border/70",
    in_production:
      "bg-[hsl(var(--ember))]/10 text-[hsl(var(--ember))] ring-1 ring-inset ring-[hsl(var(--ember))]/30",
    ready: "bg-accent/10 text-foreground ring-1 ring-inset ring-accent/40",
    paid: "bg-foreground text-background ring-1 ring-inset ring-foreground",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[11px] tracking-[0.08em] uppercase rounded-[calc(var(--radius)-4px)] ${
        cls[status] || "bg-muted/50 text-muted-foreground ring-1 ring-inset ring-border/70"
      }`}
    >
      {label}
    </span>
  );
};

const CustomerOrderDialog = ({ open, onOpenChange, order, onSave }: CustomerOrderDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const canEdit = order?.status === "confirmed";
  const isReadOnly = !canEdit || !isEditing;

  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [selectedPickupLocationId, setSelectedPickupLocationId] = useState<string>("");
  const [customPickupLocation, setCustomPickupLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [extraItemsDraft, setExtraItemsDraft] = useState<{ product_id: string; quantity: number }[]>([]);

  const formatCurrency = (value: number) => `€ ${Number(value || 0).toFixed(2)}`;

  const weeklyItems = useMemo(() => (order?.items || []).filter((i) => i.is_weekly_menu_item), [order]);
  const extraOrderItems = useMemo(() => (order?.items || []).filter((i) => !i.is_weekly_menu_item), [order]);

  const menuPrice = useMemo(() => {
    const p = order?.weekly_menu?.price;
    return typeof p === "number" ? p : p ? Number(p) : 0;
  }, [order]);

  const extrasTotalFromItems = useMemo(() => {
    const sum = extraOrderItems.reduce((acc, it) => {
      const line = Number(it.total ?? 0);
      if (line > 0) return acc + line;
      return acc + Number(it.unit_price ?? 0) * Number(it.quantity ?? 0);
    }, 0);
    return sum;
  }, [extraOrderItems]);

  const extrasTotalFallback = useMemo(() => {
    const subtotal = Number(order?.subtotal ?? 0);
    const estimate = Math.max(0, subtotal - (menuPrice || 0));
    return estimate;
  }, [order, menuPrice]);

  const extrasTotal = useMemo(() => {
    return extrasTotalFromItems > 0 ? extrasTotalFromItems : extrasTotalFallback;
  }, [extrasTotalFromItems, extrasTotalFallback]);

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

  useEffect(() => {
    if (!open) {
      setIsEditing(false);
    }
  }, [open]);

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

    const draft = extraOrderItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
    setExtraItemsDraft(draft);
  }, [open, order, extraOrderItems]);

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

  const WeeklyRow = ({ item }: { item: OrderItem }) => {
    const name = item.product?.name || "Onbekend product";
    return (
      <div className="flex items-start justify-between py-2.5">
        <div className="min-w-0 pr-3">
          <div className="text-sm text-foreground truncate">{name}</div>
          <div className="text-[11px] tracking-[0.06em] uppercase text-muted-foreground mt-0.5">
            {item.quantity}× · inbegrepen
          </div>
        </div>
        <div className="text-[11px] tracking-[0.06em] uppercase text-muted-foreground whitespace-nowrap pt-1">
          inbegrepen
        </div>
      </div>
    );
  };

  const ExtraRow = ({ item }: { item: OrderItem }) => {
    const name = item.product?.name || "Onbekend product";
    const lineTotal =
      Number(item.total ?? 0) > 0 ? Number(item.total) : Number(item.unit_price ?? 0) * Number(item.quantity ?? 0);

    return (
      <div className="flex items-start justify-between py-2.5">
        <div className="min-w-0 pr-3">
          <div className="text-sm text-foreground truncate">{name}</div>
          <div className="text-[11px] tracking-[0.06em] uppercase text-muted-foreground mt-0.5">
            {item.quantity}×
          </div>
        </div>
        <div className="text-sm text-foreground whitespace-nowrap tabular-nums pt-0.5">
          {formatCurrency(lineTotal)}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto scroll-soft">
        <DialogHeader className="space-y-3">
          <p className="bakery-eyebrow">Bestelling</p>
          <div className="flex items-baseline justify-between gap-4">
            <DialogTitle
              className="font-serif text-3xl md:text-4xl font-medium leading-tight text-foreground"
              style={{ letterSpacing: "-0.02em" }}
            >
              Overzicht
            </DialogTitle>
            {order?.order_number && (
              <div className="flex items-center gap-1.5 text-[11px] tracking-[0.08em] uppercase text-muted-foreground">
                <Hash className="w-3 h-3" />
                <span className="tabular-nums">{order.order_number}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {order && (
          <div className="pt-2 space-y-6">
            {/* Meta strip */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <StatusChip status={order.status} />

              <div className="text-[11px] tracking-[0.06em] uppercase text-muted-foreground">
                Factuur{" "}
                <span className="text-foreground tracking-normal normal-case">
                  {format(parseISO(order.invoice_date), "d MMM yyyy", { locale: nl })}
                </span>
              </div>

              {order.weekly_menu?.delivery_date && (
                <div className="text-[11px] tracking-[0.06em] uppercase text-muted-foreground">
                  Levering{" "}
                  <span className="text-foreground tracking-normal normal-case">
                    {format(parseISO(order.weekly_menu.delivery_date), "d MMM yyyy", { locale: nl })}
                  </span>
                </div>
              )}
            </div>

            {/* Edit notice */}
            {!canEdit && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="w-3.5 h-3.5" />
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
                <span className="text-foreground font-medium">Bewerkingsmodus</span>
                <span className="text-border">·</span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="underline underline-offset-2 hover:no-underline"
                >
                  Annuleren
                </button>
              </div>
            )}

            {/* Weekmenu block */}
            {(order.weekly_menu || order.weekly_menu_id) && (
              <div className="paper-card px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="bakery-eyebrow">Weekmenu</span>
                  </div>
                  <div className="text-sm text-foreground tabular-nums">
                    {menuPrice > 0 ? formatCurrency(menuPrice) : ""}
                  </div>
                </div>

                <div
                  className="font-serif text-xl text-foreground"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {order.weekly_menu?.name || "Weekmenu"}
                </div>

                {weeklyItems.length > 0 && (
                  <div className="divide-y divide-border/60 border-t border-border/60">
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
            <div className="paper-card px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="bakery-eyebrow">Extra producten</span>
                </div>
                <div className="text-sm text-foreground tabular-nums">
                  {extraOrderItems.length > 0 ? formatCurrency(extrasTotal) : ""}
                </div>
              </div>

              {extraOrderItems.length === 0 ? (
                <div className="text-xs text-muted-foreground">Geen extra producten.</div>
              ) : (
                <div className="divide-y divide-border/60 border-t border-border/60">
                  {extraOrderItems.map((it) => (
                    <ExtraRow key={it.id} item={it} />
                  ))}
                </div>
              )}

              {!isReadOnly && (
                <div className="pt-3 space-y-3 border-t border-border/60">
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
                        className="w-20 tabular-nums"
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
                    <Plus className="w-4 h-4 mr-1.5" />
                    Product toevoegen
                  </Button>
                </div>
              )}
            </div>

            {/* Afhaallocatie + notes */}
            <div className="paper-card px-5 py-4 space-y-5">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="bakery-eyebrow">Afhaallocatie</span>
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
                <Label htmlFor="notes" className="bakery-eyebrow">
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

            {/* Overzicht */}
            <div className="paper-card px-5 py-4 space-y-3">
              <p className="bakery-eyebrow">Overzicht</p>

              <div className="space-y-2 pt-1">
                {order.weekly_menu_id && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Weekmenu</span>
                    <span className="tabular-nums text-foreground">{formatCurrency(menuPrice)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Extra producten</span>
                  <span className="tabular-nums text-foreground">{formatCurrency(extrasTotal)}</span>
                </div>

                {Number(order.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[hsl(var(--ember))]">Korting</span>
                    <span className="tabular-nums text-[hsl(var(--ember))]">
                      −{formatCurrency(order.discount_amount)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-baseline justify-between pt-3 border-t border-border/60">
                <span className="bakery-eyebrow">Totaal</span>
                <span
                  className="font-serif text-2xl text-foreground tabular-nums"
                  style={{ letterSpacing: "-0.015em" }}
                >
                  {formatCurrency(order.total)}
                </span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
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
