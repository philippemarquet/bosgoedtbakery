import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type WeeklyMenu = Database["public"]["Tables"]["weekly_menus"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];

interface MenuProduct {
  product_id: string;
  quantity: string;
}

interface WeeklyMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingMenu: WeeklyMenu | null;
  onSave: () => void;
}

const WeeklyMenuDialog = ({ open, onOpenChange, editingMenu, onSave }: WeeklyMenuDialogProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    week_start_date: new Date(),
    delivery_date: null as Date | null,
    price: "",
  });

  const [menuProducts, setMenuProducts] = useState<MenuProduct[]>([]);

  const { toast } = useToast();

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from("products").select("*").order("name");
      if (data) setProducts(data);
    };
    fetchProducts();
  }, []);

  // Load existing menu data
  useEffect(() => {
    const loadMenuData = async () => {
      if (!editingMenu) {
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        setFormData({
          name: "",
          description: "",
          week_start_date: weekStart,
          delivery_date: null,
          price: "",
        });
        setMenuProducts([]);
        return;
      }

      setFormData({
        name: editingMenu.name,
        description: editingMenu.description || "",
        week_start_date: new Date(editingMenu.week_start_date),
        delivery_date: editingMenu.delivery_date ? new Date(editingMenu.delivery_date) : null,
        price: String(editingMenu.price),
      });

      const { data: mpData } = await supabase
        .from("weekly_menu_products")
        .select("product_id, quantity")
        .eq("weekly_menu_id", editingMenu.id);

      if (mpData) {
        setMenuProducts(
          mpData.map((mp) => ({
            product_id: mp.product_id,
            quantity: String(mp.quantity),
          }))
        );
      }
    };

    if (open) {
      loadMenuData();
    }
  }, [editingMenu, open]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Fout", description: "Naam is verplicht", variant: "destructive" });
      return;
    }

    setLoading(true);

    const weekStart = startOfWeek(formData.week_start_date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(formData.week_start_date, { weekStartsOn: 1 });

    const menuPayload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      week_start_date: format(weekStart, "yyyy-MM-dd"),
      week_end_date: format(weekEnd, "yyyy-MM-dd"),
      delivery_date: formData.delivery_date ? format(formData.delivery_date, "yyyy-MM-dd") : null,
      price: parseFloat(formData.price) || 0,
    };

    let menuId: string;

    if (editingMenu) {
      const { error } = await supabase
        .from("weekly_menus")
        .update(menuPayload)
        .eq("id", editingMenu.id);

      if (error) {
        toast({ title: "Fout", description: "Kon weekmenu niet bijwerken", variant: "destructive" });
        setLoading(false);
        return;
      }
      menuId = editingMenu.id;

      await supabase.from("weekly_menu_products").delete().eq("weekly_menu_id", menuId);
    } else {
      const { data, error } = await supabase
        .from("weekly_menus")
        .insert(menuPayload)
        .select("id")
        .single();

      if (error || !data) {
        toast({ title: "Fout", description: "Kon weekmenu niet aanmaken", variant: "destructive" });
        setLoading(false);
        return;
      }
      menuId = data.id;
    }

    // Insert menu products
    const validProducts = menuProducts.filter(
      (mp) => mp.product_id && parseInt(mp.quantity) > 0
    );
    if (validProducts.length > 0) {
      await supabase.from("weekly_menu_products").insert(
        validProducts.map((mp) => ({
          weekly_menu_id: menuId,
          product_id: mp.product_id,
          quantity: parseInt(mp.quantity),
        }))
      );
    }

    setLoading(false);
    toast({
      title: editingMenu ? "Opgeslagen" : "Toegevoegd",
      description: editingMenu ? "Weekmenu bijgewerkt" : "Nieuw weekmenu aangemaakt",
    });
    onOpenChange(false);
    onSave();
  };

  const addMenuProduct = () => {
    setMenuProducts([...menuProducts, { product_id: "", quantity: "1" }]);
  };

  const removeMenuProduct = (index: number) => {
    setMenuProducts(menuProducts.filter((_, i) => i !== index));
  };

  const updateMenuProduct = (index: number, field: keyof MenuProduct, value: string) => {
    const updated = [...menuProducts];
    updated[index] = { ...updated[index], [field]: value };
    setMenuProducts(updated);
  };

  const getWeekLabel = (date: Date) => {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    return `${format(weekStart, "d MMM", { locale: nl })} - ${format(weekEnd, "d MMM yyyy", { locale: nl })}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingMenu ? "Weekmenu bewerken" : "Nieuw weekmenu"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Naam *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="bijv. Weekmenu Week 5"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Week</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.week_start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {getWeekLabel(formData.week_start_date)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.week_start_date}
                    onSelect={(date) => date && setFormData({ ...formData, week_start_date: date })}
                    locale={nl}
                    weekStartsOn={1}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Leverdag *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.delivery_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.delivery_date 
                      ? format(formData.delivery_date, "EEEE d MMMM yyyy", { locale: nl })
                      : "Selecteer leverdag"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.delivery_date || undefined}
                    onSelect={(date) => setFormData({ ...formData, delivery_date: date || null })}
                    locale={nl}
                    weekStartsOn={1}
                    disabled={(date) => {
                      const weekStart = startOfWeek(formData.week_start_date, { weekStartsOn: 1 });
                      const weekEnd = endOfWeek(formData.week_start_date, { weekStartsOn: 1 });
                      return date < weekStart || date > weekEnd;
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Prijs weekmenu (€)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between items-center mb-4">
              <Label>Producten in dit menu</Label>
              <Button type="button" variant="outline" size="sm" onClick={addMenuProduct}>
                <Plus className="w-4 h-4 mr-1" />
                Product toevoegen
              </Button>
            </div>

            {menuProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nog geen producten. Klik op "Product toevoegen" om te beginnen.
              </p>
            ) : (
              <div className="space-y-2">
                {menuProducts.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Select
                      value={item.product_id}
                      onValueChange={(value) => updateMenuProduct(index, "product_id", value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecteer product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateMenuProduct(index, "quantity", e.target.value)}
                      className="w-20"
                      placeholder="1"
                    />
                    <span className="text-sm text-muted-foreground w-12">stuks</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMenuProduct(index)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Opslaan..." : editingMenu ? "Opslaan" : "Toevoegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WeeklyMenuDialog;
