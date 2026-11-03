-- P0 gerente: curva mensal agregada no banco, sem leitura da view de 10 mil linhas.
-- Fonte e formula de cab_dias seguem public.view_lancamento_consumo_real.
CREATE OR REPLACE FUNCTION public.get_gerente_curva_rapida(
  p_fazenda_id uuid, p_retiro_id uuid DEFAULT NULL
)
RETURNS TABLE (
  ano_referencia integer, mes_referencia integer,
  kg_fornecido numeric, cab_dias_assumidos numeric
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO pg_catalog, public, pg_temp
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF CURRENT_USER <> 'authenticated' OR v_uid IS NULL THEN
    RAISE EXCEPTION 'Acesso nao autorizado' USING ERRCODE='42501';
  END IF;
  IF p_fazenda_id IS NULL OR (p_retiro_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.retiros r WHERE r.id=p_retiro_id AND r.fazenda_id=p_fazenda_id
  )) THEN
    RAISE EXCEPTION 'Escopo invalido' USING ERRCODE='42501';
  END IF;
  IF NOT (
    public.is_admin(v_uid)
    OR EXISTS (
      SELECT 1 FROM public.gerentes g
      WHERE g.user_id=v_uid AND g.ativo IS TRUE AND (
        g.fazenda_id=p_fazenda_id OR EXISTS (
          SELECT 1 FROM public.gerentes_fazendas gf
          WHERE gf.gerente_id=g.id AND gf.fazenda_id=p_fazenda_id
        )
      )
    )
  ) THEN
    RAISE EXCEPTION 'Fazenda nao autorizada' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  WITH scoped AS MATERIALIZED (
    SELECT r.id,r.produto_id,r.intervalo_padrao_dias
    FROM public.retiros r
    WHERE r.fazenda_id=p_fazenda_id AND (p_retiro_id IS NULL OR r.id=p_retiro_id)
  ),
  events AS MATERIALIZED (
    SELECT l.id,l.pasto_id,l.created_at,
      (l.num_sacos>0) AS is_prod,
      (COALESCE(l.cocho_cheio,false) AND l.num_sacos<=0) AS is_cc
    FROM public.lancamentos l
    JOIN scoped r ON r.id=l.retiro_id
    WHERE l.fazenda_id=p_fazenda_id
      AND (l.num_sacos>0 OR l.cocho_cheio IS TRUE)
  ),
  ordered AS (
    SELECT e.*,
      SUM(e.is_prod::int) OVER (
        PARTITION BY e.pasto_id
        ORDER BY e.created_at,e.is_prod DESC,e.id
        ROWS UNBOUNDED PRECEDING
      ) AS grp
    FROM events e
  ),
  cc AS MATERIALIZED (
    SELECT (ARRAY_AGG(id) FILTER(WHERE is_prod))[1] AS prod_id,
      COUNT(*) FILTER(WHERE is_cc)::int AS n_cc
    FROM ordered GROUP BY pasto_id,grp
  ),
  raw AS MATERIALIZED (
    SELECT l.ano_referencia,l.mes_referencia,l.num_sacos,
      COALESCE(NULLIF(l.num_animais,0),p.num_animais,0) AS animais,
      l.created_at,l.cobertura_dias_override,
      COALESCE(p.intervalo_padrao_dias,r.intervalo_padrao_dias,f.intervalo_padrao_dias,4) AS intervalo_padrao_dias,
      p.num_animais AS animais_hoje,
      COALESCE(cc.n_cc,0) AS n_cc,
      ROW_NUMBER() OVER (PARTITION BY l.pasto_id ORDER BY l.created_at DESC) AS rn,
      COALESCE(prod.peso_saco_kg,0) AS saco_kg
    FROM public.lancamentos l
    JOIN scoped r ON r.id=l.retiro_id
    JOIN public.pastos p ON p.id=l.pasto_id AND p.retiro_id=r.id
    JOIN public.fazendas f ON f.id=p_fazenda_id
    LEFT JOIN public.ocupacoes_pasto ocup ON ocup.id=l.ocupacao_id
      AND ocup.fazenda_id=p_fazenda_id AND ocup.retiro_id=r.id AND ocup.pasto_id=l.pasto_id
    LEFT JOIN public.produtos prod ON prod.id=COALESCE(ocup.produto_id,p.produto_id,r.produto_id)
    LEFT JOIN cc ON cc.prod_id=l.id
    WHERE l.fazenda_id=p_fazenda_id AND l.num_sacos>0
      AND COALESCE(NULLIF(l.num_animais,0),p.num_animais,0)>0
  ),
  adjusted AS (
    SELECT b.*,
      CASE
        WHEN b.cobertura_dias_override IS NOT NULL THEN b.cobertura_dias_override
        WHEN b.rn=1 AND COALESCE(b.animais_hoje,0)>0
          THEN GREATEST(
            COALESCE(b.intervalo_padrao_dias,4)*(1+b.n_cc),
            LEAST(
              (NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
              (DATE_TRUNC('month',b.created_at AT TIME ZONE 'America/Sao_Paulo')
                + INTERVAL '1 mon -1 days')::date
            ) - (b.created_at AT TIME ZONE 'America/Sao_Paulo')::date
          )
        ELSE COALESCE(b.intervalo_padrao_dias,4)*(1+b.n_cc)
      END AS dias_considerados
    FROM raw b
  )
  SELECT a.ano_referencia,a.mes_referencia,
    SUM(a.num_sacos::numeric*a.saco_kg) AS kg_fornecido,
    SUM(a.animais::numeric*a.dias_considerados) AS cab_dias_assumidos
  FROM adjusted a
  WHERE a.ano_referencia IS NOT NULL AND a.mes_referencia BETWEEN 1 AND 12
  GROUP BY a.ano_referencia,a.mes_referencia
  ORDER BY a.ano_referencia DESC,a.mes_referencia;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gerente_curva_rapida(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gerente_curva_rapida(uuid,uuid) TO authenticated;
