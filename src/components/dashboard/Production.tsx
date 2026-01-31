import { useState, useEffect } from "react";
import { Package, ClipboardList, AlertTriangle, Calendar, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const Production = () => {
  const [loading, setLoading] = useState(true);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [ingredientNeeds, setIngredientNeeds] = useState<IngredientNeed[]>([]);
  const [weeklyMenus, setWeeklyMenus] = useState<{ id: string; name: string; delivery_date: string | null }[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string>("all");

  useEffect(() => {
    fetchWeeklyMenus();
  }, []);

  useEffect(() => {
    fetchProductionData();
  }, [selectedMenuId]);

  const fetchWeeklyMenus = async () => {
    const { data } = await supabase
      .from("weekly_menus")
      .select("id, name, delivery_date")
      .order("delivery_date", { ascending: false });
    
    if (data) setWeeklyMenus(data);
  };

  const fetchProductionData = async () => {
    setLoading(true);

    // Fetch orders that are pending or in_production
    let ordersQuery = supabase
      .from("orders")
      .select(`
        id,
        status,
        customer:profiles!orders_customer_id_fkey(full_name),
        weekly_menu_id
      `)
      .in("status", ["pending", "confirmed", "in_production"]);

    if (selectedMenuId !== "all") {
      ordersQuery = ordersQuery.eq("weekly_menu_id", selectedMenuId);
    }

    const { data: orders } = await ordersQuery;

    if (!orders || orders.length === 0) {
      setProductionItems([]);
      setIngredientNeeds([]);
      setLoading(false);
      return;
    }

    const orderIds = orders.map(o => o.id);

    // Fetch order items
    const { data: orderItems } = await supabase
      .from("order_items")
      .select(`
        order_id,
        product_id,
        quantity,
        product:products(id, name)
      `)
      .in("order_id", orderIds);

    if (!orderItems) {
      setProductionItems([]);
      setLoading(false);
      return;
    }

    // Aggregate products
    const productMap = new Map<string, ProductionItem>();
    
    for (const item of orderItems) {
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

    // Fetch ingredient needs
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

      setIngredientNeeds(Array.from(ingredientMap.values()).sort((a, b) => a.ingredientName.localeCompare(b.ingredientName)));
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-lg font-semibold">Productie overzicht</h2>
          <p className="text-sm text-muted-foreground">
            Bekijk hoeveel producten je nodig hebt en welke ingrediënten je moet inkopen.
          </p>
        </div>
        <Select value={selectedMenuId} onValueChange={setSelectedMenuId}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Filter op weekmenu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle openstaande bestellingen</SelectItem>
            {weeklyMenus.map((menu) => (
              <SelectItem key={menu.id} value={menu.id}>
                {menu.name}
                {menu.delivery_date && (
                  <span className="text-muted-foreground ml-2">
                    ({format(parseISO(menu.delivery_date), "d MMM", { locale: nl })})
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Product totals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Te produceren producten
              </CardTitle>
              <CardDescription>
                Totaal aantal per product voor alle openstaande bestellingen
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productionItems.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{item.totalQuantity}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.orders.length}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Ingredient needs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Benodigde ingrediënten
              </CardTitle>
              <CardDescription>
                Totale hoeveelheden ingrediënten voor productie
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ingredientNeeds.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Geen ingrediënten gevonden</p>
                  <p className="text-xs mt-1">Voeg recepten toe aan je producten</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingrediënt</TableHead>
                      <TableHead className="text-right">Hoeveelheid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingredientNeeds.map((item) => (
                      <TableRow key={item.ingredientId}>
                        <TableCell className="font-medium">{item.ingredientName}</TableCell>
                        <TableCell className="text-right">
                          {item.totalNeeded.toFixed(2)} {item.unit}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Production;
