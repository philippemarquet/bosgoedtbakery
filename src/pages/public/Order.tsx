import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { Minus, Plus, ShoppingCart, X, Check } from "lucide-react";
import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import heroBread from "@/assets/hero-bread.jpg";

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
  ordering_closes_at: string;
  ordering_opens_at: string;
}

interface MenuItem {
  popup_event_product_id: string;
  product_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  max_quantity: number | null;
  display_order: number;
}

const PHONE_RE = /^(\+32|\+31|0)[\s\d-]{7,}$/;

const formatEUR = (n: number) =>
  new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);

const formatTime = (t: string) => t?.slice(0, 5) ?? "";

const formatDay = (d: string) => format(parseISO(d), "d", { locale: nl });
const formatMonth = (d: string) => format(parseISO(d), "MMM", { locale: nl }).toUpperCase();
const formatLongDate = (d: string) => format(parseISO(d), "EEEE d MMMM yyyy", { locale: nl });

const orderSchema = z.object({
  full_name: z.string().trim().min(1, "Naam is verplicht").max(120),
  email: z.string().trim().email("Ongeldig e-mailadres").max(255),
  phone: z.string().trim().regex(PHONE_RE, "Telefoonnummer ongeldig (start met 0, +31 of +32)"),
  notes: z.string().max(500).optional(),
});

const Order = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<PopupEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    orderNumber: number;
    email: string;
  } | null>(null);

  const [bannerForm, setBannerForm] = useState({ name: "", email: "", honey: "" });
  const [bannerSubmitted, setBannerSubmitted] = useState(false);

  // form state
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    notes: "",
    optIn: true,
    honey: "",
  });

  // load events
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("popup_events")
        .select(
          "id, slug, name, description, event_date, pickup_start_time, pickup_end_time, location_name, location_address, ordering_closes_at, ordering_opens_at"
        )
        .eq("is_published", true)
        .gte("ordering_closes_at", nowIso)
        .order("event_date", { ascending: true });

      if (error) {
        toast({ title: "Kon pop-ups niet laden", description: error.message, variant: "destructive" });
        setEvents([]);
      } else {
        setEvents(data ?? []);
        const slug = searchParams.get("event");
        if (slug && data) {
          const found = data.find((e) => e.slug === slug);
          if (found) setSelectedEventId(found.id);
          else if (data.length === 1) setSelectedEventId(data[0].id);
        } else if (data && data.length === 1) {
          setSelectedEventId(data[0].id);
        }
      }
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load menu when event chosen
  useEffect(() => {
    if (!selectedEventId) {
      setMenu([]);
      return;
    }
    const load = async () => {
      setMenuLoading(true);
      const { data, error } = await supabase
        .from("popup_event_products")
        .select(
          "id, popup_event_id, price_override, max_quantity, display_order, product:products(id, name, description, image_url, selling_price)"
        )
        .eq("popup_event_id", selectedEventId)
        .order("display_order", { ascending: true });

      if (error) {
        toast({ title: "Kon menu niet laden", description: error.message, variant: "destructive" });
        setMenu([]);
      } else {
        const items: MenuItem[] = (data ?? [])
          .filter((row: any) => row.product)
          .map((row: any) => ({
            popup_event_product_id: row.id,
            product_id: row.product.id,
            name: row.product.name,
            description: row.product.description,
            image_url: row.product.image_url,
            price: row.price_override != null ? Number(row.price_override) : Number(row.product.selling_price),
            max_quantity: row.max_quantity,
            display_order: row.display_order ?? 0,
          }));
        setMenu(items);
      }
      setMenuLoading(false);
    };
    load();
    setCart({});
  }, [selectedEventId, toast]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const cartLines = useMemo(
    () =>
      menu
        .filter((m) => (cart[m.product_id] ?? 0) > 0)
        .map((m) => ({ ...m, qty: cart[m.product_id] })),
    [menu, cart]
  );
  const cartTotal = cartLines.reduce((s, l) => s + l.qty * l.price, 0);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);

  const setQty = (productId: string, qty: number, max: number | null) => {
    const clamped = Math.max(0, Math.min(max ?? 99, qty));
    setCart((c) => ({ ...c, [productId]: clamped }));
  };

  const handleSelectEvent = (id: string) => {
    setSelectedEventId(id);
    const ev = events.find((e) => e.id === id);
    if (ev?.slug) {
      setSearchParams({ event: ev.slug }, { replace: true });
    }
    setTimeout(() => {
      document.getElementById("menu-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleSubmitOrder = async () => {
    if (!selectedEvent) return;
    if (form.honey) return; // bot

    const parsed = orderSchema.safeParse(form);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Controleer het formulier";
      toast({ title: "Controleer het formulier", description: first, variant: "destructive" });
      return;
    }
    if (cartLines.length === 0) {
      toast({ title: "Je mandje is leeg", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      // Dedupe check: order op zelfde event + email in laatste 5 min
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: dupes } = await supabase
        .from("orders")
        .select("id")
        .eq("popup_event_id", selectedEvent.id)
        .eq("customer_email_snapshot", form.email.trim().toLowerCase())
        .gte("created_at", fiveMinAgo);

      if (dupes && dupes.length > 0) {
        toast({
          title: "Je hebt al een bestelling geplaatst",
          description: "Check je e-mail of neem contact met ons op.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Profile dedup op email — hergebruik bestaand guest profile of maak nieuw aan
      const emailNorm = form.email.trim().toLowerCase();
      const fullNameTrim = form.full_name.trim();
      const phoneTrim = form.phone.trim();

      let profileId: string | null = null;
      const { data: existing } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .is("user_id", null)
        .ilike("email", emailNorm)
        .limit(1)
        .maybeSingle();

      if (existing) {
        profileId = existing.id;
        const updates: { full_name?: string; phone?: string } = {};
        if (existing.full_name !== fullNameTrim) updates.full_name = fullNameTrim;
        if (existing.phone !== phoneTrim) updates.phone = phoneTrim;
        if (Object.keys(updates).length > 0) {
          await supabase.from("profiles").update(updates).eq("id", profileId);
        }
      } else {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: null,
            full_name: fullNameTrim,
            phone: phoneTrim,
            email: emailNorm,
          })
          .select("id")
          .single();
        if (profileError || !profile) throw profileError ?? new Error("Profiel aanmaken mislukt");
        profileId = profile.id;
      }

      const subtotal = cartTotal;
      const total = cartTotal;

      const { data: orderRow, error: orderErr } = await supabase
        .from("orders")
        .insert({
          customer_id: profileId!,
          popup_event_id: selectedEvent.id,
          status: "confirmed",
          order_source: "public_popup",
          customer_name_snapshot: fullNameTrim,
          customer_email_snapshot: emailNorm,
          customer_phone_snapshot: phoneTrim,
          notes: form.notes.trim() || null,
          subtotal,
          discount_amount: 0,
          total,
          invoice_date: selectedEvent.event_date,
          created_by: null,
        })
        .select("id, order_number")
        .single();

      if (orderErr || !orderRow) throw orderErr ?? new Error("Order aanmaken mislukt");

      const items = cartLines.map((l) => ({
        order_id: orderRow.id,
        product_id: l.product_id,
        quantity: l.qty,
        unit_price: l.price,
        discount_amount: 0,
        total: l.qty * l.price,
      }));
      const { error: itemErr } = await supabase.from("order_items").insert(items);
      if (itemErr) throw itemErr;

      let newSubscriberId: string | null = null;
      if (form.optIn) {
        const { data: subRow, error: subErr } = await supabase
          .from("subscribers")
          .insert({
            full_name: form.full_name.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim() || null,
            source: "bestelpagina_optin",
            consent_marketing: true,
          })
          .select("id")
          .single();
        if (!subErr && subRow) newSubscriberId = subRow.id;
        // duplicate (23505) → skip welcome silently
      }

      // Fire-and-forget: order confirmation + (optional) welcome
      void supabase.functions
        .invoke("send-order-confirmation", { body: { order_id: orderRow.id } })
        .then((r) => r.error && console.error("order confirmation mail failed", r.error));

      if (newSubscriberId) {
        void supabase.functions
          .invoke("send-welcome-email", { body: { subscriber_id: newSubscriberId } })
          .then((r) => r.error && console.error("welcome mail failed", r.error));
      }

      setConfirmation({ orderNumber: orderRow.order_number, email: form.email.trim().toLowerCase() });
      setCheckoutOpen(false);
      setCart({});
      setForm({ full_name: "", email: "", phone: "", notes: "", optIn: true, honey: "" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Er ging iets mis";
      toast({ title: "Bestelling mislukt", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBannerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bannerForm.honey) return;
    if (!bannerForm.name.trim() || !bannerForm.email.trim()) {
      toast({ title: "Vul je naam en e-mail in", variant: "destructive" });
      return;
    }
    const { data: subRow, error } = await supabase
      .from("subscribers")
      .insert({
        full_name: bannerForm.name.trim(),
        email: bannerForm.email.trim().toLowerCase(),
        source: "bestelpagina_banner",
        consent_marketing: true,
      })
      .select("id")
      .single();
    if (error && error.code !== "23505" && !/duplicate/i.test(error.message)) {
      toast({ title: "Er ging iets mis", description: error.message, variant: "destructive" });
      return;
    }
    if (subRow?.id) {
      void supabase.functions
        .invoke("send-welcome-email", { body: { subscriber_id: subRow.id } })
        .then((r) => r.error && console.error("welcome mail failed", r.error));
    }
    setBannerSubmitted(true);
  };

  return (
    <PublicLayout>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBread} alt="Brood uit de oven" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <p className="bakery-eyebrow mb-3">Bosgoedt Bakery</p>
          <h1
            className="font-serif text-4xl sm:text-6xl font-medium leading-[1.0] max-w-3xl"
            style={{ letterSpacing: "-0.025em" }}
          >
            Zuurdesem en zoete lekkernijen,<br />vers gebakken in Oud-Turnhout
          </h1>
          <p className="mt-5 text-base sm:text-lg text-foreground/80 max-w-xl">
            Bestel hieronder voor onze aankomende pop-up.
          </p>
        </div>
      </section>

      {/* CONFIRMATION (inline) */}
      {confirmation && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="rounded-[var(--radius)] border border-[hsl(var(--sage))]/40 bg-[hsl(var(--sage))]/10 p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[hsl(var(--sage))]/20 flex items-center justify-center">
                <Check className="h-5 w-5 text-[hsl(var(--sage))]" />
              </div>
              <h2 className="font-serif text-2xl">Bedankt voor je bestelling!</h2>
            </div>
            <p>
              Bestelnummer: <strong>#{confirmation.orderNumber}</strong>
            </p>
            <p className="text-sm text-foreground/80">
              We hebben je een bevestigingsmail gestuurd op <strong>{confirmation.email}</strong>. Bij ophalen
              kun je betalen via overboeking of cash.
            </p>
            <Button variant="outline" onClick={() => setConfirmation(null)}>
              Nog een bestelling plaatsen
            </Button>
          </div>
        </section>
      )}

      {/* EVENT SELECTOR */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {loading ? (
          <p className="text-muted-foreground">Pop-ups laden…</p>
        ) : events.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-border/60 bg-muted/30 p-6 sm:p-8 text-center space-y-4">
            <h2 className="font-serif text-2xl">Geen geplande pop-up op dit moment</h2>
            <p className="text-foreground/80 max-w-lg mx-auto">
              Vul hieronder je e-mail in en je hoort als eerste wanneer de volgende komt.
            </p>
          </div>
        ) : events.length === 1 ? (
          <EventHeader event={events[0]} />
        ) : (
          <>
            <h2 className="font-serif text-2xl sm:text-3xl mb-6" style={{ letterSpacing: "-0.02em" }}>
              Kies een pop-up
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((ev) => {
                const isActive = ev.id === selectedEventId;
                return (
                  <button
                    key={ev.id}
                    onClick={() => handleSelectEvent(ev.id)}
                    className={`text-left rounded-[var(--radius)] border p-5 transition-all min-h-[44px] ${
                      isActive
                        ? "border-foreground bg-card shadow-[0_4px_24px_-12px_hsl(var(--ink)/0.2)]"
                        : "border-border/60 bg-card/60 hover:border-foreground/40 hover:bg-card"
                    }`}
                  >
                    <div className="flex items-baseline gap-3 mb-3">
                      <span className="font-serif text-5xl leading-none" style={{ letterSpacing: "-0.03em" }}>
                        {formatDay(ev.event_date)}
                      </span>
                      <span className="bakery-eyebrow">{formatMonth(ev.event_date)}</span>
                    </div>
                    <p className="font-medium text-base">{ev.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatTime(ev.pickup_start_time)} — {formatTime(ev.pickup_end_time)}
                    </p>
                    {ev.location_name && (
                      <p className="text-sm text-muted-foreground">{ev.location_name}</p>
                    )}
                    <p className="text-xs text-muted-foreground/80 mt-3">
                      Bestellen sluit {format(parseISO(ev.ordering_closes_at), "d MMM 'om' HH:mm", { locale: nl })}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* MENU + CART */}
      {selectedEvent && (
        <section id="menu-section" className="max-w-5xl mx-auto px-4 sm:px-6 pb-32 sm:pb-12">
          {events.length > 1 && <EventHeader event={selectedEvent} />}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 mt-6">
            {/* MENU LIST */}
            <div className="space-y-4">
              <h3 className="font-serif text-xl">Menu</h3>
              {menuLoading ? (
                <p className="text-muted-foreground">Menu laden…</p>
              ) : menu.length === 0 ? (
                <p className="text-muted-foreground">Geen producten beschikbaar voor deze pop-up.</p>
              ) : (
                menu.map((item) => {
                  const qty = cart[item.product_id] ?? 0;
                  return (
                    <article
                      key={item.popup_event_product_id}
                      className="flex gap-4 p-4 rounded-[var(--radius)] border border-border/60 bg-card/60"
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-20 w-20 sm:h-24 sm:w-24 rounded-md object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-md bg-muted flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">{item.name}</p>
                            {item.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                                {item.description}
                              </p>
                            )}
                            <p className="text-sm font-medium mt-1">{formatEUR(item.price)}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-11 w-11"
                            onClick={() => setQty(item.product_id, qty - 1, item.max_quantity)}
                            disabled={qty === 0}
                            aria-label="Minder"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min={0}
                            max={item.max_quantity ?? 99}
                            value={qty}
                            onChange={(e) =>
                              setQty(item.product_id, Number(e.target.value) || 0, item.max_quantity)
                            }
                            className="h-11 w-16 text-center"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-11 w-11"
                            onClick={() => setQty(item.product_id, qty + 1, item.max_quantity)}
                            disabled={item.max_quantity != null && qty >= item.max_quantity}
                            aria-label="Meer"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          {item.max_quantity != null && (
                            <span className="text-xs text-muted-foreground ml-1">
                              max {item.max_quantity}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {/* DESKTOP CART */}
            <aside className="hidden lg:block">
              <div className="sticky top-20 rounded-[var(--radius)] border border-border/60 bg-card p-5 space-y-4">
                <h3 className="font-serif text-lg flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" /> Je mandje
                </h3>
                <CartContent lines={cartLines} total={cartTotal} />
                <Button
                  className="w-full min-h-[44px]"
                  disabled={cartLines.length === 0}
                  onClick={() => setCheckoutOpen(true)}
                >
                  Plaats je bestelling
                </Button>
              </div>
            </aside>
          </div>
        </section>
      )}

      {/* MOBILE STICKY CART */}
      {selectedEvent && cartLines.length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur-sm p-3 pb-safe">
          <Button
            className="w-full min-h-[48px]"
            onClick={() => setCheckoutOpen(true)}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {cartCount} {cartCount === 1 ? "item" : "items"} — {formatEUR(cartTotal)} — Bestellen
          </Button>
        </div>
      )}

      {/* OPT-IN BANNER */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="rounded-[var(--radius)] border border-border/60 bg-muted/30 p-6 sm:p-8">
          <h2 className="font-serif text-2xl sm:text-3xl mb-2" style={{ letterSpacing: "-0.02em" }}>
            Niet vandaag? Geen probleem.
          </h2>
          <p className="text-foreground/80 mb-5 max-w-xl">
            Laat je e-mail achter en je krijgt het menu van onze volgende pop-up direct in je
            mailbox — twee weken voor de datum.
          </p>
          {bannerSubmitted ? (
            <p className="font-medium">Top — je staat erop. Tot bij de volgende pop-up 🍞</p>
          ) : (
            <form onSubmit={handleBannerSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={bannerForm.honey}
                onChange={(e) => setBannerForm({ ...bannerForm, honey: e.target.value })}
                className="hidden"
                aria-hidden
              />
              <Input
                placeholder="Naam"
                value={bannerForm.name}
                onChange={(e) => setBannerForm({ ...bannerForm, name: e.target.value })}
                required
                className="h-11"
              />
              <Input
                type="email"
                placeholder="E-mailadres"
                value={bannerForm.email}
                onChange={(e) => setBannerForm({ ...bannerForm, email: e.target.value })}
                required
                className="h-11"
              />
              <Button type="submit" className="min-h-[44px]">Houd me op de hoogte</Button>
            </form>
          )}
        </div>
      </section>

      {/* OVER */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 text-center space-y-4">
        <h2 className="font-serif text-2xl" style={{ letterSpacing: "-0.02em" }}>
          Over Bosgoedt Bakery
        </h2>
        <p className="text-foreground/80 max-w-xl mx-auto">
          Bosgoedt Bakery is het bakery-project van Nikki, in Oud-Turnhout. Zuurdesem brood met
          lange fermentatie, en zoete lekkernijen voor het weekend.
        </p>
        <Button asChild variant="outline">
          <Link to="/over">Lees meer →</Link>
        </Button>
      </section>

      {/* CHECKOUT DIALOG */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Je bestelling</DialogTitle>
          </DialogHeader>

          {selectedEvent && (
            <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
              <p>
                <strong>{selectedEvent.name}</strong>
              </p>
              <p className="text-muted-foreground">
                {formatLongDate(selectedEvent.event_date)} · {formatTime(selectedEvent.pickup_start_time)} —{" "}
                {formatTime(selectedEvent.pickup_end_time)}
              </p>
              {selectedEvent.location_name && (
                <p className="text-muted-foreground">{selectedEvent.location_name}</p>
              )}
            </div>
          )}

          <CartContent lines={cartLines} total={cartTotal} compact />

          <div className="space-y-4 pt-2">
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.honey}
              onChange={(e) => setForm({ ...form, honey: e.target.value })}
              className="hidden"
              aria-hidden
            />

            <div className="space-y-2">
              <Label htmlFor="cf-name">Volledige naam *</Label>
              <Input
                id="cf-name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-email">E-mailadres *</Label>
              <Input
                id="cf-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-phone">Telefoonnummer *</Label>
              <Input
                id="cf-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-11"
                placeholder="+32… of 0…"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-notes">Opmerkingen (optioneel)</Label>
              <Textarea
                id="cf-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Allergieën, speciale wensen…"
              />
            </div>

            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={form.optIn}
                onCheckedChange={(c) => setForm({ ...form, optIn: !!c })}
                className="mt-0.5"
              />
              <span>
                Ja, houd me op de hoogte van toekomstige Bosgoedt Bakery pop-ups via e-mail.
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Maximaal 1 mail per pop-up event, je kunt je altijd uitschrijven.
                </span>
              </span>
            </label>

            {selectedEvent && (
              <p className="text-xs text-muted-foreground border-t border-border/50 pt-3">
                Je betaalt ter plekke met overboeking of cash bij ophalen op{" "}
                {formatLongDate(selectedEvent.event_date)}, tussen {formatTime(selectedEvent.pickup_start_time)} en{" "}
                {formatTime(selectedEvent.pickup_end_time)}.
              </p>
            )}

            <Button onClick={handleSubmitOrder} disabled={submitting} className="w-full min-h-[48px]">
              {submitting ? "Bezig…" : "Bevestig bestelling"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
};

const EventHeader = ({ event }: { event: PopupEvent }) => (
  <div className="rounded-[var(--radius)] border border-border/60 bg-card p-5 sm:p-6">
    <div className="flex items-baseline gap-3">
      <span className="font-serif text-5xl leading-none" style={{ letterSpacing: "-0.03em" }}>
        {formatDay(event.event_date)}
      </span>
      <span className="bakery-eyebrow">{formatMonth(event.event_date)}</span>
    </div>
    <h2 className="font-serif text-2xl mt-2" style={{ letterSpacing: "-0.02em" }}>
      {event.name}
    </h2>
    <p className="text-sm text-muted-foreground mt-1">
      {formatTime(event.pickup_start_time)} — {formatTime(event.pickup_end_time)}
      {event.location_name && ` · ${event.location_name}`}
    </p>
    {event.description && <p className="text-sm text-foreground/80 mt-3">{event.description}</p>}
  </div>
);

const CartContent = ({
  lines,
  total,
  compact = false,
}: {
  lines: Array<MenuItem & { qty: number }>;
  total: number;
  compact?: boolean;
}) => {
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">Je mandje is nog leeg.</p>;
  }
  return (
    <div className="space-y-2">
      <ul className={`space-y-1.5 ${compact ? "max-h-40 overflow-y-auto" : ""}`}>
        {lines.map((l) => (
          <li key={l.product_id} className="flex justify-between text-sm">
            <span className="truncate">
              {l.qty}× {l.name}
            </span>
            <span className="tabular-nums">{formatEUR(l.qty * l.price)}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-border/60 pt-2 flex justify-between font-medium">
        <span>Totaal</span>
        <span className="tabular-nums">{formatEUR(total)}</span>
      </div>
    </div>
  );
};

export default Order;
