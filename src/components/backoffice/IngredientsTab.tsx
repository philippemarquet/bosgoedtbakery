import { useState, useEffect, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type MeasurementUnit = Database["public"]["Enums"]["measurement_unit"];
type Ingredient = Database["public"]["Tables"]["ingredients"]["Row"];

const UNITS: { value: MeasurementUnit; label: string }[] = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "gram", label: "Gram (g)" },
  { value: "liter", label: "Liter (L)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "stuks", label: "Stuks" },
  { value: "uur", label: "Uur" },
];

const IngredientsTab = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyWithoutPrice, setShowOnlyWithoutPrice] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    price_per_unit: "",
    unit: "kg" as MeasurementUnit,
  });
  const { toast } = useToast();

  const fetchIngredients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ingredients")
      .select("*")
      .order("name");

    if (error) {
      toast({ title: "Fout", description: "Kon ingrediënten niet laden", variant: "destructive" });
    } else {
      setIngredients(data || []);
    }
    setLoading(false);
  };

  const refreshIngredients = useCallback(() => {
    fetchIngredients();
  }, []);

  useEffect(() => {
    fetchIngredients();
  }, []);

  useVisibilityRefresh(refreshIngredients);

  const filteredIngredients = ingredients.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriceFilter = showOnlyWithoutPrice ? Number(i.price_per_unit) === 0 : true;
    return matchesSearch && matchesPriceFilter;
  });

  const ingredientsWithoutPrice = ingredients.filter(i => Number(i.price_per_unit) === 0).length;

  const openCreateDialog = () => {
    setEditingIngredient(null);
    setFormData({ name: "", price_per_unit: "", unit: "kg" });
    setDialogOpen(true);
  };

  const openEditDialog = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    setFormData({
      name: ingredient.name,
      price_per_unit: String(ingredient.price_per_unit),
      unit: ingredient.unit,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Fout", description: "Naam is verplicht", variant: "destructive" });
      return;
    }

    const payload = {
      name: formData.name.trim(),
      price_per_unit: parseFloat(formData.price_per_unit) || 0,
      unit: formData.unit,
    };

    if (editingIngredient) {
      const { error } = await supabase
        .from("ingredients")
        .update(payload)
        .eq("id", editingIngredient.id);

      if (error) {
        toast({ title: "Fout", description: "Kon ingrediënt niet bijwerken", variant: "destructive" });
        return;
      }
      toast({ title: "Opgeslagen", description: "Ingrediënt bijgewerkt" });
    } else {
      const { error } = await supabase.from("ingredients").insert(payload);

      if (error) {
        toast({ title: "Fout", description: "Kon ingrediënt niet toevoegen", variant: "destructive" });
        return;
      }
      toast({ title: "Toegevoegd", description: "Nieuw ingrediënt aangemaakt" });
    }

    setDialogOpen(false);
    fetchIngredients();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Weet je zeker dat je dit ingrediënt wilt verwijderen?")) return;

    const { error } = await supabase.from("ingredients").delete().eq("id", id);

    if (error) {
      toast({ title: "Fout", description: "Kon ingrediënt niet verwijderen", variant: "destructive" });
      return;
    }
    toast({ title: "Verwijderd", description: "Ingrediënt verwijderd" });
    fetchIngredients();
  };

  const formatPrice = (price: number, unit: string) => {
    return `€${price.toFixed(2)} / ${unit}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
        <div className="flex flex-1 gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Zoek ingrediënt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary"
            />
          </div>
          {ingredientsWithoutPrice > 0 && (
            <button
              onClick={() => setShowOnlyWithoutPrice(!showOnlyWithoutPrice)}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                showOnlyWithoutPrice 
                  ? "bg-destructive/10 text-destructive" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Zonder prijs ({ingredientsWithoutPrice})
            </button>
          )}
        </div>
        <Button onClick={openCreateDialog} size="sm" className="font-normal">
          <Plus className="w-4 h-4 mr-2" />
          Nieuw ingrediënt
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Naam</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prijs per eenheid</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            ) : filteredIngredients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                  {searchQuery ? "Geen ingrediënten gevonden" : "Nog geen ingrediënten. Voeg er een toe!"}
                </TableCell>
              </TableRow>
            ) : (
              filteredIngredients.map((ingredient) => (
                <TableRow key={ingredient.id} className="border-0 hover:bg-muted/30">
                  <TableCell className="py-3 font-normal">{ingredient.name}</TableCell>
                  <TableCell className="py-3 text-muted-foreground tabular-nums">{formatPrice(Number(ingredient.price_per_unit), ingredient.unit)}</TableCell>
                  <TableCell className="py-3">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditDialog(ingredient)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(ingredient.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIngredient ? "Ingrediënt bewerken" : "Nieuw ingrediënt"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Naam</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="bijv. Tarwebloem"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Prijs per eenheid (€)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_per_unit}
                  onChange={(e) => setFormData({ ...formData, price_per_unit: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Eenheid</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value: MeasurementUnit) => setFormData({ ...formData, unit: value })}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleSave}>
              {editingIngredient ? "Opslaan" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IngredientsTab;
