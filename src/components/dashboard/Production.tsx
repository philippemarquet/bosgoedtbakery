import { useState, useEffect, useCallback } from "react";
import { Package, Wheat, ChevronRight, ArrowLeft, Loader2, Calendar } from "lucide-react";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  const [activeTab, setActiveTab] = useState<"products" | "ingredients">("products");
  
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
        <h2 className="text-lg font-semibold">Productie overzicht</h2>
        <p className="text-sm text-muted-foreground">
          Alle bestellingen met status "Bevestigd" — dit moet nog geproduceerd worden.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "products" | "ingredients")}>
          <TabsList>
            <TabsTrigger value="products" className="gap-2">
              <Package className="w-4 h-4" />
              Producten
            </TabsTrigger>
            <TabsTrigger value="ingredients" className="gap-2">
              <Wheat className="w-4 h-4" />
              Ingrediënten
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-4">
            {selectedProduct ? (
              // Product detail view - ingredients for this product
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={goBackToProductList}>
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {selectedProduct.productName}
                        <Badge variant="secondary">{selectedProduct.totalQuantity}x</Badge>
                      </CardTitle>
                      <CardDescription>
                        Benodigde ingrediënten voor {selectedProduct.totalQuantity} stuks
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingProductDetail ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : productIngredients.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Wheat className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Geen ingrediënten gekoppeld aan dit product</p>
                      <p className="text-xs mt-1">Voeg een recept toe in Back-office → Producten</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ingrediënt</TableHead>
                          <TableHead className="text-right">Per stuk</TableHead>
                          <TableHead className="text-right">Totaal nodig</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productIngredients.map((ing) => (
                          <TableRow key={ing.ingredientId}>
                            <TableCell className="font-medium">{ing.ingredientName}</TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatQuantity(ing.quantityPerProduct, ing.unit)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatQuantity(ing.totalNeeded, ing.unit)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            ) : (
              // Product list view
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Te produceren producten
                  </CardTitle>
                  <CardDescription>
                    Klik op een product om de benodigde ingrediënten te zien
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {productionItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Geen openstaande bestellingen</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Aantal</TableHead>
                          <TableHead className="text-right">Bestellingen</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productionItems.map((item) => (
                          <TableRow 
                            key={item.productId} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => fetchProductIngredients(item)}
                          >
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{item.totalQuantity}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {item.orders.length}
                            </TableCell>
                            <TableCell>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ingredients" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wheat className="w-5 h-5" />
                  Totaal benodigde ingrediënten
                </CardTitle>
                <CardDescription>
                  Alle ingrediënten die je nodig hebt voor de openstaande bestellingen
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allIngredientNeeds.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wheat className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Geen ingrediënten gevonden</p>
                    <p className="text-xs mt-1">Voeg recepten toe aan je producten</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingrediënt</TableHead>
                        <TableHead className="text-right">Totaal nodig</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allIngredientNeeds.map((item) => (
                        <TableRow key={item.ingredientId}>
                          <TableCell className="font-medium">{item.ingredientName}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatQuantity(item.totalNeeded, item.unit)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Production;
