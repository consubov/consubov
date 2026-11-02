-- CONSUBOV P0 / PR #122: read-only ACL gate for exposed push RPC.
-- Execute in authorized staging before Edge/credential cutover.
-- Checks direct API risk and machine permission; not tenant QA or release approval.
-- A NO_GO result blocks release. Never change grants/migrations here.

SELECT CASE
  WHEN p.oid IS NULL THEN 'NO_GO_FUNCTION_NOT_FOUND'
  WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'NO_GO_ANON_RPC'
  WHEN p.prosecdef AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    THEN 'NO_GO_AUTHENTICATED_SECURITY_DEFINER'
  WHEN NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
    THEN 'NO_GO_SERVICE_ROLE_EXECUTE_MISSING'
  ELSE 'ACL_GATE_ONLY_PASS_NOT_RELEASE_APPROVAL'
END AS gate,
COALESCE(p.prosecdef, false) AS security_definer,
CASE WHEN p.oid IS NULL THEN NULL
  ELSE has_function_privilege('authenticated', p.oid, 'EXECUTE')
END AS authenticated_execute,
CASE WHEN p.oid IS NULL THEN NULL
  ELSE has_function_privilege('anon', p.oid, 'EXECUTE')
END AS anon_execute,
CASE WHEN p.oid IS NULL THEN NULL
  ELSE has_function_privilege('service_role', p.oid, 'EXECUTE')
END AS service_role_execute
FROM (
  SELECT to_regprocedure('public.send_push_async(text,text,text,uuid,uuid,boolean)') AS fn
) target
LEFT JOIN pg_proc p ON p.oid = target.fn;
