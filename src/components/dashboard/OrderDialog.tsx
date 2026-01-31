import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Calendar, User, Package } from "lucide-react";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Order {
  id: string;
  status: string;
  notes: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  created_at: string;
  customer: { id: string; full_name: string | null } | null;
  weekly_menu: { id: string; name: string; delivery_date: string | null } | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  user_id: string;
}

interface WeeklyMenu {
  id: string;
  name: string;
  delivery_date: string | null;
  price: number;
}

interface Product {
  id: string;
  name: string;
  selling_price: number;
  category_name?: string;
}

interface OrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  is_weekly_menu_item: boolean;
}

interface DiscountGroup {
  id: string;
  name: string;
  product_ids: string[];
  tiers: { min_quantity: number; discount_percentage: number }[];
}

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOrder: Order | null;
  onSave: () => void;
}

const OrderDialog = ({ open, onOpenChange, editingOrder, onSave }: OrderDialogProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [weeklyMenus, setWeeklyMenus] = useState<WeeklyMenu[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discountGroups, setDiscountGroups] = useState<DiscountGroup[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedMenuId, setSelectedMenuId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [extraItems, setExtraItems] = useState<{ product_id: string; quantity: number }[]>([]);

  const { toast } = useToast();

  // Fetch customers (profiles with customer role)
  useEffect(() => {
    const fetchCustomers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, user_id")
        .order("full_name");
      if (data) setCustomers(data);
    };
    fetchCustomers();
  }, []);

  // Fetch active weekly menus (delivery_date >= today)
  useEffect(() => {
    const fetchMenus = async () => {
      const today = format(startOfDay(new Date()), "yyyy-MM-dd");
      const { data } = await supabase
        .from("weekly_menus")
        .select("id, name, delivery_date, price")
        .gte("delivery_date", today)
        .order("delivery_date");
      if (data) setWeeklyMenus(data);
    };
    fetchMenus();
  }, []);

  // Fetch orderable products
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, selling_price, category:categories(name)")
        .eq("is_orderable", true)
        .order("name");
      if (data) {
        setProducts(data.map(p => ({
          id: p.id,
          name: p.name,
          selling_price: Number(p.selling_price),
          category_name: p.category?.name || "Zonder categorie",
        })));
      }
    };
    fetchProducts();
  }, []);

  // Fetch discount groups with tiers and products
  useEffect(() => {
    const fetchDiscountGroups = async () => {
      const { data: groups } = await supabase
        .from("discount_groups")
        .select("id, name");

      if (!groups) return;

      const groupsWithDetails = await Promise.all(
        groups.map(async (group) => {
          const { data: tiers } = await supabase
            .from("discount_group_tiers")
            .select("min_quantity, discount_percentage")
            .eq("discount_group_id", group.id)
            .order("min_quantity", { ascending: false });

          const { data: productLinks } = await supabase
            .from("product_discount_groups")
            .select("product_id")
            .eq("discount_group_id", group.id);

          return {
            ...group,
            product_ids: productLinks?.map(p => p.product_id) || [],
            tiers: tiers || [],
          };
        })
      );

      setDiscountGroups(groupsWithDetails);
    };
    fetchDiscountGroups();
  }, []);

  // Load existing order data
  useEffect(() => {
    const loadOrderData = async () => {
      if (!editingOrder) {
        setSelectedCustomerId("");
        setSelectedMenuId("");
        setNotes("");
        setExtraItems([]);
        return;
      }

      setSelectedCustomerId(editingOrder.customer?.id || "");
      setSelectedMenuId(editingOrder.weekly_menu?.id || "");
      setNotes(editingOrder.notes || "");

      // Load order items
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, quantity, is_weekly_menu_item")
        .eq("order_id", editingOrder.id);

      if (items) {
        setExtraItems(
          items
            .filter(i => !i.is_weekly_menu_item)
            .map(i => ({ product_id: i.product_id, quantity: i.quantity }))
        );
      }
    };

    if (open) {
      loadOrderData();
    }
  }, [editingOrder, open]);

  // Get selected menu price
  const selectedMenu = weeklyMenus.find(m => m.id === selectedMenuId);

  // Group products by category for the extra items selector
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    products.forEach((product) => {
      const cat = product.category_name || "Zonder categorie";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(product);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Zonder categorie") return 1;
      if (b === "Zonder categorie") return -1;
      return a.localeCompare(b);
    });
  }, [products]);

  // Calculate totals with discount groups
  const { subtotal, discountAmount, total } = useMemo(() => {
    let subtotal = 0;

    // Add weekly menu price
    if (selectedMenu) {
      subtotal += selectedMenu.price;
    }

    // Add extra items
    extraItems.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      if (product) {
        subtotal += product.selling_price * item.quantity;
      }
    });

    // Calculate discount based on discount groups
    let discountAmount = 0;

    discountGroups.forEach(group => {
      // Count total quantity of products in this group
      let totalQty = 0;
      let groupItemsValue = 0;

      extraItems.forEach(item => {
        if (group.product_ids.includes(item.product_id)) {
          totalQty += item.quantity;
          const product = products.find(p => p.id === item.product_id);
          if (product) {
            groupItemsValue += product.selling_price * item.quantity;
          }
        }
      });

      // Find applicable tier (highest min_quantity that's <= totalQty)
      const applicableTier = group.tiers.find(t => totalQty >= t.min_quantity);
      if (applicableTier) {
        discountAmount += groupItemsValue * (applicableTier.discount_percentage / 100);
      }
    });

    return {
      subtotal,
      discountAmount,
      total: subtotal - discountAmount,
    };
  }, [selectedMenu, extraItems, products, discountGroups]);

  const addExtraItem = () => {
    setExtraItems([...extraItems, { product_id: "", quantity: 1 }]);
  };

  const removeExtraItem = (index: number) => {
    setExtraItems(extraItems.filter((_, i) => i !== index));
  };

  const updateExtraItem = (index: number, field: "product_id" | "quantity", value: string | number) => {
    const updated = [...extraItems];
    updated[index] = { ...updated[index], [field]: value };
    setExtraItems(updated);
  };

  const handleSave = async () => {
    if (!selectedCustomerId) {
      toast({ title: "Fout", description: "Selecteer een klant", variant: "destructive" });
      return;
    }

    if (!selectedMenuId && extraItems.length === 0) {
      toast({ title: "Fout", description: "Selecteer een weekmenu of voeg producten toe", variant: "destructive" });
      return;
    }

    setLoading(true);

    const orderPayload = {
      customer_id: selectedCustomerId,
      weekly_menu_id: selectedMenuId || null,
      notes: notes.trim() || null,
      subtotal,
      discount_amount: discountAmount,
      total,
      created_by: user?.id!,
    };

    let orderId: string;

    if (editingOrder) {
      const { error } = await supabase
        .from("orders")
        .update(orderPayload)
        .eq("id", editingOrder.id);

      if (error) {
        toast({ title: "Fout", description: "Kon bestelling niet bijwerken", variant: "destructive" });
        setLoading(false);
        return;
      }
      orderId = editingOrder.id;

      // Remove old items
      await supabase.from("order_items").delete().eq("order_id", orderId);
    } else {
      const { data, error } = await supabase
        .from("orders")
        .insert(orderPayload)
        .select("id")
        .single();

      if (error || !data) {
        toast({ title: "Fout", description: "Kon bestelling niet aanmaken", variant: "destructive" });
        setLoading(false);
        return;
      }
      orderId = data.id;
    }

    // Insert order items
    const orderItems: {
      order_id: string;
      product_id: string;
      quantity: number;
      unit_price: number;
      discount_amount: number;
      total: number;
      is_weekly_menu_item: boolean;
    }[] = [];

    // Add extra items
    extraItems.forEach(item => {
      if (!item.product_id || item.quantity <= 0) return;
      const product = products.find(p => p.id === item.product_id);
      if (!product) return;

      const itemTotal = product.selling_price * item.quantity;
      orderItems.push({
        order_id: orderId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product.selling_price,
        discount_amount: 0, // Calculated at order level
        total: itemTotal,
        is_weekly_menu_item: false,
      });
    });

    if (orderItems.length > 0) {
      await supabase.from("order_items").insert(orderItems);
    }

    setLoading(false);
    toast({
      title: editingOrder ? "Opgeslagen" : "Toegevoegd",
      description: editingOrder ? "Bestelling bijgewerkt" : "Nieuwe bestelling aangemaakt",
    });
    onOpenChange(false);
    onSave();
  };

  const formatCurrency = (value: number) => `€${value.toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingOrder ? "Bestelling bewerken" : "Nieuwe bestelling"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Klant *
            </Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer klant" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.full_name || "Naamloos"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Weekly Menu Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Weekmenu (optioneel)
            </Label>
            <Select value={selectedMenuId} onValueChange={setSelectedMenuId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer weekmenu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Geen weekmenu</SelectItem>
                {weeklyMenus.map((menu) => (
                  <SelectItem key={menu.id} value={menu.id}>
                    <div className="flex items-center gap-2">
                      <span>{menu.name}</span>
                      {menu.delivery_date && (
                        <span className="text-muted-foreground text-sm">
                          ({format(parseISO(menu.delivery_date), "EEEE d MMM", { locale: nl })})
                        </span>
                      )}
                      <span className="font-medium">{formatCurrency(menu.price)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {weeklyMenus.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Geen weekmenu's beschikbaar. Maak er eerst een aan met een toekomstige leverdag.
              </p>
            )}
          </div>

          <Separator />

          {/* Extra Products */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Extra producten
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addExtraItem}>
                <Plus className="w-4 h-4 mr-1" />
                Product toevoegen
              </Button>
            </div>

            {extraItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Geen extra producten. Klik op "Product toevoegen" om losse producten toe te voegen.
              </p>
            ) : (
              <div className="space-y-2">
                {extraItems.map((item, index) => {
                  const product = products.find(p => p.id === item.product_id);
                  return (
                    <div key={index} className="flex gap-2 items-center">
                      <Select
                        value={item.product_id}
                        onValueChange={(value) => updateExtraItem(index, "product_id", value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecteer product" />
                        </SelectTrigger>
                        <SelectContent>
                          {groupedProducts.map(([categoryName, categoryProducts]) => (
                            <div key={categoryName}>
                              <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                                {categoryName}
                              </div>
                              {categoryProducts.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} - {formatCurrency(p.selling_price)}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateExtraItem(index, "quantity", parseInt(e.target.value) || 1)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground w-20 text-right">
                        {product ? formatCurrency(product.selling_price * item.quantity) : "-"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeExtraItem(index)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Opmerkingen</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionele opmerkingen..."
              rows={2}
            />
          </div>

          <Separator />

          {/* Totals */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Overzicht</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotaal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Staffelkorting</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-lg">
                <span>Totaal</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Opslaan..." : editingOrder ? "Opslaan" : "Bestelling aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDialog;
