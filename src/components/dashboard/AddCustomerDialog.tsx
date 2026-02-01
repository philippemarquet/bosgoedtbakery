import { useState } from "react";
import { UserPlus, Copy, Check } from "lucide-react";
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
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    phone: "",
  });
  const { toast } = useToast();

  const handleSave = async () => {
    if (!formData.email.trim()) {
      toast({ title: "Fout", description: "E-mail is verplicht", variant: "destructive" });
      return;
    }

    setLoading(true);

    // Generate temporary password
    const tempPassword = generateTempPassword();

    // Create user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email.trim(),
      password: tempPassword,
      options: {
        data: {
          full_name: formData.full_name.trim() || null,
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

    // Update profile with phone if provided
    if (formData.phone.trim()) {
      await supabase
        .from("profiles")
        .update({ 
          phone: formData.phone.trim(),
          full_name: formData.full_name.trim() || null,
        })
        .eq("user_id", authData.user.id);
    }

    // Assign customer role
    await supabase.from("user_roles").insert({
      user_id: authData.user.id,
      role: "customer",
    });

    setLoading(false);
    setCreatedPassword(tempPassword);
    toast({ title: "Succes", description: "Nieuwe klant toegevoegd" });
  };

  const handleCopyPassword = async () => {
    if (createdPassword) {
      await navigator.clipboard.writeText(createdPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setFormData({ email: "", full_name: "", phone: "" });
    setCreatedPassword(null);
    setCopied(false);
    onOpenChange(false);
    if (createdPassword) {
      onCustomerAdded();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {createdPassword ? "Klant aangemaakt" : "Nieuwe klant toevoegen"}
          </DialogTitle>
          <DialogDescription>
            {createdPassword 
              ? "De klant is aangemaakt. Geef het tijdelijke wachtwoord door aan de klant."
              : "Maak een account aan voor een nieuwe klant."
            }
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
            <div className="space-y-2">
              <Label htmlFor="full_name">Naam</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Volledige naam"
              />
            </div>

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
