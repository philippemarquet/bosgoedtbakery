import { useState, useEffect } from "react";
import { MessageCircle, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Laden...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="w-5 h-5" />
            WhatsApp Bericht Sjabloon
          </CardTitle>
          <CardDescription>
            Dit bericht wordt automatisch ingevuld wanneer je op de WhatsApp-knop klikt bij een bestelling met status "Gereed".
            Gebruik <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{"{{betaallink}}"}</code> om de betaallink in te voegen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Berichtsjabloon</Label>
            <Textarea
              id="message"
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              placeholder="Typ hier je WhatsApp bericht..."
              className="min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Je kunt emoji's, enters en opmaak gebruiken. De betaallink wordt automatisch gegenereerd per bestelling.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Opslaan..." : "Opslaan"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Voorbeeld</CardTitle>
          <CardDescription>
            Zo ziet het bericht eruit met een voorbeeldbetaallink:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-[#dcf8c6] rounded-lg p-4 max-w-sm shadow-sm">
            <p className="whitespace-pre-wrap text-sm text-gray-800">
              {previewMessage}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppSettingsTab;
