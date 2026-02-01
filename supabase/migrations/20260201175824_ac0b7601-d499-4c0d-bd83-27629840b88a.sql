-- Import historic orders from CSV (weeks 39-50 of 2025)
-- Mappings:
-- Philippe → Philippe Marquet | Klant (a3caa3a5-7d26-4c8a-8178-e1d29ac2d11d)
-- Stephanie → bb3719f7-c812-4981-8ae8-1ef68cb6fda3
-- Granola (400 gram) → Granola (624c16dc-5057-4b5d-bd2e-ae330cb8d571)
-- Weekmenu's linked to existing weekly_menus table

DO $$
DECLARE
  baker_user_id uuid := '06ab0711-d5ab-4461-9cdd-06598b3f7fd9';
  
  -- Customer IDs
  svetlana_id uuid := '7c13128c-a620-4a04-bcd0-62ca3598a3e3';
  pim_id uuid := '37c52d69-0a12-411f-af48-3ea0454b92e0';
  maartje_id uuid := '781e2af7-191f-4946-bc85-d133f851f301';
  anna_id uuid := 'a2c3e79b-1aa7-45c3-8725-169723f8a1eb';
  mama_id uuid := '877e8186-2e51-40c0-8b46-87105ba46192';
  sandra_id uuid := 'ac9a1dd3-2e9b-4d1f-b741-f75ce4dc93e2';
  therese_id uuid := 'ae6720ec-9de1-4207-8c6d-d688f914ab1e';
  marion_id uuid := '57fa8c26-ac7f-4d76-9dac-9e6ac16ed6d7';
  nelly_id uuid := '1a5e2bdd-e906-43bb-8f0e-04ae2711afdd';
  philippe_id uuid := 'a3caa3a5-7d26-4c8a-8178-e1d29ac2d11d';
  anna_meijer_id uuid := '34bdbf46-2cad-4b5f-a7d8-f32744d34ceb';
  stephanie_id uuid := 'bb3719f7-c812-4981-8ae8-1ef68cb6fda3';
  
  -- Product IDs
  tripple_choc_id uuid := 'e32789d1-d573-4fd5-a641-ef2cbef7ceab';
  speculoos_id uuid := 'a4923da7-9523-463c-9458-256f4adb09ae';
  licht_tarwe_id uuid := '561d513e-57b4-40f6-bb99-b5d347052ca1';
  granola_id uuid := '624c16dc-5057-4b5d-bd2e-ae330cb8d571';
  
  -- Weekly menu IDs
  wm39_id uuid := '077a8a47-7139-4d55-93f3-baf96aff1ec8';
  wm41_id uuid := '58d30b06-134f-48c6-b649-22ac16532b71';
  wm43_id uuid := '46047146-122f-44ee-8717-dc200a954a7d';
  wm46_id uuid := 'cc8aea3d-62da-4c83-804f-9ae3f0ce0949';
  wm48_id uuid := 'a3440007-4141-49d4-8bb9-226eb34cfeb0';
  wm50_id uuid := 'a1e66ac1-c902-4d7a-92f8-69dce905237a';
  
  -- Product prices
  weekmenu_price numeric := 12.50;
  tripple_choc_price numeric := 1.75;
  speculoos_price numeric := 1.75;
  licht_tarwe_price numeric := 5.00;
  granola_price numeric := 7.00;
  
  -- Order IDs for each unique customer+date combination
  o_id uuid;
BEGIN
  -- ============ WEEK 39 (22/09/2025) ============
  -- Svetlana - Weekmenu 39
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (svetlana_id, baker_user_id, '2025-09-22', wm39_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm39_id;

  -- Pim Sistermans - Weekmenu 39
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (pim_id, baker_user_id, '2025-09-22', wm39_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm39_id;

  -- Maartje - Weekmenu 39
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (maartje_id, baker_user_id, '2025-09-22', wm39_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wm39_id;

  -- Anna - Weekmenu 39
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (anna_id, baker_user_id, '2025-09-22', wm39_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm39_id;

  -- Mama - Weekmenu 39
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (mama_id, baker_user_id, '2025-09-22', wm39_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm39_id;

  -- Sandra - Weekmenu 39
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (sandra_id, baker_user_id, '2025-09-22', wm39_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm39_id;

  -- ============ WEEK 41 (04/10/2025) - Main date ============
  -- Svetlana: Weekmenu 41 + 8 Tripple Choc + 8 Speculoos
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (svetlana_id, baker_user_id, '2025-10-04', wm41_id, weekmenu_price + (8 * tripple_choc_price) + (8 * speculoos_price), weekmenu_price + (8 * tripple_choc_price) + (8 * speculoos_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm41_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, tripple_choc_id, 8, tripple_choc_price, 8 * tripple_choc_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 8, speculoos_price, 8 * speculoos_price);

  -- Pim: Weekmenu 41 + Licht tarwe + 4 Tripple + 4 Speculoos
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (pim_id, baker_user_id, '2025-10-04', wm41_id, weekmenu_price + licht_tarwe_price + (4 * tripple_choc_price) + (4 * speculoos_price), weekmenu_price + licht_tarwe_price + (4 * tripple_choc_price) + (4 * speculoos_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm41_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, licht_tarwe_id, 1, licht_tarwe_price, licht_tarwe_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, tripple_choc_id, 4, tripple_choc_price, 4 * tripple_choc_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 4, speculoos_price, 4 * speculoos_price);

  -- Maartje: Weekmenu 41 + Granola
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (maartje_id, baker_user_id, '2025-10-04', wm41_id, weekmenu_price + granola_price, weekmenu_price + granola_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm41_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, granola_id, 1, granola_price, granola_price);

  -- Mama: Weekmenu 41 + Granola + 4 Speculoos
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (mama_id, baker_user_id, '2025-10-04', wm41_id, weekmenu_price + granola_price + (4 * speculoos_price), weekmenu_price + granola_price + (4 * speculoos_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm41_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, granola_id, 1, granola_price, granola_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 4, speculoos_price, 4 * speculoos_price);

  -- Sandra: Weekmenu 41 + Granola
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (sandra_id, baker_user_id, '2025-10-04', wm41_id, weekmenu_price + granola_price, weekmenu_price + granola_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm41_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, granola_id, 1, granola_price, granola_price);

  -- Therese: Weekmenu 41 + Granola
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (therese_id, baker_user_id, '2025-10-04', wm41_id, weekmenu_price + granola_price, weekmenu_price + granola_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm41_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, granola_id, 1, granola_price, granola_price);

  -- Marion: Weekmenu 41 + Granola
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (marion_id, baker_user_id, '2025-10-04', wm41_id, weekmenu_price + granola_price, weekmenu_price + granola_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm41_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, granola_id, 1, granola_price, granola_price);

  -- Nelly: Weekmenu 41
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (nelly_id, baker_user_id, '2025-10-04', wm41_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm41_id;

  -- Anna: Weekmenu 41 (dated 03/10/2025)
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (anna_id, baker_user_id, '2025-10-03', wm41_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm41_id;

  -- ============ WEEK 43 (20/10/2025) ============
  -- Pim: Weekmenu 43 + Licht tarwe + 4 Tripple + 4 Speculoos
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (pim_id, baker_user_id, '2025-10-20', wm43_id, weekmenu_price + licht_tarwe_price + (4 * tripple_choc_price) + (4 * speculoos_price), weekmenu_price + licht_tarwe_price + (4 * tripple_choc_price) + (4 * speculoos_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm43_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, licht_tarwe_id, 1, licht_tarwe_price, licht_tarwe_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, tripple_choc_id, 4, tripple_choc_price, 4 * tripple_choc_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 4, speculoos_price, 4 * speculoos_price);

  -- Svetlana: Weekmenu 43 + 8 Speculoos + 8 Tripple
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (svetlana_id, baker_user_id, '2025-10-20', wm43_id, weekmenu_price + (8 * speculoos_price) + (8 * tripple_choc_price), weekmenu_price + (8 * speculoos_price) + (8 * tripple_choc_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm43_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 8, speculoos_price, 8 * speculoos_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, tripple_choc_id, 8, tripple_choc_price, 8 * tripple_choc_price);

  -- Sandra: Weekmenu 43 + Granola + 4 Tripple
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (sandra_id, baker_user_id, '2025-10-20', wm43_id, weekmenu_price + granola_price + (4 * tripple_choc_price), weekmenu_price + granola_price + (4 * tripple_choc_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm43_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, granola_id, 1, granola_price, granola_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, tripple_choc_id, 4, tripple_choc_price, 4 * tripple_choc_price);

  -- Therese: 4 Speculoos (no weekmenu)
  INSERT INTO orders (customer_id, created_by, invoice_date, subtotal, total, status)
  VALUES (therese_id, baker_user_id, '2025-10-20', 4 * speculoos_price, 4 * speculoos_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 4, speculoos_price, 4 * speculoos_price);

  -- Maartje: Weekmenu 43 + 1 Tripple + 1 Speculoos
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (maartje_id, baker_user_id, '2025-10-20', wm43_id, weekmenu_price + tripple_choc_price + speculoos_price, weekmenu_price + tripple_choc_price + speculoos_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm43_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, tripple_choc_id, 1, tripple_choc_price, tripple_choc_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 1, speculoos_price, speculoos_price);

  -- Mama: Weekmenu 43 + 4 Speculoos
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (mama_id, baker_user_id, '2025-10-20', wm43_id, weekmenu_price + (4 * speculoos_price), weekmenu_price + (4 * speculoos_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm43_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 4, speculoos_price, 4 * speculoos_price);

  -- ============ WEEK 46 (10/11/2025) ============
  -- Pim: Weekmenu 46 + Licht tarwe + 4 Speculoos + 4 Tripple
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (pim_id, baker_user_id, '2025-11-10', wm46_id, weekmenu_price + licht_tarwe_price + (4 * speculoos_price) + (4 * tripple_choc_price), weekmenu_price + licht_tarwe_price + (4 * speculoos_price) + (4 * tripple_choc_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm46_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, licht_tarwe_id, 1, licht_tarwe_price, licht_tarwe_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 4, speculoos_price, 4 * speculoos_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, tripple_choc_id, 4, tripple_choc_price, 4 * tripple_choc_price);

  -- Maartje: Weekmenu 46
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (maartje_id, baker_user_id, '2025-11-10', wm46_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm46_id;

  -- Svetlana: Weekmenu 46 + 8 Speculoos + 4 Tripple
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (svetlana_id, baker_user_id, '2025-11-10', wm46_id, weekmenu_price + (8 * speculoos_price) + (4 * tripple_choc_price), weekmenu_price + (8 * speculoos_price) + (4 * tripple_choc_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm46_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 8, speculoos_price, 8 * speculoos_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, tripple_choc_id, 4, tripple_choc_price, 4 * tripple_choc_price);

  -- Nelly: Weekmenu 46
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (nelly_id, baker_user_id, '2025-11-10', wm46_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm46_id;

  -- Sandra: Weekmenu 46 + Granola
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (sandra_id, baker_user_id, '2025-11-10', wm46_id, weekmenu_price + granola_price, weekmenu_price + granola_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm46_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, granola_id, 1, granola_price, granola_price);

  -- Philippe: Weekmenu 46
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (philippe_id, baker_user_id, '2025-11-10', wm46_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm46_id;

  -- Anna: Weekmenu 46
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (anna_id, baker_user_id, '2025-11-10', wm46_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm46_id;

  -- ============ WEEK 48 (26/11/2025) ============
  -- Anna: Granola + Weekmenu 48
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (anna_id, baker_user_id, '2025-11-26', wm48_id, weekmenu_price + granola_price, weekmenu_price + granola_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm48_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, granola_id, 1, granola_price, granola_price);

  -- Philippe: Weekmenu 48
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (philippe_id, baker_user_id, '2025-11-26', wm48_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm48_id;

  -- Pim: Licht tarwe + Weekmenu 48 + 4 Tripple + 4 Speculoos
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (pim_id, baker_user_id, '2025-11-26', wm48_id, weekmenu_price + licht_tarwe_price + (4 * tripple_choc_price) + (4 * speculoos_price), weekmenu_price + licht_tarwe_price + (4 * tripple_choc_price) + (4 * speculoos_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm48_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, licht_tarwe_id, 1, licht_tarwe_price, licht_tarwe_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, tripple_choc_id, 4, tripple_choc_price, 4 * tripple_choc_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 4, speculoos_price, 4 * speculoos_price);

  -- Svetlana: Weekmenu 48 + 4 Tripple + 8 Speculoos
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (svetlana_id, baker_user_id, '2025-11-26', wm48_id, weekmenu_price + (4 * tripple_choc_price) + (8 * speculoos_price), weekmenu_price + (4 * tripple_choc_price) + (8 * speculoos_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm48_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, tripple_choc_id, 4, tripple_choc_price, 4 * tripple_choc_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 8, speculoos_price, 8 * speculoos_price);

  -- Sandra: Weekmenu 48 + 3 Granola
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (sandra_id, baker_user_id, '2025-11-26', wm48_id, weekmenu_price + (3 * granola_price), weekmenu_price + (3 * granola_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm48_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, granola_id, 3, granola_price, 3 * granola_price);

  -- Stephanie: Weekmenu 48
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (stephanie_id, baker_user_id, '2025-11-26', wm48_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm48_id;

  -- ============ WEEK 50 (11/12/2025) ============
  -- Pim: Weekmenu 50 + Licht tarwe + Granola + 4 Tripple + 4 Speculoos
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (pim_id, baker_user_id, '2025-12-11', wm50_id, weekmenu_price + licht_tarwe_price + granola_price + (4 * tripple_choc_price) + (4 * speculoos_price), weekmenu_price + licht_tarwe_price + granola_price + (4 * tripple_choc_price) + (4 * speculoos_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm50_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, licht_tarwe_id, 1, licht_tarwe_price, licht_tarwe_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, granola_id, 1, granola_price, granola_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, tripple_choc_id, 4, tripple_choc_price, 4 * tripple_choc_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 4, speculoos_price, 4 * speculoos_price);

  -- Therese: Granola + 4 Tripple (no weekmenu)
  INSERT INTO orders (customer_id, created_by, invoice_date, subtotal, total, status)
  VALUES (therese_id, baker_user_id, '2025-12-11', granola_price + (4 * tripple_choc_price), granola_price + (4 * tripple_choc_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, granola_id, 1, granola_price, granola_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, tripple_choc_id, 4, tripple_choc_price, 4 * tripple_choc_price);

  -- Svetlana: Weekmenu 50 + 8 Tripple + 8 Speculoos
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (svetlana_id, baker_user_id, '2025-12-11', wm50_id, weekmenu_price + (8 * tripple_choc_price) + (8 * speculoos_price), weekmenu_price + (8 * tripple_choc_price) + (8 * speculoos_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm50_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, tripple_choc_id, 8, tripple_choc_price, 8 * tripple_choc_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 8, speculoos_price, 8 * speculoos_price);

  -- Mama: Weekmenu 50 + Granola
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (mama_id, baker_user_id, '2025-12-11', wm50_id, weekmenu_price + granola_price, weekmenu_price + granola_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm50_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, granola_id, 1, granola_price, granola_price);

  -- Sandra: Granola + 4 Speculoos (no weekmenu)
  INSERT INTO orders (customer_id, created_by, invoice_date, subtotal, total, status)
  VALUES (sandra_id, baker_user_id, '2025-12-11', granola_price + (4 * speculoos_price), granola_price + (4 * speculoos_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, granola_id, 1, granola_price, granola_price);
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 4, speculoos_price, 4 * speculoos_price);

  -- Anna Meijer: Weekmenu 50 + 4 Speculoos
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (anna_meijer_id, baker_user_id, '2025-12-11', wm50_id, weekmenu_price + (4 * speculoos_price), weekmenu_price + (4 * speculoos_price), 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm50_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total) VALUES (o_id, speculoos_id, 4, speculoos_price, 4 * speculoos_price);

  -- Maartje: Weekmenu 50
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (maartje_id, baker_user_id, '2025-12-11', wm50_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm50_id;

  -- Nelly: Weekmenu 50 (dated 13/12/2025)
  INSERT INTO orders (customer_id, created_by, invoice_date, weekly_menu_id, subtotal, total, status)
  VALUES (nelly_id, baker_user_id, '2025-12-13', wm50_id, weekmenu_price, weekmenu_price, 'Betaald')
  RETURNING id INTO o_id;
  INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, is_weekly_menu_item)
  SELECT o_id, p.id, 1, weekmenu_price, weekmenu_price, true FROM weekly_menu_products wmp JOIN products p ON p.id = wmp.product_id WHERE wmp.weekly_menu_id = wm50_id;

END $$;