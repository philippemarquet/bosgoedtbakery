
-- Add weekly_menu_quantity column to orders
ALTER TABLE public.orders ADD COLUMN weekly_menu_quantity integer NOT NULL DEFAULT 1;

-- Update the trigger function to multiply by weekly_menu_quantity
CREATE OR REPLACE FUNCTION public.populate_weekly_menu_order_items()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if new.weekly_menu_id is not null then
    insert into public.order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      discount_amount,
      total,
      is_weekly_menu_item
    )
    select
      new.id,
      wmp.product_id,
      wmp.quantity * new.weekly_menu_quantity,
      0,
      0,
      0,
      true
    from public.weekly_menu_products wmp
    where wmp.weekly_menu_id = new.weekly_menu_id;
  end if;

  return new;
end;
$function$;
