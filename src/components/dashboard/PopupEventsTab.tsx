import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Pencil, ExternalLink, Eye, EyeOff, Trash2, ChevronLeft, Send } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface PopupEvent {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  event_date: string;
  pickup_start_time: string;
  pickup_end_time: string;
  location_name: string | null;
  location_address: string | null;
  ordering_opens_at: string;
  ordering_closes_at: string;
  is_published: boolean;
}

interface ProductOption {
  id: string;
  name: string;
  selling_price: number;
}

interface EventProduct {
  id: string;
  popup_event_id: string;
  product_id: string;
  display_order: number | null;
  max_quantity: number | null;
  price_override: number | null;
  product?: { id: string; name: string; selling_price: number } | null;
}

interface OrderRow {
  id: string;
  order_number: number;
  status: string;
  total: number;
  created_at: string;
  customer_name_snapshot: string | null;
  customer_email_snapshot: string | null;
  customer_phone_snapshot: string | null;
}

const emptyEvent: Partial<PopupEvent> = {
  name: "",
  slug: "",
  description: "",
  event_date: "",
  pickup_start_time: "10:00",
  pickup_end_time: "14:00",
  location_name: "",
  location_address: "",
  ordering_opens_at: new Date().toISOString().slice(0, 16),
  ordering_closes_at: "",
  is_published: false,
};

interface PopupEventsTabProps {
  initialEventId?: string | null;
  onSelectionChange?: (eventId: string | null) => void;
}

const PopupEventsTab = ({ initialEventId, onSelectionChange }: PopupEventsTabProps = {}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<PopupEvent[]>([]);
  const [stats, setStats] = useState<Record<string, { orders: number; revenue: number }>>({});
  const [selected, setSelectedState] = useState<PopupEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<PopupEvent> | null>(null);

  const setSelected = useCallback(
    (ev: PopupEvent | null) => {
      setSelectedState(ev);
      onSelectionChange?.(ev?.id ?? null);
    },
    [onSelectionChange]
  );

  // Auto-select event when deeplinked via initialEventId
  useEffect(() => {
    if (!initialEventId || events.length === 0) return;
    if (selected?.id === initialEventId) return;
    const match = events.find((e) => e.id === initialEventId);
    if (match) setSelectedState(match);
  }, [initialEventId, events, selected?.id]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data: evs } = await supabase
      .from("popup_events")
      .select("*")
      .order("event_date", { ascending: false });
    setEvents(evs ?? []);

    const { data: orders } = await supabase
      .from("orders")
      .select("popup_event_id, total")
      .not("popup_event_id", "is", null);
    const map: Record<string, { orders: number; revenue: number }> = {};
    (orders ?? []).forEach((o: any) => {
      const id = o.popup_event_id as string;
      if (!map[id]) map[id] = { orders: 0, revenue: 0 };
      map[id].orders += 1;
      map[id].revenue += Number(o.total);
    });
    setStats(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const openCreate = () => {
    setEditing({ ...emptyEvent });
    setDialogOpen(true);
  };

  const openEdit = (ev: PopupEvent) => {
    setEditing({
      ...ev,
      ordering_opens_at: ev.ordering_opens_at?.slice(0, 16),
      ordering_closes_at: ev.ordering_closes_at?.slice(0, 16),
    });
    setDialogOpen(true);
  };

  const saveEvent = async () => {
    if (!editing) return;
    if (!editing.name || !editing.event_date || !editing.ordering_closes_at) {
      toast({ title: "Vul minimaal naam, datum en sluit-datum in", variant: "destructive" });
      return;
    }
    const payload = {
      name: editing.name,
      slug: editing.slug || null,
      description: editing.description || null,
      event_date: editing.event_date,
      pickup_start_time: editing.pickup_start_time,
      pickup_end_time: editing.pickup_end_time,
      location_name: editing.location_name || null,
      location_address: editing.location_address || null,
      ordering_opens_at: new Date(editing.ordering_opens_at!).toISOString(),
      ordering_closes_at: new Date(editing.ordering_closes_at!).toISOString(),
      is_published: editing.is_published ?? false,
    };

    if (editing.id) {
      const { error } = await supabase.from("popup_events").update(payload).eq("id", editing.id);
      if (error) return toast({ title: "Fout", description: error.message, variant: "destructive" });
      toast({ title: "Event bijgewerkt" });
    } else {
      const { error } = await supabase.from("popup_events").insert(payload);
      if (error) return toast({ title: "Fout", description: error.message, variant: "destructive" });
      toast({ title: "Event aangemaakt" });
    }
    setDialogOpen(false);
    setEditing(null);
    fetchEvents();
  };

  const togglePublish = async (ev: PopupEvent) => {
    const { error } = await supabase
      .from("popup_events")
      .update({ is_published: !ev.is_published })
      .eq("id", ev.id);
    if (error) return toast({ title: "Fout", description: error.message, variant: "destructive" });
    fetchEvents();
    if (selected?.id === ev.id) setSelected({ ...ev, is_published: !ev.is_published });
  };

  const deleteEvent = async (ev: PopupEvent) => {
    if (!confirm(`Weet je zeker dat je "${ev.name}" wilt verwijderen?`)) return;
    const { error } = await supabase.from("popup_events").delete().eq("id", ev.id);
    if (error) return toast({ title: "Fout", description: error.message, variant: "destructive" });
    toast({ title: "Event verwijderd" });
    fetchEvents();
  };

  if (selected) {
    return (
      <PopupEventDetail
        event={selected}
        onBack={() => {
          setSelected(null);
          fetchEvents();
        }}
        onEdit={() => openEdit(selected)}
        onTogglePublish={() => togglePublish(selected)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Pop-up events</h2>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Nieuwe pop-up
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Laden…</p>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground">Nog geen pop-ups. Maak er eentje aan om te starten.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((ev) => {
            const s = stats[ev.id] ?? { orders: 0, revenue: 0 };
            return (
              <button
                key={ev.id}
                onClick={() => setSelected(ev)}
                className="text-left rounded-[var(--radius)] border border-border/60 bg-card p-5 hover:border-foreground/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="bakery-eyebrow mb-1">{format(parseISO(ev.event_date), "EEEE d MMMM yyyy", { locale: nl })}</p>
                    <h3 className="font-serif text-xl">{ev.name}</h3>
                    {ev.location_name && (
                      <p className="text-sm text-muted-foreground mt-1">{ev.location_name}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      ev.is_published
                        ? "bg-[hsl(var(--sage))]/15 text-[hsl(var(--sage))]"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {ev.is_published ? "Gepubliceerd" : "Concept"}
                  </span>
                </div>
                <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                  <span>{s.orders} bestellingen</span>
                  <span>€ {s.revenue.toFixed(2)} omzet</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <EventDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        setEditing={setEditing}
        onSave={saveEvent}
      />
    </div>
  );
};

const EventDialog = ({
  open,
  onOpenChange,
  editing,
  setEditing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Partial<PopupEvent> | null;
  setEditing: (e: Partial<PopupEvent> | null) => void;
  onSave: () => void;
}) => {
  if (!editing) return null;
  const set = (patch: Partial<PopupEvent>) => setEditing({ ...editing, ...patch });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {editing.id ? "Pop-up bewerken" : "Nieuwe pop-up"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Naam *</Label>
            <Input value={editing.name ?? ""} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Slug (voor URL, bv. juni-2026)</Label>
            <Input value={editing.slug ?? ""} onChange={(e) => set({ slug: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Korte beschrijving</Label>
            <Textarea
              rows={2}
              value={editing.description ?? ""}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 col-span-3 sm:col-span-1">
              <Label>Datum *</Label>
              <Input
                type="date"
                value={editing.event_date ?? ""}
                onChange={(e) => set({ event_date: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-3 sm:col-span-1">
              <Label>Vanaf</Label>
              <Input
                type="time"
                value={editing.pickup_start_time ?? ""}
                onChange={(e) => set({ pickup_start_time: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-3 sm:col-span-1">
              <Label>Tot</Label>
              <Input
                type="time"
                value={editing.pickup_end_time ?? ""}
                onChange={(e) => set({ pickup_end_time: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Locatie naam</Label>
            <Input
              value={editing.location_name ?? ""}
              onChange={(e) => set({ location_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Adres</Label>
            <Input
              value={editing.location_address ?? ""}
              onChange={(e) => set({ location_address: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Bestellen opent</Label>
              <Input
                type="datetime-local"
                value={editing.ordering_opens_at ?? ""}
                onChange={(e) => set({ ordering_opens_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Bestellen sluit *</Label>
              <Input
                type="datetime-local"
                value={editing.ordering_closes_at ?? ""}
                onChange={(e) => set({ ordering_closes_at: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-3 pt-2">
            <Switch
              checked={editing.is_published ?? false}
              onCheckedChange={(c) => set({ is_published: c })}
            />
            <span className="text-sm">Publiek zichtbaar</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={onSave}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PopupEventDetail = ({
  event,
  onBack,
  onEdit,
  onTogglePublish,
}: {
  event: PopupEvent;
  onBack: () => void;
  onEdit: () => void;
  onTogglePublish: () => void;
}) => {
  const { toast } = useToast();
  const [eventProducts, setEventProducts] = useState<EventProduct[]>([]);
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: eps }, { data: prods }, { data: ords }] = await Promise.all([
      supabase
        .from("popup_event_products")
        .select("*, product:products(id, name, selling_price)")
        .eq("popup_event_id", event.id)
        .order("display_order", { ascending: true }),
      supabase
        .from("products")
        .select("id, name, selling_price")
        .eq("is_orderable", true)
        .order("name"),
      supabase
        .from("orders")
        .select("id, order_number, status, total, created_at, customer_name_snapshot, customer_email_snapshot, customer_phone_snapshot")
        .eq("popup_event_id", event.id)
        .order("created_at", { ascending: false }),
    ]);
    setEventProducts(eps ?? []);
    setAllProducts(prods ?? []);
    setOrders(ords ?? []);
    setLoading(false);
  }, [event.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const availableToAdd = useMemo(() => {
    const used = new Set(eventProducts.map((p) => p.product_id));
    return allProducts.filter((p) => !used.has(p.id));
  }, [allProducts, eventProducts]);

  const addProduct = async (productId: string) => {
    const { error } = await supabase.from("popup_event_products").insert({
      popup_event_id: event.id,
      product_id: productId,
      display_order: eventProducts.length,
    });
    if (error) return toast({ title: "Fout", description: error.message, variant: "destructive" });
    fetchAll();
  };

  const updateEventProduct = async (id: string, patch: Partial<EventProduct>) => {
    const { error } = await supabase.from("popup_event_products").update(patch).eq("id", id);
    if (error) return toast({ title: "Fout", description: error.message, variant: "destructive" });
    fetchAll();
  };

  const removeEventProduct = async (id: string) => {
    const { error } = await supabase.from("popup_event_products").delete().eq("id", id);
    if (error) return toast({ title: "Fout", description: error.message, variant: "destructive" });
    fetchAll();
  };

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const uniqueCustomers = new Set(orders.map((o) => o.customer_email_snapshot ?? "")).size;
  const publicUrl = event.slug
    ? `${window.location.origin}/bestellen?event=${event.slug}`
    : `${window.location.origin}/bestellen`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Terug
          </Button>
          <h2 className="font-serif text-2xl">{event.name}</h2>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              event.is_published
                ? "bg-[hsl(var(--sage))]/15 text-[hsl(var(--sage))]"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {event.is_published ? "Gepubliceerd" : "Concept"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-1" /> Bewerken
          </Button>
          <Button variant="outline" size="sm" onClick={onTogglePublish}>
            {event.is_published ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" /> Depubliceer
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" /> Publiceer
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Bekijk publiek
            </a>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Bestellingen" value={orders.length} />
        <Stat label="Unieke klanten" value={uniqueCustomers} />
        <Stat label="Omzet" value={`€ ${totalRevenue.toFixed(2)}`} />
        <Stat
          label="Datum"
          value={format(parseISO(event.event_date), "d MMM", { locale: nl })}
        />
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Producten</TabsTrigger>
          <TabsTrigger value="orders">Bestellingen ({orders.length})</TabsTrigger>
          <TabsTrigger value="actions">Acties</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4 mt-4">
          {loading ? (
            <p className="text-muted-foreground">Laden…</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Select onValueChange={(v) => addProduct(v)}>
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Product toevoegen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableToAdd.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Alle producten zijn al toegevoegd
                      </div>
                    ) : (
                      availableToAdd.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} (€ {Number(p.selling_price).toFixed(2)})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {eventProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen producten gekoppeld.</p>
              ) : (
                <div className="border border-border/60 rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-left">
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2 w-28">Volgorde</th>
                        <th className="px-3 py-2 w-32">Prijs override</th>
                        <th className="px-3 py-2 w-24">Max</th>
                        <th className="px-3 py-2 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventProducts.map((ep) => (
                        <tr key={ep.id} className="border-t border-border/60">
                          <td className="px-3 py-2">{ep.product?.name ?? "—"}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              defaultValue={ep.display_order ?? 0}
                              onBlur={(e) =>
                                updateEventProduct(ep.id, { display_order: Number(e.target.value) })
                              }
                              className="h-8"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              step="0.01"
                              defaultValue={ep.price_override ?? ""}
                              placeholder={ep.product ? `${ep.product.selling_price}` : ""}
                              onBlur={(e) =>
                                updateEventProduct(ep.id, {
                                  price_override: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              className="h-8"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              defaultValue={ep.max_quantity ?? ""}
                              placeholder="∞"
                              onBlur={(e) =>
                                updateEventProduct(ep.id, {
                                  max_quantity: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              className="h-8"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeEventProduct(ep.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          {orders.length === 0 ? (
            <p className="text-muted-foreground">Nog geen bestellingen.</p>
          ) : (
            <div className="border border-border/60 rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Klant</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Tel</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Totaal</th>
                    <th className="px-3 py-2">Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t border-border/60">
                      <td className="px-3 py-2 tabular-nums">#{o.order_number}</td>
                      <td className="px-3 py-2">{o.customer_name_snapshot ?? "—"}</td>
                      <td className="px-3 py-2">{o.customer_email_snapshot ?? "—"}</td>
                      <td className="px-3 py-2">{o.customer_phone_snapshot ?? "—"}</td>
                      <td className="px-3 py-2">{o.status}</td>
                      <td className="px-3 py-2 text-right tabular-nums">€ {Number(o.total).toFixed(2)}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {format(parseISO(o.created_at), "d MMM HH:mm", { locale: nl })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="actions" className="mt-4 space-y-3">
          <BroadcastSection event={event} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const BroadcastSection = ({ event }: { event: PopupEvent }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"config" | "preview" | "confirm" | "sending" | "done">("config");
  const [intro, setIntro] = useState("");
  const [activeSubs, setActiveSubs] = useState<number>(0);
  const [lastBroadcast, setLastBroadcast] = useState<{ at: string; sent: number; failed: number } | null>(null);
  const [result, setResult] = useState<{ recipients_count: number; emails_sent: number; emails_failed: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from("subscribers").select("id", { count: "exact", head: true }).eq("is_active", true);
      setActiveSubs(count ?? 0);
      const { data: last } = await supabase
        .from("email_logs")
        .select("created_at, status, metadata")
        .eq("email_type", "menu_broadcast")
        .eq("related_popup_event_id", event.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (last && last.length > 0) {
        const sent = last.filter((l: any) => l.status === "sent").length;
        const failed = last.filter((l: any) => l.status === "failed").length;
        setLastBroadcast({ at: last[0].created_at, sent, failed });
      }
    })();
  }, [event.id]);

  const send = async () => {
    setStep("sending");
    const { data, error } = await supabase.functions.invoke("send-menu-broadcast", {
      body: { popup_event_id: event.id, custom_intro: intro || null },
    });
    if (error) {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
      setStep("confirm");
      return;
    }
    setResult(data as any);
    setStep("done");
  };

  if (!event.is_published) {
    return <p className="text-sm text-muted-foreground">Publiceer dit event eerst om de menu-broadcast te kunnen sturen.</p>;
  }

  return (
    <>
      <Button onClick={() => { setOpen(true); setStep("config"); setIntro(""); setResult(null); }}>
        <Send className="h-4 w-4 mr-2" /> Verzend menu naar subscribers
      </Button>
      {lastBroadcast && (
        <p className="text-xs text-muted-foreground">
          Laatste broadcast: {format(parseISO(lastBroadcast.at), "d MMM HH:mm", { locale: nl })}
          {" · "}{lastBroadcast.sent} verzonden, {lastBroadcast.failed} gefaald
        </p>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setStep("config"); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Menu broadcast — {event.name}</DialogTitle>
          </DialogHeader>

          {step === "config" && (
            <div className="space-y-4">
              <p className="text-sm">Verstuurt naar <strong>{activeSubs}</strong> actieve subscribers.</p>
              <div className="space-y-2">
                <Label>Optionele intro tekst (overschrijft de standaard intro)</Label>
                <Textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Bv. Speciale paas-editie!" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
                <Button disabled={activeSubs === 0} onClick={() => setStep("confirm")}>Volgende</Button>
              </DialogFooter>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-4">
              <p className="text-sm">Weet je het zeker? Dit verstuurt naar <strong>{activeSubs}</strong> subscribers en kan niet ongedaan worden gemaakt.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("config")}>Terug</Button>
                <Button onClick={send}>Verzend nu</Button>
              </DialogFooter>
            </div>
          )}

          {step === "sending" && <p className="text-sm py-6 text-center text-muted-foreground">Verzenden…</p>}

          {step === "done" && result && (
            <div className="space-y-4">
              <p className="text-sm">
                <strong>{result.emails_sent}</strong> verzonden, <strong>{result.emails_failed}</strong> gefaald (van {result.recipients_count}).
              </p>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Sluiten</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const Stat = ({ label, value }: { label: string; value: number | string }) => (
  <div className="rounded-[var(--radius)] border border-border/60 bg-card p-4">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="font-serif text-2xl mt-1">{value}</p>
  </div>
);

export default PopupEventsTab;
