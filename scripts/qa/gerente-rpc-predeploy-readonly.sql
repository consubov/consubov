-- Production read-only gate before exposing CONSUBOV manager v2.0.45.
-- Run on the target database AFTER migrations and BEFORE the web deploy.
-- Every row MUST be PASS. No table/data/permission changes are made.
WITH expected(name,signature,security_definer) AS (
  VALUES
  ('get_painel_mae_rapido','public.get_painel_mae_rapido(uuid,uuid,integer,integer)',false),
  ('get_gerente_fazendas_rapido','public.get_gerente_fazendas_rapido(uuid)',true),
  ('get_gerente_custos_rapido','public.get_gerente_custos_rapido(uuid,integer,integer)',false),
  ('get_gerente_curva_rapida','public.get_gerente_curva_rapida(uuid,uuid)',false),
  ('get_gerente_lancamentos_rapido','public.get_gerente_lancamentos_rapido(uuid,integer,integer)',false)
),
found AS (
  SELECT e.*,to_regprocedure(e.signature) AS oid
  FROM expected e
)
SELECT f.name,f.oid IS NOT NULL AS installed,
  COALESCE(p.prosecdef=f.security_definer,false) AS security_mode_ok,
  COALESCE(has_function_privilege('authenticated',f.oid,'EXECUTE'),false) AS authenticated_execute,
  NOT COALESCE(has_function_privilege('anon',f.oid,'EXECUTE'),true) AS anon_denied,
  CASE WHEN f.name='get_painel_mae_rapido'
       THEN COALESCE('statement_timeout=30s'=ANY(p.proconfig),false)
       ELSE true END AS timeout_config_ok,
  CASE WHEN f.oid IS NOT NULL
    AND COALESCE(p.prosecdef=f.security_definer,false)
    AND COALESCE(has_function_privilege('authenticated',f.oid,'EXECUTE'),false)
    AND NOT COALESCE(has_function_privilege('anon',f.oid,'EXECUTE'),true)
    AND CASE WHEN f.name='get_painel_mae_rapido'
      THEN COALESCE('statement_timeout=30s'=ANY(p.proconfig),false)
      ELSE true END
    THEN 'PASS' ELSE 'NO_GO' END AS deployment_gate
FROM found f LEFT JOIN pg_proc p ON p.oid=f.oid
ORDER BY f.name;
