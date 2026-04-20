import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
    // 1) luister naar Supabase auth event
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // 2) fallback: tokens uit hash zelf zetten
    (async () => {
      const p = getHashParams();
      const type = p.get("type");
      const access_token = p.get("access_token");
      const refresh_token = p.get("refresh_token");

      // Supabase recovery link bevat type=recovery in de hash
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

    await supabase.auth.signOut();

    toast({
      title: "Wachtwoord aangepast",
      description: "Log opnieuw in met je nieuwe wachtwoord.",
    });

    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <p className="bakery-eyebrow mb-3">Account</p>
          <h1
            className="font-serif text-foreground text-4xl md:text-5xl font-medium leading-tight mb-3"
            style={{ letterSpacing: "-0.02em" }}
          >
            Nieuw wachtwoord
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Kies een nieuw wachtwoord voor je account.
          </p>
        </div>

        {!ready ? (
          <div className="paper-card px-5 py-6 text-center">
            <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
            <p className="text-sm text-muted-foreground">Reset-link verwerken…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="paper-card px-6 py-7 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nieuw wachtwoord</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                placeholder="Minimaal 6 tekens"
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Bevestig wachtwoord</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Herhaal wachtwoord"
                required
                className="h-11"
              />
            </div>

            <Button type="submit" size="lg" disabled={isLoading} className="w-full">
              {isLoading ? "Opslaan…" : "Wachtwoord opslaan"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
