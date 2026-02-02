import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import heroBread from "@/assets/hero-bread.jpg";
import { ArrowLeft, Mail, KeyRound, Eye, EyeOff } from "lucide-react";

type LoginStep = "email" | "password" | "set-password";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<LoginStep>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
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

  const checkIfNeedsPasswordSetup = async (emailToCheck: string) => {
    // Check if there's a profile with this email that has password_set = false
    // We need to find the user by email first, then check their profile
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, password_set")
      .not("user_id", "is", null);

    if (error) {
      console.error("Error checking profiles:", error);
      return false;
    }

    // We can't directly query by email since profiles don't have email
    // Instead, we'll check on the password step if login fails with "Invalid login credentials"
    return false;
  };

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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      // Check if this might be a first-time login
      if (error.message === "Invalid login credentials") {
        // Try to check if user exists and needs password setup
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

        // If we get a specific error about password already set, show normal error
        // If we get user not found or needs setup, show setup option
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
          // User exists but hasn't set password - show setup screen
          setNeedsPasswordSetup(true);
          setStep("set-password");
          setPassword("");
          toast({
            title: "Welkom!",
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
      title: "Welkom terug!",
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

    // Call edge function to set password
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

    // Now sign in with the new password
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
      title: "Welkom!",
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
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero image */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-background/20 to-transparent z-10" />
        <img
          src={heroBread}
          alt="Artisanal sourdough bread"
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-12 left-12 z-20 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          <p className="bakery-subtitle text-card mb-3 drop-shadow-lg">
            Ambachtelijk • Vers • Met Liefde
          </p>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex flex-col justify-center px-8 sm:px-12 lg:px-16 xl:px-20 bg-background">
        <div className="max-w-md w-full mx-auto">
          {/* Logo / Brand */}
          <div className="mb-12 animate-fade-in">
            <h1 className="bakery-title text-foreground mb-3">
              Bosgoedt
            </h1>
            <p className="bakery-subtitle text-muted-foreground">
              Bakery
            </p>
          </div>

          {/* Mobile hero image */}
          <div className="lg:hidden mb-8 rounded-lg overflow-hidden animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <img
              src={heroBread}
              alt="Artisanal sourdough bread"
              className="w-full h-48 object-cover"
            />
          </div>

          {/* Step: Email */}
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                  E-mailadres
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bakery-input w-full pl-10"
                    placeholder="naam@email.nl"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="bakery-button-primary w-full animate-fade-in"
                style={{ animationDelay: "0.3s" }}
              >
                Doorgaan
              </button>
            </form>
          )}

          {/* Step: Password */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="animate-fade-in">
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Terug
                </button>
                
                <div className="p-3 bg-muted/50 rounded-lg border mb-6">
                  <p className="text-sm text-muted-foreground">Inloggen als</p>
                  <p className="font-medium text-foreground">{email}</p>
                </div>
              </div>

              <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                  Wachtwoord
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bakery-input w-full pl-10 pr-10"
                    placeholder="••••••••"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="bakery-button-primary w-full animate-fade-in disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ animationDelay: "0.2s" }}
              >
                {isLoading ? "Bezig met inloggen..." : "Inloggen"}
              </button>

              <p className="text-center text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: "0.3s" }}>
                Eerste keer inloggen? Voer je wachtwoord in om je account te activeren.
              </p>
            </form>
          )}

          {/* Step: Set Password (first time) */}
          {step === "set-password" && (
            <form onSubmit={handleSetPassword} className="space-y-6">
              <div className="animate-fade-in">
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Terug
                </button>
                
                <div className="p-3 bg-muted/50 rounded-lg border mb-6">
                  <p className="text-sm text-muted-foreground">Account activeren voor</p>
                  <p className="font-medium text-foreground">{email}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
                  <label htmlFor="new-password" className="block text-sm font-medium text-foreground mb-2">
                    Kies een wachtwoord
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bakery-input w-full pl-10 pr-10"
                      placeholder="Minimaal 6 tekens"
                      autoFocus
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-2">
                    Bevestig wachtwoord
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bakery-input w-full pl-10"
                      placeholder="Herhaal wachtwoord"
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="bakery-button-primary w-full animate-fade-in disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ animationDelay: "0.3s" }}
              >
                {isLoading ? "Bezig met activeren..." : "Account activeren"}
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-border animate-fade-in" style={{ animationDelay: "0.6s" }}>
            <p className="text-center text-sm text-muted-foreground">
              Nog geen account?{" "}
              <button className="text-primary hover:underline font-medium">
                Neem contact op
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
