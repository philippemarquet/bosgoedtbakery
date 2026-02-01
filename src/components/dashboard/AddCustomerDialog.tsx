import { useState } from "react";
import { UserPlus, Copy, Check, User, KeyRound } from "lucide-react";
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

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerAdded: () => void;
}

// Generate a random temporary password
const generateTempPassword = () => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const AddCustomerDialog = ({ open, onOpenChange, onCustomerAdded }: AddCustomerDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [withLogin, setWithLogin] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    phone: "",
    street: "",
    house_number: "",
    postal_code: "",
    city: "",
  });
  const { toast } = useToast();

  const handleSave = async () => {
    // Validate required fields
    if (!formData.full_name.trim()) {
      toast({ title: "Fout", description: "Naam is verplicht", variant: "destructive" });
      return;
    }

    if (withLogin && !formData.email.trim()) {
      toast({ title: "Fout", description: "E-mail is verplicht voor klanten met inlog", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      if (withLogin) {
        // Create user with Supabase Auth
        const tempPassword = generateTempPassword();

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email.trim(),
          password: tempPassword,
          options: {
            data: {
              full_name: formData.full_name.trim(),
            },
          },
        });

        if (authError) {
          toast({ title: "Fout", description: authError.message, variant: "destructive" });
          setLoading(false);
          return;
        }

        if (!authData.user) {
          toast({ title: "Fout", description: "Kon gebruiker niet aanmaken", variant: "destructive" });
          setLoading(false);
          return;
        }

        // Update profile with additional info
        await supabase
          .from("profiles")
          .update({
            phone: formData.phone.trim() || null,
            full_name: formData.full_name.trim(),
            street: formData.street.trim() || null,
            house_number: formData.house_number.trim() || null,
            postal_code: formData.postal_code.trim() || null,
            city: formData.city.trim() || null,
          })
          .eq("user_id", authData.user.id);

        // Assign customer role
        await supabase.from("user_roles").insert({
          user_id: authData.user.id,
          role: "customer",
        });

        setCreatedPassword(tempPassword);
        toast({ title: "Succes", description: "Nieuwe klant met inlog toegevoegd" });
      } else {
        // Create profile without auth user
        const { error: profileError } = await supabase.from("profiles").insert({
          user_id: null,
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          street: formData.street.trim() || null,
          house_number: formData.house_number.trim() || null,
          postal_code: formData.postal_code.trim() || null,
          city: formData.city.trim() || null,
        });

        if (profileError) {
          toast({ title: "Fout", description: profileError.message, variant: "destructive" });
          setLoading(false);
          return;
        }

        toast({ title: "Succes", description: "Nieuwe klant zonder inlog toegevoegd" });
        onCustomerAdded();
        handleClose();
      }
    } catch (error) {
      console.error("Error creating customer:", error);
      toast({ title: "Fout", description: "Er is iets misgegaan", variant: "destructive" });
    }

    setLoading(false);
  };

  const handleCopyPassword = async () => {
    if (createdPassword) {
      await navigator.clipboard.writeText(createdPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
    });
    setCreatedPassword(null);
    setCopied(false);
    setWithLogin(false);
    onOpenChange(false);
    if (createdPassword) {
      onCustomerAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {createdPassword ? "Klant aangemaakt" : "Nieuwe klant toevoegen"}
          </DialogTitle>
          <DialogDescription>
            {createdPassword
              ? "De klant is aangemaakt. Geef het tijdelijke wachtwoord door aan de klant."
              : "Voeg een nieuwe klant toe aan het systeem."}
          </DialogDescription>
        </DialogHeader>

        {createdPassword ? (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">E-mailadres</p>
                <p className="font-medium">{formData.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tijdelijk wachtwoord</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-background rounded border text-lg font-mono">
                    {createdPassword}
                  </code>
                  <Button variant="outline" size="icon" onClick={handleCopyPassword}>
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              De klant kan dit wachtwoord wijzigen via het profiel-icoon na inloggen.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Login toggle */}
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

            {/* Email - only required with login */}
            {withLogin && (
              <div className="space-y-2">
                <Label htmlFor="email">E-mailadres *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="klant@voorbeeld.nl"
                />
              </div>
            )}

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Telefoonnummer</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="06-12345678"
              />
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
          </div>
        )}

        <DialogFooter>
          {createdPassword ? (
            <Button onClick={handleClose}>Sluiten</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Annuleren
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Aanmaken..." : "Klant toevoegen"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerDialog;
