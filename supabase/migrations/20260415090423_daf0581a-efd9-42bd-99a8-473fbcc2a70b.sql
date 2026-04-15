
-- =============================================
-- FIX 1: user_roles — remove ALL policy, add explicit policies with INSERT restriction
-- =============================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Owners admins can manage roles" ON public.user_roles;

-- Owners/admins can view all roles (keep existing user self-view)
CREATE POLICY "Owners admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Only owners/admins can INSERT roles
CREATE POLICY "Owners admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Only owners/admins can UPDATE roles
CREATE POLICY "Owners admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Keep existing delete policy (already restricted to owners/admins)

-- =============================================
-- FIX 2: referral_codes — restrict SELECT to owners/admins only
-- =============================================

DROP POLICY IF EXISTS "Authenticated can view referral codes" ON public.referral_codes;

-- Only owners/admins can see referral codes
CREATE POLICY "Owners admins can view referral codes"
ON public.referral_codes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- FIX 3: admin-assets storage — add UPDATE policy
-- =============================================

CREATE POLICY "Owners admins can update admin assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'admin-assets' 
  AND (
    (SELECT public.has_role(auth.uid(), 'owner'::public.app_role))
    OR (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);
