-- Allow customers to update their own extra order items (non-weekly menu items only)
CREATE POLICY "Customers can update their own order items"
ON public.order_items
FOR UPDATE
USING (
  is_weekly_menu_item = false
  AND EXISTS (
    SELECT 1 FROM orders o
    JOIN profiles p ON p.id = o.customer_id
    WHERE o.id = order_items.order_id
    AND p.user_id = auth.uid()
    AND o.status = 'confirmed'
  )
);

-- Allow customers to delete their own extra order items (non-weekly menu items only)
CREATE POLICY "Customers can delete their own order items"
ON public.order_items
FOR DELETE
USING (
  is_weekly_menu_item = false
  AND EXISTS (
    SELECT 1 FROM orders o
    JOIN profiles p ON p.id = o.customer_id
    WHERE o.id = order_items.order_id
    AND p.user_id = auth.uid()
    AND o.status = 'confirmed'
  )
);

-- Allow customers to update their own orders (confirmed status only)
CREATE POLICY "Customers can update their own orders"
ON public.orders
FOR UPDATE
USING (
  status = 'confirmed'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = orders.customer_id
    AND profiles.user_id = auth.uid()
  )
);