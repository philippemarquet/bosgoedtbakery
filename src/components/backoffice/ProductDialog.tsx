import { useState, useEffect, useRef } from "react";
import { Upload, X, Image as ImageIcon, Trash2, Plus } from "lucide-react";
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
import { SearchableSelect } from "@/components/ui/searchable-select";

type MeasurementUnit = Database["public"]["Enums"]["measurement_unit"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];
type Ingredient = Database["public"]["Tables"]["ingredients"]["Row"];
type FixedCost = Database["public"]["Tables"]["fixed_costs"]["Row"];

interface RecipeIngredient {
  ingredient_id: string;
  quantity: string;
  display_unit: MeasurementUnit | "";
}

// Unit conversion helpers
const UNIT_CONVERSIONS: Record<
  string,
  { compatibleUnits: MeasurementUnit[]; toBase: Record<string, number>; defaultDisplayUnit: MeasurementUnit }
> = {
  kg: { compatibleUnits: ["kg", "gram"], toBase: { kg: 1, gram: 0.001 }, defaultDisplayUnit: "gram" },
  gram: { compatibleUnits: ["kg", "gram"], toBase: { kg: 1, gram: 0.001 }, defaultDisplayUnit: "gram" },
  liter: { compatibleUnits: ["liter", "ml"], toBase: { liter: 1, ml: 0.001 }, defaultDisplayUnit: "ml" },
  ml: { compatibleUnits: ["liter", "ml"], toBase: { liter: 1, ml: 0.001 }, defaultDisplayUnit: "ml" },
  stuks: { compatibleUnits: ["stuks"], toBase: { stuks: 1 }, defaultDisplayUnit: "stuks" },
  uur: { compatibleUnits: ["uur"], toBase: { uur: 1 }, defaultDisplayUnit: "uur" },
  eetlepel: { compatibleUnits: ["eetlepel"], toBase: { eetlepel: 1 }, defaultDisplayUnit: "eetlepel" },
};

const getDefaultDisplayUnit = (baseUnit: MeasurementUnit): MeasurementUnit => {
  return UNIT_CONVERSIONS[baseUnit]?.defaultDisplayUnit || baseUnit;
};

const getCompatibleUnits = (baseUnit: MeasurementUnit): MeasurementUnit[] => {
  return UNIT_CONVERSIONS[baseUnit]?.compatibleUnits || [baseUnit];
};

const convertToBaseUnit = (quantity: number, fromUnit: MeasurementUnit, baseUnit: MeasurementUnit): number => {
  const conversion = UNIT_CONVERSIONS[baseUnit];
  if (!conversion) return quantity;
  const factor = conversion.toBase[fromUnit] || 1;
  return quantity * factor;
};

const convertFromBaseUnit = (quantity: number, toUnit: MeasurementUnit, baseUnit: MeasurementUnit): number => {
  const conversion = UNIT_CONVERSIONS[baseUnit];
  if (!conversion) return quantity;
  const factor = conversion.toBase[toUnit] || 1;
  return quantity / factor;
};

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
    image_url: "",
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeFixedCosts, setRecipeFixedCosts] = useState<RecipeFixedCost[]>([]);
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);

  // ✅ refs to focus quantity inputs
  const qtyRefs = useRef<Array<HTMLInputElement | null>>([]);

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
        setFormData({
          name: "",
          description: "",
          category_id: "",
          yield_quantity: "1",
          yield_unit: "stuks",
          selling_price: "",
          is_orderable: false,
          image_url: "",
        });
        setRecipeIngredients([]);
        setRecipeFixedCosts([]);
        setPriceTiers([]);
        setImageFile(null);
        setImagePreview(null);
        return;
      }

      setFormData({
        name: editingProduct.name,
        description: editingProduct.description || "",
        category_id: editingProduct.category_id || "",
        yield_quantity: String(editingProduct.yield_quantity),
        yield_unit: editingProduct.yield_unit,
        selling_price: String(editingProduct.selling_price),
        is_orderable: editingProduct.is_orderable,
        image_url: editingProduct.image_url || "",
      });
      setImagePreview(editingProduct.image_url || null);
      setImageFile(null);

      const { data: ingData } = await supabase
        .from("recipe_ingredients")
        .select("ingredient_id, quantity, display_unit")
        .eq("product_id", editingProduct.id);

      if (ingData) {
        setRecipeIngredients(
          ingData.map((i) => {
            const ingredient = ingredients.find((ing) => ing.id === i.ingredient_id);
            const baseUnit = (ingredient?.unit || "kg") as MeasurementUnit;
            const displayUnit = (i.display_unit || baseUnit) as MeasurementUnit;
            const displayQuantity = convertFromBaseUnit(Number(i.quantity), displayUnit, baseUnit);
            return {
              ingredient_id: i.ingredient_id,
              quantity: String(displayQuantity),
              display_unit: displayUnit,
            };
          })
        );
      }

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

    if (open) loadProductData();
  }, [editingProduct, open, ingredients]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Fout", description: "Naam is verplicht", variant: "destructive" });
      return;
    }

    setLoading(true);

    // Upload image if selected
    let imageUrl = formData.image_url;
    if (imageFile) {
      setUploadingImage(true);
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, imageFile);

      if (uploadError) {
        toast({ title: "Fout", description: "Kon afbeelding niet uploaden", variant: "destructive" });
        setLoading(false);
        setUploadingImage(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
      setUploadingImage(false);
    }

    const productPayload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      category_id: formData.category_id || null,
      yield_quantity: parseFloat(formData.yield_quantity) || 1,
      yield_unit: formData.yield_unit,
      selling_price: parseFloat(formData.selling_price) || 0,
      is_orderable: formData.is_orderable,
      image_url: imageUrl || null,
    };

    let productId: string;

    if (editingProduct) {
      const { error } = await supabase.from("products").update(productPayload).eq("id", editingProduct.id);

      if (error) {
        toast({ title: "Fout", description: "Kon product niet bijwerken", variant: "destructive" });
        setLoading(false);
        return;
      }
      productId = editingProduct.id;

      await supabase.from("recipe_fixed_costs").delete().eq("product_id", productId);
      await supabase.from("product_price_tiers").delete().eq("product_id", productId);
    } else {
      const { data, error } = await supabase.from("products").insert(productPayload).select("id").single();

      if (error || !data) {
        toast({ title: "Fout", description: "Kon product niet aanmaken", variant: "destructive" });
        setLoading(false);
        return;
      }
      productId = data.id;
    }

    // Replace recipe ingredients
    await supabase.from("recipe_ingredients").delete().eq("product_id", productId);

    const validIngredients = recipeIngredients.filter((i) => i.ingredient_id && parseFloat(i.quantity) > 0);

    if (validIngredients.length > 0) {
      const { error: insertError } = await supabase.from("recipe_ingredients").insert(
        validIngredients.map((i) => {
          const ingredient = ingredients.find((ing) => ing.id === i.ingredient_id);
          const baseUnit = (ingredient?.unit || "kg") as MeasurementUnit;
          const displayUnit = (i.display_unit || baseUnit) as MeasurementUnit;
          const baseQuantity = convertToBaseUnit(parseFloat(i.quantity), displayUnit, baseUnit);
          return {
            product_id: productId,
            ingredient_id: i.ingredient_id,
            quantity: baseQuantity,
            display_unit: displayUnit,
          };
        })
      );

      if (insertError) {
        toast({
          title: "Fout",
          description: `Kon recept-ingrediënten niet opslaan (${insertError.message})`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }

    // Insert recipe fixed costs
    const validFixedCosts = recipeFixedCosts.filter((f) => f.fixed_cost_id && parseFloat(f.quantity) > 0);
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
    const yieldQty = parseFloat(formData.yield_quantity) || 1;
    const validTiers = priceTiers.filter((t) => parseInt(t.min_quantity) >= yieldQty && parseFloat(t.price) > 0);

    const invalidTiers = priceTiers.filter(
      (t) => parseInt(t.min_quantity) > 0 && parseInt(t.min_quantity) < yieldQty && parseFloat(t.price) > 0
    );
    if (invalidTiers.length > 0) {
      toast({
        title: "Let op",
        description: `${invalidTiers.length} staffelkorting(en) overgeslagen: minimale hoeveelheid moet minimaal ${yieldQty} ${formData.yield_unit} zijn`,
        variant: "destructive",
      });
    }

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

  const removeRecipeIngredient = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const updateRecipeIngredient = (index: number, field: keyof RecipeIngredient, value: string) => {
    setRecipeIngredients((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateRecipeIngredientMultiple = (index: number, updates: Partial<RecipeIngredient>) => {
    setRecipeIngredients((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
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

  const getFixedCostUnit = (id: string) => {
    return fixedCosts.find((f) => f.id === id)?.unit || "";
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData({ ...formData, image_url: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ✅ helper: focus quantity field of given index
  const focusQty = (index: number) => {
    setTimeout(() => qtyRefs.current[index]?.focus(), 0);
  };

  // ✅ ingredientOptions for SearchableSelect
  const ingredientOptions = ingredients.map((ing) => ({
    value: ing.id,
    label: `${ing.name} (€${Number(ing.price_per_unit).toFixed(2)}/${ing.unit})`,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingProduct ? "Product bewerken" : "Nieuw product"}</DialogTitle>
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
              <Label>Productafbeelding</Label>
              <div className="flex items-start gap-4">
                {imagePreview ? (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/50">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}

                <div className="flex-1">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                    <Upload className="w-4 h-4 mr-2" />
                    {imagePreview ? "Wijzigen" : "Uploaden"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG of WebP, max 5MB</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categorie</Label>
              <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
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
                <Select value={formData.yield_unit} onValueChange={(value: MeasurementUnit) => setFormData({ ...formData, yield_unit: value })}>
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
                onCheckedChange={(checked) => setFormData({ ...formData, is_orderable: checked === true })}
              />
              <Label htmlFor="is_orderable" className="text-sm font-normal">
                Separaat te bestellen door klanten
              </Label>
            </div>
          </TabsContent>

          <TabsContent value="recipe" className="space-y-4 mt-4">
            <Label>Ingrediënten</Label>

            <div className="space-y-2">
              {[...recipeIngredients, { ingredient_id: "", quantity: "", display_unit: "" as MeasurementUnit | "" }].map((item, index) => {
                const isEmptyRow = index === recipeIngredients.length;

                const selectedIngredient = ingredients.find((i) => i.id === item.ingredient_id);
                const baseUnit = (selectedIngredient?.unit || "kg") as MeasurementUnit;
                const compatibleUnits = getCompatibleUnits(baseUnit);
                const currentDisplayUnit = (item.display_unit || getDefaultDisplayUnit(baseUnit)) as MeasurementUnit;

                return (
                  <div key={isEmptyRow ? "new-row" : index} className="flex gap-2 items-center">
                    {/* ✅ Searchable select */}
                    <div className="flex-1">
                      <SearchableSelect
                        value={item.ingredient_id ? item.ingredient_id : null}
                        options={ingredientOptions}
                        placeholder="Selecteer ingrediënt..."
                        searchPlaceholder="Typ om te zoeken..."
                        onChange={(value) => {
                          const newIngredient = ingredients.find((i) => i.id === value);
                          const defaultUnit = getDefaultDisplayUnit(((newIngredient?.unit || "kg") as MeasurementUnit));

                          if (isEmptyRow) {
                            // Add new row + focus qty of newly added row
                            setRecipeIngredients((prev) => {
                              const next = [
                                ...prev,
                                { ingredient_id: value, quantity: "", display_unit: defaultUnit },
                              ];
                              return next;
                            });
                            // ✅ focus quantity on the newly inserted row index (same index as empty row)
                            focusQty(index);
                          } else {
                            updateRecipeIngredientMultiple(index, {
                              ingredient_id: value,
                              display_unit: defaultUnit,
                            });
                            // ✅ focus quantity of this row
                            focusQty(index);
                          }
                        }}
                      />
                    </div>

                    <Input
                      ref={(el) => {
                        qtyRefs.current[index] = el;
                      }}
                      type="number"
                      step="0.001"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => {
                        if (isEmptyRow) return;
                        updateRecipeIngredient(index, "quantity", e.target.value);
                      }}
                      className="w-24"
                      placeholder="0"
                      disabled={isEmptyRow}
                    />

                    <Select
                      value={currentDisplayUnit}
                      onValueChange={(value) => {
                        if (isEmptyRow) return;
                        updateRecipeIngredient(index, "display_unit", value);
                      }}
                      disabled={isEmptyRow}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {compatibleUnits.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {!isEmptyRow ? (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeRecipeIngredient(index)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    ) : (
                      <div className="w-10" />
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              Typ om te zoeken. Na selecteren springt de cursor direct naar het aantal.
            </p>
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
                    <Select value={item.fixed_cost_id} onValueChange={(value) => updateRecipeFixedCost(index, "fixed_cost_id", value)}>
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
                      onChange={(e) => updateRecipeFixedCost(index, "quantity", e.target.value)}
                      className="w-24"
                      placeholder="0"
                    />

                    <span className="w-16 text-sm text-muted-foreground">{getFixedCostUnit(item.fixed_cost_id)}</span>

                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRecipeFixedCost(index)}>
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
                  <p className="text-sm text-muted-foreground">Korting bij grotere aantallen (bijv. 4 voor €6)</p>
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
                        onChange={(e) => updatePriceTier(index, "min_quantity", e.target.value)}
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
                      <Button type="button" variant="ghost" size="icon" onClick={() => removePriceTier(index)}>
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
