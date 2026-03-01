-- Delete duplicate payment_logs, keeping only the earliest entry per unique transaction
DELETE FROM payment_logs
WHERE id NOT IN (
  SELECT DISTINCT ON (amount, description, counterparty_name, transaction_date) id
  FROM payment_logs
  ORDER BY amount, description, counterparty_name, transaction_date, created_at ASC
);

-- Add unique constraint to prevent future duplicates based on fingerprint
CREATE UNIQUE INDEX IF NOT EXISTS payment_logs_fingerprint_unique ON payment_logs (fingerprint) WHERE fingerprint IS NOT NULL;