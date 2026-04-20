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
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Hash,
  Image as ImageIcon,
  Lock,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  ShoppingCart,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
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
 * Baker-side order editor — reuses the clean customer flow.
 *
 * Layout mirrors `CustomerPlaceOrderTab`: week-strip → products-by-category
 * with plus/min steppers → pickup + notes → totals. The baker-specific bits
 * sit on top: a customer selector (picks the profile the order is being
 * placed for, which also drives customer-discount), a read-only banner for
 * orders that have moved past "confirmed", and a "Reset to Confirmed" action.
 *
 * Pricing runs through the shared `computeOrderTotals` helper. Weekly
 * offerings for the selected week become price overrides automatically, so
 * the same product can have a different price depending on which week the
 * baker is invoicing. Products that aren't on the weekly offering still show
 * up — the baker can always place a one-off order for anything in the catalog.
 */

interface Order {
  id: string;
  order_number?: number;
  status: string;
  notes: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  created_at: string;
  invoice_date?: string;
  customer: { id: string; full_name: string | null } | null;
  weekly_menu: { id: string; name: string; delivery_date: string | null } | null;
  weekly_menu_quantity?: number;
  pickup_location_id?: string | null;
}

type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "user_id" | "discount_percentage"
>;

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

type OfferingRow = Database["public"]["Tables"]["weekly_product_offerings"]["Row"];

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOrder: Order | null;
  onSave: () => void;
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

const OrderDialog = ({
  open,
  onOpenChange,
  editingOrder,
  onSave,
}: OrderDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Reference data
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceTiersByProductId, setPriceTiersByProductId] = useState<
    Record<string, ProductPriceTier[]>
  >({});
  const [discountGroups, setDiscountGroups] = useState<DiscountGroupForPricing[]>(
    [],
  );
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [offerings, setOfferings] = useState<OfferingRow[]>([]);

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedMonday, setSelectedMonday] = useState<Date>(() => mondayOf(new Date()));
  const [selectedPickupLocationId, setSelectedPickupLocationId] = useState<string>("");
  const [customPickupLocation, setCustomPickupLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(false);
  const [showEditWarning, setShowEditWarning] = useState(false);

  const selectedIso = toISODate(selectedMonday);

  // --- Fetches -----------------------------------------------------------

  /** Customers: every non-archived profile that isn't a baker. */
  useEffect(() => {
    if (!open) return;
    const run = async () => {
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, user_id, discount_percentage")
        .eq("is_archived", false)
        .order("full_name");

      if (!allProfiles) {
        setCustomers([]);
        return;
      }

      const { data: bakerRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "baker");
      const bakerUserIds = new Set((bakerRoles ?? []).map((r) => r.user_id));

      setCustomers(
        allProfiles.filter(
          (p) => !p.user_id || !bakerUserIds.has(p.user_id),
        ) as Profile[],
      );
    };
    run();
  }, [open]);

  /** Products + categories + tiers + discount groups + pickups. */
  useEffect(() => {
    if (!open) return;
    const run = async () => {
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

      setProducts(productsRes.data ?? []);
      setCategories(categoriesRes.data ?? []);

      const byProduct: Record<string, ProductPriceTier[]> = {};
      for (const row of (tiersRes.data ?? []) as PriceTierRow[]) {
        const list = byProduct[row.product_id] ?? [];
        list.push({ min_quantity: row.min_quantity, price: Number(row.price) });
        byProduct[row.product_id] = list;
      }
      setPriceTiersByProductId(byProduct);

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
    };
    run();
  }, [open]);

  /** Offerings for the selected week. */
  const fetchOfferings = useCallback(async (weekStart: string) => {
    const { data, error } = await supabase
      .from("weekly_product_offerings")
      .select("*")
      .eq("week_start_date", weekStart);
    if (error) {
      setOfferings([]);
      return;
    }
    setOfferings(data ?? []);
  }, []);

  useEffect(() => {
    if (open) fetchOfferings(selectedIso);
  }, [fetchOfferings, open, selectedIso]);

  /** Load an existing order into the form (or reset for a new one). */
  useEffect(() => {
    if (!open) return;

    if (!editingOrder) {
      setSelectedCustomerId("");
      setSelectedMonday(mondayOf(new Date()));
      setSelectedPickupLocationId("");
      setCustomPickupLocation("");
      setNotes("");
      setQuantities({});
      return;
    }

    setSelectedCustomerId(editingOrder.customer?.id ?? "");
    setSelectedPickupLocationId(editingOrder.pickup_location_id ?? "");
    setCustomPickupLocation("");
    setNotes(editingOrder.notes ?? "");
    if (editingOrder.invoice_date) {
      setSelectedMonday(mondayOf(parseISO(editingOrder.invoice_date)));
    } else {
      setSelectedMonday(mondayOf(new Date()));
    }

    // Aggregate existing order_items by product_id (weekmenu items and
    // extras get merged — the legacy weekly_menu link is cleared on save).
    const loadItems = async () => {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, quantity")
        .eq("order_id", editingOrder.id);
      const agg: Record<string, number> = {};
      for (const item of items ?? []) {
        agg[item.product_id] = (agg[item.product_id] ?? 0) + (item.quantity ?? 0);
      }
      setQuantities(agg);
    };
    loadItems();
  }, [editingOrder, open]);

  // --- Derived data ------------------------------------------------------

  const weekStrip = useMemo(() => {
    // For new orders, start from this-week. For existing orders, center the
    // strip a bit earlier so previous weeks remain reachable too.
    const start = editingOrder
      ? subWeeks(mondayOf(new Date()), 2)
      : mondayOf(new Date());
    return Array.from({ length: 7 }, (_, i) => addWeeks(start, i));
  }, [editingOrder]);

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

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const customerDiscountPercentage = Number(
    selectedCustomer?.discount_percentage ?? 0,
  );

  const lines: OrderLine[] = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, q]) => q > 0)
        .map(([product_id, quantity]) => ({ product_id, quantity })),
    [quantities],
  );

  const breakdown = useMemo(
    () =>
      computeOrderTotals({
        lines,
        products: productsForPricing,
        priceTiersByProductId,
        offeringsByProductId,
        discountGroups,
        customerDiscountPercentage,
      }),
    [
      lines,
      productsForPricing,
      priceTiersByProductId,
      offeringsByProductId,
      discountGroups,
      customerDiscountPercentage,
    ],
  );

  /** Products grouped by category — identical to the customer flow, only the
   * products on the selected week's offering are pickable. Existing order
   * lines for products that are no longer on the offering (e.g. when the
   * baker switches to a different week while editing) stay visible so the
   * quantity isn't silently lost; they just won't show up as fresh picks. */
  const visibleProducts = useMemo(() => {
    return products.filter(
      (p) => offeringsByProductId[p.id] || (quantities[p.id] ?? 0) > 0,
    );
  }, [products, offeringsByProductId, quantities]);

  const productsByCategory = useMemo(() => {
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const groups = new Map<string, Product[]>();
    for (const p of visibleProducts) {
      const key = p.category_id
        ? catName.get(p.category_id) ?? "Zonder categorie"
        : "Zonder categorie";
      const list = groups.get(key) ?? [];
      list.push(p);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "Zonder categorie") return 1;
      if (b === "Zonder categorie") return -1;
      return a.localeCompare(b);
    });
  }, [visibleProducts, categories]);

  // --- State / actions ---------------------------------------------------

  const isReadOnly =
    !!editingOrder &&
    (editingOrder.status === "in_production" ||
      editingOrder.status === "ready" ||
      editingOrder.status === "paid");

  const setQty = (productId: string, next: number) => {
    if (isReadOnly) return;
    setQuantities((prev) => {
      if (next <= 0) {
        const rest = { ...prev };
        delete rest[productId];
        return rest;
      }
      return { ...prev, [productId]: next };
    });
  };

  const handleResetToConfirmed = async () => {
    if (!editingOrder) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", editingOrder.id);
    if (error) {
      toast({
        title: "Fout",
        description: "Kon status niet wijzigen",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Status gewijzigd",
      description: "Bestelling is teruggezet naar 'Bevestigd'.",
    });
    onOpenChange(false);
    onSave();
  };

  const handleSave = async () => {
    if (!selectedCustomerId) {
      toast({
        title: "Klant ontbreekt",
        description: "Selecteer eerst een klant.",
        variant: "destructive",
      });
      return;
    }
    if (lines.length === 0) {
      toast({
        title: "Mandje is leeg",
        description: "Voeg minimaal één product toe.",
        variant: "destructive",
      });
      return;
    }
    if (
      selectedPickupLocationId === "anders" &&
      !customPickupLocation.trim()
    ) {
      toast({
        title: "Afhaallocatie ontbreekt",
        description: "Vul een afhaallocatie in.",
        variant: "destructive",
      });
      return;
    }

    if (
      editingOrder &&
      (editingOrder.status === "in_production" ||
        editingOrder.status === "ready" ||
        editingOrder.status === "paid")
    ) {
      setShowEditWarning(true);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    setShowEditWarning(false);
    setLoading(true);

    const orderNotes =
      selectedPickupLocationId === "anders"
        ? `Afhaallocatie: ${customPickupLocation.trim()}${notes ? `\n${notes}` : ""}`
        : notes.trim() || null;

    const pickup_location_id =
      selectedPickupLocationId === "anders" ||
      selectedPickupLocationId === "none" ||
      !selectedPickupLocationId
        ? null
        : selectedPickupLocationId;

    const orderPayload = {
      customer_id: selectedCustomerId,
      weekly_menu_id: null,
      weekly_menu_quantity: 1,
      pickup_location_id,
      notes: orderNotes,
      subtotal: Number(breakdown.subtotal.toFixed(2)),
      discount_amount: Number(breakdown.discount_amount.toFixed(2)),
      total: Number(breakdown.total.toFixed(2)),
      created_by: user!.id,
      invoice_date: selectedIso,
    };

    let orderId: string;

    if (editingOrder) {
      const { error } = await supabase
        .from("orders")
        .update(orderPayload)
        .eq("id", editingOrder.id);
      if (error) {
        toast({
          title: "Fout",
          description: "Kon bestelling niet bijwerken.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      orderId = editingOrder.id;
      await supabase.from("order_items").delete().eq("order_id", orderId);
    } else {
      const { data, error } = await supabase
        .from("orders")
        .insert(orderPayload)
        .select("id")
        .single();
      if (error || !data) {
        toast({
          title: "Fout",
          description: "Kon bestelling niet aanmaken.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      orderId = data.id;
    }

    const orderItems = breakdown.lines.map((l) => ({
      order_id: orderId,
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
          title: "Bestelling opgeslagen, maar regels misten",
          description: itemsErr.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    toast({
      title: editingOrder ? "Opgeslagen" : "Toegevoegd",
      description: editingOrder
        ? "Bestelling bijgewerkt."
        : "Nieuwe bestelling aangemaakt.",
    });
    onOpenChange(false);
    onSave();
  };

  const selectedLabel = formatWeekLabel(selectedMonday);
  const lineCount = lines.reduce((acc, l) => acc + l.quantity, 0);
  const statusLabel =
    editingOrder?.status === "in_production"
      ? "In productie"
      : editingOrder?.status === "ready"
        ? "Gereed"
        : editingOrder?.status === "paid"
          ? "Betaald"
          : "Bevestigd";

  // --- UI ---------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto scroll-soft">
        <DialogHeader className="space-y-1">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="bakery-eyebrow">Bestelling</p>
              <DialogTitle
                className="font-serif text-2xl font-medium leading-tight"
                style={{ letterSpacing: "-0.02em" }}
              >
                {editingOrder ? "Bewerken" : "Nieuwe bestelling"}
              </DialogTitle>
            </div>
            {editingOrder?.order_number && (
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground tabular-nums">
                <Hash className="h-3 w-3" />
                {editingOrder.order_number}
              </span>
            )}
          </div>
        </DialogHeader>

        {isReadOnly && (
          <div className="flex items-center justify-between gap-4 rounded-[calc(var(--radius)-2px)] border border-border/60 bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>
                Deze bestelling is <strong>{statusLabel}</strong> en kan
                alleen bekeken worden.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToConfirmed}
              className="shrink-0"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Terugzetten
            </Button>
          </div>
        )}

        <div className="space-y-8 pt-2">
          {/* Customer selector — baker-specific */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="bakery-eyebrow">Klant</span>
            </Label>
            <Select
              value={selectedCustomerId}
              onValueChange={setSelectedCustomerId}
              disabled={isReadOnly}
            >
              <SelectTrigger className={cn(isReadOnly && "opacity-60")}>
                <SelectValue placeholder="Selecteer klant" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    <span className="flex items-center gap-2">
                      {customer.full_name || "Naamloos"}
                      {Number(customer.discount_percentage ?? 0) > 0 && (
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          · {Number(customer.discount_percentage)}% korting
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Week-strip */}
          <div className="space-y-3">
            <p className="bakery-eyebrow">Week</p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                onClick={() => setSelectedMonday((d) => subWeeks(d, 1))}
                disabled={isReadOnly}
                aria-label="Vorige week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex flex-1 items-center gap-1.5 overflow-x-auto scroll-soft -mx-1 px-1">
                {weekStrip.map((monday) => {
                  const active = isSameDay(monday, selectedMonday);
                  const { week, range } = formatWeekLabel(monday);
                  return (
                    <button
                      key={toISODate(monday)}
                      type="button"
                      onClick={() => setSelectedMonday(monday)}
                      disabled={isReadOnly}
                      className={cn(
                        "shrink-0 rounded-[calc(var(--radius)-4px)] border px-3.5 py-2 text-left transition-colors",
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border/60 bg-card/60 text-foreground hover:border-border hover:bg-card",
                        isReadOnly && "opacity-60 pointer-events-none",
                      )}
                    >
                      <div className="text-xs font-medium leading-tight">{week}</div>
                      <div
                        className={cn(
                          "text-[11px] leading-tight mt-0.5",
                          active ? "text-background/75" : "text-muted-foreground",
                        )}
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
                disabled={isReadOnly}
                aria-label="Volgende week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] tracking-[0.06em] uppercase text-muted-foreground">
              Factuurdatum{" "}
              <span className="normal-case tracking-normal text-foreground">
                {format(selectedMonday, "EEEE d MMMM yyyy", { locale: nl })}
              </span>{" "}
              · weekprijzen uit {selectedLabel.week.toLowerCase()}
            </p>
          </div>

          {/* Product list */}
          {products.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Laden…
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="rounded-[var(--radius)] border border-dashed border-border/70 bg-card/40 px-6 py-14 text-center">
              <p
                className="font-serif text-xl text-foreground"
                style={{ letterSpacing: "-0.01em" }}
              >
                Deze week nog geen aanbod
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Voeg producten toe via Back-office → Weekaanbod of kies een
                andere week.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {productsByCategory.map(([categoryName, categoryProducts]) => (
                <section key={categoryName} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h4 className="bakery-eyebrow">{categoryName}</h4>
                    <span className="h-px flex-1 bg-border/60" />
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {categoryProducts.length}
                    </span>
                  </div>
                  <ul className="paper-card divide-y divide-border/60 overflow-hidden">
                    {categoryProducts.map((product) => {
                      const qty = quantities[product.id] ?? 0;
                      const override = offeringsByProductId[product.id]?.price_override;
                      const displayPrice =
                        override != null ? Number(override) : Number(product.selling_price);
                      return (
                        <li
                          key={product.id}
                          className={cn(
                            "flex items-center gap-4 px-5 py-4 transition-colors",
                            qty > 0
                              ? "bg-muted/30"
                              : "bg-transparent hover:bg-muted/20",
                          )}
                        >
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt=""
                              className="h-14 w-14 flex-shrink-0 rounded-[calc(var(--radius)-2px)] object-cover"
                            />
                          ) : (
                            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[calc(var(--radius)-2px)] bg-muted/60 text-muted-foreground">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[0.9375rem] font-medium text-foreground">
                              {product.name}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="tabular-nums">
                                {euro(displayPrice)} {sellUnitLabel(product)}
                              </span>
                              {override != null && (
                                <span className="inline-flex items-center rounded-[calc(var(--radius)-4px)] bg-accent/10 px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.08em] text-foreground ring-1 ring-inset ring-accent/40">
                                  Weekprijs
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => setQty(product.id, qty - 1)}
                              disabled={isReadOnly || qty <= 0}
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
                              disabled={isReadOnly}
                              className="h-9 w-14 px-1 text-center tabular-nums"
                            />
                            <Button
                              type="button"
                              variant={qty > 0 ? "default" : "outline"}
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => setQty(product.id, qty + 1)}
                              disabled={isReadOnly}
                              aria-label={`Meer ${product.name}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {/* Afronden */}
          <section className="paper-card space-y-7 px-6 py-7">
            <div>
              <p className="bakery-eyebrow mb-1.5">Afronden</p>
              <h4
                className="font-serif text-xl text-foreground"
                style={{ letterSpacing: "-0.015em" }}
              >
                Bestelling controleren
              </h4>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                Afhaallocatie
              </Label>
              <Select
                value={selectedPickupLocationId || "none"}
                onValueChange={(val) =>
                  setSelectedPickupLocationId(val === "none" ? "" : val)
                }
                disabled={isReadOnly}
              >
                <SelectTrigger className={cn(isReadOnly && "opacity-60")}>
                  <SelectValue placeholder="Selecteer afhaallocatie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen afhaallocatie</SelectItem>
                  {pickupLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{location.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {location.street} {location.house_number ?? ""},{" "}
                          {location.city}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="anders">
                    <span className="italic">Anders (zelf invullen)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {selectedPickupLocationId === "anders" && !isReadOnly && (
                <Input
                  placeholder="Vul de afhaallocatie in…"
                  value={customPickupLocation}
                  onChange={(e) => setCustomPickupLocation(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="order-notes">Opmerkingen (optioneel)</Label>
              <Textarea
                id="order-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Iets dat we moeten weten?"
                rows={2}
                disabled={isReadOnly}
                className={cn(isReadOnly && "opacity-60")}
              />
            </div>

            <div className="h-px bg-border/70" />

            {/* Totalen */}
            <div className="space-y-2.5 text-sm">
              {breakdown.lines.map((l) => {
                const product = products.find((p) => p.id === l.product_id);
                if (!product) return null;
                return (
                  <div
                    key={l.product_id}
                    className="flex items-center justify-between text-muted-foreground"
                  >
                    <span className="truncate pr-4">
                      <span className="text-foreground tabular-nums">
                        {l.quantity}×
                      </span>{" "}
                      {product.name}
                    </span>
                    <span className="tabular-nums shrink-0">
                      {euro(l.line_subtotal)}
                    </span>
                  </div>
                );
              })}
              {breakdown.lines.length > 0 && <div className="h-px bg-border/60" />}
              <div className="flex items-center justify-between text-foreground">
                <span>Subtotaal</span>
                <span className="tabular-nums">{euro(breakdown.subtotal)}</span>
              </div>
              {breakdown.group_discount_amount > 0 && (
                <div className="flex items-center justify-between text-[hsl(var(--ember))]">
                  <span>Groepskorting</span>
                  <span className="tabular-nums">
                    −{euro(breakdown.group_discount_amount)}
                  </span>
                </div>
              )}
              {breakdown.customer_discount_amount > 0 && (
                <div className="flex items-center justify-between text-[hsl(var(--ember))]">
                  <span>Klantkorting ({customerDiscountPercentage}%)</span>
                  <span className="tabular-nums">
                    −{euro(breakdown.customer_discount_amount)}
                  </span>
                </div>
              )}
              <div className="h-px bg-border/70" />
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-muted-foreground uppercase tracking-[0.12em]">
                  Totaal
                </span>
                <span
                  className="font-serif text-2xl text-foreground tabular-nums"
                  style={{ letterSpacing: "-0.015em" }}
                >
                  {euro(breakdown.total)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                {isReadOnly ? "Sluiten" : "Annuleren"}
              </Button>
              {!isReadOnly && (
                <Button onClick={handleSave} disabled={loading} size="lg">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {loading
                    ? "Opslaan…"
                    : editingOrder
                      ? "Opslaan"
                      : lineCount === 0
                        ? "Kies eerst producten"
                        : `Bestelling aanmaken (${lineCount} ${
                            lineCount === 1 ? "product" : "producten"
                          })`}
                </Button>
              )}
            </div>
          </section>
        </div>
      </DialogContent>

      <AlertDialog open={showEditWarning} onOpenChange={setShowEditWarning}>
        <AlertDialogContent>
          <AlertDialogHeader className="space-y-1">
            <p className="bakery-eyebrow flex items-center gap-1.5 text-[hsl(var(--ember))]">
              <AlertTriangle className="h-3 w-3" />
              Let op
            </p>
            <AlertDialogTitle
              className="font-serif text-xl font-medium leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              Bestelling bewerken
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Deze bestelling heeft de status &ldquo;{statusLabel}&rdquo;.
              Weet je zeker dat je deze bestelling wilt wijzigen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => performSave()}>
              Ja, wijzigen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default OrderDialog;
