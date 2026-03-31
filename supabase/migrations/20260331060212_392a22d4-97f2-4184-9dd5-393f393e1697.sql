
-- Allow admins to delete license keys
CREATE POLICY "Admins can delete keys" ON public.license_keys FOR DELETE TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete user_roles
CREATE POLICY "Admins can delete user_roles" ON public.user_roles FOR DELETE TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete transactions for cleanup
CREATE POLICY "Admins can delete transactions" ON public.transactions FOR DELETE TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete activity_logs for cleanup
CREATE POLICY "Admins can delete activity_logs" ON public.activity_logs FOR DELETE TO public USING (has_role(auth.uid(), 'admin'::app_role));
