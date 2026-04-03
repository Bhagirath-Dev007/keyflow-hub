
-- Add app_name column to license_keys
ALTER TABLE public.license_keys
ADD COLUMN app_name text NOT NULL DEFAULT '';
