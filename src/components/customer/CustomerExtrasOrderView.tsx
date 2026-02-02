import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Minus, Plus, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  onOrderCreated?: () => void;
};

interface Product {
  id: string;
  name: string;
  selling_price: number;
}

interface PickupLocation {
  id: string;
  title: string;
  street: string;
  house_number: string | null;
  postal_code: string;
  city: string;
}

export default function CustomerExtrasOrderView({ onOrderCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [profileId, setProfileId] = useState<string | null>(null);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);

  const [products, setProducts] = useState<Product[]>([]);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);

  const [pickupLocationId, setPickupLocationId] = useState<string>("");
  const [notes, setNotes] = useState("");

  // quantities by product_id
  const [qty, setQty] = useState<Record<string, number>>({});

  const formatCurrency = (v: number) => `€${Number(v || 0).toFixed(2)}`;

  // Fetch profile + products + pickup locations
  useEffect(() => {
    if (!user) return;

    const run = async () => {
      setLoading(true);

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, discount_percentage")
        .eq("user_id", user.id)
        .single();

      if (profileErr || !profile) {
        toast({ title: "Fout", description: "Kon profiel niet laden", variant: "destructive" });
        setLoading(false);
        return;
      }

      setProfileId(profile.id);
      setDiscountPercentage(Number(profile.discount_percentage || 0));

      const [{ data: prodData, error: prodErr }, { data: locData, error: locErr }] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, selling_price")
          .eq("is_orderable", true)
          .order("name"),
        supabase
          .from("pickup_locations")
          .select("id, title, street, house_number, postal_code, city")
          .eq("is_active", true)
          .order("title"),
      ]);

      if (prodErr) {
        toast({ title: "Fout", description: "Kon producten niet laden", variant: "destructive" });
        setLoading(false);
        return;
      }

      if (locErr) {
        toast({ title: "Fout", description: "Kon afhaallocaties niet laden", variant: "destructive" });
        setLoading(false);
        return;
      }

      setProducts((prodData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        selling_price: Number(p.selling_price || 0),
      })));

      setPickupLocations((locData || []) as any);

      // default pickup location
      if ((locData || []).length > 0) setPickupLocationId((locData as any)[0].id);

      setLoading(false);
    };

    run();
  }, [user, toast]);

  const selectedLines = useMemo(() => {
    return products
      .map((p) => ({
        product: p,
        quantity: Number(qty[p.id] || 0),
        lineTotal: Number(qty[p.id] || 0) * Number(p.selling_price || 0),
      }))
      .filter((l) => l.quantity > 0);
  }, [products, qty]);

  const subtotal = useMemo(() => selectedLines.reduce((a, l) => a + l.lineTotal, 0), [selectedLines]);
  const discountAmount = useMemo(() => {
    const perc = Math.max(0, Math.min(100, Number(discountPercentage || 0)));
    return (subtotal * perc) / 100;
  }, [subtotal, discountPercentage]);

  const total = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);

  const inc = (productId: string) => setQty((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  const dec = (productId: string) =>
    setQty((prev) => ({ ...prev, [productId]: Math.max(0, (prev[productId] || 0) - 1) }));

  const createOrder = async () => {
    if (!user || !profileId) return;

    if (!pickupLocationId) {
      toast({ title: "Fout", description: "Kies een afhaallocatie", variant: "destructive" });
      return;
    }

    if (selectedLines.length === 0) {
      toast({ title: "Fout", description: "Kies minimaal één product", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    // 1) order insert
    const { data: orderData, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id: profileId,
        weekly_menu_id: null,
        status: "confirmed",
        notes: notes.trim() || null,
        subtotal: subtotal,
        discount_amount: discountAmount,
        total: total,
        created_by: user.id,
        pickup_location_id: pickupLocationId,
      })
      .select("id, order_number, total")
      .single();

    if (orderErr || !orderData) {
      console.error(orderErr);
      toast({ title: "Fout", description: "Kon bestelling niet aanmaken", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // 2) items insert
    const itemsPayload = selectedLines.map((l) => ({
      order_id: orderData.id,
      product_id: l.product.id,
      quantity: l.quantity,
      unit_price: l.product.selling_price,
      discount_amount: 0,
      total: l.lineTotal,
      is_weekly_menu_item: false,
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);

    if (itemsErr) {
      console.error(itemsErr);
      toast({
        title: "Let op",
        description: "Bestelling is aangemaakt, maar items konden niet worden opgeslagen.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    toast({
      title: "Bestelling geplaatst",
      description: `Order #${orderData.order_number} is aangemaakt.`,
    });

    // reset UI
    setQty({});
    setNotes("");

    setSubmitting(false);
    onOrderCreated?.();
  };

  const paymentLink = useMemo(() => {
    // fallback link format consistent with your app
    const amount = Number(total || 0).toFixed(2);
    return `https://bunq.me/BosgoedtBakery/${amount}/`;
  }, [total]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShoppingBag className="w-4 h-4 text-muted-foreground" />
        <div className="text-sm font-medium text-foreground">Losse producten</div>
        <div className="text-xs text-muted-foreground">— selecteer wat je wil meenemen</div>
      </div>

      {/* Products list (minimal, airy) */}
      <div className="divide-y divide-border/40">
        {products.map((p) => {
          const value = Number(qty[p.id] || 0);
          return (
            <div key={p.id} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-foreground truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{formatCurrency(p.selling_price)}</div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => dec(p.id)} disabled={value <= 0}>
                  <Minus className="w-4 h-4" />
                </Button>

                <div className="w-8 text-center text-sm tabular-nums">{value}</div>

                <Button variant="outline" size="icon" onClick={() => inc(p.id)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Pickup + Notes */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Afhaallocatie</Label>
          <Select value={pickupLocationId} onValueChange={setPickupLocationId}>
            <SelectTrigger>
              <SelectValue placeholder="Kies afhaallocatie" />
            </SelectTrigger>
            <SelectContent>
              {pickupLocations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.title} — {l.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Opmerkingen</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optioneel (bv. ‘graag gesneden’)"
            rows={2}
          />
        </div>
      </div>

      <Separator />

      {/* Summary (clean) */}
      <div className="space-y-2">
        <div className="text-sm font-medium">Overzicht</div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotaal</span>
          <span className="tabular-nums">{formatCurrency(subtotal)}</span>
        </div>

        {discountAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Korting</span>
            <span className="tabular-nums">-{formatCurrency(discountAmount)}</span>
          </div>
        )}

        <div className="flex justify-between text-base font-semibold pt-2">
          <span>Totaal</span>
          <span className="tabular-nums">{formatCurrency(total)}</span>
        </div>

        <div className="pt-3 flex flex-col sm:flex-row gap-2">
          <Button onClick={createOrder} disabled={submitting} className="sm:flex-1">
            {submitting ? "Bezig..." : "Bestelling plaatsen"}
          </Button>

          {/* optioneel: payment link, je kunt dit ook later pas tonen */}
          <Button
            variant="outline"
            onClick={() => window.open(paymentLink, "_blank")}
            className="sm:w-auto"
            disabled={total <= 0}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Betalen
          </Button>
        </div>
      </div>
    </div>
  );
}
