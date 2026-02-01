-- Add order_number column with auto-increment starting at 20260190
ALTER TABLE public.orders ADD COLUMN order_number SERIAL;

-- Set the sequence to start at 20260190
SELECT setval(pg_get_serial_sequence('orders', 'order_number'), 20260190, false);

-- Create unique index on order_number
CREATE UNIQUE INDEX idx_orders_order_number ON public.orders(order_number);