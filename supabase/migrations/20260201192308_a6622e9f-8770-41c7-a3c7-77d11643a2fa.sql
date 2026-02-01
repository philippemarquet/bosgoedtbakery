-- Create table for storing WhatsApp message template
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only bakers can manage settings
CREATE POLICY "Bakers can manage app settings"
  ON public.app_settings
  FOR ALL
  USING (has_role(auth.uid(), 'baker'::app_role))
  WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

-- Everyone can view settings (needed for message template)
CREATE POLICY "Everyone can view app settings"
  ON public.app_settings
  FOR SELECT
  USING (true);

-- Insert default WhatsApp message template
INSERT INTO public.app_settings (key, value) VALUES (
  'whatsapp_message_template',
  'Bedankt voor je bestelling bij Bosgoedt Bakery 🧑‍🍳

Hierbij de betaallink:
{{betaallink}}

Alvast heel erg bedankt en graag tot de volgende keer 💚'
);

-- Add trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();