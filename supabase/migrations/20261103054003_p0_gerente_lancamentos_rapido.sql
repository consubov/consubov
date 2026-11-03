-- P0 gerente: verified monthly launch snapshot without materializing the
-- expensive global security-barrier view_consumo_tempo_real.
-- Formula and latest/cocho semantics mirror that existing view.
CREATE OR REPLACE FUNCTION public.get_gerente_lancamentos_rapido(
  p_fazenda_id uuid, p_mes integer, p_ano integer
)
RETURNS TABLE (
  id uuid, pasto_id uuid, num_sacos integer, num_animais integer,
  peso_medio_kg numeric, categoria text, sexo text, origem text,
  dias_no_pasto integer, created_at timestamptz,
  mes_referencia integer, ano_referencia integer,
  fazenda_id uuid, retiro_id uuid, consumo_g_cab_dia numeric,
  status_consumo text, indice_consumo numeric
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO pg_catalog, public, pg_temp
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF CURRENT_USER <> 'authenticated' OR v_uid IS NULL THEN
    RAISE EXCEPTION 'Acesso nao autorizado' USING ERRCODE='42501';
  END IF;
  IF p_fazenda_id IS NULL OR p_mes IS NULL OR p_mes NOT BETWEEN 1 AND 12
    OR p_ano IS NULL OR p_ano NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Periodo invalido' USING ERRCODE='22023';
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
    FROM public.retiros r WHERE r.fazenda_id=p_fazenda_id
  ),
  events AS MATERIALIZED (
    SELECT l.id,l.pasto_id,l.created_at,l.num_sacos>0 AS is_prod,
      COALESCE(l.cocho_cheio,false) AND l.num_sacos<=0 AS is_cc
    FROM public.lancamentos l
    JOIN scoped r ON r.id=l.retiro_id
    WHERE l.fazenda_id=p_fazenda_id AND (l.num_sacos>0 OR l.cocho_cheio IS TRUE)
  ),
  ordered AS (
    SELECT e.*,
      SUM(e.is_prod::int) OVER (
        PARTITION BY e.pasto_id ORDER BY e.created_at,e.is_prod DESC,e.id
        ROWS UNBOUNDED PRECEDING
      ) AS grp
    FROM events e
  ),
  cc AS MATERIALIZED (
    SELECT (ARRAY_AGG(ev.id) FILTER(WHERE ev.is_prod))[1] AS prod_id,
      COUNT(*) FILTER(WHERE ev.is_cc)::int AS n_cc
    FROM ordered ev GROUP BY ev.pasto_id,ev.grp
  ),
  base AS MATERIALIZED (
    SELECT l.id,l.pasto_id,l.num_sacos,l.created_at,
      COALESCE(NULLIF(l.num_animais,0),p.num_animais,0) AS animais,
      COALESCE(NULLIF(l.peso_medio_kg,0),p.peso_medio_kg) AS peso,
      COALESCE(NULLIF(l.categoria,''),p.categoria) AS categoria,
      COALESCE(NULLIF(l.sexo,''),p.sexo) AS sexo,
      l.origem,l.mes_referencia,l.ano_referencia,l.fazenda_id,l.retiro_id,l.status_consumo,
      l.cobertura_dias_override,
      COALESCE(p.intervalo_padrao_dias,r.intervalo_padrao_dias,f.intervalo_padrao_dias,4) AS intervalo,
      p.num_animais AS animais_hoje,
      COALESCE(cc.n_cc,0) AS n_cc,
      ROW_NUMBER() OVER (PARTITION BY l.pasto_id ORDER BY l.created_at DESC) AS rn,
      COALESCE(prod.peso_saco_kg,0) AS saco_kg,
      CASE
        WHEN lower(COALESCE(NULLIF(l.categoria,''),p.categoria,'')) LIKE '%recria 1%'
          OR lower(COALESCE(NULLIF(l.categoria,''),p.categoria,'')) LIKE '%recria1%'
          THEN prod.consumo_recria1
        WHEN lower(COALESCE(NULLIF(l.categoria,''),p.categoria,'')) LIKE '%recria 2%'
          OR lower(COALESCE(NULLIF(l.categoria,''),p.categoria,'')) LIKE '%recria2%'
          THEN prod.consumo_recria2
        ELSE prod.consumo_engorda
      END AS target_consumo
    FROM public.lancamentos l
    JOIN scoped r ON r.id=l.retiro_id
    JOIN public.pastos p ON p.id=l.pasto_id AND p.retiro_id=r.id
    JOIN public.fazendas f ON f.id=p_fazenda_id
    LEFT JOIN public.ocupacoes_pasto o ON o.id=l.ocupacao_id
      AND o.fazenda_id=p_fazenda_id AND o.retiro_id=r.id AND o.pasto_id=l.pasto_id
    LEFT JOIN public.produtos prod ON prod.id=COALESCE(o.produto_id,p.produto_id,r.produto_id)
    LEFT JOIN cc ON cc.prod_id=l.id
    WHERE l.fazenda_id=p_fazenda_id AND l.num_sacos>0
      AND COALESCE(NULLIF(l.num_animais,0),p.num_animais,0)>0
  ),
  days AS MATERIALIZED (
    SELECT b.*,
      CASE
        WHEN b.cobertura_dias_override IS NOT NULL THEN b.cobertura_dias_override
        WHEN b.rn=1 AND COALESCE(b.animais_hoje,0)>0
          THEN GREATEST(
            COALESCE(b.intervalo,4)*(1+b.n_cc),
            (NOW() AT TIME ZONE 'America/Sao_Paulo')::date -
            (b.created_at AT TIME ZONE 'America/Sao_Paulo')::date
          )
        ELSE COALESCE(b.intervalo,4)*(1+b.n_cc)
      END AS dias_considerados
    FROM base b
  )
  SELECT d.id,d.pasto_id,d.num_sacos,d.animais,d.peso,d.categoria,d.sexo,d.origem,
    d.dias_considerados,d.created_at,d.mes_referencia,d.ano_referencia,
    d.fazenda_id,d.retiro_id,
    ROUND(d.num_sacos::numeric*d.saco_kg*1000.0/
      NULLIF(d.animais*d.dias_considerados,0),2) AS consumo_g_cab_dia,
    d.status_consumo,
    ROUND(
      d.num_sacos::numeric*d.saco_kg*1000.0/
      NULLIF(d.animais*d.dias_considerados,0)/
      NULLIF(d.target_consumo*d.peso/100.0*1000.0,0),2
    ) AS indice_consumo
  FROM days d
  WHERE d.mes_referencia=p_mes AND d.ano_referencia=p_ano
  ORDER BY d.created_at DESC,d.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gerente_lancamentos_rapido(uuid,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gerente_lancamentos_rapido(uuid,integer,integer) TO authenticated;
