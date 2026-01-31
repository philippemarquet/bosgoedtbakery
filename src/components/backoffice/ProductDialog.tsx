import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type MeasurementUnit = Database["public"]["Enums"]["measurement_unit"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];
type Ingredient = Database["public"]["Tables"]["ingredients"]["Row"];
type FixedCost = Database["public"]["Tables"]["fixed_costs"]["Row"];

interface RecipeIngredient {
  ingredient_id: string;
  quantity: string;
}

interface RecipeFixedCost {
  fixed_cost_id: string;
  quantity: string;
}

interface PriceTier {
  min_quantity: string;
  price: string;
}

const UNITS: { value: MeasurementUnit; label: string }[] = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "gram", label: "Gram (g)" },
  { value: "liter", label: "Liter (L)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "stuks", label: "Stuks" },
  { value: "uur", label: "Uur" },
];

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: Product | null;
  onSave: () => void;
}

const ProductDialog = ({ open, onOpenChange, editingProduct, onSave }: ProductDialogProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category_id: "",
    yield_quantity: "1",
    yield_unit: "stuks" as MeasurementUnit,
    selling_price: "",
    is_orderable: false,
  });

  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeFixedCosts, setRecipeFixedCosts] = useState<RecipeFixedCost[]>([]);
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);

  const { toast } = useToast();

  // Fetch reference data
  useEffect(() => {
    const fetchData = async () => {
      const [categoriesRes, ingredientsRes, fixedCostsRes] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("ingredients").select("*").order("name"),
        supabase.from("fixed_costs").select("*").order("name"),
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (ingredientsRes.data) setIngredients(ingredientsRes.data);
      if (fixedCostsRes.data) setFixedCosts(fixedCostsRes.data);
    };

    fetchData();
  }, []);

  // Load existing product data
  useEffect(() => {
    const loadProductData = async () => {
      if (!editingProduct) {
        // Reset form for new product
        setFormData({
          name: "",
          description: "",
          category_id: "",
          yield_quantity: "1",
          yield_unit: "stuks",
          selling_price: "",
          is_orderable: false,
        });
        setRecipeIngredients([]);
        setRecipeFixedCosts([]);
        setPriceTiers([]);
        return;
      }

      // Load product data
      setFormData({
        name: editingProduct.name,
        description: editingProduct.description || "",
        category_id: editingProduct.category_id || "",
        yield_quantity: String(editingProduct.yield_quantity),
        yield_unit: editingProduct.yield_unit,
        selling_price: String(editingProduct.selling_price),
        is_orderable: editingProduct.is_orderable,
      });

      // Load recipe ingredients
      const { data: ingData } = await supabase
        .from("recipe_ingredients")
        .select("ingredient_id, quantity")
        .eq("product_id", editingProduct.id);

      if (ingData) {
        setRecipeIngredients(
          ingData.map((i) => ({
            ingredient_id: i.ingredient_id,
            quantity: String(i.quantity),
          }))
        );
      }

      // Load recipe fixed costs
      const { data: fcData } = await supabase
        .from("recipe_fixed_costs")
        .select("fixed_cost_id, quantity")
        .eq("product_id", editingProduct.id);

      if (fcData) {
        setRecipeFixedCosts(
          fcData.map((f) => ({
            fixed_cost_id: f.fixed_cost_id,
            quantity: String(f.quantity),
          }))
        );
      }

      // Load price tiers
      const { data: tierData } = await supabase
        .from("product_price_tiers")
        .select("min_quantity, price")
        .eq("product_id", editingProduct.id)
        .order("min_quantity");

      if (tierData) {
        setPriceTiers(
          tierData.map((t) => ({
            min_quantity: String(t.min_quantity),
            price: String(t.price),
          }))
        );
      }
    };

    if (open) {
      loadProductData();
    }
  }, [editingProduct, open]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Fout", description: "Naam is verplicht", variant: "destructive" });
      return;
    }

    setLoading(true);

    const productPayload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      category_id: formData.category_id || null,
      yield_quantity: parseFloat(formData.yield_quantity) || 1,
      yield_unit: formData.yield_unit,
      selling_price: parseFloat(formData.selling_price) || 0,
      is_orderable: formData.is_orderable,
    };

    let productId: string;

    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update(productPayload)
        .eq("id", editingProduct.id);

      if (error) {
        toast({ title: "Fout", description: "Kon product niet bijwerken", variant: "destructive" });
        setLoading(false);
        return;
      }
      productId = editingProduct.id;

      // Delete existing recipe data
      await supabase.from("recipe_ingredients").delete().eq("product_id", productId);
      await supabase.from("recipe_fixed_costs").delete().eq("product_id", productId);
      await supabase.from("product_price_tiers").delete().eq("product_id", productId);
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert(productPayload)
        .select("id")
        .single();

      if (error || !data) {
        toast({ title: "Fout", description: "Kon product niet aanmaken", variant: "destructive" });
        setLoading(false);
        return;
      }
      productId = data.id;
    }

    // Insert recipe ingredients
    const validIngredients = recipeIngredients.filter(
      (i) => i.ingredient_id && parseFloat(i.quantity) > 0
    );
    if (validIngredients.length > 0) {
      await supabase.from("recipe_ingredients").insert(
        validIngredients.map((i) => ({
          product_id: productId,
          ingredient_id: i.ingredient_id,
          quantity: parseFloat(i.quantity),
        }))
      );
    }

    // Insert recipe fixed costs
    const validFixedCosts = recipeFixedCosts.filter(
      (f) => f.fixed_cost_id && parseFloat(f.quantity) > 0
    );
    if (validFixedCosts.length > 0) {
      await supabase.from("recipe_fixed_costs").insert(
        validFixedCosts.map((f) => ({
          product_id: productId,
          fixed_cost_id: f.fixed_cost_id,
          quantity: parseFloat(f.quantity),
        }))
      );
    }

    // Insert price tiers
    const validTiers = priceTiers.filter(
      (t) => parseInt(t.min_quantity) > 0 && parseFloat(t.price) > 0
    );
    if (validTiers.length > 0) {
      await supabase.from("product_price_tiers").insert(
        validTiers.map((t) => ({
          product_id: productId,
          min_quantity: parseInt(t.min_quantity),
          price: parseFloat(t.price),
        }))
      );
    }

    setLoading(false);
    toast({
      title: editingProduct ? "Opgeslagen" : "Toegevoegd",
      description: editingProduct ? "Product bijgewerkt" : "Nieuw product aangemaakt",
    });
    onOpenChange(false);
    onSave();
  };

  const addRecipeIngredient = () => {
    setRecipeIngredients([...recipeIngredients, { ingredient_id: "", quantity: "" }]);
  };

  const removeRecipeIngredient = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const updateRecipeIngredient = (index: number, field: keyof RecipeIngredient, value: string) => {
    const updated = [...recipeIngredients];
    updated[index] = { ...updated[index], [field]: value };
    setRecipeIngredients(updated);
  };

  const addRecipeFixedCost = () => {
    setRecipeFixedCosts([...recipeFixedCosts, { fixed_cost_id: "", quantity: "" }]);
  };

  const removeRecipeFixedCost = (index: number) => {
    setRecipeFixedCosts(recipeFixedCosts.filter((_, i) => i !== index));
  };

  const updateRecipeFixedCost = (index: number, field: keyof RecipeFixedCost, value: string) => {
    const updated = [...recipeFixedCosts];
    updated[index] = { ...updated[index], [field]: value };
    setRecipeFixedCosts(updated);
  };

  const addPriceTier = () => {
    setPriceTiers([...priceTiers, { min_quantity: "", price: "" }]);
  };

  const removePriceTier = (index: number) => {
    setPriceTiers(priceTiers.filter((_, i) => i !== index));
  };

  const updatePriceTier = (index: number, field: keyof PriceTier, value: string) => {
    const updated = [...priceTiers];
    updated[index] = { ...updated[index], [field]: value };
    setPriceTiers(updated);
  };

  const getIngredientUnit = (id: string) => {
    return ingredients.find((i) => i.id === id)?.unit || "";
  };

  const getFixedCostUnit = (id: string) => {
    return fixedCosts.find((f) => f.id === id)?.unit || "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingProduct ? "Product bewerken" : "Nieuw product"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">Algemeen</TabsTrigger>
            <TabsTrigger value="recipe">Recept</TabsTrigger>
            <TabsTrigger value="costs">Vaste kosten</TabsTrigger>
            <TabsTrigger value="pricing">Prijzen</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Naam *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="bijv. Volkorenbrood"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschrijving</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optionele beschrijving..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categorie</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer categorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="yield_quantity">Opbrengst (aantal)</Label>
                <Input
                  id="yield_quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.yield_quantity}
                  onChange={(e) => setFormData({ ...formData, yield_quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yield_unit">Eenheid</Label>
                <Select
                  value={formData.yield_unit}
                  onValueChange={(value: MeasurementUnit) =>
                    setFormData({ ...formData, yield_unit: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="is_orderable"
                checked={formData.is_orderable}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_orderable: checked === true })
                }
              />
              <Label htmlFor="is_orderable" className="text-sm font-normal">
                Separaat te bestellen door klanten
              </Label>
            </div>
          </TabsContent>

          <TabsContent value="recipe" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <Label>Ingrediënten</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRecipeIngredient}>
                <Plus className="w-4 h-4 mr-1" />
                Toevoegen
              </Button>
            </div>

            {recipeIngredients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nog geen ingrediënten. Klik op "Toevoegen" om te beginnen.
              </p>
            ) : (
              <div className="space-y-2">
                {recipeIngredients.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Select
                      value={item.ingredient_id}
                      onValueChange={(value) =>
                        updateRecipeIngredient(index, "ingredient_id", value)
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecteer ingrediënt" />
                      </SelectTrigger>
                      <SelectContent>
                        {ingredients.map((ing) => (
                          <SelectItem key={ing.id} value={ing.id}>
                            {ing.name} (€{Number(ing.price_per_unit).toFixed(2)}/{ing.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      value={item.quantity}
                      onChange={(e) =>
                        updateRecipeIngredient(index, "quantity", e.target.value)
                      }
                      className="w-24"
                      placeholder="0"
                    />
                    <span className="w-16 text-sm text-muted-foreground">
                      {getIngredientUnit(item.ingredient_id)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRecipeIngredient(index)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="costs" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <Label>Vaste kosten</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRecipeFixedCost}>
                <Plus className="w-4 h-4 mr-1" />
                Toevoegen
              </Button>
            </div>

            {recipeFixedCosts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nog geen vaste kosten. Klik op "Toevoegen" om te beginnen.
              </p>
            ) : (
              <div className="space-y-2">
                {recipeFixedCosts.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Select
                      value={item.fixed_cost_id}
                      onValueChange={(value) =>
                        updateRecipeFixedCost(index, "fixed_cost_id", value)
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecteer vaste kost" />
                      </SelectTrigger>
                      <SelectContent>
                        {fixedCosts.map((fc) => (
                          <SelectItem key={fc.id} value={fc.id}>
                            {fc.name} (€{Number(fc.price_per_unit).toFixed(2)}/{fc.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      value={item.quantity}
                      onChange={(e) =>
                        updateRecipeFixedCost(index, "quantity", e.target.value)
                      }
                      className="w-24"
                      placeholder="0"
                    />
                    <span className="w-16 text-sm text-muted-foreground">
                      {getFixedCostUnit(item.fixed_cost_id)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRecipeFixedCost(index)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="selling_price">Standaard verkoopprijs (€)</Label>
              <Input
                id="selling_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <Label>Staffelprijzen</Label>
                  <p className="text-sm text-muted-foreground">
                    Korting bij grotere aantallen (bijv. 4 voor €6)
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addPriceTier}>
                  <Plus className="w-4 h-4 mr-1" />
                  Toevoegen
                </Button>
              </div>

              {priceTiers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Geen staffelprijzen. Alleen de standaardprijs wordt gebruikt.
                </p>
              ) : (
                <div className="space-y-2">
                  {priceTiers.map((tier, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        type="number"
                        min="1"
                        value={tier.min_quantity}
                        onChange={(e) =>
                          updatePriceTier(index, "min_quantity", e.target.value)
                        }
                        className="w-20"
                        placeholder="Aantal"
                      />
                      <span className="text-sm text-muted-foreground">stuks voor</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={tier.price}
                        onChange={(e) => updatePriceTier(index, "price", e.target.value)}
                        className="w-24"
                        placeholder="€ 0.00"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePriceTier(index)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Opslaan..." : editingProduct ? "Opslaan" : "Toevoegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDialog;
