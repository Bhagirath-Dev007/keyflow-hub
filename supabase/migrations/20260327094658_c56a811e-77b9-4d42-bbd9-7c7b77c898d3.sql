
-- Fix overly permissive activity_logs insert policy
DROP POLICY "Anyone can insert logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can insert logs" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
