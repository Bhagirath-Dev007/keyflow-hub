
-- 1. Fix admin_settings: remove public SELECT, keep admin-only
DROP POLICY IF EXISTS "Anyone can view settings" ON public.admin_settings;

-- Add a policy so resellers can only read the payment_qr_url setting
CREATE POLICY "Authenticated can read payment QR setting"
ON public.admin_settings FOR SELECT
TO authenticated
USING (setting_key = 'payment_qr_url');

-- 2. Fix transactions: remove self-insert policy
DROP POLICY IF EXISTS "System and admin can insert transactions" ON public.transactions;

-- Only admins can insert transactions directly
CREATE POLICY "Admins can insert transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Keep reseller insert but scope it to debit only for purchases
DROP POLICY IF EXISTS "Resellers can insert transactions" ON public.transactions;
CREATE POLICY "Resellers can insert own debit transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'reseller'::app_role)
  AND user_id = auth.uid()
  AND type = 'debit'
);

-- 3. Fix storage: remove overly permissive admin-assets upload
DROP POLICY IF EXISTS "Authenticated users can upload to admin-assets" ON storage.objects;

-- Resellers can upload only to their own logos folder
CREATE POLICY "Users can upload own logos to admin-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'admin-assets'
  AND (storage.foldername(name))[1] = 'logos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 4. Fix payment-screenshots: remove unscoped INSERT if exists
DROP POLICY IF EXISTS "Authenticated users can upload screenshots" ON storage.objects;

-- Add admin DELETE policy for payment-screenshots
CREATE POLICY "Admins can delete payment screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-screenshots'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- 5. Fix user_roles: restrict reseller SELECT to own role only
DROP POLICY IF EXISTS "Resellers can view user roles" ON public.user_roles;
CREATE POLICY "Resellers can view own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());
