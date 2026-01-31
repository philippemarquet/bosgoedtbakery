-- Create unit enum for measurements
CREATE TYPE public.measurement_unit AS ENUM ('kg', 'gram', 'liter', 'ml', 'stuks', 'uur');

-- Categories table (user-defined product categories)
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ingredients table (base ingredients with pricing)
CREATE TABLE public.ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit measurement_unit NOT NULL DEFAULT 'kg',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Fixed costs table (stickers, bags, boxes, electricity, etc.)
CREATE TABLE public.fixed_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit measurement_unit NOT NULL DEFAULT 'stuks',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Products table (main products with pricing)
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  yield_quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  yield_unit measurement_unit NOT NULL DEFAULT 'stuks',
  selling_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_orderable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Product price tiers (for multiple discount levels: 1 for €1.75, 4 for €6, 10 for €12)
CREATE TABLE public.product_price_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Recipe ingredients (junction: which ingredients in which product recipe)
CREATE TABLE public.recipe_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, ingredient_id)
);

-- Recipe fixed costs (junction: which fixed costs in which product recipe)
CREATE TABLE public.recipe_fixed_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  fixed_cost_id UUID NOT NULL REFERENCES public.fixed_costs(id) ON DELETE CASCADE,
  quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, fixed_cost_id)
);

-- Weekly menus table
CREATE TABLE public.weekly_menus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Weekly menu products (junction: which products in which weekly menu)
CREATE TABLE public.weekly_menu_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  weekly_menu_id UUID NOT NULL REFERENCES public.weekly_menus(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(weekly_menu_id, product_id)
);

-- Enable RLS on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_menu_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Bakers can manage everything, customers can only view products/menus

-- Categories
CREATE POLICY "Bakers can manage categories" ON public.categories
  FOR ALL USING (has_role(auth.uid(), 'baker'::app_role))
  WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

CREATE POLICY "Everyone can view categories" ON public.categories
  FOR SELECT USING (true);

-- Ingredients (bakers only)
CREATE POLICY "Bakers can manage ingredients" ON public.ingredients
  FOR ALL USING (has_role(auth.uid(), 'baker'::app_role))
  WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

-- Fixed costs (bakers only)
CREATE POLICY "Bakers can manage fixed costs" ON public.fixed_costs
  FOR ALL USING (has_role(auth.uid(), 'baker'::app_role))
  WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

-- Products
CREATE POLICY "Bakers can manage products" ON public.products
  FOR ALL USING (has_role(auth.uid(), 'baker'::app_role))
  WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

CREATE POLICY "Everyone can view orderable products" ON public.products
  FOR SELECT USING (is_orderable = true);

-- Product price tiers
CREATE POLICY "Bakers can manage price tiers" ON public.product_price_tiers
  FOR ALL USING (has_role(auth.uid(), 'baker'::app_role))
  WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

CREATE POLICY "Everyone can view price tiers" ON public.product_price_tiers
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.products WHERE id = product_id AND is_orderable = true
  ));

-- Recipe ingredients (bakers only)
CREATE POLICY "Bakers can manage recipe ingredients" ON public.recipe_ingredients
  FOR ALL USING (has_role(auth.uid(), 'baker'::app_role))
  WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

-- Recipe fixed costs (bakers only)
CREATE POLICY "Bakers can manage recipe fixed costs" ON public.recipe_fixed_costs
  FOR ALL USING (has_role(auth.uid(), 'baker'::app_role))
  WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

-- Weekly menus
CREATE POLICY "Bakers can manage weekly menus" ON public.weekly_menus
  FOR ALL USING (has_role(auth.uid(), 'baker'::app_role))
  WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

CREATE POLICY "Everyone can view active weekly menus" ON public.weekly_menus
  FOR SELECT USING (week_start_date <= CURRENT_DATE AND week_end_date >= CURRENT_DATE);

-- Weekly menu products
CREATE POLICY "Bakers can manage weekly menu products" ON public.weekly_menu_products
  FOR ALL USING (has_role(auth.uid(), 'baker'::app_role))
  WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

CREATE POLICY "Everyone can view active menu products" ON public.weekly_menu_products
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.weekly_menus 
    WHERE id = weekly_menu_id 
    AND week_start_date <= CURRENT_DATE 
    AND week_end_date >= CURRENT_DATE
  ));

-- Add update triggers for updated_at
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ingredients_updated_at
  BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fixed_costs_updated_at
  BEFORE UPDATE ON public.fixed_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weekly_menus_updated_at
  BEFORE UPDATE ON public.weekly_menus
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default fixed costs
INSERT INTO public.fixed_costs (name, price_per_unit, unit) VALUES
  ('Sticker', 0.09, 'stuks'),
  ('Broodzak', 0.05, 'stuks'),
  ('Kartonnen bakje', 0.34, 'stuks'),
  ('Stroomverbruik oven', 0.50, 'uur');