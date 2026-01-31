import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";
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

const AddCustomerDialog = ({ open, onOpenChange, onCustomerAdded }: AddCustomerDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
  });
  const { toast } = useToast();

  const handleSave = async () => {
    if (!formData.email.trim() || !formData.password.trim()) {
      toast({ title: "Fout", description: "E-mail en wachtwoord zijn verplicht", variant: "destructive" });
      return;
    }

    if (formData.password.length < 6) {
      toast({ title: "Fout", description: "Wachtwoord moet minimaal 6 tekens zijn", variant: "destructive" });
      return;
    }

    setLoading(true);

    // Create user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email.trim(),
      password: formData.password,
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
    toast({ title: "Succes", description: "Nieuwe klant toegevoegd" });
    setFormData({ email: "", password: "", full_name: "", phone: "" });
    onOpenChange(false);
    onCustomerAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Nieuwe klant toevoegen
          </DialogTitle>
          <DialogDescription>
            Maak een account aan voor een nieuwe klant. De klant ontvangt een bevestigingsmail.
          </DialogDescription>
        </DialogHeader>

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
            <Label htmlFor="password">Wachtwoord *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Minimaal 6 tekens"
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Aanmaken..." : "Klant toevoegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerDialog;
