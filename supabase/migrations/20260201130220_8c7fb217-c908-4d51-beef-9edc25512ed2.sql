-- Add status column to weekly_menus for manual control
-- Status: 'active', 'upcoming', 'expired'
ALTER TABLE public.weekly_menus 
ADD COLUMN status text NOT NULL DEFAULT 'upcoming';

-- Add is_archived column to profiles for soft delete
ALTER TABLE public.profiles
ADD COLUMN is_archived boolean NOT NULL DEFAULT false;

-- Update RLS policy for weekly menus to only show active ones to customers
DROP POLICY IF EXISTS "Everyone can view active weekly menus" ON public.weekly_menus;

CREATE POLICY "Everyone can view active weekly menus" 
ON public.weekly_menus 
FOR SELECT 
USING (status = 'active');

-- Update the weekly_menu_products policy to match
DROP POLICY IF EXISTS "Everyone can view active menu products" ON public.weekly_menu_products;

CREATE POLICY "Everyone can view active menu products" 
ON public.weekly_menu_products 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM weekly_menus 
  WHERE weekly_menus.id = weekly_menu_products.weekly_menu_id 
  AND weekly_menus.status = 'active'
));