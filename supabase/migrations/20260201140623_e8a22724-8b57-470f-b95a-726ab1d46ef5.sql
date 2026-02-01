-- Change default status for new orders from 'pending' to 'confirmed'
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'confirmed';