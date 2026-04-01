
-- Create payment_status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'approved', 'rejected');

-- Wallet top-up requests table
CREATE TABLE public.wallet_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  screenshot_url text,
  admin_note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_requests ENABLE ROW LEVEL SECURITY;

-- Users can view own requests, admins can view all
CREATE POLICY "Users can view own requests" ON public.wallet_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Users can create requests
CREATE POLICY "Users can create requests" ON public.wallet_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can update requests" ON public.wallet_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete requests
CREATE POLICY "Admins can delete requests" ON public.wallet_requests
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin settings table for QR image etc
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings" ON public.admin_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage settings" ON public.admin_settings
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Add panel branding columns to profiles
ALTER TABLE public.profiles ADD COLUMN panel_name text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN logo_url text DEFAULT '';

-- Storage bucket for payment screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-screenshots', 'payment-screenshots', true);

-- Storage bucket for admin QR images
INSERT INTO storage.buckets (id, name, public) VALUES ('admin-assets', 'admin-assets', true);

-- Storage policies for payment-screenshots
CREATE POLICY "Authenticated users can upload screenshots" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-screenshots');

CREATE POLICY "Anyone can view screenshots" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-screenshots');

-- Storage policies for admin-assets
CREATE POLICY "Admins can upload admin assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view admin assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'admin-assets');

CREATE POLICY "Admins can delete admin assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'admin-assets' AND public.has_role(auth.uid(), 'admin'::app_role));
