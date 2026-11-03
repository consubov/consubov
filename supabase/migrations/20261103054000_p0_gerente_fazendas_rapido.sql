-- P0: scoped manager farm lookup, including admin manager-preview.
-- Avoid RLS role checks repeated on the general-purpose farm endpoint.
-- SECURITY DEFINER is restricted to the current auth.uid(), verified
-- against the requested active manager (or active administrator).
CREATE OR REPLACE FUNCTION public.get_gerente_fazendas_rapido(p_gerente_id uuid)
RETURNS TABLE(id uuid, nome text, intervalo_padrao_dias integer, gmd_modo text, gerente_nome text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO pg_catalog, public, pg_temp
AS $function$
  SELECT f.id, f.nome, f.intervalo_padrao_dias, f.gmd_modo, g.nome
  FROM public.gerentes AS g
  CROSS JOIN LATERAL (
    SELECT g.fazenda_id AS farm_id
    UNION
    SELECT gf.fazenda_id
    FROM public.gerentes_fazendas AS gf
    WHERE gf.gerente_id = g.id
  ) AS membership
  JOIN public.fazendas AS f ON f.id = membership.farm_id
  WHERE g.id = p_gerente_id
    AND g.ativo IS TRUE
    AND (SELECT auth.uid()) IS NOT NULL
    AND (
      g.user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.administradores AS a
        WHERE a.user_id = (SELECT auth.uid()) AND a.ativo IS TRUE
      )
    )
  ORDER BY f.nome, f.id;
$function$;

REVOKE ALL ON FUNCTION public.get_gerente_fazendas_rapido(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gerente_fazendas_rapido(uuid) TO authenticated;
