ALTER TABLE public.push_subscriptions
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_subscription_key;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_id_key UNIQUE (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

DROP POLICY IF EXISTS "Users manage own push subscription select" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users manage own push subscription insert" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users manage own push subscription update" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users manage own push subscription delete" ON public.push_subscriptions;

CREATE POLICY "Users can view own push subscription"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own push subscription"
ON public.push_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscription"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscription"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);