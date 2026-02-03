-- Allow customers to create their own orders
CREATE POLICY "Customers can create their own orders"
ON public.orders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = orders.customer_id
    AND profiles.user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- Allow customers to insert their own order items
CREATE POLICY "Customers can insert their own order items"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN profiles p ON p.id = o.customer_id
    WHERE o.id = order_items.order_id
    AND p.user_id = auth.uid()
  )
);