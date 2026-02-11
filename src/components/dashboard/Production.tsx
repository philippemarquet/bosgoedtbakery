import { useState, useEffect, useCallback } from "react";
import { Package, Wheat, ChevronRight, ArrowLeft, Loader2, Calendar, ClipboardCheck } from "lucide-react";
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
  totalQuantity: number;
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
  quantityPerProduct: number;
  totalNeeded: number;
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
  // Round to 1 decimal for cleaner display
  const rounded = Math.round(converted.value * 10) / 10;
  return `${rounded} ${converted.unit}`;
};

type StatusFilter = "confirmed" | "in_production" | "all_production";

const Production = () => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [allIngredientNeeds, setAllIngredientNeeds] = useState<IngredientNeed[]>([]);
  const [activeTab, setActiveTab] = useState<"products" | "ingredients" | "stockcheck">("products");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("confirmed");
  
  // For product detail view
  const [selectedProduct, setSelectedProduct] = useState<ProductionItem | null>(null);
  const [productIngredients, setProductIngredients] = useState<ProductIngredient[]>([]);
  const [loadingProductDetail, setLoadingProductDetail] = useState(false);

  const refreshData = useCallback(() => {
    fetchProductionData();
  }, [statusFilter]);

  useEffect(() => {
    fetchProductionData();
  }, [statusFilter]);

  // Refresh data when tab becomes visible again
  useVisibilityRefresh(refreshData);


  const fetchProductionData = async () => {
    setLoading(true);
    setSelectedProduct(null);

    // Determine which statuses to fetch based on filter
    let query = supabase
      .from("orders")
      .select(`
        id,
        status,
        weekly_menu_id,
        customer:profiles!orders_customer_id_fkey(full_name)
      `);
    
    if (statusFilter === "confirmed") {
      query = query.eq("status", "confirmed");
    } else if (statusFilter === "in_production") {
      query = query.eq("status", "in_production");
    } else {
      // all_production: both confirmed and in_production
      query = query.in("status", ["confirmed", "in_production"]);
    }
    
    const { data: orders } = await query;

    if (!orders || orders.length === 0) {
      setProductionItems([]);
      setAllIngredientNeeds([]);
      setLoading(false);
      return;
    }

    const orderIds = orders.map(o => o.id);

    // Fetch ALL order items — this is the single source of truth
    const { data: orderItems } = await supabase
      .from("order_items")
      .select(`
        order_id,
        product_id,
        quantity,
        product:products(id, name)
      `)
      .in("order_id", orderIds);

    // Aggregate products from order_items only
    const productMap = new Map<string, ProductionItem>();
    
    for (const item of (orderItems || [])) {
      const order = orders.find(o => o.id === item.order_id);
      const productName = item.product?.name || "Onbekend product";
      
      if (!productMap.has(item.product_id)) {
        productMap.set(item.product_id, {
          productId: item.product_id,
          productName,
          totalQuantity: 0,
          orders: [],
        });
      }
      
      const prod = productMap.get(item.product_id)!;
      prod.totalQuantity += item.quantity;
      prod.orders.push({
        orderId: item.order_id,
        customerName: order?.customer?.full_name || "Onbekend",
        quantity: item.quantity,
      });
    }

    setProductionItems(Array.from(productMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity));

    // Fetch ingredient needs for all products
    const productIds = Array.from(productMap.keys());
    const { data: recipeIngredients } = await supabase
      .from("recipe_ingredients")
      .select(`
        product_id,
        quantity,
        ingredient:ingredients(id, name, unit)
      `)
      .in("product_id", productIds);

    if (recipeIngredients) {
      const ingredientMap = new Map<string, IngredientNeed>();
      
      for (const ri of recipeIngredients) {
        const productItem = productMap.get(ri.product_id);
        if (!productItem || !ri.ingredient) continue;

        const totalForProduct = ri.quantity * productItem.totalQuantity;
        
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

      setAllIngredientNeeds(Array.from(ingredientMap.values()).sort((a, b) => a.ingredientName.localeCompare(b.ingredientName)));
    }

    setLoading(false);
  };

  const fetchProductIngredients = async (product: ProductionItem) => {
    setLoadingProductDetail(true);
    setSelectedProduct(product);

    const { data: recipeIngredients } = await supabase
      .from("recipe_ingredients")
      .select(`
        quantity,
        ingredient:ingredients(id, name, unit)
      `)
      .eq("product_id", product.productId);

    if (recipeIngredients) {
      const ingredients: ProductIngredient[] = recipeIngredients
        .filter(ri => ri.ingredient)
        .map(ri => ({
          ingredientId: ri.ingredient!.id,
          ingredientName: ri.ingredient!.name,
          unit: ri.ingredient!.unit,
          quantityPerProduct: ri.quantity,
          totalNeeded: ri.quantity * product.totalQuantity,
        }))
        .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));

      setProductIngredients(ingredients);
    }

    setLoadingProductDetail(false);
  };

  const goBackToProductList = () => {
    setSelectedProduct(null);
    setProductIngredients([]);
  };

  const getStatusFilterLabel = () => {
    switch (statusFilter) {
      case "confirmed": return "Bevestigd";
      case "in_production": return "In productie";
      case "all_production": return "Bevestigd + In productie";
      default: return "Status";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-serif font-medium">Productie</h2>
          <p className="text-sm text-muted-foreground">
            {getStatusFilterLabel()}
          </p>
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "products" | "ingredients" | "stockcheck")}>
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
              // Product detail view
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
              // Product list
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
                          <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">{item.orders.length} orders</span>
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
