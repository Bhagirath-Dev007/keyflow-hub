
-- Create referral_codes table
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  level app_role NOT NULL DEFAULT 'reseller',
  bonus_balance NUMERIC NOT NULL DEFAULT 0,
  expiration_days INTEGER NOT NULL DEFAULT 30,
  max_uses INTEGER NOT NULL DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins can manage referral codes" ON public.referral_codes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view referral codes" ON public.referral_codes FOR SELECT TO authenticated USING (true);

-- Create referral_uses table
CREATE TABLE public.referral_uses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code_id UUID NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  used_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins can manage referral uses" ON public.referral_uses FOR ALL TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own referral use" ON public.referral_uses FOR INSERT TO authenticated WITH CHECK (used_by = auth.uid());
CREATE POLICY "Users can view own referral uses" ON public.referral_uses FOR SELECT TO authenticated USING (used_by = auth.uid());

-- Create features table
CREATE TABLE public.features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  app_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name, app_name)
);
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins can manage features" ON public.features FOR ALL TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone authenticated can read features" ON public.features FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can read features" ON public.features FOR SELECT TO anon USING (true);

-- Create mod_config table
CREATE TABLE public.mod_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_name TEXT NOT NULL UNIQUE,
  mod_name TEXT NOT NULL DEFAULT '',
  status_text TEXT NOT NULL DEFAULT 'MOD STATUS :- ACTIVE',
  master_switch BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.mod_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins can manage mod config" ON public.mod_config FOR ALL TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone authenticated can read mod config" ON public.mod_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can read mod config" ON public.mod_config FOR SELECT TO anon USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_referral_codes_updated_at BEFORE UPDATE ON public.referral_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_features_updated_at BEFORE UPDATE ON public.features FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_mod_config_updated_at BEFORE UPDATE ON public.mod_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update all existing policies to include owner role
DROP POLICY IF EXISTS "Users can view own keys" ON public.license_keys;
CREATE POLICY "Users can view own keys" ON public.license_keys FOR SELECT
USING (assigned_to = auth.uid() OR created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "Admins and resellers can insert keys" ON public.license_keys;
CREATE POLICY "Admins resellers owners can insert keys" ON public.license_keys FOR INSERT
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'reseller'::app_role));

DROP POLICY IF EXISTS "Admins can update keys" ON public.license_keys;
CREATE POLICY "Owners admins resellers can update keys" ON public.license_keys FOR UPDATE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR (has_role(auth.uid(), 'reseller'::app_role) AND created_by = auth.uid()) OR assigned_to = auth.uid());

DROP POLICY IF EXISTS "Admins can delete keys" ON public.license_keys;
CREATE POLICY "Owners and admins can delete keys" ON public.license_keys FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Owners admins can update any profile" ON public.profiles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Owners admins can delete profiles" ON public.profiles FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Owners admins can manage roles" ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete user_roles" ON public.user_roles;
CREATE POLICY "Owners admins can delete user_roles" ON public.user_roles FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Resellers can view own role" ON public.user_roles;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "Admins can insert transactions" ON public.transactions;
CREATE POLICY "Owners admins can insert transactions" ON public.transactions FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete transactions" ON public.transactions;
CREATE POLICY "Owners admins can delete transactions" ON public.transactions FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update requests" ON public.wallet_requests;
CREATE POLICY "Owners admins can update requests" ON public.wallet_requests FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete requests" ON public.wallet_requests;
CREATE POLICY "Owners admins can delete requests" ON public.wallet_requests FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all logs" ON public.activity_logs;
CREATE POLICY "Owners admins can view all logs" ON public.activity_logs FOR SELECT
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete activity_logs" ON public.activity_logs;
CREATE POLICY "Owners admins can delete activity_logs" ON public.activity_logs FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage settings" ON public.admin_settings;
CREATE POLICY "Owners admins can manage settings" ON public.admin_settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage pricing" ON public.pricing;
CREATE POLICY "Owners admins can manage pricing" ON public.pricing FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
