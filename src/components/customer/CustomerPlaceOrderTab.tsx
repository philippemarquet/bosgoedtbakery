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
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  MapPin,
  Minus,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UNIT_LABELS_SHORT, type MeasurementUnit } from "@/lib/units";
import {
  computeOrderTotals,
  type DiscountGroupForPricing,
  type OrderLine,
  type ProductForPricing,
  type ProductPriceTier,
  type WeeklyOfferingForPricing,
} from "@/lib/pricing";
import type { Database } from "@/integrations/supabase/types";

/**
 * Customer-facing ordering flow.
 *
 * Shows, per week, the products the baker has put on offer. The customer picks
 * quantities directly in the list, the totals block at the bottom adds up using
 * the single `computeOrderTotals` helper (which handles weekly price overrides,
 * volume tiers, discount groups, and the customer's personal discount), and
 * "Bestelling plaatsen" writes an order + line-items in one go. No dialog — the
 * whole flow lives on one quiet scroll.
 */

type Product = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  | "id"
  | "name"
  | "selling_price"
  | "recipe_yield_quantity"
  | "recipe_yield_unit"
  | "sell_unit_quantity"
  | "sell_unit_unit"
  | "image_url"
  | "category_id"
>;

type Offering = Database["public"]["Tables"]["weekly_product_offerings"]["Row"];
type Category = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "name"
>;
type PickupLocation = Pick<
  Database["public"]["Tables"]["pickup_locations"]["Row"],
  "id" | "title" | "street" | "house_number" | "postal_code" | "city"
>;
type PriceTierRow = Pick<
  Database["public"]["Tables"]["product_price_tiers"]["Row"],
  "product_id" | "min_quantity" | "price"
>;

interface DiscountGroupRow {
  id: string;
  tiers: { min_quantity: number; discount_percentage: number }[];
  product_ids: string[];
}

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

const sellUnitLabel = (
  product: Pick<Product, "sell_unit_quantity" | "sell_unit_unit">,
) => {
  const unit = UNIT_LABELS_SHORT[product.sell_unit_unit as MeasurementUnit];
  if (Number(product.sell_unit_quantity) === 1) return `per ${unit}`;
  return `per ${product.sell_unit_quantity} ${unit}`;
};

const CustomerPlaceOrderTab = ({
  onOrderCreated,
}: {
  onOrderCreated?: () => void;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedMonday, setSelectedMonday] = useState<Date>(() => mondayOf(new Date()));
  const selectedIso = toISODate(selectedMonday);

  // Data from Supabase.
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [priceTiersByProductId, setPriceTiersByProductId] = useState<
    Record<string, ProductPriceTier[]>
  >({});
  const [discountGroups, setDiscountGroups] = useState<DiscountGroupForPricing[]>([]);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [customerProfile, setCustomerProfile] = useState<
    { id: string; discount_percentage: number } | null
  >(null);

  // Cart state — simply a map of product_id to units ordered.
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedPickupLocationId, setSelectedPickupLocationId] = useState<string>("");
  const [customPickupLocation, setCustomPickupLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  /** One-shot fetch of all reference data that's the same across weeks. */
  const fetchReferenceData = useCallback(async () => {
    const [
      productsRes,
      categoriesRes,
      tiersRes,
      groupsRes,
      groupTiersRes,
      groupProductsRes,
      locationsRes,
    ] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id, name, selling_price, recipe_yield_quantity, recipe_yield_unit, sell_unit_quantity, sell_unit_unit, image_url, category_id",
        )
        .eq("is_orderable", true)
        .order("name"),
      supabase.from("categories").select("id, name").order("name"),
      supabase.from("product_price_tiers").select("product_id, min_quantity, price"),
      supabase.from("discount_groups").select("id"),
      supabase
        .from("discount_group_tiers")
        .select("discount_group_id, min_quantity, discount_percentage"),
      supabase.from("product_discount_groups").select("product_id, discount_group_id"),
      supabase
        .from("pickup_locations")
        .select("id, title, street, house_number, postal_code, city")
        .eq("is_active", true)
        .order("title"),
    ]);

    if (productsRes.error) {
      toast({
        title: "Kon producten niet laden",
        description: productsRes.error.message,
        variant: "destructive",
      });
    }
    setProducts(productsRes.data ?? []);
    setCategories(categoriesRes.data ?? []);

    const tiersByProduct: Record<string, ProductPriceTier[]> = {};
    for (const row of (tiersRes.data ?? []) as PriceTierRow[]) {
      const list = tiersByProduct[row.product_id] ?? [];
      list.push({ min_quantity: row.min_quantity, price: Number(row.price) });
      tiersByProduct[row.product_id] = list;
    }
    setPriceTiersByProductId(tiersByProduct);

    // Assemble discount groups from the three sub-queries.
    const tiersByGroup: Record<
      string,
      { min_quantity: number; discount_percentage: number }[]
    > = {};
    for (const row of groupTiersRes.data ?? []) {
      const list = tiersByGroup[row.discount_group_id] ?? [];
      list.push({
        min_quantity: row.min_quantity,
        discount_percentage: Number(row.discount_percentage),
      });
      tiersByGroup[row.discount_group_id] = list;
    }
    const productsByGroup: Record<string, string[]> = {};
    for (const row of groupProductsRes.data ?? []) {
      const list = productsByGroup[row.discount_group_id] ?? [];
      list.push(row.product_id);
      productsByGroup[row.discount_group_id] = list;
    }
    const groups: DiscountGroupForPricing[] = (groupsRes.data ?? []).map((g) => ({
      id: g.id,
      tiers: tiersByGroup[g.id] ?? [],
      product_ids: productsByGroup[g.id] ?? [],
    }));
    setDiscountGroups(groups);

    setPickupLocations(locationsRes.data ?? []);
  }, [toast]);

  /** Offerings change per week, so this one re-runs on week change. */
  const fetchOfferings = useCallback(
    async (weekStart: string) => {
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
        return;
      }
      setOfferings(data ?? []);
    },
    [toast],
  );

  /** The customer's own profile row — used for the personal discount. */
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, discount_percentage")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setCustomerProfile({
        id: data.id,
        discount_percentage: Number(data.discount_percentage ?? 0),
      });
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchReferenceData(), fetchProfile()]).finally(() => setLoading(false));
  }, [fetchReferenceData, fetchProfile]);

  useEffect(() => {
    fetchOfferings(selectedIso);
    // Reset cart state when switching weeks — avoids accidentally placing an
    // order for week X with items you picked while viewing week Y.
    setQuantities({});
  }, [fetchOfferings, selectedIso]);

  const refresh = useCallback(() => {
    fetchReferenceData();
    fetchOfferings(selectedIso);
    fetchProfile();
  }, [fetchReferenceData, fetchOfferings, fetchProfile, selectedIso]);
  useVisibilityRefresh(refresh);

  /** Five-week strip starting at this week's Monday. */
  const weekStrip = useMemo(() => {
    const today = mondayOf(new Date());
    return Array.from({ length: 5 }, (_, i) => addWeeks(today, i));
  }, []);

  /** Offerings reshaped into a product-keyed map for quick lookup. */
  const offeringsByProductId = useMemo(() => {
    const map: Record<string, WeeklyOfferingForPricing> = {};
    for (const o of offerings) {
      map[o.product_id] = {
        product_id: o.product_id,
        price_override: o.price_override != null ? Number(o.price_override) : null,
      };
    }
    return map;
  }, [offerings]);

  /** Products that are on offer this week, joined with category name. */
  const offeredProducts = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    return offerings
      .map((o) => {
        const product = byId.get(o.product_id);
        if (!product) return null;
        return {
          product,
          offering: o,
          category_name: product.category_id
            ? catName.get(product.category_id) ?? "Zonder categorie"
            : "Zonder categorie",
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.product.name.localeCompare(b.product.name));
  }, [offerings, products, categories]);

  /** Group offered products by category, for visual grouping in the UI. */
  const productsByCategory = useMemo(() => {
    const groups = new Map<string, typeof offeredProducts>();
    for (const entry of offeredProducts) {
      const list = groups.get(entry.category_name) ?? [];
      list.push(entry);
      groups.set(entry.category_name, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "Zonder categorie") return 1;
      if (b === "Zonder categorie") return -1;
      return a.localeCompare(b);
    });
  }, [offeredProducts]);

  /** Cart → OrderLine[]. */
  const lines: OrderLine[] = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, q]) => q > 0)
        .map(([product_id, quantity]) => ({ product_id, quantity })),
    [quantities],
  );

  /** Map cart products to the shape `pricing.ts` needs. */
  const productsForPricing: ProductForPricing[] = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        selling_price: Number(p.selling_price),
        recipe_yield_quantity: Number(p.recipe_yield_quantity),
        recipe_yield_unit: p.recipe_yield_unit as MeasurementUnit,
        sell_unit_quantity: Number(p.sell_unit_quantity),
        sell_unit_unit: p.sell_unit_unit as MeasurementUnit,
      })),
    [products],
  );

  /** Full breakdown — single source of truth for what the customer pays. */
  const breakdown = useMemo(
    () =>
      computeOrderTotals({
        lines,
        products: productsForPricing,
        priceTiersByProductId,
        offeringsByProductId,
        discountGroups,
        customerDiscountPercentage: customerProfile?.discount_percentage ?? 0,
      }),
    [
      lines,
      productsForPricing,
      priceTiersByProductId,
      offeringsByProductId,
      discountGroups,
      customerProfile,
    ],
  );

  const setQty = (productId: string, next: number) => {
    setQuantities((prev) => {
      if (next <= 0) {
        const rest = { ...prev };
        delete rest[productId];
        return rest;
      }
      return { ...prev, [productId]: next };
    });
  };

  const handleSubmit = async () => {
    if (!user || !customerProfile) {
      toast({
        title: "Fout",
        description: "Je moet ingelogd zijn om te bestellen.",
        variant: "destructive",
      });
      return;
    }
    if (lines.length === 0) {
      toast({
        title: "Mandje is leeg",
        description: "Kies eerst één of meer producten.",
        variant: "destructive",
      });
      return;
    }
    if (
      !selectedPickupLocationId ||
      (selectedPickupLocationId === "anders" && !customPickupLocation.trim())
    ) {
      toast({
        title: "Afhaallocatie ontbreekt",
        description: "Kies een afhaallocatie (of vul er zelf één in).",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    const orderNotes =
      selectedPickupLocationId === "anders"
        ? `Afhaallocatie: ${customPickupLocation.trim()}${notes ? `\n${notes}` : ""}`
        : notes.trim() || null;

    const orderPayload = {
      customer_id: customerProfile.id,
      weekly_menu_id: null,
      weekly_menu_quantity: 1,
      pickup_location_id:
        selectedPickupLocationId === "anders" ? null : selectedPickupLocationId,
      notes: orderNotes,
      subtotal: Number(breakdown.subtotal.toFixed(2)),
      discount_amount: Number(breakdown.discount_amount.toFixed(2)),
      total: Number(breakdown.total.toFixed(2)),
      created_by: user.id,
      // invoice_date = chosen week's Monday. Baker decides the actual delivery
      // day within that week. Keeping it this simple for now.
      invoice_date: selectedIso,
      status: "confirmed" as const,
    };

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert(orderPayload)
      .select("id")
      .single();

    if (orderErr || !order) {
      toast({
        title: "Kon bestelling niet aanmaken",
        description: orderErr?.message ?? "Onbekende fout",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    const orderItems = breakdown.lines.map((l) => ({
      order_id: order.id,
      product_id: l.product_id,
      quantity: l.quantity,
      unit_price: Number(l.unit_price.toFixed(2)),
      discount_amount: Number(
        (l.group_discount_amount + l.customer_discount_amount).toFixed(2),
      ),
      total: Number(l.line_total.toFixed(2)),
      is_weekly_menu_item: false,
    }));

    if (orderItems.length > 0) {
      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) {
        toast({
          title: "Bestelling gemaakt, maar regels misten",
          description: itemsErr.message,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }
    }

    toast({
      title: "Bestelling geplaatst",
      description: "Dankjewel! Je kunt je bestelling terugvinden onder 'Mijn bestellingen'.",
    });

    setQuantities({});
    setSelectedPickupLocationId("");
    setCustomPickupLocation("");
    setNotes("");
    setSubmitting(false);
    onOrderCreated?.();
  };

  const selectedLabel = formatWeekLabel(selectedMonday);
  const lineCount = lines.reduce((acc, l) => acc + l.quantity, 0);

  return (
    <div className="space-y-8">
      {/* Header — week picker */}
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
                      active
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
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

        <div>
          <h3 className="font-serif text-2xl text-foreground">Bestelling plaatsen</h3>
          <p className="text-sm text-muted-foreground">
            {selectedLabel.week} · {selectedLabel.range}
          </p>
        </div>
      </div>

      {/* Offered products, grouped by category */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Laden…</div>
      ) : offeredProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Er is deze week nog niks op aanbod.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Probeer een andere week of kom later terug.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {productsByCategory.map(([categoryName, entries]) => (
            <section key={categoryName} className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {categoryName}
              </h4>
              <div className="divide-y divide-border rounded-lg border">
                {entries.map(({ product, offering }) => {
                  const qty = quantities[product.id] ?? 0;
                  const override =
                    offering.price_override != null ? Number(offering.price_override) : null;
                  const displayPrice = override ?? Number(product.selling_price);
                  return (
                    <div
                      key={product.id}
                      className="flex items-center gap-4 px-4 py-3"
                    >
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

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {euro(displayPrice)} {sellUnitLabel(product)}
                          {override != null && (
                            <span className="ml-2 text-[11px] uppercase tracking-wider text-primary">
                              Weekprijs
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setQty(product.id, qty - 1)}
                          disabled={qty <= 0}
                          aria-label={`Minder ${product.name}`}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={qty || ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") return setQty(product.id, 0);
                            const n = Math.max(0, Math.floor(Number(raw)));
                            setQty(product.id, Number.isFinite(n) ? n : 0);
                          }}
                          placeholder="0"
                          className="h-8 w-14 text-center tabular-nums"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setQty(product.id, qty + 1)}
                          aria-label={`Meer ${product.name}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Pickup + notes + totals + submit */}
      {offeredProducts.length > 0 && (
        <div className="space-y-6 rounded-lg border bg-card p-6">
          <h4 className="text-sm font-medium">Afronden</h4>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4" />
              Afhaallocatie
            </Label>
            <Select
              value={selectedPickupLocationId}
              onValueChange={setSelectedPickupLocationId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer afhaallocatie" />
              </SelectTrigger>
              <SelectContent>
                {pickupLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{location.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {location.street} {location.house_number ?? ""}, {location.city}
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
                placeholder="Vul je gewenste afhaallocatie in…"
                value={customPickupLocation}
                onChange={(e) => setCustomPickupLocation(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="order-notes" className="text-sm">
              Opmerkingen (optioneel)
            </Label>
            <Textarea
              id="order-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Iets wat we moeten weten?"
              rows={2}
            />
          </div>

          <Separator />

          {/* Running totals block. */}
          <div className="space-y-2 text-sm">
            {breakdown.lines.map((l) => {
              const product = products.find((p) => p.id === l.product_id);
              if (!product) return null;
              return (
                <div
                  key={l.product_id}
                  className="flex items-center justify-between text-muted-foreground"
                >
                  <span>
                    {l.quantity}× {product.name}
                  </span>
                  <span className="tabular-nums">{euro(l.line_subtotal)}</span>
                </div>
              );
            })}
            {breakdown.lines.length > 0 && <Separator />}
            <div className="flex items-center justify-between">
              <span>Subtotaal</span>
              <span className="tabular-nums">{euro(breakdown.subtotal)}</span>
            </div>
            {breakdown.group_discount_amount > 0 && (
              <div className="flex items-center justify-between text-primary">
                <span>Groepskorting</span>
                <span className="tabular-nums">
                  −{euro(breakdown.group_discount_amount)}
                </span>
              </div>
            )}
            {breakdown.customer_discount_amount > 0 && (
              <div className="flex items-center justify-between text-primary">
                <span>
                  Persoonlijke korting ({customerProfile?.discount_percentage ?? 0}%)
                </span>
                <span className="tabular-nums">
                  −{euro(breakdown.customer_discount_amount)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between text-base font-medium">
              <span>Totaal</span>
              <span className="tabular-nums">{euro(breakdown.total)}</span>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || lineCount === 0}
            className="w-full"
            size="lg"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {submitting
              ? "Bezig…"
              : lineCount === 0
                ? "Kies eerst producten"
                : `Bestelling plaatsen (${lineCount} ${
                    lineCount === 1 ? "product" : "producten"
                  })`}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CustomerPlaceOrderTab;
