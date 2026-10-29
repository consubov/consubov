-- Read-only preflight/readback. No change to PostgreSQL privileges or rows.
-- Before local candidate: authenticated_update/delete_denied = false.
-- After local candidate: these should be true. INSERT remains permitted,
-- but direct forged client INSERT remains possible until server-side logging.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT
  NOT has_table_privilege('authenticated', 'public.ciclos_auditoria', 'UPDATE') AS authenticated_update_denied,
  NOT has_table_privilege('authenticated', 'public.ciclos_auditoria', 'DELETE') AS authenticated_delete_denied,
  has_table_privilege('authenticated', 'public.ciclos_auditoria', 'SELECT') AS authenticated_select_preserved,
  has_table_privilege('authenticated', 'public.ciclos_auditoria', 'INSERT') AS authenticated_insert_preserved,
  has_table_privilege('service_role', 'public.ciclos_auditoria', 'UPDATE') AS service_update_preserved,
  has_table_privilege('service_role', 'public.ciclos_auditoria', 'DELETE') AS service_delete_preserved,
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.ciclos_auditoria'::regclass) AS rls_enabled;
ROLLBACK;
