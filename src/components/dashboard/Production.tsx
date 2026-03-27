import { useState, useEffect, useCallback } from "react";
import {
  Package,
  Wheat,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Calendar,
  ClipboardCheck,
} from "lucide-react";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StockCheck from "./StockCheck";

interface ProductionItem {
  productId: string;
  productName: string;
  totalQuantity: number; // stuks te produceren (geaggregeerd)
  orders: { orderId: string; customerName: string; quantity: number }[];
}

interface IngredientNeed {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  totalNeeded: number;
}

interface ProductIngredient {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantityPerProduct: number; // per stuk (dus al yield-correct)
  totalNeeded: number; // totaal op basis van productie-aantallen
}

// Convert to grams/ml for display
const convertToDisplayUnit = (value: number, unit: string): { value: number; unit: string } => {
  if (unit === "kg") return { value: value * 1000, unit: "gram" };
  if (unit === "liter") return { value: value * 1000, unit: "ml" };
  return { value, unit };
};

const formatQuantity = (value: number, unit: string): string => {
  const converted = convertToDisplayUnit(value, unit);
  const rounded = Math.round(converted.value * 10) / 10;
  return `${rounded} ${converted.unit}`;
};

type StatusFilter = "confirmed" | "in_production" | "all_production";

type OrderRow = {
  id: string;
  status: string;
  customer: { full_name: string | null } | null;
};

type OrderItemRow = {
  order_id: string;
  product_id: string;
  quantity: number;
  is_weekly_menu_item: boolean;
  product: { id: string; name: string } | null;
};

type ProductYieldRow = {
  id: string;
  yield_quantity: number;
  yield_unit: string;
};

const Production = () => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [allIngredientNeeds, setAllIngredientNeeds] = useState<IngredientNeed[]>([]);
  const [activeTab, setActiveTab] = useState<"products" | "ingredients" | "stockcheck">("products");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("confirmed");

  const [selectedProduct, setSelectedProduct] = useState<ProductionItem | null>(null);
  const [productIngredients, setProductIngredients] = useState<ProductIngredient[]>([]);
  const [loadingProductDetail, setLoadingProductDetail] = useState(false);

  const refreshData = useCallback(() => {
    fetchProductionData();
  }, [statusFilter]);

  useEffect(() => {
    fetchProductionData();
  }, [statusFilter]);

  useVisibilityRefresh(refreshData);

  const fetchProductionData = async () => {
    setLoading(true);
    setSelectedProduct(null);

    // 1) Orders ophalen (met statusfilter)
    let query = supabase
      .from("orders")
      .select(`
        id,
        status,
        customer:profiles!orders_customer_id_fkey(full_name)
      `);

    if (statusFilter === "confirmed") {
      query = query.eq("status", "confirmed");
    } else if (statusFilter === "in_production") {
      query = query.eq("status", "in_production");
    } else {
      query = query.in("status", ["confirmed", "in_production"]);
    }

    const { data: orders, error: ordersErr } = await query;

    if (ordersErr || !orders || orders.length === 0) {
      setProductionItems([]);
      setAllIngredientNeeds([]);
      setLoading(false);
      return;
    }

    const orderRows = orders as unknown as OrderRow[];
    const orderIdList = orderRows.map((o) => o.id);
    const orderById = new Map<string, OrderRow>();
    for (const o of orderRows) orderById.set(o.id, o);

    // 2) ALL order_items (single source of truth — includes weekly menu items with correct quantities)
    const { data: allItems, error: itemsErr } = await supabase
      .from("order_items")
      .select(`
        order_id,
        product_id,
        quantity,
        is_weekly_menu_item,
        product:products(id, name)
      `)
      .in("order_id", orderIdList);

    if (itemsErr) {
      console.error("Error fetching order items:", itemsErr);
    }

    const allItemRows = (allItems || []) as unknown as OrderItemRow[];

    // 3) Aggregate productieproducten
    const productMap = new Map<string, ProductionItem>();

    const addToProduction = (orderId: string, productId: string, productName: string, quantity: number) => {
      if (!productMap.has(productId)) {
        productMap.set(productId, {
          productId,
          productName,
          totalQuantity: 0,
          orders: [],
        });
      }
      const prod = productMap.get(productId)!;
      prod.totalQuantity += quantity;

      const order = orderById.get(orderId);
      prod.orders.push({
        orderId,
        customerName: order?.customer?.full_name || "Onbekend",
        quantity,
      });
    };

    for (const item of allItemRows) {
      const name = item.product?.name || "Onbekend product";
      addToProduction(item.order_id, item.product_id, name, item.quantity);
    }

    const productionList = Array.from(productMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
    setProductionItems(productionList);

    // 5) Yield info ophalen voor alle producten die in productie zitten
    const productIds = Array.from(productMap.keys());
    const { data: yieldsData, error: yieldsErr } = await supabase
      .from("products")
      .select("id, yield_quantity, yield_unit")
      .in("id", productIds);

    if (yieldsErr) console.error("Error fetching product yields:", yieldsErr);

    const yieldByProductId = new Map<string, number>();
    for (const p of ((yieldsData || []) as unknown as ProductYieldRow[])) {
      // yield_quantity kan bv 30 zijn; fallback minimaal 1
      yieldByProductId.set(p.id, Math.max(1, Number(p.yield_quantity || 1)));
    }

    // 6) Ingrediëntenbehoefte (alles) — yield-correct
    const { data: recipeIngredients, error: recipeErr } = await supabase
      .from("recipe_ingredients")
      .select(
        `
        product_id,
        quantity,
        ingredient:ingredients(id, name, unit)
      `
      )
      .in("product_id", productIds);

    if (recipeErr) console.error("Error fetching recipe_ingredients:", recipeErr);

    if (recipeIngredients) {
      const ingredientMap = new Map<string, IngredientNeed>();

      for (const ri of recipeIngredients as any[]) {
        const productItem = productMap.get(ri.product_id);
        if (!productItem || !ri.ingredient) continue;

        const yieldQty = yieldByProductId.get(ri.product_id) ?? 1; // stuks per batch
        const perPieceQty = Number(ri.quantity || 0) / yieldQty; // ✅ per stuk
        const totalForProduct = perPieceQty * productItem.totalQuantity;

        const ingId = ri.ingredient.id;
        if (!ingredientMap.has(ingId)) {
          ingredientMap.set(ingId, {
            ingredientId: ingId,
            ingredientName: ri.ingredient.name,
            unit: ri.ingredient.unit,
            totalNeeded: 0,
          });
        }

        ingredientMap.get(ingId)!.totalNeeded += totalForProduct;
      }

      setAllIngredientNeeds(
        Array.from(ingredientMap.values()).sort((a, b) =>
          a.ingredientName.localeCompare(b.ingredientName)
        )
      );
    } else {
      setAllIngredientNeeds([]);
    }

    setLoading(false);
  };

  const fetchProductIngredients = async (product: ProductionItem) => {
    setLoadingProductDetail(true);
    setSelectedProduct(product);

    // Yield ophalen (voor per-stuk omrekening)
    const { data: productRow, error: prodErr } = await supabase
      .from("products")
      .select("id, yield_quantity")
      .eq("id", product.productId)
      .single();

    if (prodErr) console.error("Error fetching product yield:", prodErr);

    const yieldQty = Math.max(1, Number((productRow as any)?.yield_quantity || 1));

    const { data: recipeIngredients, error: recipeErr } = await supabase
      .from("recipe_ingredients")
      .select(
        `
        quantity,
        ingredient:ingredients(id, name, unit)
      `
      )
      .eq("product_id", product.productId);

    if (recipeErr) console.error("Error fetching recipe_ingredients for product:", recipeErr);

    if (recipeIngredients) {
      const ingredients: ProductIngredient[] = (recipeIngredients as any[])
        .filter((ri) => ri.ingredient)
        .map((ri) => {
          const perPieceQty = Number(ri.quantity || 0) / yieldQty; // ✅ per stuk
          return {
            ingredientId: ri.ingredient.id,
            ingredientName: ri.ingredient.name,
            unit: ri.ingredient.unit,
            quantityPerProduct: perPieceQty,
            totalNeeded: perPieceQty * product.totalQuantity,
          };
        })
        .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));

      setProductIngredients(ingredients);
    } else {
      setProductIngredients([]);
    }

    setLoadingProductDetail(false);
  };

  const goBackToProductList = () => {
    setSelectedProduct(null);
    setProductIngredients([]);
  };

  const getStatusFilterLabel = () => {
    switch (statusFilter) {
      case "confirmed":
        return "Bevestigd";
      case "in_production":
        return "In productie";
      case "all_production":
        return "Bevestigd + In productie";
      default:
        return "Status";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-serif font-medium">Productie</h2>
          <p className="text-sm text-muted-foreground">{getStatusFilterLabel()}</p>
        </div>
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confirmed">Bevestigd</SelectItem>
            <SelectItem value="in_production">In productie</SelectItem>
            <SelectItem value="all_production">Bevestigd + In productie</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="products" className="gap-1.5 text-xs sm:text-sm">
              <Package className="w-4 h-4" />
              {isMobile ? "Prod." : "Producten"}
            </TabsTrigger>
            <TabsTrigger value="ingredients" className="gap-1.5 text-xs sm:text-sm">
              <Wheat className="w-4 h-4" />
              {isMobile ? "Ingr." : "Ingrediënten"}
            </TabsTrigger>
            <TabsTrigger value="stockcheck" className="gap-1.5 text-xs sm:text-sm">
              <ClipboardCheck className="w-4 h-4" />
              {isMobile ? "Voorraad" : "Voorraadcheck"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-6">
            {selectedProduct ? (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Button variant="ghost" size="icon" onClick={goBackToProductList}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div>
                    <h3 className="text-lg font-serif font-medium">{selectedProduct.productName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedProduct.totalQuantity} stuks — benodigde ingrediënten
                    </p>
                  </div>
                </div>

                {loadingProductDetail ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : productIngredients.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Wheat className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p>Geen ingrediënten gekoppeld</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {productIngredients.map((ing) => (
                      <div key={ing.ingredientId} className="py-3 flex items-center justify-between gap-2">
                        <span className="text-foreground text-sm min-w-0 truncate">{ing.ingredientName}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                            {formatQuantity(ing.quantityPerProduct, ing.unit)}/st
                          </span>
                          <span className="text-sm tabular-nums font-medium">
                            {formatQuantity(ing.totalNeeded, ing.unit)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {productionItems.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p>Geen openstaande bestellingen</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {productionItems.map((item) => (
                      <div
                        key={item.productId}
                        className="py-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => fetchProductIngredients(item)}
                      >
                        <span className="text-foreground text-sm min-w-0 truncate">{item.productName}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm tabular-nums font-medium">{item.totalQuantity}×</span>
                          <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                            {item.orders.length} orders
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ingredients" className="mt-6">
            {allIngredientNeeds.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wheat className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p>Geen ingrediënten</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {allIngredientNeeds.map((item) => (
                  <div key={item.ingredientId} className="py-3 flex items-center justify-between gap-2">
                    <span className="text-foreground text-sm min-w-0 truncate">{item.ingredientName}</span>
                    <span className="text-sm tabular-nums font-medium shrink-0">
                      {formatQuantity(item.totalNeeded, item.unit)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stockcheck" className="mt-6">
            <StockCheck />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Production;
