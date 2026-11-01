-- CONSUBOV P0 / PR #122: read-only preflight for direct + indirect privileged push paths.
-- No sends, DDL, DML, GRANT/REVOKE, pg_net calls or secret values.
-- The two elevated SECURITY DEFINER RPCs must not be executable by anonymous
-- or authenticated application roles. Re-run with F12 owner in staging.
-- PASS here is ONLY a metadata check; real trigger/cron and rollback QA remain.
--
-- Discovered in production catalog 2026-10-29:
-- public.send_push_async(...) is used by 4 triggers and overdue-salt routine.
-- public.verificar_salgas_atrasadas() is invoked hourly by cron as postgres.
-- Revoking authenticated on the first function ALONE does not close the second.

WITH expected(signature, label) AS (
  VALUES
    ('public.send_push_async(text,text,text,uuid,uuid,boolean)', 'direct_push_rpc'),
    ('public.verificar_salgas_atrasadas()', 'indirect_hourly_push_rpc')
), resolved AS (
  SELECT e.label, to_regprocedure(e.signature) AS oid FROM expected e
)
SELECT r.label,
  CASE
    WHEN p.oid IS NULL THEN 'NO_GO_FUNCTION_MISSING'
    WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'NO_GO_ANON_EXECUTE'
    WHEN p.prosecdef AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
      THEN 'NO_GO_AUTHENTICATED_DEFINER'
    WHEN NOT p.prosecdef THEN 'REVIEW_SECURITY_INVOKER_CHANGE'
    ELSE 'ACL_ONLY_PASS_NOT_RELEASE_APPROVAL'
  END AS gate,
  COALESCE(p.prosecdef, false) AS security_definer,
  CASE WHEN p.oid IS NULL THEN NULL
    ELSE has_function_privilege('authenticated', p.oid, 'EXECUTE')
  END AS authenticated_execute,
  CASE WHEN p.oid IS NULL THEN NULL
    ELSE has_function_privilege('service_role', p.oid, 'EXECUTE')
  END AS service_role_execute,
  pg_get_userbyid(p.proowner) AS owner
FROM resolved r
LEFT JOIN pg_proc p ON p.oid = r.oid
ORDER BY r.label;

-- Structural cron preservation gate. This does NOT execute the scheduled job.
SELECT 'overdue_salt_hourly_cron' AS label,
  CASE
    WHEN count(*) = 0 THEN 'NO_GO_CRON_MISSING'
    WHEN count(*) <> 1 THEN 'NO_GO_DUPLICATE_CRON_JOBS'
    WHEN count(*) FILTER (
      WHERE active
        AND username = 'postgres'
        AND lower(command) LIKE '%verificar_salgas_atrasadas%'
    ) <> 1 THEN 'NO_GO_CRON_DISABLED_OR_CALLER_CHANGED'
    ELSE 'CRON_METADATA_ONLY_PASS_NOT_EXECUTION_QA'
  END AS gate,
  count(*) AS matched_jobs,
  count(*) FILTER (WHERE active) AS active_jobs,
  string_agg(DISTINCT username, ',') AS executor_roles
FROM cron.job
WHERE jobname = 'verificar-salgas-atrasadas-hourly';
