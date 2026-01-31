-- Insert categories
INSERT INTO public.categories (name) VALUES 
  ('Brood'),
  ('Zoet')
ON CONFLICT (name) DO NOTHING;

-- Insert products with category references
WITH cat_brood AS (SELECT id FROM public.categories WHERE name = 'Brood'),
     cat_zoet AS (SELECT id FROM public.categories WHERE name = 'Zoet')
INSERT INTO public.products (name, category_id, selling_price, is_orderable, yield_quantity, yield_unit) VALUES
  -- Brood producten
  ('Licht tarwebrood', (SELECT id FROM cat_brood), 5.00, true, 1, 'stuks'),
  ('Donker tarwebrood', (SELECT id FROM cat_brood), 5.00, false, 1, 'stuks'),
  ('100% spelt', (SELECT id FROM cat_brood), 5.00, false, 1, 'stuks'),
  ('Wit tarwebrood', (SELECT id FROM cat_brood), 5.00, false, 1, 'stuks'),
  ('Donker pompoen', (SELECT id FROM cat_brood), 6.00, false, 1, 'stuks'),
  ('Licht pestobrood', (SELECT id FROM cat_brood), 6.00, false, 1, 'stuks'),
  ('Donker walnoten', (SELECT id FROM cat_brood), 6.00, false, 1, 'stuks'),
  ('Donker zonnebloem', (SELECT id FROM cat_brood), 6.00, false, 1, 'stuks'),
  ('Ciabatta', (SELECT id FROM cat_brood), 6.00, false, 1, 'stuks'),
  ('Focaccia', (SELECT id FROM cat_brood), 6.00, false, 1, 'stuks'),
  ('Chocolade desembrood', (SELECT id FROM cat_brood), 6.00, false, 1, 'stuks'),
  -- Zoet producten
  ('Tripple Choc cookies', (SELECT id FROM cat_zoet), 1.75, true, 1, 'stuks'),
  ('Speculoos - witte chocolade - hazelnoot cookies', (SELECT id FROM cat_zoet), 1.75, true, 1, 'stuks'),
  ('Granola (400 gram)', (SELECT id FROM cat_zoet), 7.00, true, 1, 'stuks'),
  ('Citroentijm cake', (SELECT id FROM cat_zoet), 5.50, false, 1, 'stuks'),
  ('Millionaire''s Shortbread', (SELECT id FROM cat_zoet), 6.00, false, 1, 'stuks'),
  ('Salted espresso blondie', (SELECT id FROM cat_zoet), 6.00, false, 1, 'stuks'),
  ('Blueberry custard bun', (SELECT id FROM cat_zoet), 3.00, false, 1, 'stuks');

-- Insert price tiers for cookies (4 for €6.00)
INSERT INTO public.product_price_tiers (product_id, min_quantity, price)
SELECT id, 4, 6.00 FROM public.products WHERE name = 'Tripple Choc cookies';

INSERT INTO public.product_price_tiers (product_id, min_quantity, price)
SELECT id, 4, 6.00 FROM public.products WHERE name = 'Speculoos - witte chocolade - hazelnoot cookies';