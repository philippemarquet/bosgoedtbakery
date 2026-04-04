
CREATE TABLE public.production_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  checked_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(order_item_id)
);

ALTER TABLE public.production_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bakers can manage production checks"
ON public.production_checks
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'baker'::app_role))
WITH CHECK (has_role(auth.uid(), 'baker'::app_role));
