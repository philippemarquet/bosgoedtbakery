-- Create table for stock checks
CREATE TABLE public.stock_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'in_progress',
  notes TEXT,
  created_by UUID NOT NULL
);

-- Create table for stock check items (ingredient lines)
CREATE TABLE public.stock_check_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_check_id UUID NOT NULL REFERENCES public.stock_checks(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  required_quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  is_ordered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_check_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_checks
CREATE POLICY "Bakers can manage stock checks"
ON public.stock_checks
FOR ALL
USING (has_role(auth.uid(), 'baker'::app_role))
WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

-- RLS policies for stock_check_items
CREATE POLICY "Bakers can manage stock check items"
ON public.stock_check_items
FOR ALL
USING (has_role(auth.uid(), 'baker'::app_role))
WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

-- Add indexes for performance
CREATE INDEX idx_stock_check_items_stock_check_id ON public.stock_check_items(stock_check_id);
CREATE INDEX idx_stock_check_items_ingredient_id ON public.stock_check_items(ingredient_id);