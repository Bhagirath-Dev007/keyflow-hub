
-- Allow resellers to view user profiles and user_roles (for their user management page)
CREATE POLICY "Resellers can view user profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'reseller'::app_role));

CREATE POLICY "Resellers can view user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'reseller'::app_role));

-- Allow resellers to update user wallet balances
CREATE POLICY "Resellers can credit user wallets"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'reseller'::app_role));

-- Allow resellers to insert transactions (for balance transfers)
CREATE POLICY "Resellers can insert transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'reseller'::app_role));
