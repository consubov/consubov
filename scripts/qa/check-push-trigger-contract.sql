-- CONSUBOV P0 / PR #122: read-only dependency preflight for push triggers.
-- Does not prove trigger execution or ability to deliver notifications.
-- Run in staging before any change to execute grants, SQL or Edge functions.
-- Conservative: a changed handler owner blocks until reviewed/QAed.

WITH expected(table_name, trigger_name, handler_name) AS (
  VALUES
    ('mortalidades','trg_notificar_mortalidade','notificar_mortalidade'),
    ('observacoes','trg_notificar_observacao','notificar_observacao'),
    ('transferencias_estoque','trg_notificar_transferencia_estoque','notificar_transferencia_estoque'),
    ('transferencias_fabrica','trg_notificar_transferencia_fabrica','notificar_transferencia_fabrica')
),
target AS (
  SELECT to_regprocedure('public.send_push_async(text,text,text,uuid,uuid,boolean)') AS push_oid
)
SELECT e.table_name, e.trigger_name,
  CASE
    WHEN t.oid IS NULL THEN 'NO_GO_TRIGGER_MISSING'
    WHEN t.tgenabled NOT IN ('O','A') THEN 'NO_GO_TRIGGER_DISABLED'
    WHEN p.proname IS DISTINCT FROM e.handler_name THEN 'NO_GO_HANDLER_CHANGED'
    WHEN NOT COALESCE(p.prosecdef, false) THEN 'NO_GO_HANDLER_NOT_DEFINER'
    WHEN p.prosrc NOT ILIKE '%send_push_async%' THEN 'NO_GO_PUSH_CALL_MISSING'
    WHEN push.oid IS NULL THEN 'NO_GO_PUSH_RPC_MISSING'
    WHEN pg_get_userbyid(p.proowner) IS DISTINCT FROM pg_get_userbyid(push.proowner)
      THEN 'NO_GO_HANDLER_OWNER_CHANGED'
    ELSE 'TRIGGER_METADATA_ONLY_PASS_NOT_RELEASE_APPROVAL'
  END AS gate,
  t.tgenabled AS enabled_code,
  p.proname AS handler,
  pg_get_userbyid(p.proowner) AS handler_owner
FROM expected e
CROSS JOIN target
JOIN pg_namespace n ON n.nspname='public'
LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.table_name
LEFT JOIN pg_trigger t ON t.tgrelid=c.oid AND t.tgname=e.trigger_name AND NOT t.tgisinternal
LEFT JOIN pg_proc p ON p.oid=t.tgfoid
LEFT JOIN pg_proc push ON push.oid=target.push_oid
ORDER BY e.table_name;
