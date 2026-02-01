-- Create payment_logs table for tracking all incoming transactions
CREATE TABLE public.payment_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  description text,
  counterparty_name text,
  status text NOT NULL DEFAULT 'pending',
  raw_payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add index for quick lookups
CREATE INDEX idx_payment_logs_status ON public.payment_logs(status);
CREATE INDEX idx_payment_logs_created_at ON public.payment_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Only bakers can view payment logs
CREATE POLICY "Bakers can view payment logs"
ON public.payment_logs
FOR SELECT
USING (has_role(auth.uid(), 'baker'::app_role));

-- Service role can insert (for edge function)
CREATE POLICY "Service role can insert payment logs"
ON public.payment_logs
FOR INSERT
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.payment_logs IS 'Logs all incoming payment transactions from Zapier/Bunq webhook';