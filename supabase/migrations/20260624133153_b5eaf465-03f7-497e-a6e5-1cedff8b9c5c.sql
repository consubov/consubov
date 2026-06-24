ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS endpoint text;

UPDATE public.push_subscriptions
SET endpoint = subscription->>'endpoint'
WHERE endpoint IS NULL;

WITH ranked AS (
  SELECT
    id,
    endpoint,
    row_number() OVER (PARTITION BY endpoint ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC) AS rn
  FROM public.push_subscriptions
)
DELETE FROM public.push_subscriptions p
USING ranked r
WHERE p.id = r.id
  AND (r.endpoint IS NULL OR r.endpoint = '' OR r.rn > 1);

ALTER TABLE public.push_subscriptions
  ALTER COLUMN endpoint SET NOT NULL;

ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_key;

ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_subscription_key;

ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_key;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_enabled
  ON public.push_subscriptions(user_id, enabled);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;