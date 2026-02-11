-- Backfill missing order_items for orders that have a weekly_menu but no corresponding items
INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, discount_amount, total, is_weekly_menu_item)
SELECT
  o.id,
  wmp.product_id,
  wmp.quantity,
  0,
  0,
  0,
  true
FROM public.orders o
JOIN public.weekly_menu_products wmp ON wmp.weekly_menu_id = o.weekly_menu_id
WHERE o.weekly_menu_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = o.id AND oi.is_weekly_menu_item = true
  );