-- Safe preflight/readback ONLY. PostgreSQL 17.
-- Before applying the candidate: authenticated_delete_denied=false is expected
-- in the legacy database. After applying it in LOCAL PG17, it must be true.
BEGIN TRANSACTION READ ONLY;
SELECT
  NOT has_table_privilege('authenticated', 'public.ciclos', 'DELETE') AS authenticated_delete_denied,
  has_table_privilege('authenticated', 'public.ciclos', 'SELECT') AS authenticated_select_preserved,
  has_table_privilege('authenticated', 'public.ciclos', 'UPDATE') AS authenticated_update_preserved,
  has_table_privilege('service_role', 'public.ciclos', 'DELETE') AS service_role_maintenance_preserved,
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.ciclos'::regclass) AS rls_enabled;
ROLLBACK;
