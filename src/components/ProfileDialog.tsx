import { useState, useEffect } from "react";
import { User as UserIcon, Lock, Eye, EyeOff } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  user: User | null;
  onProfileUpdate?: (name: string) => void;
}

const ProfileDialog = ({ user, onProfileUpdate }: ProfileDialogProps) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
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
  
  // Password change state
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
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
      setActiveTab("profile");
      setPasswordData({ newPassword: "", confirmPassword: "" });
    }
  }, [open, user]);

  const handleSaveProfile = async () => {
    if (!user) return;

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

  const handleChangePassword = async () => {
    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Fout",
        description: "Wachtwoord moet minimaal 6 tekens zijn",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Fout",
        description: "Wachtwoorden komen niet overeen",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Je wachtwoord is gewijzigd",
      });
      
      setPasswordData({ newPassword: "", confirmPassword: "" });
      setActiveTab("profile");
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: "Fout",
        description: error.message || "Kon wachtwoord niet wijzigen",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          title="Profiel bewerken"
        >
          <UserIcon className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Mijn Account</DialogTitle>
          <DialogDescription>
            Beheer je profiel en wachtwoord
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Laden...</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <UserIcon className="w-4 h-4" />
                Profiel
              </TabsTrigger>
              <TabsTrigger value="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Wachtwoord
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 pt-4">
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
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                >
                  {isSaving ? "Opslaan..." : "Opslaan"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="password" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nieuw wachtwoord</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    placeholder="Minimaal 6 tekens"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Bevestig wachtwoord</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Herhaal je wachtwoord"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isChangingPassword}
                >
                  Annuleren
                </Button>
                <Button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                >
                  {isChangingPassword ? "Wijzigen..." : "Wachtwoord wijzigen"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;
