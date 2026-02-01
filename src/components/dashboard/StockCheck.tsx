import { useState, useEffect, useCallback } from "react";
import { ClipboardCheck, Play, Check, AlertCircle, Clock, ChevronRight, ArrowLeft, Loader2, Package } from "lucide-react";
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

interface IngredientNeed {
  ingredientId: string;
  ingredientName: string;
  unit: string;
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

// Convert to grams/ml for display
const convertToDisplayUnit = (value: number, unit: string): { value: number; unit: string } => {
  if (unit === "kg") {
    return { value: value * 1000, unit: "gram" };
  }
  if (unit === "liter") {
    return { value: value * 1000, unit: "ml" };
  }
  return { value, unit };
};

const formatQuantity = (value: number, unit: string): string => {
  const converted = convertToDisplayUnit(value, unit);
  const rounded = Math.round(converted.value * 10) / 10;
  return `${rounded} ${converted.unit}`;
};

const StockCheck = () => {
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
    // Fetch orders with status "confirmed" only
    const { data: orders } = await supabase
      .from("orders")
      .select(`id, weekly_menu_id`)
      .eq("status", "confirmed");

    if (!orders || orders.length === 0) {
      return [];
    }

    const orderIds = orders.map(o => o.id);
    const weeklyMenuIds = orders
      .filter(o => o.weekly_menu_id)
      .map(o => o.weekly_menu_id) as string[];

    // Fetch order items
    const { data: orderItems } = await supabase
      .from("order_items")
      .select(`product_id, quantity`)
      .in("order_id", orderIds);

    // Fetch weekly menu products
    let weeklyMenuProducts: { weekly_menu_id: string; product_id: string; quantity: number }[] = [];
    if (weeklyMenuIds.length > 0) {
      const { data } = await supabase
        .from("weekly_menu_products")
        .select(`weekly_menu_id, product_id, quantity`)
        .in("weekly_menu_id", weeklyMenuIds);
      weeklyMenuProducts = data || [];
    }

    // Aggregate products
    const productMap = new Map<string, number>();
    
    for (const item of (orderItems || [])) {
      productMap.set(item.product_id, (productMap.get(item.product_id) || 0) + item.quantity);
    }

    for (const order of orders) {
      if (!order.weekly_menu_id) continue;
      const menuProducts = weeklyMenuProducts.filter(wmp => wmp.weekly_menu_id === order.weekly_menu_id);
      for (const wmp of menuProducts) {
        productMap.set(wmp.product_id, (productMap.get(wmp.product_id) || 0) + wmp.quantity);
      }
    }

    // Fetch ingredient needs
    const productIds = Array.from(productMap.keys());
    if (productIds.length === 0) return [];

    const { data: recipeIngredients } = await supabase
      .from("recipe_ingredients")
      .select(`product_id, quantity, ingredient:ingredients(id, name, unit)`)
      .in("product_id", productIds);

    const ingredientMap = new Map<string, IngredientNeed>();
    
    for (const ri of (recipeIngredients || [])) {
      const productQty = productMap.get(ri.product_id) || 0;
      if (!ri.ingredient) continue;

      const totalForProduct = ri.quantity * productQty;
      
      if (!ingredientMap.has(ri.ingredient.id)) {
        ingredientMap.set(ri.ingredient.id, {
          ingredientId: ri.ingredient.id,
          ingredientName: ri.ingredient.name,
          unit: ri.ingredient.unit,
          totalNeeded: 0,
        });
      }
      
      ingredientMap.get(ri.ingredient.id)!.totalNeeded += totalForProduct;
    }

    return Array.from(ingredientMap.values()).sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ingrediënt</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Benodigd</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-center py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">Besteld</th>
              </tr>
            </thead>
            <tbody>
              {itemsToOrder.map((item) => (
                <tr key={item.id} className="border-b border-border/50 last:border-0">
                  <td className="py-3 px-0 text-foreground">{item.ingredientName}</td>
                  <td className="py-3 px-4 text-right tabular-nums font-medium">
                    {formatQuantity(item.requiredQuantity, item.unit)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge 
                      variant="outline" 
                      className={item.status === "insufficient" ? "border-destructive text-destructive" : "border-yellow-600 text-yellow-600"}
                    >
                      {item.status === "insufficient" ? "Onvoldoende" : "Extra"}
                    </Badge>
                  </td>
                  <td className="py-3 px-0 text-center">
                    <Checkbox 
                      checked={item.isOrdered}
                      onCheckedChange={(checked) => updateItemOrdered(item.id, !!checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // Render active check (check in progress)
  if (activeCheck) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-serif font-medium">Voorraadcheck actief</h3>
            <p className="text-sm text-muted-foreground">
              Gestart op {format(new Date(activeCheck.createdAt), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
            </p>
          </div>
          <Button 
            onClick={completeCheck} 
            disabled={!allItemsChecked}
            size="sm"
          >
            <Check className="w-4 h-4 mr-2" />
            Afronden
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          {activeCheck.items.filter(i => i.status !== "pending").length} van {activeCheck.items.length} gecontroleerd
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ingrediënt</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Benodigd</th>
              <th className="py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {activeCheck.items.map((item) => (
              <tr key={item.id} className="border-b border-border/50 last:border-0">
                <td className="py-3 px-0 text-foreground">{item.ingredientName}</td>
                <td className="py-3 px-4 text-right tabular-nums font-medium">
                  {formatQuantity(item.requiredQuantity, item.unit)}
                </td>
                <td className="py-3 px-0">
                  <RadioGroup 
                    value={item.status} 
                    onValueChange={(val) => updateItemStatus(item.id, val as StockCheckItem["status"])}
                    className="flex gap-4"
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
                      <Label htmlFor={`${item.id}-extra`} className="text-xs cursor-pointer text-yellow-600">Extra bestellen</Label>
                    </div>
                  </RadioGroup>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">Datum</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ingrediënten</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Te bestellen</th>
              <th className="text-center py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">Status</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {stockChecks.filter(c => c.status === "completed").map((check) => {
              const itemsToOrder = check.items.filter(i => i.status === "insufficient" || i.status === "order_extra");
              return (
                <tr 
                  key={check.id} 
                  className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedCheck(check)}
                >
                  <td className="py-3 px-0 text-foreground">
                    {format(new Date(check.createdAt), "d MMM yyyy", { locale: nl })}
                  </td>
                  <td className="py-3 px-4 text-center tabular-nums text-muted-foreground">
                    {check.items.length}
                  </td>
                  <td className="py-3 px-4 text-center tabular-nums">
                    {itemsToOrder.length}
                  </td>
                  <td className="py-3 px-0 text-center">
                    {getCheckStatusIcon(check)}
                  </td>
                  <td className="py-3 px-0">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default StockCheck;
