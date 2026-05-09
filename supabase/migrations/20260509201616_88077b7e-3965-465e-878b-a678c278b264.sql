CREATE POLICY "Bakers can update subscribers"
ON public.subscribers
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'baker'::app_role))
WITH CHECK (has_role(auth.uid(), 'baker'::app_role));