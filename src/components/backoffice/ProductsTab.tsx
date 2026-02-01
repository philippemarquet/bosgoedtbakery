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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Zoek product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nieuw product
        </Button>
      </div>

      <div className="bakery-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Aantal</TableHead>
              <TableHead className="text-right">Kostprijs</TableHead>
              <TableHead className="text-right">Verkoopprijs</TableHead>
              <TableHead className="text-right">Marge</TableHead>
              <TableHead className="text-center">Bestelbaar</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            ) : groupedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "Geen producten gevonden" : "Nog geen producten. Voeg er een toe!"}
                </TableCell>
              </TableRow>
            ) : (
              groupedProducts.map(([categoryName, categoryProducts]) => (
                <>
                  {/* Category header row */}
                  <TableRow key={`category-${categoryName}`} className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={8} className="font-semibold text-sm py-2">
                      {categoryName} ({categoryProducts.length})
                    </TableCell>
                  </TableRow>
                  {/* Products in this category */}
                  {categoryProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(product)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        {product.yield_quantity} {product.yield_unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.totalCost || 0)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(product.selling_price))}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${getMarginColor(product.totalCost || 0, Number(product.selling_price))}`}>
                        {formatCurrency(product.margin || 0)} ({formatMarginPercent(product.totalCost || 0, Number(product.selling_price))})
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={product.is_orderable} disabled />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(product.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
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
