import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addWeeks,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { nl } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
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
  | "is_orderable"
>;

type Offering = Database["public"]["Tables"]["weekly_product_offerings"]["Row"];

/**
 * Monday of the week that `date` falls in. We use Monday to match the
 * Postgres `date_trunc('week', ...)` RLS on `weekly_product_offerings` and
 * the way weekly menus were modeled.
 */
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
  `€${Number(value ?? 0).toLocaleString("nl-NL", {
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
  const { toast } = useToast();

  const selectedIso = toISODate(selectedMonday);

  /** Fetch every orderable product — the list of candidates for the week. */
  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, selling_price, sell_unit_quantity, sell_unit_unit, image_url, is_orderable",
      )
      .eq("is_orderable", true)
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

  /** Fetch existing offerings for the currently-selected week. */
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
      // Seed the override-input drafts from the stored values so the inputs
      // reflect the DB state but don't fight the user's in-progress typing.
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

  // Refresh when the tab becomes visible again — so switching between
  // tabs / apps picks up changes made elsewhere.
  const refresh = useCallback(() => {
    fetchProducts();
    fetchOfferings(selectedIso);
  }, [fetchProducts, fetchOfferings, selectedIso]);
  useVisibilityRefresh(refresh);

  /** Five-week strip: this week + four upcoming weeks. */
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
    if (!existing) return; // Only saveable once the product is on offer.

    const raw = overrideDrafts[product.id] ?? "";
    const parsed = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
      toast({
        title: "Ongeldige prijs",
        description: `"${raw}" is geen geldig bedrag.`,
        variant: "destructive",
      });
      // Revert draft to stored value.
      setOverrideDrafts((prev) => ({
        ...prev,
        [product.id]:
          existing.price_override != null ? String(existing.price_override) : "",
      }));
      return;
    }
    if (parsed === Number(existing.price_override ?? NaN)) return; // no change

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

  return (
    <div className="space-y-8">
      {/* Header: prev / week-pills / next + friendly subtitle. */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedMonday((d) => subWeeks(d, 1))}
            aria-label="Vorige week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1 overflow-x-auto">
            {weekStrip.map((monday) => {
              const active = isSameDay(monday, selectedMonday);
              const { week, range } = formatWeekLabel(monday);
              return (
                <button
                  key={toISODate(monday)}
                  onClick={() => setSelectedMonday(monday)}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                >
                  <div className="text-xs font-medium leading-tight">{week}</div>
                  <div
                    className={`text-[11px] leading-tight ${
                      active ? "text-primary-foreground/80" : "text-muted-foreground"
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
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedMonday((d) => addWeeks(d, 1))}
            aria-label="Volgende week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          {selectedLabel.week} ·{" "}
          {countOnOffer === 0
            ? "nog niks op aanbod"
            : countOnOffer === 1
              ? "1 product op aanbod"
              : `${countOnOffer} producten op aanbod`}
        </p>
      </div>

      {/* Body: one row per orderable product. */}
      <div className="divide-y divide-border rounded-lg border">
        {loading && products.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Laden…</div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nog geen bestelbare producten. Zet producten op "Separaat te bestellen door klanten"
            om ze hier te zien.
          </div>
        ) : (
          products.map((product) => {
            const offering = offeringsByProductId[product.id];
            const isOn = Boolean(offering);
            return (
              <div
                key={product.id}
                className="flex items-center gap-4 px-4 py-3"
              >
                {/* Thumb */}
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt=""
                    className="h-12 w-12 flex-shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-muted/40">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}

                {/* Name + base price */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{product.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {euro(product.selling_price)} {sellUnitLabel(product)}
                  </div>
                </div>

                {/* Optional week-price override (only when on aanbod) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Weekprijs</span>
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

                {/* On / off toggle */}
                <Switch
                  checked={isOn}
                  onCheckedChange={(checked) => onToggleOffer(product, checked)}
                  aria-label={`${product.name} op aanbod`}
                />
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Klanten zien alleen producten met een ingeschakeld aanbod voor deze week.
        Laat de weekprijs leeg om de standaardprijs te gebruiken.
      </p>
    </div>
  );
};

export default WeeklyOfferingsTab;
