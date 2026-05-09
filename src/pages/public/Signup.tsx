import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import heroBread from "@/assets/hero-bread.jpg";

const SOURCE_OPTIONS = [
  { value: "popup_pickup", label: "Ophalen bij een pop-up" },
  { value: "friends_family", label: "Vrienden / familie" },
  { value: "social_media", label: "Sociale media" },
  { value: "other", label: "Anders" },
];

const schema = z.object({
  full_name: z.string().trim().min(1, "Naam is verplicht").max(120),
  email: z.string().trim().email("Ongeldig e-mailadres").max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  source: z.string().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Je moet akkoord gaan om je in te schrijven." }) }),
  // honeypot
  website: z.string().max(0).optional(),
});

const Signup = () => {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    source: "",
    consent: true,
    website: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Controleer het formulier";
      toast({ title: "Oeps", description: first, variant: "destructive" });
      return;
    }
    if (form.website) return; // bot

    setLoading(true);
    const source = form.source || "aanmeldpagina";
    const { data: subRow, error } = await supabase
      .from("subscribers")
      .insert({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        source,
        consent_marketing: true,
      })
      .select("id")
      .single();

    setLoading(false);

    if (error) {
      if (error.code === "23505" || /duplicate/i.test(error.message)) {
        setSubmitted(true);
        toast({ title: "Je bent al ingeschreven 🍞" });
        return;
      }
      toast({ title: "Er ging iets mis", description: error.message, variant: "destructive" });
      return;
    }

    // Fire-and-forget welcome mail
    if (subRow?.id) {
      void supabase.functions
        .invoke("send-welcome-email", { body: { subscriber_id: subRow.id } })
        .then((r) => r.error && console.error("welcome mail failed", r.error));
    }

    setSubmitted(true);
  };

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-[var(--radius)] overflow-hidden border border-border/60 mb-8">
          <img src={heroBread} alt="Brood" className="w-full h-40 object-cover" />
        </div>

        <p className="bakery-eyebrow mb-2">Bosgoedt Bakery</p>
        <h1 className="font-serif text-3xl sm:text-4xl mb-3" style={{ letterSpacing: "-0.02em" }}>
          Pop-ups in Oud-Turnhout
        </h1>
        <p className="text-foreground/80 mb-6">
          Schrijf je in en krijg twee weken voor elke pop-up het menu in je mailbox, met een directe
          link om te bestellen.
        </p>

        {submitted ? (
          <div className="rounded-[var(--radius)] border border-border/60 bg-muted/30 p-6 text-center space-y-4">
            <p className="font-serif text-xl">Je bent ingeschreven 🍞</p>
            <p className="text-sm text-muted-foreground">
              Tot bij de volgende pop-up. Je hoort van ons.
            </p>
            <Button asChild>
              <Link to="/bestellen">Naar de bestelpagina →</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* honeypot */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="hidden"
              aria-hidden
            />

            <div className="space-y-2">
              <Label htmlFor="name">Naam *</Label>
              <Input
                id="name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefoonnummer (optioneel)</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label>Hoe heb je van ons gehoord?</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Kies een optie" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={form.consent}
                onCheckedChange={(c) => setForm({ ...form, consent: !!c })}
                className="mt-0.5"
              />
              <span>
                Ja, ik wil graag updates over Bosgoedt Bakery pop-ups ontvangen via e-mail.
              </span>
            </label>

            <Button type="submit" size="lg" className="w-full min-h-[44px]" disabled={loading}>
              {loading ? "Bezig…" : "Houd me op de hoogte"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Je kunt je op elk moment uitschrijven via een link in elke mail.
            </p>
          </form>
        )}
      </div>
    </PublicLayout>
  );
};

export default Signup;
