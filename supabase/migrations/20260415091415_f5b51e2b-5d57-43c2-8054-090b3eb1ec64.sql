
-- 1. Atomic wallet deduction RPC for key generation
CREATE OR REPLACE FUNCTION public.deduct_wallet_balance(
  _user_id uuid,
  _amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance numeric;
BEGIN
  UPDATE profiles
  SET wallet_balance = wallet_balance - _amount,
      updated_at = now()
  WHERE user_id = _user_id
    AND wallet_balance >= _amount
    AND is_banned = false
  RETURNING wallet_balance INTO _new_balance;

  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient balance or account banned';
  END IF;

  RETURN _new_balance;
END;
$$;

-- 2. Atomic wallet approval RPC (checks pending status atomically)
CREATE OR REPLACE FUNCTION public.approve_wallet_request(
  _request_id uuid,
  _admin_note text DEFAULT ''
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _amount numeric;
  _new_balance numeric;
BEGIN
  -- Atomically flip status from pending to approved
  UPDATE wallet_requests
  SET status = 'approved', admin_note = _admin_note, updated_at = now()
  WHERE id = _request_id AND status = 'pending'
  RETURNING user_id, amount INTO _user_id, _amount;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Atomically credit balance
  UPDATE profiles
  SET wallet_balance = wallet_balance + _amount, updated_at = now()
  WHERE user_id = _user_id
  RETURNING wallet_balance INTO _new_balance;

  -- Record transaction
  INSERT INTO transactions (user_id, amount, type, source, note)
  VALUES (_user_id, _amount, 'credit', 'admin',
    'Balance request approved' || CASE WHEN _admin_note != '' THEN ': ' || _admin_note ELSE '' END);

  RETURN _new_balance;
END;
$$;

-- 3. Atomic reject RPC
CREATE OR REPLACE FUNCTION public.reject_wallet_request(
  _request_id uuid,
  _admin_note text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE wallet_requests
  SET status = 'rejected', admin_note = _admin_note, updated_at = now()
  WHERE id = _request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;
END;
$$;

-- 4. Remove direct INSERT policy on referral_uses (edge function uses service role)
DROP POLICY IF EXISTS "Users can insert own referral use" ON referral_uses;

-- 5. Add explicit UPDATE deny on payment-screenshots bucket
CREATE POLICY "No updates on payment screenshots"
ON storage.objects FOR UPDATE
USING (bucket_id = 'payment-screenshots' AND false);
