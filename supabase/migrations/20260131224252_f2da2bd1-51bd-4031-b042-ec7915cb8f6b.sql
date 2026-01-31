
-- Update stuks-based ingredients that were stored with incorrect precision
-- These are Ei, Eigeel, Citroenrasp (stuks), etc.

-- Tripple Choc cookies - Ei should be 0.0625 (not 0.063)
UPDATE public.recipe_ingredients 
SET quantity = 0.0625 
WHERE product_id = 'e32789d1-d573-4fd5-a641-ef2cbef7ceab' 
AND ingredient_id = 'ca84d4bb-48f9-461c-b690-1e9ef3f155a7'; -- Ei

-- Speculoos cookies - Ei 0.125 (already correct but confirming)
UPDATE public.recipe_ingredients 
SET quantity = 0.125 
WHERE product_id = 'a4923da7-9523-463c-9458-256f4adb09ae' 
AND ingredient_id = 'ca84d4bb-48f9-461c-b690-1e9ef3f155a7'; -- Ei

-- Millionaire's Shortbread - Citroenrasp 0.25
UPDATE public.recipe_ingredients 
SET quantity = 0.25 
WHERE product_id = 'ff6b1fc6-3c44-4abe-8177-5e30b6ce61a6' 
AND ingredient_id = '1ef37d32-70a1-4da0-b4aa-cb5d85167811'; -- Citroenrasp

-- Citroentijm cake - Citroenrasp 0.5
UPDATE public.recipe_ingredients 
SET quantity = 0.5 
WHERE product_id = 'cfc5e45b-2f50-49ca-8b6a-91e5740475dd' 
AND ingredient_id = '1ef37d32-70a1-4da0-b4aa-cb5d85167811'; -- Citroenrasp

-- Blueberry custard bun - Ei 0.4
UPDATE public.recipe_ingredients 
SET quantity = 0.4 
WHERE product_id = '9f4bf8e5-adaf-421b-afbf-41f49afbf94c' 
AND ingredient_id = 'ca84d4bb-48f9-461c-b690-1e9ef3f155a7'; -- Ei

-- Salted espresso blondie - Ei 0.5
UPDATE public.recipe_ingredients 
SET quantity = 0.5 
WHERE product_id = 'a8175490-9204-4db9-a3e0-8d28718cea3c' 
AND ingredient_id = 'ca84d4bb-48f9-461c-b690-1e9ef3f155a7'; -- Ei

-- Salted espresso blondie - Eigeel 0.5
UPDATE public.recipe_ingredients 
SET quantity = 0.5 
WHERE product_id = 'a8175490-9204-4db9-a3e0-8d28718cea3c' 
AND ingredient_id = '5e56e503-45dd-491c-8594-64b210813e02'; -- Eigeel

-- Speculoos cookies - Kartonnen doosje 0.25
-- Speculoos cookies - Sticker 0.25
-- Tripple Choc cookies - Kartonnen doosje 0.25
-- Tripple Choc cookies - Sticker 0.25
-- (these are fixed costs, not ingredients - handled separately)

-- Citroentijm cake - Tijm (eetlepel) 0.5
UPDATE public.recipe_ingredients 
SET quantity = 0.5 
WHERE product_id = 'cfc5e45b-2f50-49ca-8b6a-91e5740475dd' 
AND ingredient_id = 'dc258167-f0fd-4078-b850-3971d5f2f5d3'; -- Tijm

-- Citroentijm cake - Ei 1
UPDATE public.recipe_ingredients 
SET quantity = 1 
WHERE product_id = 'cfc5e45b-2f50-49ca-8b6a-91e5740475dd' 
AND ingredient_id = 'ca84d4bb-48f9-461c-b690-1e9ef3f155a7'; -- Ei
