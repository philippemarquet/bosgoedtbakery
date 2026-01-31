-- Update all kg-based ingredients to use gram as display_unit
UPDATE public.recipe_ingredients ri
SET display_unit = 'gram'
FROM public.ingredients i
WHERE ri.ingredient_id = i.id
  AND i.unit = 'kg';