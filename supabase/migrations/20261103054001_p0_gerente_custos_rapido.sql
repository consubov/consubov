-- P0 gerente: custo por retiro, usando lancamentos filtrados e autenticação existente.
-- Evita view_consumo_tempo_real e view_painel_mae_pasto (ambas geram 57014).
-- Contrato: mesma fórmula de custo de get_consumo_mineral, sem modificar a função compartilhada.
-- Não altera roles globais, políticas, tabelas nem dados.
CREATE OR REPLACE FUNCTION public.get_gerente_custos_rapido(
  p_fazenda_id uuid, p_mes integer, p_ano integer
)
RETURNS TABLE (
  retiro_id uuid, total_sacos bigint, total_cab_dias numeric,
  custo_mensal numeric, custo_diario numeric
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
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
      WHERE g.user_id=v_uid AND g.ativo IS TRUE
        AND (g.fazenda_id=p_fazenda_id OR EXISTS (
          SELECT 1 FROM public.gerentes_fazendas gf
          WHERE gf.gerente_id=g.id AND gf.fazenda_id=p_fazenda_id
        ))
    )
  ) THEN
    RAISE EXCEPTION 'Fazenda nao autorizada' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  WITH scoped AS MATERIALIZED (
    SELECT r.id, r.produto_id, r.intervalo_padrao_dias
    FROM public.retiros r
    WHERE r.fazenda_id=p_fazenda_id AND r.ativo IS TRUE
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
  grouped AS (
    SELECT e.*,
      SUM(e.is_prod::int) OVER (
        PARTITION BY e.pasto_id
        ORDER BY e.created_at,e.is_prod DESC,e.id
        ROWS UNBOUNDED PRECEDING
      ) AS grp
    FROM events e
  ),
  cc AS MATERIALIZED (
    SELECT (ARRAY_AGG(id) FILTER (WHERE is_prod))[1] AS prod_id,
      COUNT(*) FILTER (WHERE is_cc)::int AS n_cc
    FROM grouped
    GROUP BY pasto_id,grp
  ),
  raw AS MATERIALIZED (
    SELECT l.id,l.retiro_id,l.pasto_id,l.created_at,
      l.mes_referencia,l.ano_referencia,l.num_sacos,
      COALESCE(NULLIF(l.num_animais,0),p.num_animais,0) AS animais,
      p.num_animais AS animais_hoje,
      COALESCE(l.cobertura_dias_override,p.intervalo_padrao_dias,r.intervalo_padrao_dias,f.intervalo_padrao_dias,4) AS base_dias,
      (l.cobertura_dias_override IS NOT NULL) AS tem_override,
      COALESCE(cc.n_cc,0) AS n_cc,
      MAX(l.created_at) OVER (PARTITION BY l.pasto_id) AS ultimo_lancamento,
      prod.peso_saco_kg AS custo_saco_kg,
      prod.preco_por_kg AS custo_preco_kg,
      ocup_prod.peso_saco_kg AS consumo_saco_kg
    FROM public.lancamentos l
    JOIN scoped r ON r.id=l.retiro_id
    JOIN public.pastos p ON p.id=l.pasto_id AND p.retiro_id=r.id
    JOIN public.fazendas f ON f.id=p_fazenda_id
    LEFT JOIN public.ocupacoes_pasto ocup ON ocup.id=l.ocupacao_id
      AND ocup.fazenda_id=p_fazenda_id AND ocup.retiro_id=r.id AND ocup.pasto_id=l.pasto_id
    LEFT JOIN public.produtos ocup_prod ON ocup_prod.id=COALESCE(ocup.produto_id,p.produto_id,r.produto_id)
    LEFT JOIN public.produtos prod ON prod.id=COALESCE(
      CASE WHEN p.ativo IS TRUE THEN p.produto_id ELSE NULL::uuid END,r.produto_id
    )
    LEFT JOIN cc ON cc.prod_id=l.id
    WHERE l.fazenda_id=p_fazenda_id
      AND l.num_sacos>0
      AND COALESCE(NULLIF(l.num_animais,0),p.num_animais,0)>0
  ),
  adjusted AS MATERIALIZED (
    SELECT b.*,
      CASE
        WHEN b.ultimo_lancamento=b.created_at AND COALESCE(b.animais_hoje,0)>0
        THEN GREATEST(
          CASE WHEN b.tem_override THEN b.base_dias ELSE b.base_dias*(1+b.n_cc) END,
          (NOW() AT TIME ZONE 'America/Sao_Paulo')::date -
          (b.created_at AT TIME ZONE 'America/Sao_Paulo')::date
        )
        ELSE CASE WHEN b.tem_override THEN b.base_dias ELSE b.base_dias*(1+b.n_cc) END
      END AS dias_considerados
    FROM raw b
  ),
  clipped AS MATERIALIZED (
    SELECT a.*,
      GREATEST(0,
        LEAST(a.created_at::date,(MAKE_DATE(p_ano,p_mes,1)+INTERVAL '1 month - 1 day')::date)
        - GREATEST(
          a.created_at::date - (a.dias_considerados - 1),
          MAKE_DATE(p_ano,p_mes,1)
        ) + 1
      )::numeric AS dias_no_periodo
    FROM adjusted a
    WHERE a.ano_referencia=p_ano AND a.mes_referencia=p_mes
  ),
  valued AS (
    SELECT c.retiro_id,c.num_sacos,
      c.animais*c.dias_no_periodo AS cab_dias,
      (
        CASE
          WHEN c.num_sacos>0 AND COALESCE(c.custo_saco_kg,0)>0
          THEN c.num_sacos::numeric*c.custo_saco_kg
          WHEN c.animais>0 AND c.dias_considerados>0
            AND COALESCE(c.consumo_saco_kg,0)>0
          THEN ROUND(
            c.num_sacos::numeric*c.consumo_saco_kg*1000.0/
              NULLIF(c.animais*c.dias_considerados,0),2
          )*c.animais*c.dias_no_periodo/1000
          ELSE 0::numeric
        END
      )*COALESCE(c.custo_preco_kg,0) AS custo
    FROM clipped c
  )
  SELECT s.id,
    COALESCE(SUM(v.num_sacos),0)::bigint AS total_sacos,
    ROUND(COALESCE(SUM(v.cab_dias),0),2) AS total_cab_dias,
    ROUND(COALESCE(SUM(v.custo),0),2) AS custo_mensal,
    CASE WHEN COALESCE(SUM(v.cab_dias),0)>0
      THEN ROUND(SUM(v.custo)/SUM(v.cab_dias),4)
      ELSE 0::numeric END AS custo_diario
  FROM scoped s
  LEFT JOIN valued v ON v.retiro_id=s.id
  GROUP BY s.id
  ORDER BY s.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gerente_custos_rapido(uuid,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gerente_custos_rapido(uuid,integer,integer) TO authenticated;
