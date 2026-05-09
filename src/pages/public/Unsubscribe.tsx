import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "ok" | "invalid" | "missing">(
    token ? "loading" : "missing",
  );

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.rpc("unsubscribe_via_token", { p_token: token });
      if (error) {
        setState("invalid");
        return;
      }
      const success = (data as { success?: boolean } | null)?.success;
      setState(success ? "ok" : "invalid");
    })();
  }, [token]);

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center space-y-5">
        {state === "loading" && <p className="text-muted-foreground">Bezig met uitschrijven…</p>}

        {state === "missing" && (
          <>
            <h1 className="font-serif text-2xl">Geen geldige link</h1>
            <p className="text-foreground/80">
              Deze pagina opent normaal vanuit een mail.{" "}
              <a href="mailto:bakery@bosgoedt.be" className="underline">
                Mail ons
              </a>{" "}
              als er iets niet klopt.
            </p>
          </>
        )}

        {state === "ok" && (
          <>
            <h1 className="font-serif text-2xl">Je bent uitgeschreven</h1>
            <p className="text-foreground/80">We hopen je later weer te zien!</p>
            <Button asChild>
              <Link to="/aanmelden">Toch weer aanmelden →</Link>
            </Button>
          </>
        )}

        {state === "invalid" && (
          <>
            <h1 className="font-serif text-2xl">Deze link is niet (meer) geldig</h1>
            <p className="text-foreground/80">
              Misschien ben je al uitgeschreven.{" "}
              <a href="mailto:bakery@bosgoedt.be" className="underline">
                Mail ons
              </a>{" "}
              als je hulp nodig hebt.
            </p>
          </>
        )}
      </div>
    </PublicLayout>
  );
};

export default Unsubscribe;
