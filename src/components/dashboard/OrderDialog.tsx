import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  FileText,
  Hash,
  Image as ImageIcon,
  Lock,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  Trash2,
  User,
} from "lucide-react";
import { format, parseISO, startOfWeek } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
 * Baker-side order editor.
 *
 * Unlike the customer flow, the baker can pick *any* orderable product (not
 * just products on the weekly offering), because the baker often places orders
 * on behalf of customers for one-off requests. Weekly-offering overrides still
 * apply automatically though: we look up the `week_start_date` from whichever
 * invoice date the baker has picked, fetch that week's offerings, and feed
 * them into the same `computeOrderTotals` helper used everywhere else.
 *
 * Weekly-menu selection is gone. Existing orders with `weekly_menu_id` load
 * fine (we merge all their line-items into the editable list), but saving
 * writes `weekly_menu_id = null` — the legacy link is cleared on first edit.
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

const mondayOf = (date: Date) =>
  format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");

const sellUnitLabel = (
  product: Pick<Product, "sell_unit_quantity" | "sell_unit_unit">,
) => {
  const unit = UNIT_LABELS_SHORT[product.sell_unit_unit as MeasurementUnit];
  if (Number(product.sell_unit_quantity) === 1) return `per ${unit}`;
  return `per ${product.sell_unit_quantity} ${unit}`;
};

const euro = (value: number) =>
  `€${Number(value ?? 0).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const OrderDialog = ({
  open,
  onOpenChange,
  editingOrder,
  onSave,
}: OrderDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Reference data (static across the dialog lifetime).
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceTiersByProductId, setPriceTiersByProductId] = useState<
    Record<string, ProductPriceTier[]>
  >({});
  const [discountGroups, setDiscountGroups] = useState<DiscountGroupForPricing[]>([]);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);

  // Offerings for the week of the current invoice date.
  const [offerings, setOfferings] = useState<OfferingRow[]>([]);

  // Form state.
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedPickupLocationId, setSelectedPickupLocationId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<{ product_id: string; quantity: number }[]>(
    [],
  );
  const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(new Date());

  const [loading, setLoading] = useState(false);
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  // --- Fetches -----------------------------------------------------------

  /** Customers: every non-archived profile that isn't a baker. */
  useEffect(() => {
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
        allProfiles.filter((p) => !p.user_id || !bakerUserIds.has(p.user_id)) as Profile[],
      );
    };
    run();
  }, []);

  /** Products + categories. */
  useEffect(() => {
    const run = async () => {
      const [productsRes, categoriesRes] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id, name, selling_price, recipe_yield_quantity, recipe_yield_unit, sell_unit_quantity, sell_unit_unit, image_url, category_id",
          )
          .eq("is_orderable", true)
          .order("name"),
        supabase.from("categories").select("id, name").order("name"),
      ]);
      setProducts(productsRes.data ?? []);
      setCategories(categoriesRes.data ?? []);
    };
    run();
  }, []);

  /** Pickup locations. */
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from("pickup_locations")
        .select("id, title, street, house_number, postal_code, city")
        .eq("is_active", true)
        .order("title");
      setPickupLocations(data ?? []);
    };
    run();
  }, []);

  /** Price tiers. */
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from("product_price_tiers")
        .select("product_id, min_quantity, price");
      const byProduct: Record<string, ProductPriceTier[]> = {};
      for (const row of (data ?? []) as PriceTierRow[]) {
        const list = byProduct[row.product_id] ?? [];
        list.push({ min_quantity: row.min_quantity, price: Number(row.price) });
        byProduct[row.product_id] = list;
      }
      setPriceTiersByProductId(byProduct);
    };
    run();
  }, []);

  /** Discount groups — assembled from three sub-queries. */
  useEffect(() => {
    const run = async () => {
      const [groupsRes, tiersRes, linksRes] = await Promise.all([
        supabase.from("discount_groups").select("id"),
        supabase
          .from("discount_group_tiers")
          .select("discount_group_id, min_quantity, discount_percentage"),
        supabase.from("product_discount_groups").select("product_id, discount_group_id"),
      ]);

      const tiersByGroup: Record<
        string,
        { min_quantity: number; discount_percentage: number }[]
      > = {};
      for (const row of tiersRes.data ?? []) {
        const list = tiersByGroup[row.discount_group_id] ?? [];
        list.push({
          min_quantity: row.min_quantity,
          discount_percentage: Number(row.discount_percentage),
        });
        tiersByGroup[row.discount_group_id] = list;
      }
      const productsByGroup: Record<string, string[]> = {};
      for (const row of linksRes.data ?? []) {
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
    };
    run();
  }, []);

  /** Offerings for the selected invoice date's week. Re-fetches when the
   * baker changes the invoice date, so the pricing block always reflects
   * the right week's overrides. */
  const fetchOfferingsForWeek = useCallback(async (date: Date) => {
    const weekStart = mondayOf(date);
    const { data, error } = await supabase
      .from("weekly_product_offerings")
      .select("*")
      .eq("week_start_date", weekStart);
    if (error) {
      // Non-fatal — we just fall back to base prices.
      setOfferings([]);
      return;
    }
    setOfferings(data ?? []);
  }, []);

  useEffect(() => {
    if (invoiceDate) fetchOfferingsForWeek(invoiceDate);
  }, [fetchOfferingsForWeek, invoiceDate]);

  /** Load an existing order into the form. */
  useEffect(() => {
    if (!open) return;

    if (!editingOrder) {
      setSelectedCustomerId("");
      setSelectedPickupLocationId("");
      setNotes("");
      setLineItems([]);
      setInvoiceDate(new Date());
      return;
    }

    setSelectedCustomerId(editingOrder.customer?.id ?? "");
    setSelectedPickupLocationId(editingOrder.pickup_location_id ?? "");
    setNotes(editingOrder.notes ?? "");
    setInvoiceDate(
      editingOrder.invoice_date ? parseISO(editingOrder.invoice_date) : new Date(),
    );

    // Merge every order_item into the single editable list — weekly-menu
    // items and extras alike. After save, the order will no longer have a
    // weekly_menu_id, and all line-items become regular (is_weekly_menu_item
    // = false). This is the one-way migration for existing weekly-menu orders.
    const loadItems = async () => {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, quantity")
        .eq("order_id", editingOrder.id);
      setLineItems(
        (items ?? []).map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        })),
      );
    };
    loadItems();
  }, [editingOrder, open]);

  // --- Derived data ------------------------------------------------------

  const productsById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  /** Category → products, for the product-picker grouping. */
  const productsByCategory = useMemo(() => {
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const groups = new Map<string, Product[]>();
    for (const p of products) {
      const key = p.category_id ? catName.get(p.category_id) ?? "Zonder categorie" : "Zonder categorie";
      const list = groups.get(key) ?? [];
      list.push(p);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "Zonder categorie") return 1;
      if (b === "Zonder categorie") return -1;
      return a.localeCompare(b);
    });
  }, [products, categories]);

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
  const customerDiscountPercentage = Number(selectedCustomer?.discount_percentage ?? 0);

  /** Aggregate by product_id so duplicates sum before going to pricing. */
  const linesForPricing: OrderLine[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of lineItems) {
      if (!item.product_id || item.quantity <= 0) continue;
      map.set(item.product_id, (map.get(item.product_id) ?? 0) + item.quantity);
    }
    return Array.from(map.entries()).map(([product_id, quantity]) => ({
      product_id,
      quantity,
    }));
  }, [lineItems]);

  const breakdown = useMemo(
    () =>
      computeOrderTotals({
        lines: linesForPricing,
        products: productsForPricing,
        priceTiersByProductId,
        offeringsByProductId,
        discountGroups,
        customerDiscountPercentage,
      }),
    [
      linesForPricing,
      productsForPricing,
      priceTiersByProductId,
      offeringsByProductId,
      discountGroups,
      customerDiscountPercentage,
    ],
  );

  /** Map product_id → unit_price as computed by pricing.ts (accounting for
   * overrides + tiers). Used when writing out order_items. */
  const unitPriceByProductId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of breakdown.lines) map[l.product_id] = l.unit_price;
    return map;
  }, [breakdown]);

  // --- Actions ----------------------------------------------------------

  const isReadOnly =
    !!editingOrder &&
    (editingOrder.status === "in_production" ||
      editingOrder.status === "ready" ||
      editingOrder.status === "paid");

  const addLine = () => {
    if (isReadOnly) return;
    setLineItems((prev) => [...prev, { product_id: "", quantity: 1 }]);
  };

  const removeLine = (index: number) => {
    if (isReadOnly) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLine = (
    index: number,
    field: "product_id" | "quantity",
    value: string | number,
  ) => {
    if (isReadOnly) return;
    setLineItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value } as (typeof prev)[number];
      return next;
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
      toast({ title: "Fout", description: "Selecteer een klant.", variant: "destructive" });
      return;
    }

    if (linesForPricing.length === 0) {
      toast({
        title: "Fout",
        description: "Voeg minimaal één product toe.",
        variant: "destructive",
      });
      return;
    }

    if (!invoiceDate) {
      toast({
        title: "Fout",
        description: "Selecteer een factuurdatum.",
        variant: "destructive",
      });
      return;
    }

    if (
      editingOrder &&
      (editingOrder.status === "in_production" ||
        editingOrder.status === "ready" ||
        editingOrder.status === "paid") &&
      !pendingSave
    ) {
      setShowEditWarning(true);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    setPendingSave(false);
    setLoading(true);

    const orderPayload = {
      customer_id: selectedCustomerId,
      weekly_menu_id: null,
      weekly_menu_quantity: 1,
      pickup_location_id:
        selectedPickupLocationId === "anders" || selectedPickupLocationId === "none"
          ? null
          : selectedPickupLocationId || null,
      notes: notes.trim() || null,
      subtotal: Number(breakdown.subtotal.toFixed(2)),
      discount_amount: Number(breakdown.discount_amount.toFixed(2)),
      total: Number(breakdown.total.toFixed(2)),
      created_by: user!.id,
      invoice_date: format(invoiceDate!, "yyyy-MM-dd"),
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
      description: editingOrder ? "Bestelling bijgewerkt." : "Nieuwe bestelling aangemaakt.",
    });
    onOpenChange(false);
    onSave();
  };

  // --- UI ---------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
          <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>
                Deze bestelling is{" "}
                <strong>
                  {editingOrder?.status === "in_production"
                    ? "In productie"
                    : editingOrder?.status === "ready"
                      ? "Gereed"
                      : "Betaald"}
                </strong>{" "}
                en kan alleen bekeken worden.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToConfirmed}
              className="shrink-0"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Terugzetten naar Bevestigd
            </Button>
          </div>
        )}

        <div className="space-y-6 py-4">
          {/* Customer */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Klant *
            </Label>
            <Select
              value={selectedCustomerId}
              onValueChange={setSelectedCustomerId}
              disabled={isReadOnly}
            >
              <SelectTrigger className={isReadOnly ? "opacity-60" : ""}>
                <SelectValue placeholder="Selecteer klant" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.full_name || "Naamloos"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Invoice date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Factuurdatum *
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !invoiceDate && "text-muted-foreground",
                    isReadOnly && "pointer-events-none opacity-60",
                  )}
                  disabled={isReadOnly}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {invoiceDate
                    ? format(invoiceDate, "EEEE d MMMM yyyy", { locale: nl })
                    : "Selecteer datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={invoiceDate}
                  onSelect={setInvoiceDate}
                  initialFocus
                  locale={nl}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Bepaalt welke week-overrides van toepassing zijn.
            </p>
          </div>

          {/* Pickup location */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Afhaallocatie
            </Label>
            <Select
              value={selectedPickupLocationId || "none"}
              onValueChange={(val) =>
                setSelectedPickupLocationId(val === "none" ? "" : val)
              }
              disabled={isReadOnly}
            >
              <SelectTrigger className={isReadOnly ? "opacity-60" : ""}>
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
                        {location.postal_code} {location.city}
                      </span>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="anders">
                  <span className="italic">Anders (zelf invullen in opmerkingen)</span>
                </SelectItem>
              </SelectContent>
            </Select>
            {pickupLocations.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Geen afhaallocaties beschikbaar. Maak er eerst een aan in de back-office.
              </p>
            )}
          </div>

          <Separator />

          {/* Line items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Producten
              </Label>
              {!isReadOnly && (
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="mr-1 h-4 w-4" />
                  Product toevoegen
                </Button>
              )}
            </div>

            {lineItems.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Geen producten. Klik op "Product toevoegen".
              </p>
            ) : (
              <div className="space-y-3">
                {lineItems.map((item, index) => {
                  const product = productsById.get(item.product_id);
                  const unitPrice = product
                    ? unitPriceByProductId[product.id] ?? Number(product.selling_price)
                    : 0;
                  const lineTotal = unitPrice * item.quantity;
                  const hasOverride =
                    product && offeringsByProductId[product.id]?.price_override != null;

                  return (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border bg-muted/30 p-2",
                        isReadOnly && "opacity-60",
                      )}
                    >
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                        {product?.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {isReadOnly ? (
                        <span className="flex-1 text-sm">
                          {product?.name || "Onbekend product"}
                        </span>
                      ) : (
                        <Select
                          value={item.product_id}
                          onValueChange={(value) => updateLine(index, "product_id", value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecteer product" />
                          </SelectTrigger>
                          <SelectContent>
                            {productsByCategory.map(([categoryName, categoryProducts]) => (
                              <div key={categoryName}>
                                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                  {categoryName}
                                </div>
                                {categoryProducts.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      {sellUnitLabel(p)}
                                    </span>
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {isReadOnly ? (
                        <span className="w-20 text-center text-sm">{item.quantity}×</span>
                      ) : (
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateLine(
                              index,
                              "quantity",
                              Math.max(1, parseInt(e.target.value) || 1),
                            )
                          }
                          className="w-20"
                        />
                      )}

                      <div className="flex w-28 flex-col items-end">
                        <span className="text-sm font-medium tabular-nums">
                          {product ? euro(lineTotal) : "-"}
                        </span>
                        {product && (
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {euro(unitPrice)} {sellUnitLabel(product)}
                            {hasOverride && (
                              <span className="ml-1 text-primary">· weekprijs</span>
                            )}
                          </span>
                        )}
                      </div>

                      {!isReadOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Opmerkingen</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionele opmerkingen…"
              rows={2}
              disabled={isReadOnly}
              className={isReadOnly ? "opacity-60" : ""}
            />
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
                <span className="tabular-nums">{euro(breakdown.subtotal)}</span>
              </div>
              {breakdown.group_discount_amount > 0 && (
                <div className="flex justify-between text-sm text-primary">
                  <span>Groepskorting</span>
                  <span className="tabular-nums">
                    −{euro(breakdown.group_discount_amount)}
                  </span>
                </div>
              )}
              {breakdown.customer_discount_amount > 0 && (
                <div className="flex justify-between text-sm text-primary">
                  <span>Klantkorting ({customerDiscountPercentage}%)</span>
                  <span className="tabular-nums">
                    −{euro(breakdown.customer_discount_amount)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Totaal</span>
                <span className="tabular-nums">{euro(breakdown.total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isReadOnly ? "Sluiten" : "Annuleren"}
          </Button>
          {!isReadOnly && (
            <Button onClick={handleSave} disabled={loading}>
              {loading
                ? "Opslaan…"
                : editingOrder
                  ? "Opslaan"
                  : "Bestelling aanmaken"}
            </Button>
          )}
        </DialogFooter>
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
              Deze bestelling heeft de status &ldquo;
              {editingOrder?.status === "in_production"
                ? "In productie"
                : editingOrder?.status === "ready"
                  ? "Gereed"
                  : "Betaald"}
              &rdquo;. Weet je zeker dat je deze bestelling wilt wijzigen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowEditWarning(false);
                setPendingSave(true);
                setTimeout(() => handleSave(), 0);
              }}
            >
              Ja, wijzigen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default OrderDialog;
