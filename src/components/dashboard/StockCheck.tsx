import { useState, useEffect, useCallback } from "react";
import { ClipboardCheck, Play, Check, AlertCircle, Clock, ChevronRight, ArrowLeft, Package, X } from "lucide-react";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  batchesForOrder,
  ingredientNeeded,
  type ProductForPricing,
} from "@/lib/pricing";
import { formatQuantity as formatUnitQuantity, type MeasurementUnit } from "@/lib/units";

interface IngredientNeed {
  ingredientId: string;
  ingredientName: string;
  unit: MeasurementUnit;
  totalNeeded: number;
}

interface StockCheckItem {
  id: string;
  ingredientId: string;
  ingredientName: string;
  requiredQuantity: number;
  unit: string;
  status: "pending" | "sufficient" | "insufficient" | "order_extra";
  isOrdered: boolean;
}

interface StockCheck {
  id: string;
  createdAt: string;
  completedAt: string | null;
  status: "in_progress" | "completed";
  items: StockCheckItem[];
}

const formatQuantity = (value: number, unit: string): string => {
  // stock_check_items.unit is stored as the ingredient's measurement_unit enum
  // (e.g. "kg", "gram", "ml"). Fall back gracefully if an unknown string sneaks in.
  const known = new Set<string>(["kg", "gram", "liter", "ml", "stuks", "uur", "eetlepel"]);
  if (known.has(unit)) return formatUnitQuantity(value, unit as MeasurementUnit);
  return `${Math.round(value * 10) / 10} ${unit}`;
};

const StatusChip = ({ tone, children }: { tone: "muted" | "ember" | "foreground" | "accent" | "destructive"; children: React.ReactNode }) => {
  const styles: Record<string, string> = {
    muted: "bg-muted/60 text-muted-foreground ring-border/60",
    ember: "bg-[hsl(var(--ember))]/10 text-[hsl(var(--ember))] ring-[hsl(var(--ember))]/30",
    foreground: "bg-foreground text-background ring-foreground",
    accent: "bg-accent/10 text-foreground ring-accent/40",
    destructive: "bg-destructive/10 text-destructive ring-destructive/30",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] uppercase rounded-[calc(var(--radius)-4px)] ring-1 ring-inset ${styles[tone]}`}
    >
      {children}
    </span>
  );
};

const StockCheck = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stockChecks, setStockChecks] = useState<StockCheck[]>([]);
  const [activeCheck, setActiveCheck] = useState<StockCheck | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<StockCheck | null>(null);
  const [creatingCheck, setCreatingCheck] = useState(false);

  const refreshData = useCallback(() => {
    fetchStockChecks();
  }, []);

  useEffect(() => {
    fetchStockChecks();
  }, []);

  useVisibilityRefresh(refreshData);

  const fetchStockChecks = async () => {
    setLoading(true);

    const { data: checks } = await supabase
      .from("stock_checks")
      .select("*")
      .order("created_at", { ascending: false });

    if (checks) {
      const checksWithItems: StockCheck[] = [];

      for (const check of checks) {
        const { data: items } = await supabase
          .from("stock_check_items")
          .select(`
            id,
            ingredient_id,
            required_quantity,
            unit,
            status,
            is_ordered,
            ingredient:ingredients(name)
          `)
          .eq("stock_check_id", check.id);

        checksWithItems.push({
          id: check.id,
          createdAt: check.created_at,
          completedAt: check.completed_at,
          status: check.status as "in_progress" | "completed",
          items: (items || []).map(item => ({
            id: item.id,
            ingredientId: item.ingredient_id,
            ingredientName: (item.ingredient as any)?.name || "Onbekend",
            requiredQuantity: item.required_quantity,
            unit: item.unit,
            status: item.status as StockCheckItem["status"],
            isOrdered: item.is_ordered,
          })),
        });
      }

      setStockChecks(checksWithItems);

      // Find active check (in_progress)
      const active = checksWithItems.find(c => c.status === "in_progress");
      setActiveCheck(active || null);
    }

    setLoading(false);
  };

  const fetchIngredientNeeds = async (): Promise<IngredientNeed[]> => {
    // Fetch orders with status "confirmed" only.
    const { data: orders } = await supabase
      .from("orders")
      .select(`id`)
      .eq("status", "confirmed");

    if (!orders || orders.length === 0) return [];

    const orderIds = orders.map((o) => o.id);

    // All order_items are the single source of truth — legacy orders with a
    // weekly_menu_id still have all their items denormalised here.
    const { data: orderItems } = await supabase
      .from("order_items")
      .select(`product_id, quantity`)
      .in("order_id", orderIds);

    // Aggregate sell-units per product.
    const qtyByProduct = new Map<string, number>();
    for (const item of orderItems || []) {
      qtyByProduct.set(
        item.product_id,
        (qtyByProduct.get(item.product_id) || 0) + Number(item.quantity || 0),
      );
    }

    const productIds = Array.from(qtyByProduct.keys());
    if (productIds.length === 0) return [];

    // Parallel: product yield/sell-unit info + recipe ingredients.
    const [productsRes, recipesRes] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id, recipe_yield_quantity, recipe_yield_unit, sell_unit_quantity, sell_unit_unit, selling_price",
        )
        .in("id", productIds),
      supabase
        .from("recipe_ingredients")
        .select(`product_id, quantity, ingredient:ingredients(id, name, unit)`)
        .in("product_id", productIds),
    ]);

    const productById = new Map<string, ProductForPricing>();
    for (const p of productsRes.data || []) {
      productById.set(p.id, {
        id: p.id,
        selling_price: Number(p.selling_price || 0),
        recipe_yield_quantity: Number(p.recipe_yield_quantity || 0),
        recipe_yield_unit: p.recipe_yield_unit as MeasurementUnit,
        sell_unit_quantity: Number(p.sell_unit_quantity || 0),
        sell_unit_unit: p.sell_unit_unit as MeasurementUnit,
      });
    }

    // Pre-compute batches per product (= sell-units ordered → recipe batches).
    const batchesByProduct = new Map<string, number>();
    for (const [productId, qty] of qtyByProduct) {
      const product = productById.get(productId);
      if (!product) continue;
      try {
        batchesByProduct.set(productId, batchesForOrder(product, qty));
      } catch (err) {
        console.warn("batchesForOrder failed for product", productId, err);
      }
    }

    const ingredientMap = new Map<string, IngredientNeed>();
    for (const ri of recipesRes.data || []) {
      if (!ri.ingredient) continue;
      const ing = ri.ingredient as { id: string; name: string; unit: MeasurementUnit };
      const batches = batchesByProduct.get(ri.product_id) ?? 0;
      if (batches <= 0) continue;

      const totalNeeded = ingredientNeeded(
        { quantity: Number(ri.quantity || 0) },
        batches,
      );

      if (!ingredientMap.has(ing.id)) {
        ingredientMap.set(ing.id, {
          ingredientId: ing.id,
          ingredientName: ing.name,
          unit: ing.unit,
          totalNeeded: 0,
        });
      }
      ingredientMap.get(ing.id)!.totalNeeded += totalNeeded;
    }

    return Array.from(ingredientMap.values()).sort((a, b) =>
      a.ingredientName.localeCompare(b.ingredientName),
    );
  };

  const startNewCheck = async () => {
    if (!user) return;
    setCreatingCheck(true);

    const needs = await fetchIngredientNeeds();

    if (needs.length === 0) {
      toast({
        title: "Geen ingrediënten",
        description: "Er zijn geen bevestigde bestellingen om te controleren",
        variant: "destructive"
      });
      setCreatingCheck(false);
      return;
    }

    // Create stock check
    const { data: check, error } = await supabase
      .from("stock_checks")
      .insert({ created_by: user.id })
      .select()
      .single();

    if (error || !check) {
      toast({ title: "Fout", description: "Kon voorraadcheck niet starten", variant: "destructive" });
      setCreatingCheck(false);
      return;
    }

    // Create stock check items
    const items = needs.map(n => ({
      stock_check_id: check.id,
      ingredient_id: n.ingredientId,
      required_quantity: n.totalNeeded,
      unit: n.unit,
      status: "pending",
    }));

    await supabase.from("stock_check_items").insert(items);

    toast({ title: "Gestart", description: "Voorraadcheck gestart" });
    await fetchStockChecks();
    setCreatingCheck(false);
  };

  const updateItemStatus = async (itemId: string, status: StockCheckItem["status"]) => {
    await supabase
      .from("stock_check_items")
      .update({ status })
      .eq("id", itemId);

    // Update local state
    if (activeCheck) {
      setActiveCheck({
        ...activeCheck,
        items: activeCheck.items.map(item =>
          item.id === itemId ? { ...item, status } : item
        ),
      });
    }
  };

  const completeCheck = async () => {
    if (!activeCheck) return;

    await supabase
      .from("stock_checks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", activeCheck.id);

    toast({ title: "Voltooid", description: "Voorraadcheck afgerond" });
    await fetchStockChecks();
  };

  const cancelCheck = async () => {
    if (!activeCheck) return;

    // Delete items first, then the check
    await supabase
      .from("stock_check_items")
      .delete()
      .eq("stock_check_id", activeCheck.id);

    await supabase
      .from("stock_checks")
      .delete()
      .eq("id", activeCheck.id);

    toast({ title: "Geannuleerd", description: "Voorraadcheck geannuleerd" });
    await fetchStockChecks();
  };

  const updateItemOrdered = async (itemId: string, isOrdered: boolean) => {
    await supabase
      .from("stock_check_items")
      .update({ is_ordered: isOrdered })
      .eq("id", itemId);

    // Update local state
    if (selectedCheck) {
      setSelectedCheck({
        ...selectedCheck,
        items: selectedCheck.items.map(item =>
          item.id === itemId ? { ...item, isOrdered } : item
        ),
      });
    }

    // Also update in stockChecks
    setStockChecks(prev => prev.map(check =>
      check.id === selectedCheck?.id
        ? {
            ...check,
            items: check.items.map(item =>
              item.id === itemId ? { ...item, isOrdered } : item
            ),
          }
        : check
    ));
  };

  const getCheckStatusIcon = (check: StockCheck) => {
    if (check.status === "in_progress") {
      return <Clock className="w-4 h-4 text-muted-foreground" />;
    }

    const itemsToOrder = check.items.filter(i => i.status === "insufficient" || i.status === "order_extra");
    const insufficientItems = check.items.filter(i => i.status === "insufficient");
    const allOrdered = itemsToOrder.every(i => i.isOrdered);

    if (allOrdered) {
      return <Check className="w-4 h-4 text-foreground" />;
    }
    if (insufficientItems.some(i => !i.isOrdered)) {
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
    return <Package className="w-4 h-4 text-[hsl(var(--ember))]" />;
  };

  const allItemsChecked = activeCheck?.items.every(i => i.status !== "pending") ?? false;

  // Render selected check (order list view)
  if (selectedCheck) {
    const itemsToOrder = selectedCheck.items.filter(i => i.status === "insufficient" || i.status === "order_extra");
    const allOrdered = itemsToOrder.every(i => i.isOrdered);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedCheck(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="bakery-eyebrow">Voorraadcheck</p>
            <h3
              className="font-serif text-xl md:text-2xl font-medium text-foreground leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              Bestellijst · {format(new Date(selectedCheck.createdAt), "d MMMM yyyy", { locale: nl })}
            </h3>
          </div>
          {allOrdered && itemsToOrder.length > 0 && (
            <StatusChip tone="foreground">Alles besteld</StatusChip>
          )}
        </div>

        <div className="paper-card overflow-hidden">
          {itemsToOrder.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center">
                <Check className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="font-serif text-lg text-foreground">Alle voorraad was voldoende</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {itemsToOrder.map((item) => (
                <div key={item.id} className="py-3 px-6 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center justify-between sm:flex-1 gap-2">
                    <span className="text-sm text-foreground min-w-0 truncate">{item.ingredientName}</span>
                    <span className="text-sm tabular-nums font-medium text-foreground shrink-0">
                      {formatQuantity(item.requiredQuantity, item.unit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <StatusChip tone={item.status === "insufficient" ? "destructive" : "ember"}>
                      {item.status === "insufficient" ? "Onvoldoende" : "Extra"}
                    </StatusChip>
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id={`ordered-${item.id}`}
                        checked={item.isOrdered}
                        onCheckedChange={(checked) => updateItemOrdered(item.id, !!checked)}
                      />
                      <Label htmlFor={`ordered-${item.id}`} className="text-xs text-muted-foreground cursor-pointer">
                        Besteld
                      </Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render active check (check in progress)
  if (activeCheck) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="bakery-eyebrow mb-2">Voorraadcheck actief</p>
            <h3
              className="font-serif text-2xl md:text-3xl font-medium text-foreground leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              {activeCheck.items.filter(i => i.status !== "pending").length} / {activeCheck.items.length} gecontroleerd
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              Gestart op {format(new Date(activeCheck.createdAt), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelCheck} size="sm">
              <X className="w-4 h-4 mr-1.5" />
              Annuleren
            </Button>
            <Button onClick={completeCheck} disabled={!allItemsChecked} size="sm">
              <Check className="w-4 h-4 mr-1.5" />
              Afronden
            </Button>
          </div>
        </div>

        <div className="paper-card overflow-hidden">
          <div className="divide-y divide-border/50">
            {activeCheck.items.map((item) => (
              <div key={item.id} className="py-4 px-6 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-foreground min-w-0 truncate">{item.ingredientName}</span>
                  <span className="text-sm tabular-nums font-medium text-foreground shrink-0">
                    {formatQuantity(item.requiredQuantity, item.unit)}
                  </span>
                </div>
                <RadioGroup
                  value={item.status}
                  onValueChange={(val) => updateItemStatus(item.id, val as StockCheckItem["status"])}
                  className="flex flex-wrap gap-3"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="sufficient" id={`${item.id}-suf`} className="h-3.5 w-3.5" />
                    <Label htmlFor={`${item.id}-suf`} className="text-xs cursor-pointer">Voldoende</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="insufficient" id={`${item.id}-insuf`} className="h-3.5 w-3.5" />
                    <Label htmlFor={`${item.id}-insuf`} className="text-xs cursor-pointer text-destructive">Onvoldoende</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="order_extra" id={`${item.id}-extra`} className="h-3.5 w-3.5" />
                    <Label htmlFor={`${item.id}-extra`} className="text-xs cursor-pointer text-[hsl(var(--ember))]">Extra</Label>
                  </div>
                </RadioGroup>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render stock check list/history
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="bakery-eyebrow mb-2">Voorraad</p>
          <h2
            className="font-serif text-3xl md:text-4xl font-medium text-foreground leading-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            Voorraadcheck
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Controleer wat er in huis is voor alle bevestigde bestellingen.
          </p>
        </div>
        <Button onClick={startNewCheck} disabled={creatingCheck} size="sm">
          {creatingCheck ? (
            <div className="w-4 h-4 mr-1.5 animate-spin rounded-full border border-current/30 border-t-current" />
          ) : (
            <Play className="w-4 h-4 mr-1.5" />
          )}
          Start voorraadcheck
        </Button>
      </div>

      <div className="paper-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
            <p className="text-sm text-muted-foreground">Laden…</p>
          </div>
        ) : stockChecks.filter(c => c.status === "completed").length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-serif text-lg text-foreground">Nog geen voorraadchecks</p>
            <p className="text-sm text-muted-foreground mt-1">Start er een om te beginnen.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {stockChecks.filter(c => c.status === "completed").map((check) => {
              const itemsToOrder = check.items.filter(i => i.status === "insufficient" || i.status === "order_extra");
              return (
                <button
                  type="button"
                  key={check.id}
                  className="w-full text-left py-3 px-6 flex items-center justify-between gap-2 hover:bg-muted/40 transition-colors"
                  onClick={() => setSelectedCheck(check)}
                >
                  <div className="min-w-0">
                    <span className="text-sm text-foreground">
                      {format(new Date(check.createdAt), "d MMM yyyy", { locale: nl })}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {check.items.length} ingr. · {itemsToOrder.length} te bestellen
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getCheckStatusIcon(check)}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockCheck;
