-- Drop the unique constraint so duplicate ingredients are allowed in recipes
ALTER TABLE public.recipe_ingredients
DROP CONSTRAINT IF EXISTS recipe_ingredients_product_id_ingredient_id_key;