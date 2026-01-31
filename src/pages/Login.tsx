import { useState } from "react";
import { useNavigate } from "react-router-dom";
import heroBread from "@/assets/hero-bread.jpg";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // TODO: Implement actual authentication with Supabase
    // For now, simulate login
    setTimeout(() => {
      setIsLoading(false);
      // Navigate to dashboard (will implement role-based routing later)
      navigate("/dashboard");
    }, 1000);
  };

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

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                E-mailadres
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bakery-input w-full"
                placeholder="naam@email.nl"
                required
              />
            </div>

            <div className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Wachtwoord
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bakery-input w-full"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex items-center justify-between animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-muted-foreground">Onthoud mij</span>
              </label>
              <button type="button" className="text-sm text-primary hover:underline">
                Wachtwoord vergeten?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bakery-button-primary w-full animate-fade-in disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ animationDelay: "0.5s" }}
            >
              {isLoading ? "Bezig met inloggen..." : "Inloggen"}
            </button>
          </form>

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
