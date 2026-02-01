import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Calendar, User, Package, MapPin, Image as ImageIcon, AlertTriangle, FileText, Lock, RotateCcw, Hash } from "lucide-react";
import { format, parseISO, startOfDay } from "date-fns";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface Order {
  id: string;
  order_number?: number;
  status: string;
  notes: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  created_at: string;
  invoice_date?: string;
  customer: { id: string; full_name: string | null } | null;
  weekly_menu: { id: string; name: string; delivery_date: string | null } | null;
  pickup_location_id?: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  user_id: string | null;
  discount_percentage: number;
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
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedMenuId, setSelectedMenuId] = useState<string>("");
  const [selectedPickupLocationId, setSelectedPickupLocationId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [extraItems, setExtraItems] = useState<{ product_id: string; quantity: number }[]>([]);
  const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(new Date());
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  const { toast } = useToast();

  // Fetch all active customers (both with and without login)
  useEffect(() => {
    const fetchCustomers = async () => {
      // Get all non-archived profiles
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, user_id, discount_percentage")
        .eq("is_archived", false)
        .order("full_name");

      if (!allProfiles || allProfiles.length === 0) {
        setCustomers([]);
        return;
      }

      // Get user_ids with 'baker' role to exclude them
      const { data: bakerRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "baker");
      
      const bakerUserIds = new Set(bakerRoles?.map(r => r.user_id) || []);

      // Filter out bakers - customers are:
      // 1. Profiles without user_id (no login customers)
      // 2. Profiles with user_id that's NOT a baker
      const customers = allProfiles.filter(profile => 
        !profile.user_id || !bakerUserIds.has(profile.user_id)
      );
      
      setCustomers(customers);
    };
    fetchCustomers();
  }, []);

  // Fetch weekly menus - all for editing, only active for new orders
  useEffect(() => {
    const fetchMenus = async () => {
      const today = format(startOfDay(new Date()), "yyyy-MM-dd");
      
      // If editing an order, fetch all menus to show historical data
      // If creating new order, only show menus with future delivery date
      let query = supabase
        .from("weekly_menus")
        .select("id, name, delivery_date, price")
        .order("delivery_date", { ascending: false });
      
      if (!editingOrder) {
        query = query.gte("delivery_date", today);
      }
      
      const { data } = await query;
      if (data) setWeeklyMenus(data);
    };
    fetchMenus();
  }, [editingOrder]);

  // Fetch orderable products with images
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
        setSelectedPickupLocationId("");
        setNotes("");
        setExtraItems([]);
        setInvoiceDate(new Date());
        return;
      }

      setSelectedCustomerId(editingOrder.customer?.id || "");
      setSelectedMenuId(editingOrder.weekly_menu?.id || "");
      setSelectedPickupLocationId(editingOrder.pickup_location_id || "");
      setNotes(editingOrder.notes || "");
      
      // Load invoice date from order
      if (editingOrder.invoice_date) {
        setInvoiceDate(parseISO(editingOrder.invoice_date));
      } else {
        setInvoiceDate(new Date());
      }

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

  // Get selected customer for discount percentage
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const customerDiscountPercentage = selectedCustomer?.discount_percentage || 0;

  // Calculate totals with discount groups and customer discount
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
    let groupDiscountAmount = 0;

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
        groupDiscountAmount += groupItemsValue * (applicableTier.discount_percentage / 100);
      }
    });

    // Apply customer discount to the remaining amount after group discounts
    const afterGroupDiscount = subtotal - groupDiscountAmount;
    const customerDiscountAmount = afterGroupDiscount * (customerDiscountPercentage / 100);
    const totalDiscountAmount = groupDiscountAmount + customerDiscountAmount;

    return {
      subtotal,
      discountAmount: totalDiscountAmount,
      total: subtotal - totalDiscountAmount,
    };
  }, [selectedMenu, extraItems, products, discountGroups, customerDiscountPercentage]);

  // Check if order is read-only (status is ready or paid)
  const isReadOnly = editingOrder && (editingOrder.status === "ready" || editingOrder.status === "paid");

  const addExtraItem = () => {
    if (isReadOnly) return;
    setExtraItems([...extraItems, { product_id: "", quantity: 1 }]);
  };

  const removeExtraItem = (index: number) => {
    if (isReadOnly) return;
    setExtraItems(extraItems.filter((_, i) => i !== index));
  };

  const updateExtraItem = (index: number, field: "product_id" | "quantity", value: string | number) => {
    if (isReadOnly) return;
    const updated = [...extraItems];
    updated[index] = { ...updated[index], [field]: value };
    setExtraItems(updated);
  };

  const handleResetToConfirmed = async () => {
    if (!editingOrder) return;
    
    const { error } = await supabase
      .from("orders")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", editingOrder.id);
    
    if (error) {
      toast({ title: "Fout", description: "Kon status niet wijzigen", variant: "destructive" });
      return;
    }
    
    toast({ title: "Status gewijzigd", description: "Bestelling is teruggezet naar 'Bevestigd'" });
    onOpenChange(false);
    onSave();
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

    if (!invoiceDate) {
      toast({ title: "Fout", description: "Selecteer een factuurdatum", variant: "destructive" });
      return;
    }

    // Show warning when editing ready or paid orders
    if (editingOrder && (editingOrder.status === "ready" || editingOrder.status === "paid") && !pendingSave) {
      setShowEditWarning(true);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    setPendingSave(false);
    setLoading(true);

    const orderPayload = {
      customer_id: selectedCustomerId,
      weekly_menu_id: selectedMenuId || null,
      pickup_location_id: selectedPickupLocationId || null,
      notes: notes.trim() || null,
      subtotal,
      discount_amount: discountAmount,
      total,
      created_by: user!.id,
      invoice_date: format(invoiceDate!, "yyyy-MM-dd"),
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
          <div className="flex items-center justify-between">
            <DialogTitle>
              {editingOrder ? "Bestelling bewerken" : "Nieuwe bestelling"}
            </DialogTitle>
            {editingOrder?.order_number && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-normal">
                <Hash className="w-3.5 h-3.5" />
                {editingOrder.order_number}
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Read-only notice for ready/paid orders */}
        {isReadOnly && (
          <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 border rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>
                Deze bestelling is <strong>{editingOrder?.status === "ready" ? "Gereed" : "Betaald"}</strong> en kan alleen bekeken worden.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToConfirmed}
              className="shrink-0"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Terugzetten naar Bevestigd
            </Button>
          </div>
        )}

        <div className="space-y-6 py-4">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Klant *
            </Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId} disabled={isReadOnly}>
              <SelectTrigger className={isReadOnly ? "opacity-60" : ""}>
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

          {/* Invoice Date */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Factuurdatum *
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !invoiceDate && "text-muted-foreground",
                    isReadOnly && "opacity-60 pointer-events-none"
                  )}
                  disabled={isReadOnly}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {invoiceDate ? format(invoiceDate, "EEEE d MMMM yyyy", { locale: nl }) : "Selecteer datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={invoiceDate}
                  onSelect={setInvoiceDate}
                  initialFocus
                  locale={nl}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Weekly Menu Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Weekmenu (optioneel)
            </Label>
            <Select 
              value={selectedMenuId || "none"} 
              onValueChange={(val) => setSelectedMenuId(val === "none" ? "" : val)}
              disabled={isReadOnly}
            >
              <SelectTrigger className={isReadOnly ? "opacity-60" : ""}>
                <SelectValue placeholder="Selecteer weekmenu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Geen weekmenu</SelectItem>
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
            {weeklyMenus.length === 0 && !editingOrder && (
              <p className="text-sm text-muted-foreground">
                Geen weekmenu's beschikbaar. Maak er eerst een aan met een toekomstige leverdag.
              </p>
            )}
          </div>

          {/* Pickup Location Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Afhaallocatie
            </Label>
            <Select value={selectedPickupLocationId} onValueChange={setSelectedPickupLocationId} disabled={isReadOnly}>
              <SelectTrigger className={isReadOnly ? "opacity-60" : ""}>
                <SelectValue placeholder="Selecteer afhaallocatie" />
              </SelectTrigger>
              <SelectContent>
                {pickupLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{location.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {location.street} {location.house_number}, {location.postal_code} {location.city}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pickupLocations.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Geen afhaallocaties beschikbaar. Maak er eerst een aan in de back-office.
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
              {!isReadOnly && (
                <Button type="button" variant="outline" size="sm" onClick={addExtraItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  Product toevoegen
                </Button>
              )}
            </div>

            {extraItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Geen extra producten. Klik op "Product toevoegen" om losse producten toe te voegen.
              </p>
            ) : (
              <div className="space-y-3">
                {extraItems.map((item, index) => {
                  const product = products.find(p => p.id === item.product_id);
                  return (
                    <div key={index} className={cn(
                      "flex gap-3 items-center p-2 border rounded-lg bg-muted/30",
                      isReadOnly && "opacity-60"
                    )}>
                      {/* Product image */}
                      <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        {product?.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      
                      {isReadOnly ? (
                        <span className="flex-1 text-sm">{product?.name || "Onbekend product"}</span>
                      ) : (
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
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {isReadOnly ? (
                        <span className="w-20 text-sm text-center">{item.quantity}x</span>
                      ) : (
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateExtraItem(index, "quantity", parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                      )}
                      <span className="text-sm font-medium w-20 text-right">
                        {product ? formatCurrency(product.selling_price * item.quantity) : "-"}
                      </span>
                      {!isReadOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeExtraItem(index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
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
              disabled={isReadOnly}
              className={isReadOnly ? "opacity-60" : ""}
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
            {isReadOnly ? "Sluiten" : "Annuleren"}
          </Button>
          {!isReadOnly && (
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Opslaan..." : editingOrder ? "Opslaan" : "Bestelling aanmaken"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Warning Dialog for editing ready/paid orders */}
      <AlertDialog open={showEditWarning} onOpenChange={setShowEditWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Bestelling bewerken
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deze bestelling heeft de status "{editingOrder?.status === "ready" ? "Gereed" : "Betaald"}". 
              Weet je zeker dat je deze bestelling wilt wijzigen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowEditWarning(false);
              setPendingSave(true);
              setTimeout(() => handleSave(), 0);
            }}>
              Ja, wijzigen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default OrderDialog;
