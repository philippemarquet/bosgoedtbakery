import { useState, useEffect, useCallback } from "react";
import { ClipboardCheck, Play, Check, AlertCircle, Clock, ChevronRight, ArrowLeft, Loader2, Package, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const StockCheck = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stockChecks, setStockChecks] = useState<StockCheck[]>([]);
  const [activeCheck, setActiveCheck] = useState<StockCheck | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<StockCheck | null>(null);
  const [ingredientNeeds, setIngredientNeeds] = useState<IngredientNeed[]>([]);
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
      return <Check className="w-4 h-4 text-green-600" />;
    }
    if (insufficientItems.some(i => !i.isOrdered)) {
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
    return <Package className="w-4 h-4 text-yellow-600" />;
  };

  const getStatusLabel = (status: StockCheckItem["status"]) => {
    switch (status) {
      case "sufficient": return "Voldoende";
      case "insufficient": return "Onvoldoende";
      case "order_extra": return "Extra bestellen";
      default: return "Nog niet gecontroleerd";
    }
  };

  const allItemsChecked = activeCheck?.items.every(i => i.status !== "pending") ?? false;

  // Render selected check (order list view)
  if (selectedCheck) {
    const itemsToOrder = selectedCheck.items.filter(i => i.status === "insufficient" || i.status === "order_extra");
    const allOrdered = itemsToOrder.every(i => i.isOrdered);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedCheck(null)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h3 className="text-lg font-serif font-medium">Bestellijst</h3>
            <p className="text-sm text-muted-foreground">
              {format(new Date(selectedCheck.createdAt), "d MMMM yyyy", { locale: nl })}
            </p>
          </div>
          {allOrdered && (
            <Badge className="ml-auto bg-green-500 hover:bg-green-500">Alles besteld</Badge>
          )}
        </div>

        {itemsToOrder.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Check className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p>Alle voorraad was voldoende</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {itemsToOrder.map((item) => (
              <div key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center justify-between sm:flex-1 gap-2">
                  <span className="text-sm text-foreground min-w-0 truncate">{item.ingredientName}</span>
                  <span className="text-sm tabular-nums font-medium shrink-0">
                    {formatQuantity(item.requiredQuantity, item.unit)}
                  </span>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <Badge
                    variant="outline"
                    className={item.status === "insufficient" ? "border-destructive text-destructive" : "border-yellow-600 text-yellow-600"}
                  >
                    {item.status === "insufficient" ? "Onvoldoende" : "Extra"}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      checked={item.isOrdered}
                      onCheckedChange={(checked) => updateItemOrdered(item.id, !!checked)}
                    />
                    <span className="text-xs text-muted-foreground">Besteld</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Render active check (check in progress)
  if (activeCheck) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-serif font-medium">Voorraadcheck actief</h3>
            <p className="text-sm text-muted-foreground">
              Gestart op {format(new Date(activeCheck.createdAt), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelCheck} size="sm">
              <X className="w-4 h-4 mr-2" />
              Annuleren
            </Button>
            <Button onClick={completeCheck} disabled={!allItemsChecked} size="sm">
              <Check className="w-4 h-4 mr-2" />
              Afronden
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {activeCheck.items.filter(i => i.status !== "pending").length} van {activeCheck.items.length} gecontroleerd
        </div>

        <div className="divide-y divide-border/50">
          {activeCheck.items.map((item) => (
            <div key={item.id} className="py-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground min-w-0 truncate">{item.ingredientName}</span>
                <span className="text-sm tabular-nums font-medium shrink-0">
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
                  <Label htmlFor={`${item.id}-extra`} className="text-xs cursor-pointer text-yellow-600">Extra</Label>
                </div>
              </RadioGroup>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Render stock check list/history
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Controleer voorraad voor bevestigde bestellingen
          </p>
        </div>
        <Button onClick={startNewCheck} disabled={creatingCheck} size="sm">
          {creatingCheck ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          Start voorraadcheck
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : stockChecks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardCheck className="w-6 h-6 mx-auto mb-2 opacity-50" />
          <p>Nog geen voorraadchecks uitgevoerd</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {stockChecks.filter(c => c.status === "completed").map((check) => {
            const itemsToOrder = check.items.filter(i => i.status === "insufficient" || i.status === "order_extra");
            return (
              <div
                key={check.id}
                className="py-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StockCheck;
