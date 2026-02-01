import { useState, useEffect, useCallback } from "react";
import { Package, Wheat, ChevronRight, ArrowLeft, Loader2, Calendar, ClipboardCheck } from "lucide-react";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const Production = () => {
  const [loading, setLoading] = useState(true);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [allIngredientNeeds, setAllIngredientNeeds] = useState<IngredientNeed[]>([]);
  const [activeTab, setActiveTab] = useState<"products" | "ingredients" | "stockcheck">("products");
  
  // For product detail view
  const [selectedProduct, setSelectedProduct] = useState<ProductionItem | null>(null);
  const [productIngredients, setProductIngredients] = useState<ProductIngredient[]>([]);
  const [loadingProductDetail, setLoadingProductDetail] = useState(false);

  const refreshData = useCallback(() => {
    fetchProductionData();
  }, []);

  useEffect(() => {
    fetchProductionData();
  }, []);

  // Refresh data when tab becomes visible again
  useVisibilityRefresh(refreshData);


  const fetchProductionData = async () => {
    setLoading(true);
    setSelectedProduct(null);

    // Fetch orders with status "confirmed" only
    const { data: orders } = await supabase
      .from("orders")
      .select(`
        id,
        status,
        weekly_menu_id,
        customer:profiles!orders_customer_id_fkey(full_name)
      `)
      .eq("status", "confirmed");

    if (!orders || orders.length === 0) {
      setProductionItems([]);
      setAllIngredientNeeds([]);
      setLoading(false);
      return;
    }

    const orderIds = orders.map(o => o.id);
    const weeklyMenuIds = orders
      .filter(o => o.weekly_menu_id)
      .map(o => o.weekly_menu_id) as string[];

    // Fetch order items (individual products)
    const { data: orderItems } = await supabase
      .from("order_items")
      .select(`
        order_id,
        product_id,
        quantity,
        product:products(id, name)
      `)
      .in("order_id", orderIds);

    // Fetch weekly menu products if any orders have a weekly_menu_id
    let weeklyMenuProducts: { weekly_menu_id: string; product_id: string; quantity: number; product: { id: string; name: string } | null }[] = [];
    if (weeklyMenuIds.length > 0) {
      const { data } = await supabase
        .from("weekly_menu_products")
        .select(`
          weekly_menu_id,
          product_id,
          quantity,
          product:products(id, name)
        `)
        .in("weekly_menu_id", weeklyMenuIds);
      weeklyMenuProducts = data || [];
    }

    // Aggregate products
    const productMap = new Map<string, ProductionItem>();
    
    // Add order items (individual products)
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

    // Add weekly menu products
    for (const order of orders) {
      if (!order.weekly_menu_id) continue;
      
      const menuProducts = weeklyMenuProducts.filter(wmp => wmp.weekly_menu_id === order.weekly_menu_id);
      for (const wmp of menuProducts) {
        const productName = wmp.product?.name || "Onbekend product";
        
        if (!productMap.has(wmp.product_id)) {
          productMap.set(wmp.product_id, {
            productId: wmp.product_id,
            productName,
            totalQuantity: 0,
            orders: [],
          });
        }
        
        const prod = productMap.get(wmp.product_id)!;
        prod.totalQuantity += wmp.quantity;
        prod.orders.push({
          orderId: order.id,
          customerName: order.customer?.full_name || "Onbekend",
          quantity: wmp.quantity,
        });
      }
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-serif font-medium">Productie</h2>
        <p className="text-sm text-muted-foreground">
          Bestellingen met status "Bevestigd"
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "products" | "ingredients" | "stockcheck")}>
          <TabsList>
            <TabsTrigger value="products" className="gap-2">
              <Package className="w-4 h-4" />
              Producten
            </TabsTrigger>
            <TabsTrigger value="ingredients" className="gap-2">
              <Wheat className="w-4 h-4" />
              Ingrediënten
            </TabsTrigger>
            <TabsTrigger value="stockcheck" className="gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Voorraadcheck
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
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ingrediënt</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Per stuk</th>
                        <th className="text-right py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">Totaal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productIngredients.map((ing) => (
                        <tr key={ing.ingredientId} className="border-b border-border/50 last:border-0">
                          <td className="py-3 px-0 text-foreground">{ing.ingredientName}</td>
                          <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                            {formatQuantity(ing.quantityPerProduct, ing.unit)}
                          </td>
                          <td className="py-3 px-0 text-right tabular-nums font-medium">
                            {formatQuantity(ing.totalNeeded, ing.unit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">Product</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Aantal</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Orders</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {productionItems.map((item) => (
                        <tr 
                          key={item.productId} 
                          className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => fetchProductIngredients(item)}
                        >
                          <td className="py-3 px-0 text-foreground">{item.productName}</td>
                          <td className="py-3 px-4 text-right tabular-nums font-medium">{item.totalQuantity}</td>
                          <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">{item.orders.length}</td>
                          <td className="py-3 px-0">
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ingrediënt</th>
                    <th className="text-right py-3 px-0 text-xs font-medium text-muted-foreground uppercase tracking-wider">Totaal nodig</th>
                  </tr>
                </thead>
                <tbody>
                  {allIngredientNeeds.map((item) => (
                    <tr key={item.ingredientId} className="border-b border-border/50 last:border-0">
                      <td className="py-3 px-0 text-foreground">{item.ingredientName}</td>
                      <td className="py-3 px-0 text-right tabular-nums font-medium">
                        {formatQuantity(item.totalNeeded, item.unit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
