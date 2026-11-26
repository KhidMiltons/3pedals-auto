-- 3 Pedals Auto KE weekly automotive insights newsletter subscriptions
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  topics text[] NOT NULL DEFAULT ARRAY['arrivals', 'drops']::text[],
  cadence text NOT NULL DEFAULT 'weekly' CHECK (cadence = 'weekly'),
  lang text NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'sw')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  source text NOT NULL DEFAULT 'footer',
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_subscriptions_status_idx
  ON public.newsletter_subscriptions (status, updated_at DESC);

ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.newsletter_subscriptions FROM anon, authenticated, public;
GRANT SELECT, INSERT, UPDATE ON public.newsletter_subscriptions TO service_role;
