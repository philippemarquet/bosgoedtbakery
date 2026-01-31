import { useState, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface DiscountGroup {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface Tier {
  min_quantity: string;
  discount_percentage: string;
}

interface Product {
  id: string;
  name: string;
  category_name?: string;
}

interface DiscountGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGroup: DiscountGroup | null;
  onSave: () => void;
}

const DiscountGroupDialog = ({ open, onOpenChange, editingGroup, onSave }: DiscountGroupDialogProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Fetch all products with categories
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, category:categories(name)")
        .eq("is_orderable", true)
        .order("name");
      
      if (data) {
        setProducts(data.map(p => ({
          id: p.id,
          name: p.name,
          category_name: p.category?.name || "Zonder categorie",
        })));
      }
    };
    fetchProducts();
  }, []);

  // Load existing group data
  useEffect(() => {
    const loadGroupData = async () => {
      if (!editingGroup) {
        setFormData({ name: "", description: "" });
        setTiers([]);
        setSelectedProductIds(new Set());
        return;
      }

      setFormData({
        name: editingGroup.name,
        description: editingGroup.description || "",
      });

      // Load tiers
      const { data: tiersData } = await supabase
        .from("discount_group_tiers")
        .select("min_quantity, discount_percentage")
        .eq("discount_group_id", editingGroup.id)
        .order("min_quantity");

      if (tiersData) {
        setTiers(tiersData.map(t => ({
          min_quantity: String(t.min_quantity),
          discount_percentage: String(t.discount_percentage),
        })));
      }

      // Load assigned products
      const { data: productLinks } = await supabase
        .from("product_discount_groups")
        .select("product_id")
        .eq("discount_group_id", editingGroup.id);

      if (productLinks) {
        setSelectedProductIds(new Set(productLinks.map(p => p.product_id)));
      }
    };

    if (open) {
      loadGroupData();
    }
  }, [editingGroup, open]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Fout", description: "Naam is verplicht", variant: "destructive" });
      return;
    }

    setLoading(true);

    const groupPayload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
    };

    let groupId: string;

    if (editingGroup) {
      const { error } = await supabase
        .from("discount_groups")
        .update(groupPayload)
        .eq("id", editingGroup.id);

      if (error) {
        toast({ title: "Fout", description: "Kon kortingsgroep niet bijwerken", variant: "destructive" });
        setLoading(false);
        return;
      }
      groupId = editingGroup.id;

      // Remove old tiers and products
      await supabase.from("discount_group_tiers").delete().eq("discount_group_id", groupId);
      await supabase.from("product_discount_groups").delete().eq("discount_group_id", groupId);
    } else {
      const { data, error } = await supabase
        .from("discount_groups")
        .insert(groupPayload)
        .select("id")
        .single();

      if (error || !data) {
        toast({ title: "Fout", description: "Kon kortingsgroep niet aanmaken", variant: "destructive" });
        setLoading(false);
        return;
      }
      groupId = data.id;
    }

    // Insert tiers
    const validTiers = tiers.filter(t => parseInt(t.min_quantity) > 0 && parseFloat(t.discount_percentage) > 0);
    if (validTiers.length > 0) {
      await supabase.from("discount_group_tiers").insert(
        validTiers.map(t => ({
          discount_group_id: groupId,
          min_quantity: parseInt(t.min_quantity),
          discount_percentage: parseFloat(t.discount_percentage),
        }))
      );
    }

    // Insert product links
    const productIds = Array.from(selectedProductIds);
    if (productIds.length > 0) {
      await supabase.from("product_discount_groups").insert(
        productIds.map(pid => ({
          discount_group_id: groupId,
          product_id: pid,
        }))
      );
    }

    setLoading(false);
    toast({
      title: editingGroup ? "Opgeslagen" : "Toegevoegd",
      description: editingGroup ? "Kortingsgroep bijgewerkt" : "Nieuwe kortingsgroep aangemaakt",
    });
    onOpenChange(false);
    onSave();
  };

  const addTier = () => {
    setTiers([...tiers, { min_quantity: "", discount_percentage: "" }]);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof Tier, value: string) => {
    const updated = [...tiers];
    updated[index] = { ...updated[index], [field]: value };
    setTiers(updated);
  };

  const toggleProduct = (productId: string) => {
    const newSet = new Set(selectedProductIds);
    if (newSet.has(productId)) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
    }
    setSelectedProductIds(newSet);
  };

  // Group products by category
  const groupedProducts = products.reduce((acc, product) => {
    const cat = product.category_name || "Zonder categorie";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingGroup ? "Kortingsgroep bewerken" : "Nieuwe kortingsgroep"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Naam *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="bijv. Koekjes"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschrijving</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optionele beschrijving..."
              rows={2}
            />
          </div>

          {/* Tiers Section */}
          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between items-center mb-4">
              <Label>Staffelkorting</Label>
              <Button type="button" variant="outline" size="sm" onClick={addTier}>
                <Plus className="w-4 h-4 mr-1" />
                Staffel toevoegen
              </Button>
            </div>

            {tiers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Nog geen staffels. Voeg een staffel toe om korting te geven vanaf een bepaald aantal.
              </p>
            ) : (
              <div className="space-y-2">
                {tiers.map((tier, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <span className="text-sm text-muted-foreground">Vanaf</span>
                    <Input
                      type="number"
                      min="1"
                      value={tier.min_quantity}
                      onChange={(e) => updateTier(index, "min_quantity", e.target.value)}
                      className="w-20"
                      placeholder="4"
                    />
                    <span className="text-sm text-muted-foreground">stuks:</span>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={tier.discount_percentage}
                      onChange={(e) => updateTier(index, "discount_percentage", e.target.value)}
                      className="w-20"
                      placeholder="10"
                    />
                    <span className="text-sm text-muted-foreground">% korting</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTier(index)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Products Section */}
          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between items-center mb-4">
              <Label>Producten in deze groep</Label>
              <Badge variant="secondary">{selectedProductIds.size} geselecteerd</Badge>
            </div>

            <ScrollArea className="h-[200px] border rounded-md p-4">
              {Object.entries(groupedProducts).map(([categoryName, categoryProducts]) => (
                <div key={categoryName} className="mb-4">
                  <p className="text-sm font-semibold text-muted-foreground mb-2">{categoryName}</p>
                  <div className="space-y-1">
                    {categoryProducts.map((product) => (
                      <label
                        key={product.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
                      >
                        <Checkbox
                          checked={selectedProductIds.has(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                        />
                        <span className="text-sm">{product.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Opslaan..." : editingGroup ? "Opslaan" : "Toevoegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DiscountGroupDialog;
