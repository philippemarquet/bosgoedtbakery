import { useState, useEffect, useMemo, useCallback } from "react";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  totalCost: number;
  margin: number;
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

  useVisibilityRefresh(refreshProducts);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const groupedProducts = useMemo(() => {
    const groups: Record<string, ProductWithDetails[]> = {};

    filteredProducts.forEach((product) => {
      const categoryName = product.category?.name || "Zonder categorie";
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(product);
    });

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

  const formatCurrency = (value: number) => `€ ${value.toFixed(2)}`;

  const formatSellUnit = (product: Product) => {
    const qty = Number(product.sell_unit_quantity || 1);
    const unit = product.sell_unit_unit as MeasurementUnit;
    const label = UNIT_LABELS_SHORT[unit] ?? unit;
    if (qty === 1) return label;
    return `${qty} ${label}`;
  };

  const marginTone = (costPrice: number, sellingPrice: number) => {
    if (sellingPrice <= 0) return "text-muted-foreground";
    const marginPercent = ((sellingPrice - costPrice) / sellingPrice) * 100;
    if (marginPercent < 30) return "text-destructive";
    if (marginPercent < 60) return "text-[hsl(var(--ember))]";
    return "text-foreground";
  };

  const formatMarginPercent = (costPrice: number, sellingPrice: number) => {
    if (sellingPrice <= 0) return "0%";
    const marginPercent = ((sellingPrice - costPrice) / sellingPrice) * 100;
    return `${marginPercent.toFixed(0)}%`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="bakery-eyebrow mb-2">Back-office</p>
          <h2
            className="font-serif text-3xl md:text-4xl font-medium text-foreground leading-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            Producten
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Recepten, verkoopeenheden en marges in één overzicht.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Zoek product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Nieuw product
          </Button>
        </div>
      </div>

      <div className="paper-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-10"></TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Product
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Verkoopeenheid
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground text-right">
                  Kostprijs
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground text-right">
                  Verkoopprijs
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground text-right">
                  Marge
                </TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-16 text-muted-foreground"
                  >
                    <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
                    <p className="text-sm">Laden…</p>
                  </TableCell>
                </TableRow>
              ) : groupedProducts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-16 text-muted-foreground text-sm"
                  >
                    {searchQuery
                      ? "Geen producten gevonden."
                      : "Nog geen producten. Voeg er een toe."}
                  </TableCell>
                </TableRow>
              ) : (
                groupedProducts.map(([categoryName, categoryProducts]) => (
                  <>
                    <TableRow
                      key={`category-${categoryName}`}
                      className="hover:bg-transparent border-0"
                    >
                      <TableCell colSpan={7} className="pt-7 pb-2 px-6">
                        <div className="flex items-baseline gap-3">
                          <span className="bakery-eyebrow text-foreground">
                            {categoryName}
                          </span>
                          <span className="text-[11px] tracking-[0.08em] uppercase text-muted-foreground">
                            {categoryProducts.length}
                          </span>
                          <div className="flex-1 border-t border-border/50 mb-1" />
                        </div>
                      </TableCell>
                    </TableRow>
                    {categoryProducts.map((product) => (
                      <TableRow
                        key={product.id}
                        className="border-b border-border/40 hover:bg-muted/40"
                      >
                        <TableCell className="py-3 w-10 pl-6">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                            onClick={() => openEditDialog(product)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-foreground">
                          {product.name}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
                          {formatSellUnit(product)}
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm text-muted-foreground tabular-nums">
                          {formatCurrency(product.totalCost)}
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm text-foreground tabular-nums">
                          {formatCurrency(Number(product.selling_price))}
                        </TableCell>
                        <TableCell
                          className={`py-3 text-right text-sm tabular-nums ${marginTone(
                            product.totalCost,
                            Number(product.selling_price),
                          )}`}
                        >
                          {formatCurrency(product.margin)}{" "}
                          <span className="text-muted-foreground">
                            ·{" "}
                            {formatMarginPercent(
                              product.totalCost,
                              Number(product.selling_price),
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 w-10 pr-6">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
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
