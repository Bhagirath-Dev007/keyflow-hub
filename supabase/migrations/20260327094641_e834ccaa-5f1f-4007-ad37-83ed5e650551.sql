
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'reseller');

-- Create transaction type enum
CREATE TYPE public.transaction_type AS ENUM ('credit', 'debit');

-- Create transaction source enum
CREATE TYPE public.transaction_source AS ENUM ('admin', 'manual', 'system', 'purchase', 'reseller');

-- Create key status enum
CREATE TYPE public.key_status AS ENUM ('active', 'expired', 'revoked', 'unused');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  wallet_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

-- Pricing table
CREATE TABLE public.pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  user_price DECIMAL(10,2) NOT NULL,
  reseller_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- License keys table
CREATE TABLE public.license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  plan_name TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  status key_status NOT NULL DEFAULT 'unused',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id TEXT,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  type transaction_type NOT NULL,
  source transaction_source NOT NULL DEFAULT 'system',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Security definer function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Pricing policies (everyone can read, admin can manage)
CREATE POLICY "Anyone can view pricing" ON public.pricing
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage pricing" ON public.pricing
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- License keys policies
CREATE POLICY "Users can view own keys" ON public.license_keys
  FOR SELECT USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins and resellers can insert keys" ON public.license_keys
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'reseller')
  );

CREATE POLICY "Admins can update keys" ON public.license_keys
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'reseller') AND created_by = auth.uid())
    OR assigned_to = auth.uid()
  );

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System and admin can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR user_id = auth.uid()
  );

-- Activity logs policies
CREATE POLICY "Admins can view all logs" ON public.activity_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert logs" ON public.activity_logs
  FOR INSERT WITH CHECK (true);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Timestamp update trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pricing_updated_at
  BEFORE UPDATE ON public.pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_license_keys_assigned_to ON public.license_keys(assigned_to);
CREATE INDEX idx_license_keys_key ON public.license_keys(key);
CREATE INDEX idx_license_keys_status ON public.license_keys(status);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
