import { useState, useEffect, useMemo, useCallback } from "react";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import ProductDialog from "./ProductDialog";
import type { Database } from "@/integrations/supabase/types";
import { costPerSellUnit, type ProductForPricing } from "@/lib/pricing";
import { UNIT_LABELS_SHORT, type MeasurementUnit } from "@/lib/units";

type Product = Database["public"]["Tables"]["products"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];

interface ProductWithDetails extends Product {
  category?: Category | null;
  totalCost: number; // cost per sell-unit
  margin: number; // selling_price - totalCost
}

const ProductsTab = () => {
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  const fetchProducts = async () => {
    setLoading(true);

    // Three parallel queries — no more N+1 per product.
    const [productsResult, recipeIngredientsResult, recipeFixedCostsResult] =
      await Promise.all([
        supabase
          .from("products")
          .select(`*, category:categories(*)`)
          .order("name"),
        supabase.from("recipe_ingredients").select(`
          product_id,
          quantity,
          ingredient:ingredients(price_per_unit)
        `),
        supabase.from("recipe_fixed_costs").select(`
          product_id,
          quantity,
          fixed_cost:fixed_costs(price_per_unit)
        `),
      ]);

    if (productsResult.error) {
      toast({
        title: "Fout",
        description: "Kon producten niet laden",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Aggregate recipe cost per product (ingredients + fixed costs) in one pass.
    const batchCostByProductId = new Map<string, number>();
    const addCost = (productId: string, lineCost: number) => {
      batchCostByProductId.set(
        productId,
        (batchCostByProductId.get(productId) ?? 0) + lineCost,
      );
    };

    for (const ri of recipeIngredientsResult.data ?? []) {
      const price =
        (ri.ingredient as { price_per_unit: number } | null)?.price_per_unit ?? 0;
      addCost(ri.product_id, Number(ri.quantity || 0) * Number(price));
    }
    for (const fc of recipeFixedCostsResult.data ?? []) {
      const price =
        (fc.fixed_cost as { price_per_unit: number } | null)?.price_per_unit ?? 0;
      addCost(fc.product_id, Number(fc.quantity || 0) * Number(price));
    }

    const productsWithCosts: ProductWithDetails[] = (productsResult.data || []).map(
      (product) => {
        const batchCost = batchCostByProductId.get(product.id) ?? 0;
        const forPricing: ProductForPricing = {
          id: product.id,
          selling_price: Number(product.selling_price),
          recipe_yield_quantity: Number(product.recipe_yield_quantity || 0),
          recipe_yield_unit: product.recipe_yield_unit as MeasurementUnit,
          sell_unit_quantity: Number(product.sell_unit_quantity || 0),
          sell_unit_unit: product.sell_unit_unit as MeasurementUnit,
        };
        const unitCost = costPerSellUnit(forPricing, batchCost);
        return {
          ...product,
          totalCost: unitCost,
          margin: Number(product.selling_price) - unitCost,
        };
      },
    );

    setProducts(productsWithCosts);
    setLoading(false);
  };

  const refreshProducts = useCallback(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, []);

  // Refresh data when tab becomes visible again
  useVisibilityRefresh(refreshProducts);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Group products by category
  const groupedProducts = useMemo(() => {
    const groups: Record<string, ProductWithDetails[]> = {};

    filteredProducts.forEach((product) => {
      const categoryName = product.category?.name || "Zonder categorie";
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(product);
    });

    // Sort categories alphabetically, but keep "Zonder categorie" at the end
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Zonder categorie") return 1;
      if (b === "Zonder categorie") return -1;
      return a.localeCompare(b);
    });
  }, [filteredProducts]);

  const openCreateDialog = () => {
    setEditingProduct(null);
    setDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Weet je zeker dat je dit product wilt verwijderen?")) return;

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      toast({
        title: "Fout",
        description: "Kon product niet verwijderen",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Verwijderd", description: "Product verwijderd" });
    fetchProducts();
  };

  const formatCurrency = (value: number) => `€${value.toFixed(2)}`;

  const formatSellUnit = (product: Product) => {
    const qty = Number(product.sell_unit_quantity || 1);
    const unit = product.sell_unit_unit as MeasurementUnit;
    const label = UNIT_LABELS_SHORT[unit] ?? unit;
    // "1 stuks" reads awkwardly — drop the quantity when it's the natural "1 x unit".
    if (qty === 1) return label;
    return `${qty} ${label}`;
  };

  const getMarginColor = (costPrice: number, sellingPrice: number) => {
    if (sellingPrice <= 0) return "text-muted-foreground";
    const marginPercent = ((sellingPrice - costPrice) / sellingPrice) * 100;
    if (marginPercent < 30) return "text-destructive";
    if (marginPercent < 60) return "text-yellow-600";
    return "text-green-600";
  };

  const formatMarginPercent = (costPrice: number, sellingPrice: number) => {
    if (sellingPrice <= 0) return "0%";
    const marginPercent = ((sellingPrice - costPrice) / sellingPrice) * 100;
    return `${marginPercent.toFixed(0)}%`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Zoek product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary"
          />
        </div>
        <Button onClick={openCreateDialog} size="sm" className="font-normal">
          <Plus className="w-4 h-4 mr-2" />
          Nieuw product
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="w-10 text-xs font-medium uppercase tracking-wide text-muted-foreground"></TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Product
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Verkoopeenheid
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                Kostprijs
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                Verkoopprijs
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                Marge
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-center">
                Bestelbaar
              </TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-12 text-muted-foreground"
                >
                  Laden...
                </TableCell>
              </TableRow>
            ) : groupedProducts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-12 text-muted-foreground"
                >
                  {searchQuery
                    ? "Geen producten gevonden"
                    : "Nog geen producten. Voeg er een toe!"}
                </TableCell>
              </TableRow>
            ) : (
              groupedProducts.map(([categoryName, categoryProducts]) => (
                <>
                  <TableRow
                    key={`category-${categoryName}`}
                    className="hover:bg-transparent"
                  >
                    <TableCell colSpan={8} className="pt-6 pb-2 px-0">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {categoryName} ({categoryProducts.length})
                      </span>
                    </TableCell>
                  </TableRow>
                  {categoryProducts.map((product) => (
                    <TableRow
                      key={product.id}
                      className="border-0 hover:bg-muted/30"
                    >
                      <TableCell className="py-2.5 w-10">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditDialog(product)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                      <TableCell className="py-2.5 text-sm font-light">
                        {product.name}
                      </TableCell>
                      <TableCell className="py-2.5 text-sm text-muted-foreground tabular-nums">
                        {formatSellUnit(product)}
                      </TableCell>
                      <TableCell className="py-2.5 text-right text-sm tabular-nums">
                        {formatCurrency(product.totalCost)}
                      </TableCell>
                      <TableCell className="py-2.5 text-right text-sm tabular-nums">
                        {formatCurrency(Number(product.selling_price))}
                      </TableCell>
                      <TableCell
                        className={`py-2.5 text-right text-sm tabular-nums ${getMarginColor(
                          product.totalCost,
                          Number(product.selling_price),
                        )}`}
                      >
                        {formatCurrency(product.margin)} (
                        {formatMarginPercent(
                          product.totalCost,
                          Number(product.selling_price),
                        )}
                        )
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <Checkbox
                          checked={product.is_orderable}
                          disabled
                          className="opacity-60"
                        />
                      </TableCell>
                      <TableCell className="py-2.5 w-10">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingProduct={editingProduct}
        onSave={fetchProducts}
      />
    </div>
  );
};

export default ProductsTab;
