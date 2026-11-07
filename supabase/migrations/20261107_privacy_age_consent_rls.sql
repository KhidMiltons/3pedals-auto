-- 3 Pedals Auto KE privacy, age eligibility and RLS hardening
-- Applied to Supabase project dlejmelyeaaxcvelvzia on 2026-11-07.
-- Publicly readable marketplace content remains intentionally public; user-owned
-- records are protected by auth.uid()-scoped policies. Internal queues stay server-only.

CREATE TABLE IF NOT EXISTS public.privacy_consents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  analytics_allowed boolean NOT NULL DEFAULT false,
  marketing_allowed boolean NOT NULL DEFAULT false,
  policy_version text NOT NULL DEFAULT '2026-11-07',
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;

ALTER TABLE public.privacy_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own privacy consent" ON public.privacy_consents;
CREATE POLICY "Users manage their own privacy consent"
  ON public.privacy_consents FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.privacy_consents FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.privacy_consents TO authenticated;

-- Profile ownership is enforced by RLS. Protected columns cannot be client-edited.
DROP POLICY IF EXISTS "3 Pedals users update own profile" ON public.profiles;
CREATE POLICY "3 Pedals users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (name, phone, email, account_type, avatar_url, seller_slug)
  ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_3pedals_admin() THEN
    NEW.id := OLD.id;
    NEW.is_admin := OLD.is_admin;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile_privileged_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_profile_privileged_fields ON public.profiles;
CREATE TRIGGER guard_profile_privileged_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_fields();

-- Sellers cannot transfer listings or self-approve them. The existing
-- guard_3pedals_listing_changes trigger still permits approved -> sold.
CREATE OR REPLACE FUNCTION public.guard_listing_owner_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_3pedals_admin() THEN
    IF NEW.owner IS DISTINCT FROM OLD.owner THEN
      RAISE EXCEPTION 'Listing ownership cannot be changed by a seller';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND lower(coalesce(NEW.status, '')) NOT IN ('pending', 'sold') THEN
      RAISE EXCEPTION 'Only 3 Pedals Auto KE can approve or reject a listing';
    END IF;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_listing_owner_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_listing_owner_fields ON public.listings;
CREATE TRIGGER guard_listing_owner_fields
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_listing_owner_fields();

-- The age check runs before auth.users insertion. An under-13 signup is rejected
-- before an auth user or profile row can be stored.
CREATE OR REPLACE FUNCTION public.enforce_3pedals_minimum_signup_age()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  dob_text text;
  dob date;
BEGIN
  dob_text := NEW.raw_user_meta_data ->> 'date_of_birth';
  IF dob_text IS NULL OR btrim(dob_text) = '' THEN
    RAISE EXCEPTION 'Date of birth is required to create a 3 Pedals Auto KE account';
  END IF;
  BEGIN
    dob := dob_text::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Enter a valid date of birth';
  END;
  IF dob > CURRENT_DATE THEN
    RAISE EXCEPTION 'Date of birth cannot be in the future';
  END IF;
  IF dob > (CURRENT_DATE - INTERVAL '13 years')::date THEN
    RAISE EXCEPTION 'You must be at least 13 years old to create an account';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_3pedals_minimum_signup_age() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_3pedals_minimum_signup_age ON auth.users;
CREATE TRIGGER enforce_3pedals_minimum_signup_age
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_3pedals_minimum_signup_age();

-- Active promotion rows are public only through safe display columns. Payment
-- phone numbers, checkout IDs and M-Pesa receipt references are never selectable
-- by anon/authenticated clients.
DROP POLICY IF EXISTS "Public can read active promotion display fields" ON public.listing_promotions;
CREATE POLICY "Public can read active promotion display fields"
  ON public.listing_promotions FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND payment_status = 'verified'
    AND starts_at <= now()
    AND expires_at > now()
  );
DROP POLICY IF EXISTS "Sellers read own promotions" ON public.listing_promotions;
CREATE POLICY "Sellers read own promotions"
  ON public.listing_promotions FOR SELECT TO authenticated
  USING (seller_id = (SELECT auth.uid()) OR (SELECT public.is_3pedals_admin()));
REVOKE SELECT ON public.listing_promotions FROM anon, authenticated;
GRANT SELECT (
  id, listing_id, package_id, package_name, amount, duration_days,
  status, payment_status, starts_at, expires_at, created_at, updated_at
) ON public.listing_promotions TO anon;
GRANT SELECT (
  id, listing_id, seller_id, package_id, package_name, amount, duration_days,
  status, payment_status, starts_at, expires_at, created_at, updated_at
) ON public.listing_promotions TO authenticated;
ALTER VIEW public.active_listing_promotions SET (security_invoker = true);

-- Keep privileged RPCs callable only by the roles that actually need them.
REVOKE EXECUTE ON FUNCTION public.is_3pedals_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_3pedals_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_listing_sold(uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_listing_sold(uuid,numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.prepare_account_deletion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_meta_purchase_events(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meta_purchase_events(integer) TO service_role;
ALTER FUNCTION public.set_projects_updated_at() SET search_path = pg_catalog;
REVOKE ALL ON FUNCTION public.set_projects_updated_at() FROM PUBLIC, anon, authenticated;

-- Meta outbox events without affirmative marketing consent are never sent.
ALTER TABLE public.meta_event_outbox DROP CONSTRAINT IF EXISTS meta_event_outbox_status_check;
ALTER TABLE public.meta_event_outbox ADD CONSTRAINT meta_event_outbox_status_check
  CHECK (status = ANY (ARRAY['pending','processing','sent','failed','suppressed']::text[]));
