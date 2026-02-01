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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];

const CategoriesTab = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: "" });
  const { toast } = useToast();

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");

    if (error) {
      toast({ title: "Fout", description: "Kon categorieën niet laden", variant: "destructive" });
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  };

  const refreshCategories = useCallback(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchCategories();
  }, []);

  useVisibilityRefresh(refreshCategories);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingCategory(null);
    setFormData({ name: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({ name: category.name });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Fout", description: "Naam is verplicht", variant: "destructive" });
      return;
    }

    if (editingCategory) {
      const { error } = await supabase
        .from("categories")
        .update({ name: formData.name.trim() })
        .eq("id", editingCategory.id);

      if (error) {
        toast({ title: "Fout", description: "Kon categorie niet bijwerken", variant: "destructive" });
        return;
      }
      toast({ title: "Opgeslagen", description: "Categorie bijgewerkt" });
    } else {
      const { error } = await supabase.from("categories").insert({ name: formData.name.trim() });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Fout", description: "Deze categorie bestaat al", variant: "destructive" });
        } else {
          toast({ title: "Fout", description: "Kon categorie niet toevoegen", variant: "destructive" });
        }
        return;
      }
      toast({ title: "Toegevoegd", description: "Nieuwe categorie aangemaakt" });
    }

    setDialogOpen(false);
    fetchCategories();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Weet je zeker dat je deze categorie wilt verwijderen?")) return;

    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (error) {
      toast({ title: "Fout", description: "Kon categorie niet verwijderen. Mogelijk zijn er nog producten aan gekoppeld.", variant: "destructive" });
      return;
    }
    toast({ title: "Verwijderd", description: "Categorie verwijderd" });
    fetchCategories();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Zoek categorie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 border-0 border-b border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary"
          />
        </div>
        <Button onClick={openCreateDialog} size="sm" className="font-normal">
          <Plus className="w-4 h-4 mr-2" />
          Nieuwe categorie
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="w-10"></TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Naam</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            ) : filteredCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                  {searchQuery ? "Geen categorieën gevonden" : "Nog geen categorieën. Voeg er een toe!"}
                </TableCell>
              </TableRow>
            ) : (
              filteredCategories.map((category) => (
                <TableRow key={category.id} className="border-0 hover:bg-muted/30">
                  <TableCell className="py-2.5 w-10">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditDialog(category)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                  <TableCell className="py-2.5 text-sm font-light">{category.name}</TableCell>
                  <TableCell className="py-2.5 w-10">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(category.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
              {editingCategory ? "Categorie bewerken" : "Nieuwe categorie"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Naam</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ name: e.target.value })}
                placeholder="bijv. Brood, Koekjes, Gebak"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleSave}>
              {editingCategory ? "Opslaan" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategoriesTab;
