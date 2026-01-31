import { useState, useEffect } from "react";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileData {
  full_name: string;
  phone: string;
  address: string;
}

const ProfileDialog = () => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "",
    phone: "",
    address: "",
  });
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchProfile = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, address")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      setProfile({
        full_name: data?.full_name || "",
        phone: data?.phone || "",
        address: data?.address || "",
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchProfile();
    }
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;

    // Basic validation
    const trimmedName = profile.full_name.trim();
    const trimmedPhone = profile.phone.trim();
    const trimmedAddress = profile.address.trim();

    if (trimmedName.length > 100) {
      toast({
        title: "Fout",
        description: "Naam mag maximaal 100 tekens zijn",
        variant: "destructive",
      });
      return;
    }

    if (trimmedPhone.length > 20) {
      toast({
        title: "Fout",
        description: "Telefoonnummer mag maximaal 20 tekens zijn",
        variant: "destructive",
      });
      return;
    }

    if (trimmedAddress.length > 255) {
      toast({
        title: "Fout",
        description: "Adres mag maximaal 255 tekens zijn",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedName || null,
          phone: trimmedPhone || null,
          address: trimmedAddress || null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Opgeslagen",
        description: "Je profiel is bijgewerkt",
      });
      setOpen(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Fout",
        description: "Kon profiel niet opslaan",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          title="Profiel bewerken"
        >
          <User className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Mijn Profiel</DialogTitle>
          <DialogDescription>
            Bewerk hier je persoonlijke gegevens
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Laden...</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres</Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                E-mailadres kan niet worden gewijzigd
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Volledige naam</Label>
              <Input
                id="full_name"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Jan Jansen"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefoonnummer</Label>
              <Input
                id="phone"
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+31 6 12345678"
                maxLength={20}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adres</Label>
              <Input
                id="address"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="Straatnaam 123, 1234 AB Plaats"
                maxLength={255}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSaving}
              >
                Annuleren
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;
