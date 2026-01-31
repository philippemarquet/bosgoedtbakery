
-- Increase precision of quantity column from numeric(10,3) to numeric(10,6)
-- This allows for values like 0.0625 to be stored without rounding
ALTER TABLE public.recipe_ingredients 
ALTER COLUMN quantity TYPE numeric(10,6);
