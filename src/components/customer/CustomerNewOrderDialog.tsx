import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, MapPin, Package, Image as ImageIcon, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface WeeklyMenu {
  id: string;
  name: string;
  description: string | null;
  price: number;
  delivery_date: string | null;
  week_start_date: string;
  week_end_date: string;
  products: { id: string; name: string; quantity: number }[];
}

interface Product {
  id: string;
  name: string;
  selling_price: number;
  category_name?: string;
  image_url?: string | null;
}

interface PickupLocation {
  id: string;
  title: string;
  street: string;
  house_number: string | null;
  postal_code: string;
  city: string;
}

interface CustomerNewOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weeklyMenu: WeeklyMenu | null;
  onSuccess: () => void;
}

const CustomerNewOrderDialog = ({ open, onOpenChange, weeklyMenu, onSuccess }: CustomerNewOrderDialogProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [customerProfile, setCustomerProfile] = useState<{ id: string; discount_percentage: number } | null>(null);

  const [selectedPickupLocationId, setSelectedPickupLocationId] = useState<string>("");
  const [customPickupLocation, setCustomPickupLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [extraItems, setExtraItems] = useState<{ product_id: string; quantity: number }[]>([]);

  const { toast } = useToast();

  // Fetch customer profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, discount_percentage")
        .eq("user_id", user.id)
        .single();
      if (data) setCustomerProfile(data);
    };
    fetchProfile();
  }, [user]);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, selling_price, image_url, category:categories(name)")
        .eq("is_orderable", true)
        .order("name");
      if (data) {
        setProducts(data.map(p => ({
          id: p.id,
          name: p.name,
          selling_price: Number(p.selling_price),
          category_name: p.category?.name || "Zonder categorie",
          image_url: p.image_url,
        })));
      }
    };
    fetchProducts();
  }, []);

  // Fetch pickup locations
  useEffect(() => {
    const fetchPickupLocations = async () => {
      const { data } = await supabase
        .from("pickup_locations")
        .select("*")
        .eq("is_active", true)
        .order("title");
      if (data) setPickupLocations(data);
    };
    fetchPickupLocations();
  }, []);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPickupLocationId("");
      setCustomPickupLocation("");
      setNotes("");
      setExtraItems([]);
    }
  }, [open]);

  // Group products by category
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

  // Calculate totals
  const { subtotal, discountAmount, total } = useMemo(() => {
    let subtotal = 0;

    // Add weekly menu price
    if (weeklyMenu) {
      subtotal += weeklyMenu.price;
    }

    // Add extra items
    extraItems.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      if (product) {
        subtotal += product.selling_price * item.quantity;
      }
    });

    // Apply customer discount
    const discountPercentage = customerProfile?.discount_percentage || 0;
    const discountAmount = subtotal * (discountPercentage / 100);

    return {
      subtotal,
      discountAmount,
      total: subtotal - discountAmount,
    };
  }, [weeklyMenu, extraItems, products, customerProfile]);

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

  const handleSubmit = async () => {
    if (!user || !customerProfile) {
      toast({ title: "Fout", description: "Je moet ingelogd zijn om te bestellen", variant: "destructive" });
      return;
    }

    if (!selectedPickupLocationId || (selectedPickupLocationId === "anders" && !customPickupLocation.trim())) {
      toast({ title: "Fout", description: "Selecteer een afhaallocatie", variant: "destructive" });
      return;
    }

    if (!weeklyMenu && extraItems.length === 0) {
      toast({ title: "Fout", description: "Voeg minimaal één product toe", variant: "destructive" });
      return;
    }

    setLoading(true);

    // Use delivery date from weekly menu as invoice date, or today
    const invoiceDate = weeklyMenu?.delivery_date || format(new Date(), "yyyy-MM-dd");

    const orderNotes = selectedPickupLocationId === "anders" 
      ? `Afhaallocatie: ${customPickupLocation.trim()}${notes ? `\n${notes}` : ""}`
      : notes.trim() || null;

    const orderPayload = {
      customer_id: customerProfile.id,
      weekly_menu_id: weeklyMenu?.id || null,
      pickup_location_id: selectedPickupLocationId === "anders" ? null : selectedPickupLocationId,
      notes: orderNotes,
      subtotal,
      discount_amount: discountAmount,
      total,
      created_by: user.id,
      invoice_date: invoiceDate,
      status: "confirmed",
    };

    const { data: order, error } = await supabase
      .from("orders")
      .insert(orderPayload)
      .select("id")
      .single();

    if (error || !order) {
      toast({ title: "Fout", description: "Kon bestelling niet aanmaken", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Insert order items for extra products
    const orderItems = extraItems
      .filter(item => item.product_id && item.quantity > 0)
      .map(item => {
        const product = products.find(p => p.id === item.product_id);
        return {
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: product?.selling_price || 0,
          discount_amount: 0,
          total: (product?.selling_price || 0) * item.quantity,
          is_weekly_menu_item: false,
        };
      });

    if (orderItems.length > 0) {
      await supabase.from("order_items").insert(orderItems);
    }

    setLoading(false);
    toast({ 
      title: "Bestelling geplaatst!", 
      description: "Je bestelling is succesvol geplaatst. Bekijk deze bij 'Mijn bestellingen'." 
    });
    onSuccess();
  };

  const formatCurrency = (value: number) => `€${value.toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {weeklyMenu ? `Bestellen: ${weeklyMenu.name}` : "Nieuwe bestelling"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Weekly Menu Info */}
          {weeklyMenu && (
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {weeklyMenu.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {weeklyMenu.description && (
                  <p className="text-sm text-muted-foreground">{weeklyMenu.description}</p>
                )}
                {weeklyMenu.delivery_date && (
                  <p className="text-sm">
                    <strong>Levering:</strong> {format(parseISO(weeklyMenu.delivery_date), "EEEE d MMMM yyyy", { locale: nl })}
                  </p>
                )}
                <div className="pt-2">
                  <p className="text-sm font-medium">Inhoud:</p>
                  <ul className="mt-1 space-y-1">
                    {weeklyMenu.products.map((product) => (
                      <li key={product.id} className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                        {product.quantity}x {product.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pickup Location */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Afhaallocatie *
            </Label>
            <Select value={selectedPickupLocationId} onValueChange={setSelectedPickupLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer afhaallocatie" />
              </SelectTrigger>
              <SelectContent>
                {pickupLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{location.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {location.street} {location.house_number}, {location.city}
                      </span>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="anders">
                  <span className="italic">Anders (zelf invullen)</span>
                </SelectItem>
              </SelectContent>
            </Select>
            {selectedPickupLocationId === "anders" && (
              <Input
                placeholder="Vul je gewenste afhaallocatie in..."
                value={customPickupLocation}
                onChange={(e) => setCustomPickupLocation(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          <Separator />

          {/* Extra Products */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Extra producten (optioneel)
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addExtraItem}>
                <Plus className="w-4 h-4 mr-1" />
                Product toevoegen
              </Button>
            </div>

            {extraItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Wil je naast het weekmenu nog extra producten? Klik op "Product toevoegen".
              </p>
            ) : (
              <div className="space-y-3">
                {extraItems.map((item, index) => {
                  const product = products.find(p => p.id === item.product_id);
                  return (
                    <div key={index} className="flex gap-3 items-center p-2 border rounded-lg bg-muted/30">
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        {product?.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
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
                      <span className="text-sm font-medium w-16 text-right">
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
              placeholder="Optionele opmerkingen voor je bestelling..."
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
              {weeklyMenu && (
                <div className="flex justify-between text-sm">
                  <span>{weeklyMenu.name}</span>
                  <span>{formatCurrency(weeklyMenu.price)}</span>
                </div>
              )}
              {extraItems.filter(i => i.product_id).map((item, index) => {
                const product = products.find(p => p.id === item.product_id);
                return product ? (
                  <div key={index} className="flex justify-between text-sm text-muted-foreground">
                    <span>{item.quantity}x {product.name}</span>
                    <span>{formatCurrency(product.selling_price * item.quantity)}</span>
                  </div>
                ) : null;
              })}
              <Separator />
              <div className="flex justify-between text-sm">
                <span>Subtotaal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Korting ({customerProfile?.discount_percentage}%)</span>
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
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Bestelling plaatsen..." : "Bestelling plaatsen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerNewOrderDialog;
