-- Split yield into recipe-yield + sell-unit, and introduce weekly product offerings.
--
-- Background:
--   The current `products.yield_quantity` / `products.yield_unit` pair conflates
--   two different concepts: (1) how much a recipe produces, and (2) the unit in
--   which a product is sold to customers. This split lets a baker say:
--     "my granola recipe makes 1 kg but I sell it per 400 g"
--     "my cookie recipe makes 24 cookies but I sell per piece"
--
--   A single formula then drives all ingredient/cost calculations:
--     batches = (ordered_units * sell_unit_quantity) / recipe_yield_quantity
--     ingredients_needed = recipe_ingredient.quantity * batches
--
--   Historically this bug manifested as StockCheck over-reporting ingredient
--   needs by a factor of yield_quantity for batch-based products.
--
-- This migration is intentionally backwards-compatible: the old columns
-- (yield_quantity, yield_unit) stay in place while the application is
-- gradually refactored to use the new columns. A follow-up migration will
-- drop the legacy columns once no code references them anymore.
--
-- The `weekly_product_offerings` table replaces the weekmenu concept:
-- per calendar week, the baker selects which products are on offer. The
-- weekmenu tables (`weekly_menus`, `weekly_menu_products`) remain for now
-- and will be dropped in a later migration once the frontend no longer
-- reads from them.

-- ---------------------------------------------------------------------------
-- 1) Products: add recipe-yield + sell-unit columns, backfill from legacy.
-- ---------------------------------------------------------------------------

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS recipe_yield_quantity numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recipe_yield_unit measurement_unit NOT NULL DEFAULT 'stuks',
  ADD COLUMN IF NOT EXISTS sell_unit_quantity numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sell_unit_unit measurement_unit NOT NULL DEFAULT 'stuks';

-- Backfill the new columns from the legacy fields so existing products keep
-- the same numeric meaning until the baker edits them.
UPDATE public.products
SET
  recipe_yield_quantity = COALESCE(yield_quantity, 1),
  recipe_yield_unit     = COALESCE(yield_unit, 'stuks'::measurement_unit),
  sell_unit_quantity    = COALESCE(yield_quantity, 1),
  sell_unit_unit        = COALESCE(yield_unit, 'stuks'::measurement_unit);

COMMENT ON COLUMN public.products.recipe_yield_quantity IS
  'How much the recipe produces (together with recipe_yield_unit). Drives ingredient/cost calculations.';
COMMENT ON COLUMN public.products.recipe_yield_unit IS
  'Unit of the recipe yield (kg, gram, stuks, ...).';
COMMENT ON COLUMN public.products.sell_unit_quantity IS
  'Size of a single sellable unit, expressed in sell_unit_unit (e.g. 400 for "per 400 g", 1 for "per stuk").';
COMMENT ON COLUMN public.products.sell_unit_unit IS
  'Unit in which the product is offered to customers.';


-- ---------------------------------------------------------------------------
-- 2) Weekly product offerings: per week, which products are on offer.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.weekly_product_offerings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  -- Optional weekly override of the product's base selling price.
  price_override  numeric,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- A product can only appear once per week.
  CONSTRAINT weekly_product_offerings_product_week_unique
    UNIQUE (product_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS weekly_product_offerings_week_idx
  ON public.weekly_product_offerings (week_start_date);

CREATE INDEX IF NOT EXISTS weekly_product_offerings_product_idx
  ON public.weekly_product_offerings (product_id);

-- Standard updated_at trigger.
CREATE TRIGGER weekly_product_offerings_updated_at
  BEFORE UPDATE ON public.weekly_product_offerings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ---------------------------------------------------------------------------
-- 3) RLS for weekly_product_offerings.
--    Bakers manage everything; authenticated customers can see the current
--    and upcoming weeks (so they can browse and place orders).
-- ---------------------------------------------------------------------------

ALTER TABLE public.weekly_product_offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bakers can manage weekly product offerings"
  ON public.weekly_product_offerings
  FOR ALL
  USING (has_role(auth.uid(), 'baker'::app_role))
  WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

-- Customers only need to see offerings for the current week and forward.
-- date_trunc('week', ...) uses Monday as week start in Postgres, matching
-- how weekly menus were modeled.
CREATE POLICY "Everyone can view current and upcoming offerings"
  ON public.weekly_product_offerings
  FOR SELECT
  USING (
    week_start_date >= (date_trunc('week', CURRENT_DATE)::date)
  );


-- ---------------------------------------------------------------------------
-- 4) Security hygiene: fix the mutable search_path on the legacy trigger.
--    (The trigger itself will be dropped together with the weekmenu tables
--    in a follow-up migration.)
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.populate_weekly_menu_order_items()
  SET search_path = public, pg_temp;
