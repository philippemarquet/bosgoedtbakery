-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true);

-- RLS policies for product images bucket
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Bakers can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND has_role(auth.uid(), 'baker'::app_role));

CREATE POLICY "Bakers can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'baker'::app_role));

CREATE POLICY "Bakers can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'baker'::app_role));

-- Add image_url column to products
ALTER TABLE public.products
ADD COLUMN image_url text;

-- Create pickup_locations table
CREATE TABLE public.pickup_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  street text NOT NULL,
  house_number text,
  postal_code text NOT NULL,
  city text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pickup_locations ENABLE ROW LEVEL SECURITY;

-- RLS policies for pickup_locations
CREATE POLICY "Bakers can manage pickup locations"
ON public.pickup_locations
FOR ALL
USING (has_role(auth.uid(), 'baker'::app_role))
WITH CHECK (has_role(auth.uid(), 'baker'::app_role));

CREATE POLICY "Everyone can view active pickup locations"
ON public.pickup_locations
FOR SELECT
USING (is_active = true);

-- Add pickup_location_id to orders
ALTER TABLE public.orders
ADD COLUMN pickup_location_id uuid REFERENCES public.pickup_locations(id);

-- Add trigger for updated_at
CREATE TRIGGER update_pickup_locations_updated_at
BEFORE UPDATE ON public.pickup_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();