import { useState, useEffect } from "react";
import { UserPlus, Edit, Mail, KeyRound, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

interface CustomerData {
  profile_id: string;
  user_id: string | null;
  full_name: string | null;
  phone: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  discount_percentage: number;
}

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerSaved: () => void;
  customer?: CustomerData | null; // If provided, we're editing
}

const CustomerDialog = ({ open, onOpenChange, onCustomerSaved, customer }: CustomerDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [withLogin, setWithLogin] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    phone: "",
    street: "",
    house_number: "",
    postal_code: "",
    city: "",
    discount_percentage: 0,
  });
  const { toast } = useToast();

  const isEditing = !!customer;
  const hasExistingLogin = !!customer?.user_id;

  // Reset form when dialog opens/closes or customer changes
  useEffect(() => {
    if (open && customer) {
      setFormData({
        email: "",
        full_name: customer.full_name || "",
        phone: customer.phone || "",
        street: customer.street || "",
        house_number: customer.house_number || "",
        postal_code: customer.postal_code || "",
        city: customer.city || "",
        discount_percentage: customer.discount_percentage || 0,
      });
      setWithLogin(!!customer.user_id);
    } else if (open && !customer) {
      setFormData({
        email: "",
        full_name: "",
        phone: "",
        street: "",
        house_number: "",
        postal_code: "",
        city: "",
        discount_percentage: 0,
      });
      setWithLogin(false);
    }
  }, [open, customer]);

  const handleSave = async () => {
    // Validate required fields
    if (!formData.full_name.trim()) {
      toast({ title: "Fout", description: "Naam is verplicht", variant: "destructive" });
      return;
    }

    // Phone is required for WhatsApp messaging
    if (!formData.phone.trim()) {
      toast({ title: "Fout", description: "Telefoonnummer is verplicht", variant: "destructive" });
      return;
    }

    // If enabling login for the first time, email is required
    if (withLogin && !hasExistingLogin && !formData.email.trim()) {
      toast({ title: "Fout", description: "E-mail is verplicht voor klanten met inlog", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      if (isEditing) {
        // Update existing customer
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            full_name: formData.full_name.trim(),
            phone: formData.phone.trim() || null,
            street: formData.street.trim() || null,
            house_number: formData.house_number.trim() || null,
            postal_code: formData.postal_code.trim() || null,
            city: formData.city.trim() || null,
            discount_percentage: formData.discount_percentage,
          })
          .eq("id", customer.profile_id);

        if (updateError) throw updateError;

        // If enabling login for existing customer without login
        if (withLogin && !hasExistingLogin && formData.email.trim()) {
          const { data: session } = await supabase.auth.getSession();
          
          const response = await supabase.functions.invoke("create-auth-user", {
            body: {
              email: formData.email.trim(),
              full_name: formData.full_name.trim(),
              profile_id: customer.profile_id,
            },
          });

          if (response.error) {
            toast({ 
              title: "Waarschuwing", 
              description: `Profiel bijgewerkt, maar inlog aanmaken mislukt: ${response.error.message}`,
              variant: "destructive" 
            });
          } else {
            toast({ title: "Succes", description: "Klant bijgewerkt en inlog aangemaakt" });
          }
        } else {
          toast({ title: "Succes", description: "Klant bijgewerkt" });
        }
      } else {
        // Create new customer
        if (withLogin) {
          // Create with login via edge function
          const response = await supabase.functions.invoke("create-auth-user", {
            body: {
              email: formData.email.trim(),
              full_name: formData.full_name.trim(),
            },
          });

          if (response.error) {
            toast({ title: "Fout", description: response.error.message, variant: "destructive" });
            setLoading(false);
            return;
          }

          const newUserId = response.data.user_id;

          // Update the profile with additional info (profile is auto-created by trigger)
          await supabase
            .from("profiles")
            .update({
              phone: formData.phone.trim() || null,
              street: formData.street.trim() || null,
              house_number: formData.house_number.trim() || null,
              postal_code: formData.postal_code.trim() || null,
              city: formData.city.trim() || null,
              discount_percentage: formData.discount_percentage,
            })
            .eq("user_id", newUserId);

          toast({ title: "Succes", description: "Klant met inlog toegevoegd" });
        } else {
          // Create without login - just a profile
          const { error: profileError } = await supabase.from("profiles").insert({
            user_id: null,
            full_name: formData.full_name.trim(),
            phone: formData.phone.trim() || null,
            street: formData.street.trim() || null,
            house_number: formData.house_number.trim() || null,
            postal_code: formData.postal_code.trim() || null,
            city: formData.city.trim() || null,
            discount_percentage: formData.discount_percentage,
          });

          if (profileError) throw profileError;

          toast({ title: "Succes", description: "Klant zonder inlog toegevoegd" });
        }
      }

      onCustomerSaved();
      handleClose();
    } catch (error) {
      console.error("Error saving customer:", error);
      toast({ title: "Fout", description: "Er is iets misgegaan", variant: "destructive" });
    }

    setLoading(false);
  };

  const handleClose = () => {
    setFormData({
      email: "",
      full_name: "",
      phone: "",
      street: "",
      house_number: "",
      postal_code: "",
      city: "",
      discount_percentage: 0,
    });
    setWithLogin(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Edit className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            {isEditing ? "Klant bewerken" : "Nieuwe klant toevoegen"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Pas de gegevens van deze klant aan."
              : "Voeg een nieuwe klant toe aan het systeem."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Login toggle - only show if not already having a login */}
          {!hasExistingLogin && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-3">
                {withLogin ? (
                  <KeyRound className="w-5 h-5 text-primary" />
                ) : (
                  <User className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {withLogin ? "Met inlog" : "Zonder inlog"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {withLogin
                      ? "Klant kan zelf inloggen"
                      : "Alleen voor handmatige bestellingen"}
                  </p>
                </div>
              </div>
              <Switch checked={withLogin} onCheckedChange={setWithLogin} />
            </div>
          )}

          {/* Show existing login status */}
          {hasExistingLogin && (
            <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <Mail className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-primary">Heeft inlog</p>
                <p className="text-xs text-muted-foreground">
                  Deze klant kan zelf inloggen
                </p>
              </div>
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="full_name">Naam *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Volledige naam"
            />
          </div>

          {/* Email - only for new login */}
          {withLogin && !hasExistingLogin && (
            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="klant@voorbeeld.nl"
              />
              <p className="text-xs text-muted-foreground">
                De klant kan bij de eerste login een wachtwoord instellen via "Wachtwoord vergeten".
              </p>
            </div>
          )}

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Telefoonnummer *</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+31612345678"
            />
            <p className="text-xs text-muted-foreground">
              Gebruik internationaal formaat (bijv. +31612345678) voor WhatsApp.
            </p>
          </div>

          {/* Address fields */}
          <div className="space-y-2">
            <Label>Adres</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                className="col-span-2"
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                placeholder="Straat"
              />
              <Input
                value={formData.house_number}
                onChange={(e) => setFormData({ ...formData, house_number: e.target.value })}
                placeholder="Nr."
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                placeholder="Postcode"
              />
              <Input
                className="col-span-2"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Plaats"
              />
            </div>
          </div>

          {/* Discount Percentage */}
          <div className="space-y-2">
            <Label htmlFor="discount_percentage">Vaste korting (%)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="discount_percentage"
                type="number"
                min="0"
                max="100"
                value={formData.discount_percentage}
                onChange={(e) => setFormData({ ...formData, discount_percentage: Math.min(100, Math.max(0, Number(e.target.value))) })}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Deze korting wordt automatisch toegepast op alle bestellingen van deze klant.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Opslaan..." : isEditing ? "Opslaan" : "Klant toevoegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDialog;
