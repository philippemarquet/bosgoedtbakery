import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
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
        const costPerUnit = product.yield_quantity > 0 
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

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const getMarginColor = (margin: number) => {
    if (margin < 0) return "text-destructive";
    if (margin < 1) return "text-yellow-600";
    return "text-green-600";
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
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Categorie</TableHead>
              <TableHead>Opbrengst</TableHead>
              <TableHead className="text-right">Kostprijs</TableHead>
              <TableHead className="text-right">Verkoopprijs</TableHead>
              <TableHead className="text-right">Marge</TableHead>
              <TableHead className="text-center">Bestelbaar</TableHead>
              <TableHead className="w-[100px]">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "Geen producten gevonden" : "Nog geen producten. Voeg er een toe!"}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => setExpandedProduct(
                        expandedProduct === product.id ? null : product.id
                      )}
                    >
                      {expandedProduct === product.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    {product.category ? (
                      <Badge variant="secondary">{product.category.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {product.yield_quantity} {product.yield_unit}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(product.totalCost || 0)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(product.selling_price))}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${getMarginColor(product.margin || 0)}`}>
                    {formatCurrency(product.margin || 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox checked={product.is_orderable} disabled />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
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
