-- Add display_unit column to recipe_ingredients for user-friendly input
ALTER TABLE public.recipe_ingredients 
ADD COLUMN display_unit public.measurement_unit;

-- Set default display_unit based on existing ingredient units
UPDATE public.recipe_ingredients ri
SET display_unit = i.unit
FROM public.ingredients i
WHERE ri.ingredient_id = i.id;