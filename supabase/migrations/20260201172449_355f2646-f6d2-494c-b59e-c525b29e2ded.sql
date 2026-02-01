-- Add invoice_date column to orders table
ALTER TABLE public.orders
ADD COLUMN invoice_date date;

-- Set default value for existing orders based on weekly menu delivery date or created_at
UPDATE public.orders o
SET invoice_date = COALESCE(
  (SELECT wm.delivery_date FROM public.weekly_menus wm WHERE wm.id = o.weekly_menu_id),
  o.created_at::date
);

-- Make invoice_date NOT NULL after setting values
ALTER TABLE public.orders
ALTER COLUMN invoice_date SET NOT NULL,
ALTER COLUMN invoice_date SET DEFAULT CURRENT_DATE;