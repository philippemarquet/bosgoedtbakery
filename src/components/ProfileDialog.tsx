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
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  country: string;
}

interface ProfileDialogProps {
  onProfileUpdate?: (name: string) => void;
}

const ProfileDialog = ({ onProfileUpdate }: ProfileDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "",
    phone: "",
    street: "",
    house_number: "",
    postal_code: "",
    city: "",
    country: "Nederland",
  });
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchProfile = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, street, house_number, postal_code, city, country")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      setProfile({
        full_name: data?.full_name || "",
        phone: data?.phone || "",
        street: data?.street || "",
        house_number: data?.house_number || "",
        postal_code: data?.postal_code || "",
        city: data?.city || "",
        country: data?.country || "Nederland",
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
    const trimmedData = {
      full_name: profile.full_name.trim(),
      phone: profile.phone.trim(),
      street: profile.street.trim(),
      house_number: profile.house_number.trim(),
      postal_code: profile.postal_code.trim(),
      city: profile.city.trim(),
      country: profile.country.trim(),
    };

    if (trimmedData.full_name.length > 100) {
      toast({
        title: "Fout",
        description: "Naam mag maximaal 100 tekens zijn",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedData.full_name || null,
          phone: trimmedData.phone || null,
          street: trimmedData.street || null,
          house_number: trimmedData.house_number || null,
          postal_code: trimmedData.postal_code || null,
          city: trimmedData.city || null,
          country: trimmedData.country || null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Opgeslagen",
        description: "Je profiel is bijgewerkt",
      });
      
      // Notify parent of name change
      if (onProfileUpdate) {
        onProfileUpdate(trimmedData.full_name);
      }
      
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

            {/* Address fields */}
            <div className="pt-2 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-3">Adresgegevens</p>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="street">Straat</Label>
                  <Input
                    id="street"
                    value={profile.street}
                    onChange={(e) => setProfile({ ...profile, street: e.target.value })}
                    placeholder="Bakkerstraat"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="house_number">Huisnr.</Label>
                  <Input
                    id="house_number"
                    value={profile.house_number}
                    onChange={(e) => setProfile({ ...profile, house_number: e.target.value })}
                    placeholder="12a"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postcode</Label>
                  <Input
                    id="postal_code"
                    value={profile.postal_code}
                    onChange={(e) => setProfile({ ...profile, postal_code: e.target.value })}
                    placeholder="1234 AB"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Stad</Label>
                  <Input
                    id="city"
                    value={profile.city}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    placeholder="Amsterdam"
                    maxLength={50}
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <Label htmlFor="country">Land</Label>
                <Input
                  id="country"
                  value={profile.country}
                  onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                  placeholder="Nederland"
                  maxLength={50}
                />
              </div>
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
