
-- 1. Drop overly permissive profile UPDATE policies
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Resellers can credit user wallets" ON public.profiles;

-- 2. Admin can update any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Users can only update safe fields on their own profile
CREATE POLICY "Users can update own safe fields"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND wallet_balance IS NOT DISTINCT FROM (SELECT wallet_balance FROM public.profiles WHERE user_id = auth.uid())
  AND is_banned IS NOT DISTINCT FROM (SELECT is_banned FROM public.profiles WHERE user_id = auth.uid())
);

-- 4. Drop overly broad reseller SELECT
DROP POLICY IF EXISTS "Resellers can view user profiles" ON public.profiles;

-- 5. Fix payment-screenshots bucket: make private
UPDATE storage.buckets SET public = false WHERE id = 'payment-screenshots';

-- 6. Drop any existing storage policies for payment-screenshots
DROP POLICY IF EXISTS "Anyone can view screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload screenshots" ON storage.objects;

-- 7. Create proper storage policies for payment-screenshots
CREATE POLICY "Users can upload own payment screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own payment screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-screenshots' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 8. Storage policies for admin-assets (resellers need to upload logos)
CREATE POLICY "Authenticated users can upload to admin-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'admin-assets');

CREATE POLICY "Anyone can view admin-assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'admin-assets');
