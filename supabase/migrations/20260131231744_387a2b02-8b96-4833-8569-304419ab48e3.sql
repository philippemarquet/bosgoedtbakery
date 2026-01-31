-- Add delivery_date to weekly_menus
ALTER TABLE public.weekly_menus 
ADD COLUMN delivery_date date;

-- Create discount_groups table for tiered pricing across multiple products
CREATE TABLE public.discount_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discount_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies for discount_groups
CREATE POLICY "Bakers can manage discount groups"
ON public.discount_groups
FOR ALL
USING (has_role(auth.uid(), 'baker'::app_role))
WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

CREATE POLICY "Everyone can view discount groups"
ON public.discount_groups
FOR SELECT
USING (true);

-- Create junction table for products in discount groups
CREATE TABLE public.product_discount_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  discount_group_id uuid NOT NULL REFERENCES public.discount_groups(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(product_id, discount_group_id)
);

-- Enable RLS
ALTER TABLE public.product_discount_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_discount_groups
CREATE POLICY "Bakers can manage product discount groups"
ON public.product_discount_groups
FOR ALL
USING (has_role(auth.uid(), 'baker'::app_role))
WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

CREATE POLICY "Everyone can view product discount groups"
ON public.product_discount_groups
FOR SELECT
USING (true);

-- Create discount_group_tiers for tiered pricing per discount group
CREATE TABLE public.discount_group_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discount_group_id uuid NOT NULL REFERENCES public.discount_groups(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL DEFAULT 1,
  discount_percentage numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(discount_group_id, min_quantity)
);

-- Enable RLS
ALTER TABLE public.discount_group_tiers ENABLE ROW LEVEL SECURITY;

-- RLS policies for discount_group_tiers
CREATE POLICY "Bakers can manage discount group tiers"
ON public.discount_group_tiers
FOR ALL
USING (has_role(auth.uid(), 'baker'::app_role))
WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

CREATE POLICY "Everyone can view discount group tiers"
ON public.discount_group_tiers
FOR SELECT
USING (true);

-- Create orders table
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  weekly_menu_id uuid REFERENCES public.weekly_menus(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- RLS policies for orders
CREATE POLICY "Bakers can manage all orders"
ON public.orders
FOR ALL
USING (has_role(auth.uid(), 'baker'::app_role))
WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

CREATE POLICY "Customers can view their own orders"
ON public.orders
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = orders.customer_id 
  AND profiles.user_id = auth.uid()
));

-- Create order_items table
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  discount_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL,
  is_weekly_menu_item boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for order_items
CREATE POLICY "Bakers can manage all order items"
ON public.order_items
FOR ALL
USING (has_role(auth.uid(), 'baker'::app_role))
WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

CREATE POLICY "Customers can view their own order items"
ON public.order_items
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.orders o
  JOIN public.profiles p ON p.id = o.customer_id
  WHERE o.id = order_items.order_id
  AND p.user_id = auth.uid()
));

-- Add updated_at triggers
CREATE TRIGGER update_discount_groups_updated_at
BEFORE UPDATE ON public.discount_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();