CREATE OR REPLACE VIEW public.view_painel_mae_pasto AS
WITH ultimo_lancamento AS (
  SELECT DISTINCT ON (l.pasto_id, l.mes_referencia, l.ano_referencia)
    l.id AS lancamento_id,
    l.pasto_id,
    l.retiro_id,
    l.fazenda_id,
    l.ocupacao_id,
    COALESCE(NULLIF(l.num_animais, 0), p0.num_animais, 0) AS num_animais,
    l.num_sacos,
    GREATEST(COALESCE(NULLIF(l.dias_no_pasto, 0), 1), 1) AS dias_no_pasto,
    COALESCE(NULLIF(p0.peso_medio_kg, 0::numeric), l.peso_medio_kg) AS peso_medio_kg,
    l.consumo_g_cab_dia AS consumo_real_g_cab_dia,
    l.indice_consumo AS indice_real,
    l.status_consumo AS status_real,
    l.mes_referencia,
    l.ano_referencia,
    l.created_at
  FROM lancamentos l
  LEFT JOIN pastos p0 ON p0.id = l.pasto_id
  WHERE l.num_sacos > 0 AND COALESCE(NULLIF(l.num_animais, 0), p0.num_animais, 0) > 0
  ORDER BY l.pasto_id, l.mes_referencia, l.ano_referencia, l.created_at DESC
)
SELECT ul.pasto_id,
  ul.retiro_id,
  ul.fazenda_id,
  (ul.peso_medio_kg)::numeric(8,2) AS peso_medio_kg,
  ul.num_animais,
  ul.mes_referencia,
  ul.ano_referencia,
  ul.consumo_real_g_cab_dia,
  ul.indice_real,
  ul.status_real,
  (ul.num_animais * ul.dias_no_pasto) AS cab_dias_real,
  vctr.consumo_g_cab_dia AS consumo_global_g_cab_dia,
  vctr.indice_consumo AS indice_global,
  (ul.num_animais * vctr.dias_no_pasto) AS cab_dias_global,
  COALESCE((ul.num_sacos)::numeric * prod.peso_saco_kg,
           (ul.num_sacos)::numeric * r.peso_saco_kg,
           (ul.consumo_real_g_cab_dia * (ul.num_animais * ul.dias_no_pasto)::numeric) / 1000.0) AS kg_fornecido,
  public.classificar_consumo(vctr.consumo_g_cab_dia, cat.esperado_g, cat.margem_mais_pct, cat.margem_menos_pct, COALESCE(prod.amarelo_buffer_g, 0::numeric)) AS status_global,
  GREATEST(0::numeric, 100::numeric - (abs(1::numeric - vctr.indice_consumo) * 100::numeric)) AS eficiencia_pasto
FROM ultimo_lancamento ul
JOIN pastos p ON p.id = ul.pasto_id AND p.ativo = true
JOIN retiros r ON r.id = ul.retiro_id
LEFT JOIN ocupacoes_pasto op ON op.id = ul.ocupacao_id
LEFT JOIN produtos prod ON prod.id = COALESCE(op.produto_id, p.produto_id, r.produto_id)
LEFT JOIN view_consumo_tempo_real vctr ON vctr.id = ul.lancamento_id
LEFT JOIN LATERAL (SELECT public.calcular_categoria(ul.peso_medio_kg, p.sexo) AS categoria_calc) cc ON true
LEFT JOIN LATERAL (
  SELECT
    CASE WHEN cc.categoria_calc ILIKE '%recria 1%' OR cc.categoria_calc ILIKE '%recria1%' THEN prod.consumo_recria1
         WHEN cc.categoria_calc ILIKE '%recria 2%' OR cc.categoria_calc ILIKE '%recria2%' THEN prod.consumo_recria2
         ELSE prod.consumo_engorda END AS consumo_categoria,
    CASE WHEN cc.categoria_calc ILIKE '%recria 1%' OR cc.categoria_calc ILIKE '%recria1%' THEN prod.margem_mais_recria1_pct
         WHEN cc.categoria_calc ILIKE '%recria 2%' OR cc.categoria_calc ILIKE '%recria2%' THEN prod.margem_mais_recria2_pct
         ELSE prod.margem_mais_engorda_pct END AS margem_mais_pct,
    CASE WHEN cc.categoria_calc ILIKE '%recria 1%' OR cc.categoria_calc ILIKE '%recria1%' THEN prod.margem_menos_recria1_pct
         WHEN cc.categoria_calc ILIKE '%recria 2%' OR cc.categoria_calc ILIKE '%recria2%' THEN prod.margem_menos_recria2_pct
         ELSE prod.margem_menos_engorda_pct END AS margem_menos_pct
) mc ON true
LEFT JOIN LATERAL (
  SELECT mc.margem_mais_pct, mc.margem_menos_pct,
    CASE WHEN COALESCE(mc.consumo_categoria, 0::numeric) > 0::numeric AND COALESCE(ul.peso_medio_kg, 0::numeric) > 0::numeric
         THEN ((mc.consumo_categoria / 100.0) * ul.peso_medio_kg) * 1000.0
         ELSE NULL::numeric END AS esperado_g
) cat ON true;

CREATE OR REPLACE FUNCTION public.get_painel_mae(p_fazenda_id uuid, p_retiro_id uuid DEFAULT NULL::uuid, p_mes integer DEFAULT NULL::integer, p_ano integer DEFAULT NULL::integer)
 RETURNS TABLE(consumo_real_g_cab_dia numeric, consumo_global_g_cab_dia numeric, eficiencia numeric, pastos_na_meta_num integer, pastos_na_meta_den integer, peso_medio_kg numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    (SELECT ROUND(SUM(kg_fornecido) * 1000.0 / NULLIF(SUM(cab_dias_assumidos), 0), 2)
     FROM public.view_lancamento_consumo_real
     WHERE fazenda_id = p_fazenda_id
       AND (p_retiro_id IS NULL OR retiro_id = p_retiro_id)
       AND (p_mes IS NULL OR mes_referencia = p_mes)
       AND (p_ano IS NULL OR ano_referencia = p_ano)
    )                                                                                     AS consumo_real_g_cab_dia,
    ROUND(SUM(vp.kg_fornecido) * 1000.0 / NULLIF(SUM(vp.cab_dias_global), 0), 2)         AS consumo_global_g_cab_dia,
    ROUND(SUM(vp.eficiencia_pasto * vp.cab_dias_global) / NULLIF(SUM(vp.cab_dias_global), 0), 1) AS eficiencia,
    COUNT(*) FILTER (WHERE vp.status_global IN ('Ideal', 'Atenção'))::int                 AS pastos_na_meta_num,
    COUNT(*)::int                                                                         AS pastos_na_meta_den,
    (SELECT ROUND(SUM(COALESCE(vp2.peso_medio_kg, p2.peso_medio_kg, 0) * p2.num_animais) / NULLIF(SUM(p2.num_animais), 0), 1)
     FROM public.pastos p2
     JOIN public.retiros r2 ON r2.id = p2.retiro_id
     LEFT JOIN public.view_painel_mae_pasto vp2
       ON vp2.pasto_id = p2.id
       AND (p_mes IS NULL OR vp2.mes_referencia = p_mes)
       AND (p_ano IS NULL OR vp2.ano_referencia = p_ano)
     WHERE r2.fazenda_id = p_fazenda_id
       AND (p_retiro_id IS NULL OR p2.retiro_id = p_retiro_id)
       AND p2.ativo = true
       AND p2.num_animais > 0
    )                                                                                     AS peso_medio_kg
  FROM public.view_painel_mae_pasto vp
  JOIN public.pastos p ON p.id = vp.pasto_id
  WHERE vp.fazenda_id = p_fazenda_id
    AND (p_retiro_id IS NULL OR vp.retiro_id = p_retiro_id)
    AND (p_mes IS NULL OR vp.mes_referencia = p_mes)
    AND (p_ano IS NULL OR vp.ano_referencia = p_ano);
$function$;