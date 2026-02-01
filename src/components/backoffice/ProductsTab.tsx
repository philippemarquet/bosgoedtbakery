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

type Product = Database["public"]["Tables"]["products"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];

interface ProductWithDetails extends Product {
  category?: Category | null;
  totalCost?: number;
  margin?: number;
}

const ProductsTab = () => {
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  // Removed expandedProduct state - no longer needed
  const { toast } = useToast();

  const fetchProducts = async () => {
    setLoading(true);
    
    // Fetch products with categories
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select(`
        *,
        category:categories(*)
      `)
      .order("name");

    if (productsError) {
      toast({ title: "Fout", description: "Kon producten niet laden", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch recipe costs for each product
    const productsWithCosts = await Promise.all(
      (productsData || []).map(async (product) => {
        // Get ingredient costs
        const { data: ingredients } = await supabase
          .from("recipe_ingredients")
          .select(`
            quantity,
            ingredient:ingredients(price_per_unit)
          `)
          .eq("product_id", product.id);

        // Get fixed costs
        const { data: fixedCosts } = await supabase
          .from("recipe_fixed_costs")
          .select(`
            quantity,
            fixed_cost:fixed_costs(price_per_unit)
          `)
          .eq("product_id", product.id);

        let totalCost = 0;

        // Calculate ingredient costs
        ingredients?.forEach((item) => {
          if (item.ingredient) {
            totalCost += Number(item.quantity) * Number(item.ingredient.price_per_unit);
          }
        });

        // Calculate fixed costs
        fixedCosts?.forEach((item) => {
          if (item.fixed_cost) {
            totalCost += Number(item.quantity) * Number(item.fixed_cost.price_per_unit);
          }
        });

        // Calculate cost per unit
        // Only divide by yield_quantity when yield_unit is 'stuks'
        // For other units (gram, kg, etc.), the total cost IS the cost per batch/product
        const costPerUnit = product.yield_unit === 'stuks' && product.yield_quantity > 1
          ? totalCost / Number(product.yield_quantity) 
          : totalCost;

        const margin = Number(product.selling_price) - costPerUnit;

        return {
          ...product,
          totalCost: costPerUnit,
          margin,
        };
      })
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

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.name?.toLowerCase().includes(searchQuery.toLowerCase())
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
      toast({ title: "Fout", description: "Kon product niet verwijderen", variant: "destructive" });
      return;
    }
    toast({ title: "Verwijderd", description: "Product verwijderd" });
    fetchProducts();
  };

  const formatCurrency = (value: number) => {
    return `€${value.toFixed(2)}`;
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
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Product</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Aantal</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Kostprijs</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Verkoopprijs</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Marge</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-center">Bestelbaar</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            ) : groupedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  {searchQuery ? "Geen producten gevonden" : "Nog geen producten. Voeg er een toe!"}
                </TableCell>
              </TableRow>
            ) : (
              groupedProducts.map(([categoryName, categoryProducts]) => (
                <>
                  <TableRow key={`category-${categoryName}`} className="hover:bg-transparent">
                    <TableCell colSpan={8} className="pt-6 pb-2 px-0">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {categoryName} ({categoryProducts.length})
                      </span>
                    </TableCell>
                  </TableRow>
                  {categoryProducts.map((product) => (
                    <TableRow key={product.id} className="border-0 hover:bg-muted/30">
                      <TableCell className="py-3">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditDialog(product)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                      <TableCell className="py-3 font-normal">{product.name}</TableCell>
                      <TableCell className="py-3 text-muted-foreground tabular-nums">
                        {product.yield_quantity} {product.yield_unit}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums">
                        {formatCurrency(product.totalCost || 0)}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums">
                        {formatCurrency(Number(product.selling_price))}
                      </TableCell>
                      <TableCell className={`py-3 text-right tabular-nums ${getMarginColor(product.totalCost || 0, Number(product.selling_price))}`}>
                        {formatCurrency(product.margin || 0)} ({formatMarginPercent(product.totalCost || 0, Number(product.selling_price))})
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        <Checkbox checked={product.is_orderable} disabled className="opacity-60" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(product.id)}>
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
