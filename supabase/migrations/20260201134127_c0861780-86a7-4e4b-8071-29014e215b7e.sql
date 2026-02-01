-- Make user_id nullable for customers without login
ALTER TABLE public.profiles 
ALTER COLUMN user_id DROP NOT NULL;

-- Add a policy for bakers to insert profiles (for customers without login)
CREATE POLICY "Bakers can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'baker'::app_role));