-- Add customer discount percentage to profiles
ALTER TABLE public.profiles 
ADD COLUMN discount_percentage numeric NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.discount_percentage IS 'Fixed discount percentage for this customer (0-100)';