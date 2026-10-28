-- F12 P1 - CANDIDATE ONLY. NOT a Supabase migration.
-- Run ONLY in an isolated PostgreSQL 17 environment after checking dependencies.
-- Do not run against the remote legacy database without separate authorization.
-- Does NOT change public.lancamentos, RLS policies, cron, or function grants.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';

DO $check$
BEGIN
  IF current_setting('server_version_num')::int < 170000 THEN
    RAISE EXCEPTION 'Requires PostgreSQL 17 or newer';
  END IF;
  -- Fail closed if someone accidentally executes the candidate against Supabase.
  IF current_database() !~ '^consubov_qa_' OR
     current_setting('consubov.qa_isolated_pg17', true) IS DISTINCT FROM 'acknowledged' THEN
    RAISE EXCEPTION 'Candidate restricted to a named isolated QA database';
  END IF;
  IF to_regclass('public.ciclos') IS NULL THEN
    RAISE EXCEPTION 'public.ciclos is missing';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.ciclos', 'DELETE') THEN
    RAISE EXCEPTION 'Expected service_role DELETE grant is missing';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.ciclos', 'SELECT') OR
     NOT has_table_privilege('authenticated', 'public.ciclos', 'UPDATE') THEN
    RAISE EXCEPTION 'Expected authenticated SELECT/UPDATE grants differ';
  END IF;
END
$check$;

-- Fail closed: legacy clients may no longer physically delete cycles.
-- Maintenance roles remain unchanged. No policy is activated here.
REVOKE DELETE ON TABLE public.ciclos FROM authenticated;

DO $check$
BEGIN
  IF has_table_privilege('authenticated', 'public.ciclos', 'DELETE') THEN
    RAISE EXCEPTION 'DELETE still allowed (inherited or PUBLIC grant?)';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.ciclos', 'DELETE') THEN
    RAISE EXCEPTION 'Service maintenance DELETE grant was lost';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.ciclos', 'SELECT') OR
     NOT has_table_privilege('authenticated', 'public.ciclos', 'UPDATE') THEN
    RAISE EXCEPTION 'Legitimate read/reopen grants were changed';
  END IF;
END
$check$;
COMMIT;
