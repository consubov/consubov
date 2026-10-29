-- CONSUBOV F12 / CICLOS. CANDIDATE FOR ISOLATED PG17 QA ONLY.
-- NOT a migration. DO NOT execute against remote Supabase.
-- This prevents direct UPDATE/DELETE of existing audit rows by authenticated.
-- INSERT remains permitted to avoid breaking the legacy UI, so audit forgery
-- through INSERT is STILL POSSIBLE. True audit integrity requires a trusted,
-- atomic server-side writer and scoped RLS; this candidate is not a full fix.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

DO $guard$
BEGIN
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'PostgreSQL 17 or later required';
  END IF;
  IF current_database() !~ '^consubov_qa_[a-z0-9_]+$' OR
     current_setting('consubov.qa_isolated_pg17', true) IS DISTINCT FROM 'acknowledged' THEN
    RAISE EXCEPTION 'Only explicit isolated CONSUBOV QA databases are allowed';
  END IF;
  IF to_regclass('public.ciclos_auditoria') IS NULL THEN
    RAISE EXCEPTION 'public.ciclos_auditoria is missing';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.ciclos_auditoria', 'INSERT') OR
     NOT has_table_privilege('authenticated', 'public.ciclos_auditoria', 'SELECT') THEN
    RAISE EXCEPTION 'Legacy SELECT/INSERT privilege baseline differs';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.ciclos_auditoria', 'UPDATE') OR
     NOT has_table_privilege('service_role', 'public.ciclos_auditoria', 'DELETE') THEN
    RAISE EXCEPTION 'Maintenance privilege baseline differs';
  END IF;
END
$guard$;

REVOKE UPDATE, DELETE ON TABLE public.ciclos_auditoria FROM authenticated;

DO $verify$
BEGIN
  IF has_table_privilege('authenticated', 'public.ciclos_auditoria', 'UPDATE') OR
     has_table_privilege('authenticated', 'public.ciclos_auditoria', 'DELETE') THEN
    RAISE EXCEPTION 'Authenticated audit UPDATE/DELETE remains allowed';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.ciclos_auditoria', 'SELECT') OR
     NOT has_table_privilege('authenticated', 'public.ciclos_auditoria', 'INSERT') THEN
    RAISE EXCEPTION 'Legacy read or append permission was lost';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.ciclos_auditoria', 'UPDATE') OR
     NOT has_table_privilege('service_role', 'public.ciclos_auditoria', 'DELETE') THEN
    RAISE EXCEPTION 'Maintenance UPDATE/DELETE permission was lost';
  END IF;
END
$verify$;
COMMIT;
