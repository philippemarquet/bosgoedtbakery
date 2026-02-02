-- Add password_set field to profiles to track if user has set their initial password
ALTER TABLE public.profiles 
ADD COLUMN password_set boolean NOT NULL DEFAULT true;

-- Set password_set to false for profiles that have a user_id but were created via baker (customer accounts)
-- Existing users who already logged in keep password_set = true
COMMENT ON COLUMN public.profiles.password_set IS 'Tracks whether user has set their initial password. False for newly created customer accounts.';