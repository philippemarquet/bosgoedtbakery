import { useState, useEffect } from "react";
import { MessageCircle, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const WhatsAppSettingsTab = () => {
  const [messageTemplate, setMessageTemplate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTemplate = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_message_template")
        .single();

      if (!error && data) {
        setMessageTemplate(data.value);
      }
      setLoading(false);
    };

    fetchTemplate();
  }, []);

  const handleSave = async () => {
    if (!messageTemplate.trim()) {
      toast({ title: "Fout", description: "Bericht mag niet leeg zijn", variant: "destructive" });
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("app_settings")
      .update({ value: messageTemplate })
      .eq("key", "whatsapp_message_template");

    if (error) {
      toast({ title: "Fout", description: "Kon bericht niet opslaan", variant: "destructive" });
    } else {
      toast({ title: "Opgeslagen", description: "WhatsApp bericht bijgewerkt" });
    }

    setSaving(false);
  };

  // Generate preview with example data
  const previewMessage = messageTemplate
    .replace("{{betaallink}}", "https://bunq.me/BosgoedtBakery/25.50/20260191");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border border-foreground/20 border-t-foreground/70" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="bakery-eyebrow mb-2">WhatsApp</p>
        <h2
          className="font-serif text-3xl md:text-4xl font-medium text-foreground leading-tight"
          style={{ letterSpacing: "-0.02em" }}
        >
          Berichtsjabloon
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Dit bericht wordt automatisch ingevuld wanneer je op de WhatsApp-knop klikt bij een bestelling met status &ldquo;Gereed&rdquo;.
          Gebruik{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{"{{betaallink}}"}</code>{" "}
          om de betaallink in te voegen.
        </p>
      </div>

      <div className="paper-card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-foreground/70">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div>
            <p className="bakery-eyebrow">Sjabloon</p>
            <h3 className="font-serif text-lg font-medium text-foreground leading-tight">
              Bewerk het bericht
            </h3>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message" className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Berichtsjabloon
          </Label>
          <Textarea
            id="message"
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
            placeholder="Typ hier je WhatsApp bericht..."
            className="min-h-[220px] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Je kunt emoji&rsquo;s, enters en opmaak gebruiken. De betaallink wordt automatisch gegenereerd per bestelling.
          </p>
        </div>

        <div className="flex justify-end pt-2 border-t border-border/40">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Opslaan..." : "Opslaan"}
          </Button>
        </div>
      </div>

      <div className="paper-card p-6 space-y-4">
        <div>
          <p className="bakery-eyebrow">Voorbeeld</p>
          <h3 className="font-serif text-lg font-medium text-foreground leading-tight mt-1">
            Zo ziet het eruit
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Met een voorbeeldbetaallink ingevuld.
          </p>
        </div>

        <div className="rounded-[calc(var(--radius)-2px)] border border-border/60 bg-muted/30 p-5">
          <div
            className="max-w-sm rounded-[calc(var(--radius)-4px)] border border-[hsl(var(--sage))]/30 bg-[hsl(var(--sage))]/10 px-4 py-3 shadow-sm"
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {previewMessage}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppSettingsTab;
