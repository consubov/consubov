ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;