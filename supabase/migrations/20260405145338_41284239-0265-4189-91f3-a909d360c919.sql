CREATE POLICY "Bakers can update payment logs"
ON public.payment_logs
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'baker'::app_role))
WITH CHECK (has_role(auth.uid(), 'baker'::app_role));