import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import heroBread from "@/assets/hero-bread.jpg";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { signIn, signOut, user, isLoading: authLoading, isBaker } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user && isBaker) {
      navigate("/dashboard");
    }
  }, [user, authLoading, isBaker, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setIsLoading(true);

    const { error } = await signIn(email.trim(), password);
    if (error) {
      toast({
        title: "Inloggen mislukt",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Wacht heel kort en check rol
    setTimeout(async () => {
      const { data } = await import("@/integrations/supabase/client").then((m) => m.supabase.auth.getUser());
      const uid = data.user?.id;
      if (!uid) return;
      const { data: roleRow } = await import("@/integrations/supabase/client").then((m) =>
        m.supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "baker").maybeSingle()
      );
      if (!roleRow) {
        await signOut();
        toast({
          title: "Geen toegang",
          description: "Dit account heeft geen toegang tot de backoffice.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      toast({ title: "Welkom terug" });
      navigate("/dashboard");
    }, 200);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border border-foreground/20 border-t-foreground/70 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        <img src={heroBread} alt="Brood" className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, hsl(var(--ink) / 0.55), transparent 70%)" }}
        />
        <div className="absolute bottom-12 left-12 right-12 z-10">
          <p className="font-serif text-background text-3xl leading-snug max-w-lg">
            Brood dat de tijd krijgt — stil rijzend, op hout gebakken.
          </p>
        </div>
      </div>

      <div className="relative w-full lg:w-1/2 xl:w-[45%] flex flex-col justify-center px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-12">
            <p className="bakery-eyebrow mb-4">Bakkerij</p>
            <h1 className="font-serif text-foreground text-5xl md:text-6xl leading-[0.95] font-medium" style={{ letterSpacing: "-0.025em" }}>
              Bosgoedt
            </h1>
            <div className="mt-6 flex items-center gap-3">
              <span className="h-px w-10 bg-border" />
              <span className="text-sm text-muted-foreground tracking-[0.12em] uppercase">Backoffice</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@email.nl"
                required
                autoFocus
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Wachtwoord</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label="Toon wachtwoord"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" disabled={isLoading} className="w-full">
              {isLoading ? "Bezig…" : "Inloggen"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
