-- Update remaining kg-based ingredients to use gram as display_unit
UPDATE public.recipe_ingredients
SET display_unit = 'gram'
WHERE id IN (
  '9c16d5f8-5a8a-43db-9e09-9af66477c1e4',
  '4d17c64e-2c0e-41f7-a338-3b291dafeaf6',
  '46eaa60d-b01b-44f9-b146-d1303a8553ef',
  'd9f16ecd-fdae-4f0e-b626-a09641c2b99a',
  'ffff5144-8d10-4cad-9bb9-6c88b2da4158',
  '1bc90976-2611-4d15-97de-0e2acc95b52a'
);