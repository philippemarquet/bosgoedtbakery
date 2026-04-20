import { useState, useEffect, useCallback } from "react";
import {
  Package,
  Wheat,
  ChevronRight,
  ArrowLeft,
  Calendar,
  ClipboardCheck,
  ListChecks,
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
import ProductionChecklist from "./ProductionChecklist";
import {
  batchesForOrder,
  ingredientNeeded,
  type ProductForPricing,
} from "@/lib/pricing";
import { formatQuantity, type MeasurementUnit } from "@/lib/units";

interface ProductionItem {
  productId: string;
  productName: string;
  totalQuantity: number; // sell-units te produceren (geaggregeerd)
  batches: number;       // hoeveel recept-batches dat zijn
  sellUnitLabel: string; // bv. "400 g" of "stuks"
  orders: { orderId: string; customerName: string; quantity: number }[];
}

interface IngredientNeed {
  ingredientId: string;
  ingredientName: string;
  unit: MeasurementUnit;
  totalNeeded: number;
}

interface ProductIngredient {
  ingredientId: string;
  ingredientName: string;
  unit: MeasurementUnit;
  quantityPerSellUnit: number; // ingrediënt-hoeveelheid per verkoopeenheid
  totalNeeded: number;          // totaal voor de bestelde hoeveelheid
}

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
  product: { id: string; name: string } | null;
};

type ProductRow = {
  id: string;
  name: string;
  recipe_yield_quantity: number;
  recipe_yield_unit: MeasurementUnit;
  sell_unit_quantity: number;
  sell_unit_unit: MeasurementUnit;
  selling_price: number;
};

type RecipeRow = {
  product_id: string;
  quantity: number;
  ingredient: {
    id: string;
    name: string;
    unit: MeasurementUnit;
  } | null;
};

const toForPricing = (p: ProductRow): ProductForPricing => ({
  id: p.id,
  selling_price: Number(p.selling_price || 0),
  recipe_yield_quantity: Number(p.recipe_yield_quantity || 0),
  recipe_yield_unit: p.recipe_yield_unit,
  sell_unit_quantity: Number(p.sell_unit_quantity || 0),
  sell_unit_unit: p.sell_unit_unit,
});

const formatSellUnit = (p: ProductRow): string => {
  const qty = Number(p.sell_unit_quantity || 1);
  return formatQuantity(qty, p.sell_unit_unit);
};

const Production = () => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [allIngredientNeeds, setAllIngredientNeeds] = useState<IngredientNeed[]>([]);
  const [activeTab, setActiveTab] = useState<"products" | "ingredients" | "stockcheck" | "checklist">("products");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const saved = localStorage.getItem("production_statusFilter");
    return saved === "confirmed" || saved === "in_production" || saved === "all_production"
      ? saved
      : "confirmed";
  });

  const [selectedProduct, setSelectedProduct] = useState<ProductionItem | null>(null);
  const [productIngredients, setProductIngredients] = useState<ProductIngredient[]>([]);
  const [loadingProductDetail, setLoadingProductDetail] = useState(false);
  // Caches from the main fetch, reused when opening a product detail.
  const [productsById, setProductsById] = useState<Record<string, ProductRow>>({});
  const [recipesByProductId, setRecipesByProductId] = useState<Record<string, RecipeRow[]>>({});

  const refreshData = useCallback(() => {
    fetchProductionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    fetchProductionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useVisibilityRefresh(refreshData);

  const fetchProductionData = async () => {
    setLoading(true);
    setSelectedProduct(null);

    // 1) Orders ophalen (met statusfilter)
    let query = supabase.from("orders").select(`
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
      setProductsById({});
      setRecipesByProductId({});
      setLoading(false);
      return;
    }

    const orderRows = orders as unknown as OrderRow[];
    const orderIdList = orderRows.map((o) => o.id);
    const orderById = new Map<string, OrderRow>();
    for (const o of orderRows) orderById.set(o.id, o);

    // 2) ALL order_items (single source of truth — inclusief oude weekmenu-items
    //    met correcte quantities)
    const { data: allItems, error: itemsErr } = await supabase
      .from("order_items")
      .select(`
        order_id,
        product_id,
        quantity,
        product:products(id, name)
      `)
      .in("order_id", orderIdList);

    if (itemsErr) console.error("Error fetching order items:", itemsErr);

    const allItemRows = (allItems || []) as unknown as OrderItemRow[];

    // Aggregate sell-units per product + verzamel orders per product.
    type Aggregate = {
      productId: string;
      productName: string;
      totalQuantity: number;
      orders: { orderId: string; customerName: string; quantity: number }[];
    };
    const aggByProduct = new Map<string, Aggregate>();
    for (const item of allItemRows) {
      const name = item.product?.name || "Onbekend product";
      if (!aggByProduct.has(item.product_id)) {
        aggByProduct.set(item.product_id, {
          productId: item.product_id,
          productName: name,
          totalQuantity: 0,
          orders: [],
        });
      }
      const entry = aggByProduct.get(item.product_id)!;
      entry.totalQuantity += Number(item.quantity || 0);
      const order = orderById.get(item.order_id);
      entry.orders.push({
        orderId: item.order_id,
        customerName: order?.customer?.full_name || "Onbekend",
        quantity: Number(item.quantity || 0),
      });
    }

    // 3) Product-data (yield / sell-unit) + recepten in 2 bulk queries.
    const productIds = Array.from(aggByProduct.keys());
    if (productIds.length === 0) {
      setProductionItems([]);
      setAllIngredientNeeds([]);
      setProductsById({});
      setRecipesByProductId({});
      setLoading(false);
      return;
    }

    const [productsRes, recipesRes] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id, name, recipe_yield_quantity, recipe_yield_unit, sell_unit_quantity, sell_unit_unit, selling_price",
        )
        .in("id", productIds),
      supabase
        .from("recipe_ingredients")
        .select(`
          product_id,
          quantity,
          ingredient:ingredients(id, name, unit)
        `)
        .in("product_id", productIds),
    ]);

    if (productsRes.error) console.error("Error fetching products:", productsRes.error);
    if (recipesRes.error) console.error("Error fetching recipe_ingredients:", recipesRes.error);

    const productMap: Record<string, ProductRow> = {};
    for (const p of (productsRes.data || []) as ProductRow[]) {
      productMap[p.id] = p;
    }

    const recipeMap: Record<string, RecipeRow[]> = {};
    for (const r of (recipesRes.data || []) as unknown as RecipeRow[]) {
      if (!recipeMap[r.product_id]) recipeMap[r.product_id] = [];
      recipeMap[r.product_id].push(r);
    }

    setProductsById(productMap);
    setRecipesByProductId(recipeMap);

    // 4) Production-list met batches per product.
    const productionList: ProductionItem[] = Array.from(aggByProduct.values())
      .map((agg) => {
        const product = productMap[agg.productId];
        const batches = product
          ? safeBatches(toForPricing(product), agg.totalQuantity)
          : 0;
        return {
          productId: agg.productId,
          productName: agg.productName,
          totalQuantity: agg.totalQuantity,
          batches,
          sellUnitLabel: product ? formatSellUnit(product) : "stuks",
          orders: agg.orders,
        };
      })
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    setProductionItems(productionList);

    // 5) Ingrediëntenbehoefte (alles) — via pricing-lib: batches × quantity-per-batch.
    const ingredientMap = new Map<string, IngredientNeed>();
    for (const agg of aggByProduct.values()) {
      const product = productMap[agg.productId];
      if (!product) continue;
      const batches = safeBatches(toForPricing(product), agg.totalQuantity);
      if (batches <= 0) continue;
      const recipes = recipeMap[agg.productId] ?? [];

      for (const ri of recipes) {
        if (!ri.ingredient) continue;
        const totalForIngredient = ingredientNeeded({ quantity: Number(ri.quantity || 0) }, batches);
        const ing = ri.ingredient;
        if (!ingredientMap.has(ing.id)) {
          ingredientMap.set(ing.id, {
            ingredientId: ing.id,
            ingredientName: ing.name,
            unit: ing.unit,
            totalNeeded: 0,
          });
        }
        ingredientMap.get(ing.id)!.totalNeeded += totalForIngredient;
      }
    }

    setAllIngredientNeeds(
      Array.from(ingredientMap.values()).sort((a, b) =>
        a.ingredientName.localeCompare(b.ingredientName),
      ),
    );

    setLoading(false);
  };

  const openProductDetail = (product: ProductionItem) => {
    setLoadingProductDetail(true);
    setSelectedProduct(product);

    const productRow = productsById[product.productId];
    const recipes = recipesByProductId[product.productId] ?? [];
    if (!productRow) {
      setProductIngredients([]);
      setLoadingProductDetail(false);
      return;
    }

    const forPricing = toForPricing(productRow);
    const batchesTotal = safeBatches(forPricing, product.totalQuantity);
    const batchesPerOne = safeBatches(forPricing, 1);

    const ingredients: ProductIngredient[] = recipes
      .filter((ri) => ri.ingredient)
      .map((ri) => {
        const perSellUnit = Number(ri.quantity || 0) * batchesPerOne;
        const totalNeeded = ingredientNeeded(
          { quantity: Number(ri.quantity || 0) },
          batchesTotal,
        );
        return {
          ingredientId: ri.ingredient!.id,
          ingredientName: ri.ingredient!.name,
          unit: ri.ingredient!.unit,
          quantityPerSellUnit: perSellUnit,
          totalNeeded,
        };
      })
      .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));

    setProductIngredients(ingredients);
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
        return "Bevestigd + in productie";
      default:
        return "Status";
    }
  };

  const EmptyState = ({
    icon: Icon,
    title,
    hint,
  }: {
    icon: typeof Calendar;
    title: string;
    hint?: string;
  }) => (
    <div className="text-center py-16">
      <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="font-serif text-lg text-foreground">{title}</p>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="bakery-eyebrow mb-2">Productie</p>
          <h2
            className="font-serif text-3xl md:text-4xl font-medium text-foreground leading-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            Wat gaat er vandaag de oven in?
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Filter — {getStatusFilterLabel().toLowerCase()}.
          </p>
        </div>
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            const v = val as StatusFilter;
            setStatusFilter(v);
            localStorage.setItem("production_statusFilter", v);
          }}
        >
          <SelectTrigger className="w-full md:w-[220px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confirmed">Bevestigd</SelectItem>
            <SelectItem value="in_production">In productie</SelectItem>
            <SelectItem value="all_production">Bevestigd + in productie</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="paper-card py-16 text-center">
          <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
          <p className="text-sm text-muted-foreground">Laden…</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="products" className="gap-1.5 text-xs sm:text-sm">
              <Package className="w-4 h-4" />
              {isMobile ? "Prod." : "Producten"}
            </TabsTrigger>
            <TabsTrigger value="ingredients" className="gap-1.5 text-xs sm:text-sm">
              <Wheat className="w-4 h-4" />
              {isMobile ? "Ingr." : "Ingrediënten"}
            </TabsTrigger>
            <TabsTrigger value="checklist" className="gap-1.5 text-xs sm:text-sm">
              <ListChecks className="w-4 h-4" />
              {isMobile ? "To do" : "Te produceren"}
            </TabsTrigger>
            <TabsTrigger value="stockcheck" className="gap-1.5 text-xs sm:text-sm">
              <ClipboardCheck className="w-4 h-4" />
              {isMobile ? "Voorraad" : "Voorraadcheck"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-6">
            {selectedProduct ? (
              <div className="paper-card">
                <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-border/50">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goBackToProductList}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div>
                    <p className="bakery-eyebrow mb-0.5">Product</p>
                    <h3
                      className="font-serif text-xl md:text-2xl font-medium text-foreground leading-tight"
                      style={{ letterSpacing: "-0.02em" }}
                    >
                      {selectedProduct.productName}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 tabular-nums">
                      {selectedProduct.totalQuantity}× {selectedProduct.sellUnitLabel}
                      {selectedProduct.batches > 0 && (
                        <> · {formatBatches(selectedProduct.batches)} batch(es)</>
                      )}
                    </p>
                  </div>
                </div>

                {loadingProductDetail ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
                    <p className="text-sm text-muted-foreground">Laden…</p>
                  </div>
                ) : productIngredients.length === 0 ? (
                  <div className="py-12">
                    <EmptyState icon={Wheat} title="Geen ingrediënten gekoppeld" />
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {productIngredients.map((ing) => (
                      <div
                        key={ing.ingredientId}
                        className="py-3 px-6 flex items-center justify-between gap-2"
                      >
                        <span className="text-foreground text-sm min-w-0 truncate">
                          {ing.ingredientName}
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                            {formatQuantity(ing.quantityPerSellUnit, ing.unit)}/{selectedProduct.sellUnitLabel}
                          </span>
                          <span className="text-sm tabular-nums font-medium text-foreground">
                            {formatQuantity(ing.totalNeeded, ing.unit)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="paper-card overflow-hidden">
                {productionItems.length === 0 ? (
                  <EmptyState icon={Calendar} title="Geen openstaande bestellingen" hint="Niets te bakken op dit moment." />
                ) : (
                  <div className="divide-y divide-border/50">
                    {productionItems.map((item) => (
                      <button
                        key={item.productId}
                        type="button"
                        className="w-full text-left py-3 px-6 flex items-center justify-between gap-2 hover:bg-muted/40 transition-colors"
                        onClick={() => openProductDetail(item)}
                      >
                        <span className="text-foreground text-sm min-w-0 truncate">
                          {item.productName}
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm tabular-nums font-medium text-foreground">
                            {item.totalQuantity}× {item.sellUnitLabel}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                            {item.orders.length} orders
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ingredients" className="mt-6">
            <div className="paper-card overflow-hidden">
              {allIngredientNeeds.length === 0 ? (
                <EmptyState icon={Wheat} title="Geen ingrediënten" hint="Staat niets in de productielijst." />
              ) : (
                <div className="divide-y divide-border/50">
                  {allIngredientNeeds.map((item) => (
                    <div
                      key={item.ingredientId}
                      className="py-3 px-6 flex items-center justify-between gap-2"
                    >
                      <span className="text-foreground text-sm min-w-0 truncate">
                        {item.ingredientName}
                      </span>
                      <span className="text-sm tabular-nums font-medium text-foreground shrink-0">
                        {formatQuantity(item.totalNeeded, item.unit)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="checklist" className="mt-6">
            <ProductionChecklist statusFilter={statusFilter} />
          </TabsContent>

          <TabsContent value="stockcheck" className="mt-6">
            <StockCheck />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

// Wrap `batchesForOrder` — product-setup bugs (mismatched dimensions) now
// show as 0 batches instead of a thrown error that takes down the whole tab.
function safeBatches(product: ProductForPricing, sellUnits: number): number {
  try {
    return batchesForOrder(product, sellUnits);
  } catch (err) {
    console.warn("batchesForOrder failed for product", product.id, err);
    return 0;
  }
}

function formatBatches(batches: number): string {
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 }).format(batches);
}

export default Production;
