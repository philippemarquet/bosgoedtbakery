import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

function getHashParams() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash);
}

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // 1) Luister naar auth events (Supabase kan PASSWORD_RECOVERY emitten)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // 2) Fallback: tokens uit URL-hash zetten als session
    (async () => {
      const p = getHashParams();
      const type = p.get("type");
      const access_token = p.get("access_token");
      const refresh_token = p.get("refresh_token");

      // Alleen bij recovery links
      if (type !== "recovery" || !access_token) return;

      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token: refresh_token || "",
      });

      if (error) {
        toast({
          title: "Reset-link ongeldig of verlopen",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setReady(true);
    })();

    return () => sub.subscription.unsubscribe();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: "Wachtwoord te kort",
        description: "Gebruik minimaal 6 tekens.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirm) {
      toast({
        title: "Komt niet overeen",
        description: "Wachtwoorden komen niet overeen.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setIsLoading(false);

    if (error) {
      toast({
        title: "Reset mislukt",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Optioneel (maar fijn): user uitloggen en laten inloggen met nieuw wachtwoord
    await supabase.auth.signOut();

    toast({
      title: "Wachtwoord aangepast",
      description: "Log opnieuw in met je nieuwe wachtwoord.",
    });

    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <h1 className="bakery-title text-foreground mb-2">Nieuw wachtwoord</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Kies een nieuw wachtwoord voor je account.
        </p>

        {!ready ? (
          <div className="p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
            Reset-link verwerken…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Nieuw wachtwoord
              </label>
              <input
                type="password"
                className="bakery-input w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Bevestig wachtwoord
              </label>
              <input
                type="password"
                className="bakery-input w-full"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bakery-button-primary w-full disabled:opacity-50"
            >
              {isLoading ? "Opslaan..." : "Wachtwoord opslaan"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
