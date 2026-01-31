-- Update Tijm ingredient to use eetlepel as unit
UPDATE public.ingredients SET unit = 'eetlepel' WHERE name = 'Tijm';

-- =============================================
-- INSERT RECIPE INGREDIENTS
-- Note: quantities in grams are divided by 1000 for kg-based ingredients
-- =============================================

-- 100% spelt
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  'e184383c-7ed0-4287-b541-9d7770ae5afb'::uuid,
  id,
  CASE name
    WHEN 'Speltbloem' THEN 0.265
    WHEN 'Zout' THEN 0.008
    WHEN 'Speltdesem' THEN 0.088
    WHEN 'Speltmeel' THEN 0.177
    WHEN 'Water' THEN 0.265
  END
FROM public.ingredients
WHERE name IN ('Speltbloem', 'Zout', 'Speltdesem', 'Speltmeel', 'Water');

-- Citroentijm cake
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  'cfc5e45b-2f50-49ca-8b6a-91e5740475dd'::uuid,
  id,
  CASE name
    WHEN 'Kristalsuiker' THEN 0.100
    WHEN 'Tijm' THEN 0.5
    WHEN 'Ei' THEN 1
    WHEN 'Citroenrasp (stuks)' THEN 0.5
    WHEN 'Citroensap' THEN 0.023
    WHEN 'Olijfolie' THEN 0.055
    WHEN 'Yoghurt' THEN 0.090
    WHEN 'Franse tarwebloem (bio)' THEN 0.095
    WHEN 'Baking Powder' THEN 0.002
    WHEN 'Zout' THEN 0.0005
    WHEN 'Poedersuiker' THEN 0.025
  END
FROM public.ingredients
WHERE name IN ('Kristalsuiker', 'Tijm', 'Ei', 'Citroenrasp (stuks)', 'Citroensap', 'Olijfolie', 'Yoghurt', 'Franse tarwebloem (bio)', 'Baking Powder', 'Zout', 'Poedersuiker');

-- Donker pompoen
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  '781386a4-86c5-4a2b-98df-9c5a5d1ae30e'::uuid,
  id,
  CASE name
    WHEN 'Tarwebloem (bio)' THEN 0.135
    WHEN 'Zout' THEN 0.009
    WHEN 'Gerstmeel (bio)' THEN 0.009
    WHEN 'Tarwemeel (bio)' THEN 0.306
    WHEN 'Desem' THEN 0.090
    WHEN 'Water' THEN 0.306
    WHEN 'Pompoenpitten (bio)' THEN 0.090
  END
FROM public.ingredients
WHERE name IN ('Tarwebloem (bio)', 'Zout', 'Gerstmeel (bio)', 'Tarwemeel (bio)', 'Desem', 'Water', 'Pompoenpitten (bio)');

-- Donker tarwebrood
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  'e0bfa6a7-87d2-4dbe-9635-954f652229f7'::uuid,
  id,
  CASE name
    WHEN 'Tarwebloem (bio)' THEN 0.135
    WHEN 'Tarwemeel (bio)' THEN 0.306
    WHEN 'Gerstmeel (bio)' THEN 0.009
    WHEN 'Water' THEN 0.306
    WHEN 'Desem' THEN 0.090
    WHEN 'Zout' THEN 0.009
  END
FROM public.ingredients
WHERE name IN ('Tarwebloem (bio)', 'Tarwemeel (bio)', 'Gerstmeel (bio)', 'Water', 'Desem', 'Zout');

-- Donker walnoten
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  '4f282822-628f-4cdb-a89c-df3686e597d3'::uuid,
  id,
  CASE name
    WHEN 'Tarwebloem (bio)' THEN 0.135
    WHEN 'Tarwemeel (bio)' THEN 0.306
    WHEN 'Zout' THEN 0.009
    WHEN 'Desem' THEN 0.090
    WHEN 'Gerstmeel (bio)' THEN 0.009
    WHEN 'Water' THEN 0.306
    WHEN 'Walnoten (bio)' THEN 0.075
  END
FROM public.ingredients
WHERE name IN ('Tarwebloem (bio)', 'Tarwemeel (bio)', 'Zout', 'Desem', 'Gerstmeel (bio)', 'Water', 'Walnoten (bio)');

-- Donker zonnebloem
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  '211355dc-4245-4bc8-9a21-5e77b33ee33f'::uuid,
  id,
  CASE name
    WHEN 'Tarwebloem (bio)' THEN 0.220
    WHEN 'Tarwemeel (bio)' THEN 0.220
    WHEN 'Gerstmeel (bio)' THEN 0.009
    WHEN 'Water' THEN 0.306
    WHEN 'Desem' THEN 0.090
    WHEN 'Zout' THEN 0.009
    WHEN 'Zonnebloempitten (bio)' THEN 0.075
  END
FROM public.ingredients
WHERE name IN ('Tarwebloem (bio)', 'Tarwemeel (bio)', 'Gerstmeel (bio)', 'Water', 'Desem', 'Zout', 'Zonnebloempitten (bio)');

-- Granola (400 gram) -> Granola
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  '624c16dc-5057-4b5d-bd2e-ae330cb8d571'::uuid,
  id,
  CASE name
    WHEN 'Havervlokken (bio)' THEN 0.267
    WHEN 'Amandelen (bio)' THEN 0.067
    WHEN 'Walnoten (bio)' THEN 0.033
    WHEN 'Hazelnoten' THEN 0.033
    WHEN 'Eiwit' THEN 0.050
    WHEN 'Kaneel (gemalen)' THEN 0.015
  END
FROM public.ingredients
WHERE name IN ('Havervlokken (bio)', 'Amandelen (bio)', 'Walnoten (bio)', 'Hazelnoten', 'Eiwit', 'Kaneel (gemalen)');

-- Licht pestobrood
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  '3bfe64d1-13b3-4e80-bd37-06d3a8541130'::uuid,
  id,
  CASE name
    WHEN 'Tarwebloem (bio)' THEN 0.360
    WHEN 'Water' THEN 0.2925
    WHEN 'Zout' THEN 0.009
    WHEN 'Tarwemeel (bio)' THEN 0.081
    WHEN 'Desem' THEN 0.090
    WHEN 'Gerstmeel (bio)' THEN 0.009
    WHEN 'Verse basilicum' THEN 0.027
  END
FROM public.ingredients
WHERE name IN ('Tarwebloem (bio)', 'Water', 'Zout', 'Tarwemeel (bio)', 'Desem', 'Gerstmeel (bio)', 'Verse basilicum');

-- Licht tarwebrood
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  '561d513e-57b4-40f6-bb99-b5d347052ca1'::uuid,
  id,
  CASE name
    WHEN 'Tarwebloem (bio)' THEN 0.360
    WHEN 'Tarwemeel (bio)' THEN 0.081
    WHEN 'Gerstmeel (bio)' THEN 0.009
    WHEN 'Water' THEN 0.2925
    WHEN 'Desem' THEN 0.090
    WHEN 'Zout' THEN 0.009
  END
FROM public.ingredients
WHERE name IN ('Tarwebloem (bio)', 'Tarwemeel (bio)', 'Gerstmeel (bio)', 'Water', 'Desem', 'Zout');

-- Millionaire's Shortbread
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  'ff6b1fc6-3c44-4abe-8177-5e30b6ce61a6'::uuid,
  id,
  CASE name
    WHEN 'Kristalsuiker' THEN 0.025
    WHEN 'Boter' THEN 0.0875
    WHEN 'Franse tarwebloem (bio)' THEN 0.075
    WHEN 'Citroenrasp (stuks)' THEN 0.25
    WHEN 'Zout' THEN 0.001
    WHEN 'Gecondenseerde melk' THEN 0.100
    WHEN 'Witte basterdsuiker' THEN 0.0125
    WHEN 'Lichtbruine suiker' THEN 0.0125
    WHEN 'Donkere chocolade' THEN 0.050
    WHEN 'Witte chocolade' THEN 0.0075
  END
FROM public.ingredients
WHERE name IN ('Kristalsuiker', 'Boter', 'Franse tarwebloem (bio)', 'Citroenrasp (stuks)', 'Zout', 'Gecondenseerde melk', 'Witte basterdsuiker', 'Lichtbruine suiker', 'Donkere chocolade', 'Witte chocolade');

-- Speculoos - witte chocolade - hazelnoot cookies
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  'a4923da7-9523-463c-9458-256f4adb09ae'::uuid,
  id,
  CASE name
    WHEN 'Boter' THEN 0.0125
    WHEN 'Speculoos' THEN 0.0075
    WHEN 'Lichtbruine suiker' THEN 0.0125
    WHEN 'Kristalsuiker' THEN 0.0063
    WHEN 'Ei' THEN 0.125
    WHEN 'Franse tarwebloem (bio)' THEN 0.0188
    WHEN 'Baking Soda' THEN 0.0003
    WHEN 'Baking Powder' THEN 0.0003
    WHEN 'Zout' THEN 0.0003
    WHEN 'Witte chocolade' THEN 0.015
    WHEN 'Hazelnoten' THEN 0.0075
    WHEN 'Vanille' THEN 0.0003
  END
FROM public.ingredients
WHERE name IN ('Boter', 'Speculoos', 'Lichtbruine suiker', 'Kristalsuiker', 'Ei', 'Franse tarwebloem (bio)', 'Baking Soda', 'Baking Powder', 'Zout', 'Witte chocolade', 'Hazelnoten', 'Vanille');

-- Tripple Choc cookies
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  'e32789d1-d573-4fd5-a641-ef2cbef7ceab'::uuid,
  id,
  CASE name
    WHEN 'Franse tarwebloem (bio)' THEN 0.0222
    WHEN 'Cacaopoeder' THEN 0.0031
    WHEN 'Baking Powder' THEN 0.0005
    WHEN 'Baking Soda' THEN 0.0004
    WHEN 'Zout' THEN 0.0002
    WHEN 'Maizena' THEN 0.0003
    WHEN 'Espressopoeder' THEN 0.0003
    WHEN 'Boter' THEN 0.0142
    WHEN 'Lichtbruine suiker' THEN 0.0125
    WHEN 'Kristalsuiker' THEN 0.0075
    WHEN 'Eigeel' THEN 0.125
    WHEN 'Ei' THEN 0.0625
    WHEN 'Witte chocolade' THEN 0.0094
    WHEN 'Donkere chocolade' THEN 0.0094
  END
FROM public.ingredients
WHERE name IN ('Franse tarwebloem (bio)', 'Cacaopoeder', 'Baking Powder', 'Baking Soda', 'Zout', 'Maizena', 'Espressopoeder', 'Boter', 'Lichtbruine suiker', 'Kristalsuiker', 'Eigeel', 'Ei', 'Witte chocolade', 'Donkere chocolade');

-- Wit tarwebrood
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  '18efb40f-0f8a-42a5-8313-9097eec4f518'::uuid,
  id,
  CASE name
    WHEN 'Tarwebloem (bio)' THEN 0.440
    WHEN 'Desem' THEN 0.135
    WHEN 'Gerstmeel (bio)' THEN 0.010
    WHEN 'Zout' THEN 0.010
    WHEN 'Water' THEN 0.315
  END
FROM public.ingredients
WHERE name IN ('Tarwebloem (bio)', 'Desem', 'Gerstmeel (bio)', 'Zout', 'Water');

-- Ciabatta
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  'a17b5555-7a47-43d1-84cd-5ec500feff9a'::uuid,
  id,
  CASE name
    WHEN 'Poolish' THEN 0.070
    WHEN 'Desem' THEN 0.070
    WHEN 'Tarwebloem (bio)' THEN 0.160
    WHEN 'Roggemeel' THEN 0.007
    WHEN 'Roggebloem' THEN 0.007
    WHEN 'Water' THEN 0.095
    WHEN 'Olijfolie' THEN 0.006
    WHEN 'Zout' THEN 0.0045
  END
FROM public.ingredients
WHERE name IN ('Poolish', 'Desem', 'Tarwebloem (bio)', 'Roggemeel', 'Roggebloem', 'Water', 'Olijfolie', 'Zout');

-- Focaccia
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  '9dcb9a9c-9d1e-4315-aebc-075fedc19df8'::uuid,
  id,
  CASE name
    WHEN 'Pizzabloem (00)' THEN 0.250
    WHEN 'Desem' THEN 0.100
    WHEN 'Tarwebloem (bio)' THEN 0.250
    WHEN 'Water' THEN 0.425
    WHEN 'Zout' THEN 0.013
    WHEN 'Olijfolie' THEN 0.033
  END
FROM public.ingredients
WHERE name IN ('Pizzabloem (00)', 'Desem', 'Tarwebloem (bio)', 'Water', 'Zout', 'Olijfolie');

-- Salted espresso blondie
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  'a8175490-9204-4db9-a3e0-8d28718cea3c'::uuid,
  id,
  CASE name
    WHEN 'Boter' THEN 0.055
    WHEN 'Donkerbruine suiker' THEN 0.055
    WHEN 'Kristalsuiker' THEN 0.050
    WHEN 'Ei' THEN 0.5
    WHEN 'Eigeel' THEN 0.5
    WHEN 'Vanille' THEN 0.0025
    WHEN 'Zout' THEN 0.002
    WHEN 'Baking Soda' THEN 0.0005
    WHEN 'Franse tarwebloem (bio)' THEN 0.080
    WHEN 'Donkere chocolade' THEN 0.070
  END
FROM public.ingredients
WHERE name IN ('Boter', 'Donkerbruine suiker', 'Kristalsuiker', 'Ei', 'Eigeel', 'Vanille', 'Zout', 'Baking Soda', 'Franse tarwebloem (bio)', 'Donkere chocolade');

-- Chocolade desembrood
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  '0a47938f-dd20-47fb-9eef-5b0428419394'::uuid,
  id,
  CASE name
    WHEN 'Desem' THEN 0.055
    WHEN 'Water' THEN 0.210
    WHEN 'Tarwebloem (bio)' THEN 0.275
    WHEN 'Donkere chocolade' THEN 0.075
    WHEN 'Cacaopoeder' THEN 0.022
    WHEN 'Espressopoeder' THEN 0.001
    WHEN 'Zout' THEN 0.0045
    WHEN 'Vanille' THEN 0.0045
    WHEN 'Maple syrup' THEN 0.030
  END
FROM public.ingredients
WHERE name IN ('Desem', 'Water', 'Tarwebloem (bio)', 'Donkere chocolade', 'Cacaopoeder', 'Espressopoeder', 'Zout', 'Vanille', 'Maple syrup');

-- Blueberry custard bun
INSERT INTO public.recipe_ingredients (product_id, ingredient_id, quantity)
SELECT 
  '9f4bf8e5-adaf-421b-afbf-41f49afbf94c'::uuid,
  id,
  CASE name
    WHEN 'Gist' THEN 0.001
    WHEN 'Kristalsuiker' THEN 0.017
    WHEN 'Ei' THEN 0.4
    WHEN 'Tarwebloem (bio)' THEN 0.095
    WHEN 'Zout' THEN 0.0017
    WHEN 'Boter' THEN 0.028
    WHEN 'Poedersuiker' THEN 0.040
    WHEN 'Fruitjam' THEN 0.025
    WHEN 'Blauwe bessen' THEN 0.050
    WHEN 'Franse tarwebloem (bio)' THEN 0.020
    WHEN 'Lichtbruine suiker' THEN 0.033
    WHEN 'Kaneel (gemalen)' THEN 0.001
    WHEN 'Melk' THEN 0.060
    WHEN 'Slagroom' THEN 0.010
  END
FROM public.ingredients
WHERE name IN ('Gist', 'Kristalsuiker', 'Ei', 'Tarwebloem (bio)', 'Zout', 'Boter', 'Poedersuiker', 'Fruitjam', 'Blauwe bessen', 'Franse tarwebloem (bio)', 'Lichtbruine suiker', 'Kaneel (gemalen)', 'Melk', 'Slagroom');

-- =============================================
-- INSERT RECIPE FIXED COSTS
-- =============================================

-- 100% spelt: Sticker (1), Broodzak (1)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('e184383c-7ed0-4287-b541-9d7770ae5afb', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1),
  ('e184383c-7ed0-4287-b541-9d7770ae5afb', '5d791b51-c6ae-4b74-a039-cf428a1f885d', 1);

-- Citroentijm cake: Aluminium bakje (1)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('cfc5e45b-2f50-49ca-8b6a-91e5740475dd', '7e9233a7-fbe4-409c-a972-480a7d0418cc', 1);

-- Donker pompoen: Sticker (1), Broodzak (1)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('781386a4-86c5-4a2b-98df-9c5a5d1ae30e', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1),
  ('781386a4-86c5-4a2b-98df-9c5a5d1ae30e', '5d791b51-c6ae-4b74-a039-cf428a1f885d', 1);

-- Donker tarwebrood: Sticker (1), Broodzak (1)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('e0bfa6a7-87d2-4dbe-9635-954f652229f7', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1),
  ('e0bfa6a7-87d2-4dbe-9635-954f652229f7', '5d791b51-c6ae-4b74-a039-cf428a1f885d', 1);

-- Donker walnoten: Sticker (1), Broodzak (10)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('4f282822-628f-4cdb-a89c-df3686e597d3', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1),
  ('4f282822-628f-4cdb-a89c-df3686e597d3', '5d791b51-c6ae-4b74-a039-cf428a1f885d', 10);

-- Donker zonnebloem: Broodzak (1), Sticker (1)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('211355dc-4245-4bc8-9a21-5e77b33ee33f', '5d791b51-c6ae-4b74-a039-cf428a1f885d', 1),
  ('211355dc-4245-4bc8-9a21-5e77b33ee33f', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1);

-- Granola: Granolazak (1), Sticker (1)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('624c16dc-5057-4b5d-bd2e-ae330cb8d571', '214e617f-bc86-42e9-a2c0-fe067d62ea2b', 1),
  ('624c16dc-5057-4b5d-bd2e-ae330cb8d571', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1);

-- Licht pestobrood: Broodzak (1), Sticker (1)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('3bfe64d1-13b3-4e80-bd37-06d3a8541130', '5d791b51-c6ae-4b74-a039-cf428a1f885d', 1),
  ('3bfe64d1-13b3-4e80-bd37-06d3a8541130', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1);

-- Licht tarwebrood: Sticker (1), Broodzak (1)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('561d513e-57b4-40f6-bb99-b5d347052ca1', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1),
  ('561d513e-57b4-40f6-bb99-b5d347052ca1', '5d791b51-c6ae-4b74-a039-cf428a1f885d', 1);

-- Millionaire's Shortbread: Sticker (1), Kartonnen bakje (1) for Doosje
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('ff6b1fc6-3c44-4abe-8177-5e30b6ce61a6', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1),
  ('ff6b1fc6-3c44-4abe-8177-5e30b6ce61a6', 'fce8e95f-54e7-412f-a4e1-84a56296eff9', 1);

-- Speculoos cookies: Kartonnen bakje (0.25), Sticker (0.25)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('a4923da7-9523-463c-9458-256f4adb09ae', 'fce8e95f-54e7-412f-a4e1-84a56296eff9', 0.25),
  ('a4923da7-9523-463c-9458-256f4adb09ae', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 0.25);

-- Tripple Choc cookies: Kartonnen bakje (0.25), Sticker (0.25)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('e32789d1-d573-4fd5-a641-ef2cbef7ceab', 'fce8e95f-54e7-412f-a4e1-84a56296eff9', 0.25),
  ('e32789d1-d573-4fd5-a641-ef2cbef7ceab', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 0.25);

-- Wit tarwebrood: Broodzak (1), Sticker (1)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('18efb40f-0f8a-42a5-8313-9097eec4f518', '5d791b51-c6ae-4b74-a039-cf428a1f885d', 1),
  ('18efb40f-0f8a-42a5-8313-9097eec4f518', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1);

-- Ciabatta: Broodzak (1), Sticker (1)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('a17b5555-7a47-43d1-84cd-5ec500feff9a', '5d791b51-c6ae-4b74-a039-cf428a1f885d', 1),
  ('a17b5555-7a47-43d1-84cd-5ec500feff9a', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1);

-- Focaccia: Broodzak (1), Sticker (1)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('9dcb9a9c-9d1e-4315-aebc-075fedc19df8', '5d791b51-c6ae-4b74-a039-cf428a1f885d', 1),
  ('9dcb9a9c-9d1e-4315-aebc-075fedc19df8', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1);

-- Salted espresso blondie: Aluminium bakje (1), Sticker (1)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('a8175490-9204-4db9-a3e0-8d28718cea3c', '7e9233a7-fbe4-409c-a972-480a7d0418cc', 1),
  ('a8175490-9204-4db9-a3e0-8d28718cea3c', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1);

-- Chocolade desembrood: Broodzak (1), Sticker (1)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('0a47938f-dd20-47fb-9eef-5b0428419394', '5d791b51-c6ae-4b74-a039-cf428a1f885d', 1),
  ('0a47938f-dd20-47fb-9eef-5b0428419394', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1);

-- Blueberry custard bun: Kartonnen bakje (1), Sticker (1)
INSERT INTO public.recipe_fixed_costs (product_id, fixed_cost_id, quantity)
VALUES 
  ('9f4bf8e5-adaf-421b-afbf-41f49afbf94c', 'fce8e95f-54e7-412f-a4e1-84a56296eff9', 1),
  ('9f4bf8e5-adaf-421b-afbf-41f49afbf94c', '7edf41cb-f150-48bc-a2a4-19630b7ae315', 1);