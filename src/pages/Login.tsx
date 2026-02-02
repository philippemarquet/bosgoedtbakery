import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import heroBread from "@/assets/hero-bread.jpg";
import { ArrowLeft, Mail, KeyRound } from "lucide-react";

type LoginStep = "email" | "password" | "reset-sent";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<LoginStep>("email");
  const [isLoading, setIsLoading] = useState(false);
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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: "Inloggen mislukt",
        description: error.message === "Invalid login credentials" 
          ? "Ongeldige inloggegevens. Controleer je wachtwoord of vraag een nieuw wachtwoord aan."
          : error.message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: "Welkom terug!",
      description: "Je bent succesvol ingelogd.",
    });

    // Navigation will happen via useEffect when role is loaded
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({
        title: "Fout",
        description: "Vul eerst je e-mailadres in",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard`,
    });

    setIsLoading(false);

    if (error) {
      toast({
        title: "Fout",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setStep("reset-sent");
  };

  const handleBackToEmail = () => {
    setStep("email");
    setPassword("");
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
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bakery-input w-full pl-10"
                    placeholder="••••••••"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-muted-foreground">Onthoud mij</span>
                </label>
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                  className="text-sm text-primary hover:underline disabled:opacity-50"
                >
                  Wachtwoord vergeten?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="bakery-button-primary w-full animate-fade-in disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ animationDelay: "0.3s" }}
              >
                {isLoading ? "Bezig met inloggen..." : "Inloggen"}
              </button>

              <p className="text-center text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: "0.4s" }}>
                Eerste keer inloggen?{" "}
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                  className="text-primary hover:underline font-medium disabled:opacity-50"
                >
                  Stel je wachtwoord in
                </button>
              </p>
            </form>
          )}

          {/* Step: Reset email sent */}
          {step === "reset-sent" && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-serif font-semibold text-foreground mb-2">
                  Controleer je e-mail
                </h2>
                <p className="text-muted-foreground">
                  We hebben een link gestuurd naar <strong>{email}</strong> om je wachtwoord in te stellen.
                </p>
              </div>

              <button
                onClick={handleBackToEmail}
                className="bakery-button-primary w-full"
              >
                Terug naar inloggen
              </button>
            </div>
          )}

          {/* Footer */}
          {step !== "reset-sent" && (
            <div className="mt-12 pt-8 border-t border-border animate-fade-in" style={{ animationDelay: "0.6s" }}>
              <p className="text-center text-sm text-muted-foreground">
                Nog geen account?{" "}
                <button className="text-primary hover:underline font-medium">
                  Neem contact op
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
