
ALTER TABLE public.license_keys ADD COLUMN device_limit integer NOT NULL DEFAULT 1;
ALTER TABLE public.license_keys ADD COLUMN device_ids text[] NOT NULL DEFAULT ARRAY[]::text[];

-- Migrate existing device_id data to device_ids array
UPDATE public.license_keys SET device_ids = ARRAY[device_id] WHERE device_id IS NOT NULL AND device_id != '';
