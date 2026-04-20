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
    return `€ ${price.toFixed(2)} / ${unit}`;
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
            Ingrediënten
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Grondstoffen en hun inkoopprijzen.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Zoek ingrediënt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Nieuw ingrediënt
          </Button>
        </div>
      </div>

      {ingredientsWithoutPrice > 0 && (
        <div>
          <button
            onClick={() => setShowOnlyWithoutPrice(!showOnlyWithoutPrice)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase rounded-[calc(var(--radius)-4px)] transition-colors border ${
              showOnlyWithoutPrice
                ? "bg-destructive/5 text-destructive border-destructive/30"
                : "text-muted-foreground border-border/60 hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Zonder prijs · {ingredientsWithoutPrice}
          </button>
        </div>
      )}

      <div className="paper-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-10"></TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Naam
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Prijs per eenheid
                </TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-16 text-muted-foreground">
                    <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
                    <p className="text-sm">Laden…</p>
                  </TableCell>
                </TableRow>
              ) : filteredIngredients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-16 text-muted-foreground text-sm">
                    {searchQuery ? "Geen ingrediënten gevonden." : "Nog geen ingrediënten. Voeg er een toe."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredIngredients.map((ingredient) => (
                  <TableRow key={ingredient.id} className="border-b border-border/40 hover:bg-muted/40">
                    <TableCell className="py-3 w-10 pl-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        onClick={() => openEditDialog(ingredient)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-foreground">{ingredient.name}</TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
                      {formatPrice(Number(ingredient.price_per_unit), ingredient.unit)}
                    </TableCell>
                    <TableCell className="py-3 w-10 pr-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                        onClick={() => handleDelete(ingredient.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader className="space-y-2">
            <p className="bakery-eyebrow">Ingrediënt</p>
            <DialogTitle
              className="font-serif text-2xl md:text-3xl font-medium text-foreground leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              {editingIngredient ? "Bewerken" : "Nieuw ingrediënt"}
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
                  className="tabular-nums"
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
