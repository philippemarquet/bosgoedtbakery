-- Add transaction_date column to payment_logs for storing the original Bunq transaction date
ALTER TABLE public.payment_logs 
ADD COLUMN transaction_date date;