-- CONSUBOV P0 / PR #122: safe, read-only preflight for the exposed push RPC.
-- Re-run in authorized staging before any push Edge or credentials cutover.
-- This checks ACL exposure only, not tenant authorization or release readiness.
-- A NO_GO result blocks the release. Do not apply migrations in this script.

SELECT CASE
  WHEN p.oid IS NULL THEN 'NO_GO_FUNCTION_NOT_FOUND'
  WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'NO_GO_ANON_RPC'
  WHEN p.prosecdef AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    THEN 'NO_GO_AUTHENTICATED_SECURITY_DEFINER'
  ELSE 'ACL_GATE_ONLY_PASS_NOT_RELEASE_APPROVAL'
END AS gate,
COALESCE(p.prosecdef, false) AS security_definer,
CASE WHEN p.oid IS NULL THEN NULL
  ELSE has_function_privilege('authenticated', p.oid, 'EXECUTE')
END AS authenticated_execute,
CASE WHEN p.oid IS NULL THEN NULL
  ELSE has_function_privilege('anon', p.oid, 'EXECUTE')
END AS anon_execute
FROM (
  SELECT to_regprocedure(
    'public.send_push_async(text,text,text,uuid,uuid,boolean)'
  ) AS fn
) target
LEFT JOIN pg_proc p ON p.oid = target.fn;
