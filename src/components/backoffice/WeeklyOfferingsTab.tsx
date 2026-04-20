import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addWeeks,
  format,
  isSameDay,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { nl } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  const [searchQuery, setSearchQuery] = useState("");
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

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleProducts = useMemo(() => {
    if (!normalizedQuery) return products;
    return products.filter((p) => p.name.toLowerCase().includes(normalizedQuery));
  }, [products, normalizedQuery]);

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
          Kies per week welke producten op de lijst staan. Zoek hieronder en zet
          ze op aanbod — laat de weekprijs leeg om de standaardprijs te gebruiken.
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

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek product…"
              className="h-9 pl-9"
            />
          </div>
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
        ) : visibleProducts.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground px-6">
            Geen product gevonden voor &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {visibleProducts.map((product) => {
              const offering = offeringsByProductId[product.id];
              const isOn = Boolean(offering);
              return (
                <div
                  key={product.id}
                  className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                    isOn ? "bg-card" : "bg-transparent"
                  }`}
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
                        disabled={!isOn}
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

                  <Switch
                    checked={isOn}
                    onCheckedChange={(checked) => onToggleOffer(product, checked)}
                    aria-label={`${product.name} op aanbod`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyOfferingsTab;
