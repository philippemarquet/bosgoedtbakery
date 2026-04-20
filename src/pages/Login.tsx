import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import heroBread from "@/assets/hero-bread.jpg";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type LoginStep = "email" | "password" | "set-password";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<LoginStep>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [, setNeedsPasswordSetup] = useState(false);

  const navigate = useNavigate();
  const { signIn, user, isLoading: authLoading, isBaker, isCustomer, role } = useAuth();
  const { toast } = useToast();

  // Redirect if already logged in based on role
  useEffect(() => {
    if (!authLoading && user && role) {
      if (isBaker) {
        navigate("/dashboard");
      } else if (isCustomer) {
        navigate("/klant");
      }
    }
  }, [user, authLoading, role, isBaker, isCustomer, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        title: "Fout",
        description: "Vul je e-mailadres in",
        variant: "destructive",
      });
      return;
    }
    setStep("password");
  };

  const handleForgotPassword = async () => {
    const trimmed = email.trim();

    if (!trimmed) {
      toast({
        title: "E-mailadres ontbreekt",
        description: "Vul eerst je e-mailadres in.",
        variant: "destructive",
      });
      setStep("email");
      return;
    }

    setIsLoading(true);

    // Let op: deze route moet bestaan in je router + ook in Supabase "Additional Redirect URLs"
    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });

    setIsLoading(false);

    if (error) {
      toast({
        title: "Reset aanvragen mislukt",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Check je mailbox",
      description: "We hebben een link gestuurd om je wachtwoord te resetten.",
    });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      if (error.message === "Invalid login credentials") {
        // NB: supabase.functions.invoke kan throwen bij non-2xx; altijd afvangen om blank screen te voorkomen.
        let checkData: any = null;
        try {
          const response = await supabase.functions.invoke("set-initial-password", {
            body: { email, password: "check-only" },
          });
          checkData = response.data;
        } catch (invokeErr) {
          console.error("set-initial-password check failed:", invokeErr);
          toast({
            title: "Inloggen mislukt",
            description: "Ongeldige inloggegevens. Controleer je wachtwoord.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        if (checkData?.error === "Wachtwoord is al ingesteld. Gebruik 'Wachtwoord vergeten' om te resetten.") {
          toast({
            title: "Inloggen mislukt",
            description: "Ongeldige inloggegevens. Controleer je wachtwoord.",
            variant: "destructive",
          });
        } else if (checkData?.error === "Gebruiker niet gevonden") {
          toast({
            title: "Inloggen mislukt",
            description: "Dit e-mailadres is niet bekend.",
            variant: "destructive",
          });
        } else {
          setNeedsPasswordSetup(true);
          setStep("set-password");
          setPassword("");
          toast({
            title: "Welkom",
            description: "Stel je wachtwoord in om je account te activeren.",
          });
        }
      } else {
        toast({
          title: "Inloggen mislukt",
          description: error.message,
          variant: "destructive",
        });
      }
      setIsLoading(false);
      return;
    }

    toast({
      title: "Welkom terug",
      description: "Je bent succesvol ingelogd.",
    });
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Fout",
        description: "Wachtwoorden komen niet overeen",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Fout",
        description: "Wachtwoord moet minimaal 6 tekens zijn",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    let setData: any = null;
    try {
      const { data } = await supabase.functions.invoke("set-initial-password", {
        body: { email, password },
      });
      setData = data;
    } catch (invokeErr) {
      console.error("set-initial-password set failed:", invokeErr);
      toast({
        title: "Fout",
        description: "Kon wachtwoord niet instellen",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (setData?.error) {
      toast({
        title: "Fout",
        description: setData?.error || "Kon wachtwoord niet instellen",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const signInResult = await signIn(email, password);

    if (signInResult.error) {
      toast({
        title: "Fout",
        description: "Wachtwoord ingesteld maar inloggen mislukt. Probeer opnieuw.",
        variant: "destructive",
      });
      setStep("password");
      setIsLoading(false);
      return;
    }

    toast({
      title: "Welkom",
      description: "Je wachtwoord is ingesteld en je bent ingelogd.",
    });
  };

  const handleBackToEmail = () => {
    setStep("email");
    setPassword("");
    setConfirmPassword("");
    setNeedsPasswordSetup(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border border-foreground/20 border-t-foreground/70 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground tracking-wide">Laden…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Linkerzijde — hero */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        <img
          src={heroBread}
          alt="Ambachtelijk brood uit de oven van Bosgoedt"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Warme paper-overlay — houdt de Japandi-sfeer over de foto */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, hsl(var(--paper) / 0.35), hsl(var(--paper) / 0.05) 40%, hsl(var(--paper) / 0) 70%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, hsl(var(--ink) / 0.55), hsl(var(--ink) / 0.1) 45%, transparent 70%)",
          }}
        />

        {/* Eyebrow linksboven */}
        <div className="absolute top-10 left-10 z-10 animate-fade-in">
          <div className="flex items-center gap-3 text-background/80">
            <span className="h-px w-8 bg-background/60" />
            <span className="bakery-eyebrow text-background/80">Est · 2024</span>
          </div>
        </div>

        {/* Quote onderaan */}
        <div
          className="absolute bottom-12 left-12 right-12 z-10 animate-fade-in"
          style={{ animationDelay: "0.15s" }}
        >
          <p
            className="font-serif text-background text-[1.75rem] md:text-3xl leading-snug max-w-lg drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
            style={{ letterSpacing: "-0.01em" }}
          >
            Brood dat de tijd krijgt — stil rijzend, op hout gebakken.
          </p>
          <div className="mt-4 flex items-center gap-3 text-background/75">
            <span className="h-px w-8 bg-background/55" />
            <span className="bakery-eyebrow text-background/75">Ambacht · Geduld · Smaak</span>
          </div>
        </div>
      </div>

      {/* Rechterzijde — formulier */}
      <div className="relative w-full lg:w-1/2 xl:w-[45%] flex flex-col justify-center px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="w-full max-w-md mx-auto">
          {/* Merkregel */}
          <div className="mb-14 animate-fade-in">
            <p className="bakery-eyebrow mb-4">Bakkerij</p>
            <h1
              className="font-serif text-foreground text-[3.25rem] md:text-6xl leading-[0.95] font-medium"
              style={{ letterSpacing: "-0.025em" }}
            >
              Bosgoedt
            </h1>
            <div className="mt-6 flex items-center gap-3">
              <span className="h-px w-10 bg-border" />
              <span className="text-sm text-muted-foreground tracking-[0.12em] uppercase">
                {step === "email"
                  ? "Aanmelden"
                  : step === "password"
                    ? "Welkom terug"
                    : "Account activeren"}
              </span>
            </div>
          </div>

          {/* Mobiele hero */}
          <div
            className="lg:hidden -mx-6 mb-10 overflow-hidden animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="relative h-44">
              <img
                src={heroBread}
                alt="Ambachtelijk brood uit de oven van Bosgoedt"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, hsl(var(--ink) / 0.35), hsl(var(--ink) / 0.05) 60%, transparent)",
                }}
              />
            </div>
          </div>

          {/* Stap: e-mail */}
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-8">
              <div className="space-y-2 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <Label htmlFor="email">E-mailadres</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="naam@email.nl"
                  autoFocus
                  required
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full animate-fade-in"
                style={{ animationDelay: "0.3s" }}
              >
                Doorgaan
              </Button>
            </form>
          )}

          {/* Stap: wachtwoord */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-8">
              <div className="animate-fade-in">
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  className="group inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                  Terug
                </button>

                <div className="rounded-[var(--radius)] border border-border/70 bg-muted/40 px-4 py-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground mb-1">
                    Ingelogd als
                  </p>
                  <p className="text-sm font-medium text-foreground truncate">{email}</p>
                </div>
              </div>

              <div className="space-y-2 animate-fade-in" style={{ animationDelay: "0.1s" }}>
                <Label htmlFor="password">Wachtwoord</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    required
                    className="h-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Verberg wachtwoord" : "Toon wachtwoord"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-[calc(var(--radius)-4px)] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-3 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <Button type="submit" size="lg" disabled={isLoading} className="w-full">
                  {isLoading ? "Bezig met inloggen…" : "Inloggen"}
                </Button>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                  className="block w-full text-center text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline disabled:opacity-50 transition-colors"
                >
                  Wachtwoord vergeten?
                </button>
              </div>

              <p
                className="text-center text-xs text-muted-foreground leading-relaxed animate-fade-in"
                style={{ animationDelay: "0.3s" }}
              >
                Eerste keer inloggen? Voer je wachtwoord in om je account te activeren.
              </p>
            </form>
          )}

          {/* Stap: wachtwoord instellen */}
          {step === "set-password" && (
            <form onSubmit={handleSetPassword} className="space-y-8">
              <div className="animate-fade-in">
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  className="group inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                  Terug
                </button>

                <div className="rounded-[var(--radius)] border border-accent/40 bg-accent/5 px-4 py-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground mb-1">
                    Account activeren voor
                  </p>
                  <p className="text-sm font-medium text-foreground truncate">{email}</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2 animate-fade-in" style={{ animationDelay: "0.1s" }}>
                  <Label htmlFor="new-password">Kies een wachtwoord</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimaal 6 tekens"
                      autoFocus
                      required
                      minLength={6}
                      className="h-11 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Verberg wachtwoord" : "Toon wachtwoord"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-[calc(var(--radius)-4px)] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                  <Label htmlFor="confirm-password">Bevestig wachtwoord</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Herhaal wachtwoord"
                    required
                    className="h-11"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={isLoading}
                className="w-full animate-fade-in"
                style={{ animationDelay: "0.3s" }}
              >
                {isLoading ? "Bezig met activeren…" : "Account activeren"}
              </Button>
            </form>
          )}

          {/* Voetregel */}
          <div
            className="mt-14 pt-8 border-t border-border/70 animate-fade-in"
            style={{ animationDelay: "0.5s" }}
          >
            <p className="text-center text-xs text-muted-foreground leading-relaxed">
              Nog geen account?{" "}
              <span className="text-foreground underline-offset-4 hover:underline cursor-pointer">
                Neem contact op
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
