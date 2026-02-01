-- Allow bakers to delete profiles
CREATE POLICY "Bakers can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (has_role(auth.uid(), 'baker'::app_role));