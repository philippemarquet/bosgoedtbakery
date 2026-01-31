-- Add separate address fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN street TEXT,
ADD COLUMN house_number TEXT,
ADD COLUMN postal_code TEXT,
ADD COLUMN city TEXT,
ADD COLUMN country TEXT DEFAULT 'Nederland';

-- Remove old address column (data migration not needed as it's empty)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS address;