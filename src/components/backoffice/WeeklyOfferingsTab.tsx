import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addWeeks,
  format,
  isSameDay,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { nl } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { UNIT_LABELS_SHORT, type MeasurementUnit } from "@/lib/units";
import type { Database } from "@/integrations/supabase/types";

type Product = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  | "id"
  | "name"
  | "selling_price"
  | "sell_unit_quantity"
  | "sell_unit_unit"
  | "image_url"
>;

type Offering = Database["public"]["Tables"]["weekly_product_offerings"]["Row"];

const mondayOf = (date: Date) => startOfWeek(date, { weekStartsOn: 1 });

const toISODate = (date: Date) => format(date, "yyyy-MM-dd");

const formatWeekLabel = (date: Date) => {
  const start = mondayOf(date);
  const week = format(start, "w", { locale: nl });
  return {
    week: `Week ${week}`,
    range: `${format(start, "d MMM", { locale: nl })} – ${format(
      addWeeks(start, 1),
      "d MMM",
      { locale: nl },
    )}`,
  };
};

const euro = (value: number | null | undefined) =>
  `€ ${Number(value ?? 0).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const sellUnitLabel = (product: Pick<Product, "sell_unit_quantity" | "sell_unit_unit">) => {
  const unit = UNIT_LABELS_SHORT[product.sell_unit_unit as MeasurementUnit];
  if (Number(product.sell_unit_quantity) === 1) return `per ${unit}`;
  return `per ${product.sell_unit_quantity} ${unit}`;
};

const WeeklyOfferingsTab = () => {
  const [selectedMonday, setSelectedMonday] = useState<Date>(() => mondayOf(new Date()));
  const [products, setProducts] = useState<Product[]>([]);
  const [offeringsByProductId, setOfferingsByProductId] = useState<Record<string, Offering>>({});
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const { toast } = useToast();

  const selectedIso = toISODate(selectedMonday);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, selling_price, sell_unit_quantity, sell_unit_unit, image_url",
      )
      .order("name");
    if (error) {
      toast({
        title: "Kon producten niet laden",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setProducts(data ?? []);
  }, [toast]);

  const fetchOfferings = useCallback(
    async (weekStart: string) => {
      setLoading(true);
      const { data, error } = await supabase
        .from("weekly_product_offerings")
        .select("*")
        .eq("week_start_date", weekStart);
      if (error) {
        toast({
          title: "Kon weekaanbod niet laden",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const byId: Record<string, Offering> = {};
      for (const row of data ?? []) byId[row.product_id] = row;
      setOfferingsByProductId(byId);
      setOverrideDrafts(
        Object.fromEntries(
          Object.entries(byId).map(([pid, off]) => [
            pid,
            off.price_override != null ? String(off.price_override) : "",
          ]),
        ),
      );
      setLoading(false);
    },
    [toast],
  );

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchOfferings(selectedIso);
  }, [fetchOfferings, selectedIso]);

  const refresh = useCallback(() => {
    fetchProducts();
    fetchOfferings(selectedIso);
  }, [fetchProducts, fetchOfferings, selectedIso]);
  useVisibilityRefresh(refresh);

  const weekStrip = useMemo(() => {
    const today = mondayOf(new Date());
    return Array.from({ length: 5 }, (_, i) => addWeeks(today, i));
  }, []);

  const onToggleOffer = async (product: Product, nextOn: boolean) => {
    const existing = offeringsByProductId[product.id];

    if (nextOn && !existing) {
      const { data, error } = await supabase
        .from("weekly_product_offerings")
        .insert({
          product_id: product.id,
          week_start_date: selectedIso,
          price_override: null,
        })
        .select("*")
        .single();
      if (error || !data) {
        toast({
          title: "Kon niet op aanbod zetten",
          description: error?.message ?? "Onbekende fout",
          variant: "destructive",
        });
        return;
      }
      setOfferingsByProductId((prev) => ({ ...prev, [product.id]: data }));
      return;
    }

    if (!nextOn && existing) {
      const { error } = await supabase
        .from("weekly_product_offerings")
        .delete()
        .eq("id", existing.id);
      if (error) {
        toast({
          title: "Kon niet van aanbod halen",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      setOfferingsByProductId((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      setOverrideDrafts((prev) => ({ ...prev, [product.id]: "" }));
    }
  };

  const saveOverride = async (product: Product) => {
    const existing = offeringsByProductId[product.id];
    if (!existing) return;

    const raw = overrideDrafts[product.id] ?? "";
    const parsed = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
      toast({
        title: "Ongeldige prijs",
        description: `"${raw}" is geen geldig bedrag.`,
        variant: "destructive",
      });
      setOverrideDrafts((prev) => ({
        ...prev,
        [product.id]:
          existing.price_override != null ? String(existing.price_override) : "",
      }));
      return;
    }
    if (parsed === Number(existing.price_override ?? NaN)) return;

    const { data, error } = await supabase
      .from("weekly_product_offerings")
      .update({ price_override: parsed })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) {
      toast({
        title: "Kon weekprijs niet opslaan",
        description: error?.message ?? "Onbekende fout",
        variant: "destructive",
      });
      return;
    }
    setOfferingsByProductId((prev) => ({ ...prev, [product.id]: data }));
  };

  const selectedLabel = formatWeekLabel(selectedMonday);
  const countOnOffer = Object.keys(offeringsByProductId).length;

  const offeredProducts = useMemo(
    () => products.filter((p) => Boolean(offeringsByProductId[p.id])),
    [products, offeringsByProductId],
  );

  const normalizedAddQuery = addSearchQuery.trim().toLowerCase();
  const addableProducts = useMemo(() => {
    const notYetOffered = products.filter((p) => !offeringsByProductId[p.id]);
    if (!normalizedAddQuery) return notYetOffered;
    return notYetOffered.filter((p) =>
      p.name.toLowerCase().includes(normalizedAddQuery),
    );
  }, [products, offeringsByProductId, normalizedAddQuery]);

  const handleAddProduct = async (product: Product) => {
    await onToggleOffer(product, true);
  };

  // Reset the dialog's search whenever it closes
  useEffect(() => {
    if (!addDialogOpen) setAddSearchQuery("");
  }, [addDialogOpen]);

  return (
    <div className="space-y-8">
      <div>
        <p className="bakery-eyebrow mb-2">Back-office</p>
        <h2
          className="font-serif text-3xl md:text-4xl font-medium text-foreground leading-tight"
          style={{ letterSpacing: "-0.02em" }}
        >
          Weekaanbod
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Kies per week welke producten op de lijst staan. Voeg een product toe,
          pas de weekprijs aan of haal het weer van het aanbod af — laat de
          weekprijs leeg om de standaardprijs te gebruiken.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/60"
            onClick={() => setSelectedMonday((d) => subWeeks(d, 1))}
            aria-label="Vorige week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1.5 overflow-x-auto scroll-soft flex-1">
            {weekStrip.map((monday) => {
              const active = isSameDay(monday, selectedMonday);
              const { week, range } = formatWeekLabel(monday);
              return (
                <button
                  key={toISODate(monday)}
                  onClick={() => setSelectedMonday(monday)}
                  className={`rounded-[calc(var(--radius)-4px)] px-3.5 py-2 text-left transition-colors flex-shrink-0 border ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card border-border/60 hover:bg-muted/60"
                  }`}
                >
                  <div className="text-xs font-medium leading-tight">{week}</div>
                  <div
                    className={`text-[11px] leading-tight mt-0.5 ${
                      active ? "text-background/75" : "text-muted-foreground"
                    }`}
                  >
                    {range}
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/60"
            onClick={() => setSelectedMonday((d) => addWeeks(d, 1))}
            aria-label="Volgende week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[11px] tracking-[0.08em] uppercase text-muted-foreground">
            {selectedLabel.week} ·{" "}
            <span className="normal-case tracking-normal">
              {countOnOffer === 0
                ? "nog niks op aanbod"
                : countOnOffer === 1
                  ? "1 product op aanbod"
                  : `${countOnOffer} producten op aanbod`}
            </span>
          </p>

          <Button
            onClick={() => setAddDialogOpen(true)}
            size="sm"
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Product toevoegen
          </Button>
        </div>
      </div>

      <div className="paper-card overflow-hidden">
        {loading && products.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
            Laden…
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground px-6">
            Nog geen producten. Voeg er een toe via Back-office → Producten.
          </div>
        ) : offeredProducts.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground px-6 space-y-3">
            <p>Nog niks op het aanbod deze week.</p>
            <Button
              onClick={() => setAddDialogOpen(true)}
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Product toevoegen
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {offeredProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-4 px-5 py-3.5 bg-card"
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt=""
                    className="h-12 w-12 flex-shrink-0 rounded-[calc(var(--radius)-4px)] object-cover shadow-paper"
                  />
                ) : (
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[calc(var(--radius)-4px)] bg-muted/60">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-foreground">{product.name}</div>
                  <div className="text-[11px] tracking-[0.04em] text-muted-foreground mt-0.5 tabular-nums">
                    {euro(product.selling_price)}{" "}
                    <span className="text-muted-foreground/80">{sellUnitLabel(product)}</span>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-[11px] tracking-[0.06em] uppercase text-muted-foreground">
                    Weekprijs
                  </span>
                  <div className="flex items-center">
                    <span className="mr-1 text-sm text-muted-foreground">€</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder={Number(product.selling_price).toFixed(2)}
                      value={overrideDrafts[product.id] ?? ""}
                      onChange={(e) =>
                        setOverrideDrafts((prev) => ({
                          ...prev,
                          [product.id]: e.target.value,
                        }))
                      }
                      onBlur={() => saveOverride(product)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="h-8 w-24 tabular-nums"
                    />
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onToggleOffer(product, false)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  aria-label={`${product.name} van aanbod halen`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="space-y-1">
            <p className="bakery-eyebrow">Weekaanbod</p>
            <DialogTitle
              className="font-serif text-2xl font-medium leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              Product toevoegen
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Zoek een product en tik om het aan {selectedLabel.week.toLowerCase()} toe te voegen.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              type="search"
              value={addSearchQuery}
              onChange={(e) => setAddSearchQuery(e.target.value)}
              placeholder="Zoek product…"
              className="h-9 pl-9 pr-9"
            />
            {addSearchQuery && (
              <button
                type="button"
                onClick={() => setAddSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
                aria-label="Zoekveld leegmaken"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto -mx-6 px-6 mt-3 min-h-0">
            {addableProducts.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {normalizedAddQuery
                  ? <>Geen product gevonden voor &ldquo;{addSearchQuery}&rdquo;.</>
                  : "Alle producten staan al op het aanbod deze week."}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {addableProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleAddProduct(product)}
                    className="flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-muted/50 rounded-[calc(var(--radius)-4px)]"
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt=""
                        className="h-10 w-10 flex-shrink-0 rounded-[calc(var(--radius)-4px)] object-cover shadow-paper"
                      />
                    ) : (
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[calc(var(--radius)-4px)] bg-muted/60">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">{product.name}</div>
                      <div className="text-[11px] tracking-[0.04em] text-muted-foreground mt-0.5 tabular-nums">
                        {euro(product.selling_price)}{" "}
                        <span className="text-muted-foreground/80">{sellUnitLabel(product)}</span>
                      </div>
                    </div>
                    <Plus className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WeeklyOfferingsTab;
