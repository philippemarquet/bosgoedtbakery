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
        <DialogHeader className="space-y-1">
          <p className="bakery-eyebrow">Kortingsgroep</p>
          <DialogTitle
            className="font-serif text-2xl font-medium leading-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            {editingGroup ? "Bewerken" : "Nieuwe groep"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Naam *
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="bijv. Koekjes"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Beschrijving
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optionele beschrijving..."
              rows={2}
            />
          </div>

          {/* Tiers Section */}
          <div className="pt-4 border-t border-border/60 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="bakery-eyebrow">Staffelkorting</p>
                <h3 className="font-serif text-base font-medium text-foreground leading-tight mt-0.5">
                  Korting per aantal
                </h3>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addTier} className="gap-1">
                <Plus className="h-4 w-4" />
                Staffel toevoegen
              </Button>
            </div>

            {tiers.length === 0 ? (
              <div className="rounded-[calc(var(--radius)-2px)] border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Nog geen staffels. Voeg er een toe om korting te geven vanaf een bepaald aantal.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {tiers.map((tier, index) => (
                  <div
                    key={index}
                    className="flex gap-2 items-center rounded-[calc(var(--radius)-2px)] border border-border/60 bg-muted/20 px-3 py-2"
                  >
                    <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Vanaf</span>
                    <Input
                      type="number"
                      min="1"
                      value={tier.min_quantity}
                      onChange={(e) => updateTier(index, "min_quantity", e.target.value)}
                      className="w-20 tabular-nums"
                      placeholder="4"
                    />
                    <span className="text-xs text-muted-foreground">stuks</span>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={tier.discount_percentage}
                      onChange={(e) => updateTier(index, "discount_percentage", e.target.value)}
                      className="w-20 tabular-nums"
                      placeholder="10"
                    />
                    <span className="text-xs text-muted-foreground">% korting</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTier(index)}
                      className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Products Section */}
          <div className="pt-4 border-t border-border/60 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="bakery-eyebrow">Producten</p>
                <h3 className="font-serif text-base font-medium text-foreground leading-tight mt-0.5">
                  In deze groep
                </h3>
              </div>
              <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium tabular-nums text-foreground ring-1 ring-inset ring-border/60">
                {selectedProductIds.size} geselecteerd
              </span>
            </div>

            <ScrollArea className="h-[220px] rounded-[calc(var(--radius)-2px)] border border-border/60 bg-muted/10 p-4">
              {Object.entries(groupedProducts).map(([categoryName, categoryProducts]) => (
                <div key={categoryName} className="mb-4 last:mb-0">
                  <p className="bakery-eyebrow mb-2">{categoryName}</p>
                  <div className="space-y-0.5">
                    {categoryProducts.map((product) => (
                      <label
                        key={product.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-2 py-1 rounded-[calc(var(--radius)-4px)] transition-colors"
                      >
                        <Checkbox
                          checked={selectedProductIds.has(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                        />
                        <span className="text-sm text-foreground">{product.name}</span>
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
