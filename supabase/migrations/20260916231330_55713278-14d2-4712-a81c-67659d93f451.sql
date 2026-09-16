CREATE OR REPLACE VIEW public.view_painel_mae_pasto AS
WITH ultimo_lancamento AS (
  SELECT DISTINCT ON (l.pasto_id, l.mes_referencia, l.ano_referencia)
    l.id AS lancamento_id,
    l.pasto_id,
    l.retiro_id,
    l.fazenda_id,
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
  FROM public.lancamentos l
  LEFT JOIN public.pastos p0 ON p0.id = l.pasto_id
  WHERE l.num_sacos > 0
    AND COALESCE(NULLIF(l.num_animais, 0), p0.num_animais, 0) > 0
  ORDER BY l.pasto_id, l.mes_referencia, l.ano_referencia, l.created_at DESC
)
SELECT
  ul.pasto_id,
  ul.retiro_id,
  ul.fazenda_id,
  ul.peso_medio_kg::numeric(8,2) AS peso_medio_kg,
  ul.num_animais,
  ul.mes_referencia,
  ul.ano_referencia,
  ul.consumo_real_g_cab_dia,
  ul.indice_real,
  ul.status_real,
  ul.num_animais * ul.dias_no_pasto AS cab_dias_real,
  vctr.consumo_g_cab_dia AS consumo_global_g_cab_dia,
  vctr.indice_consumo AS indice_global,
  ul.num_animais * vctr.dias_no_pasto AS cab_dias_global,
  COALESCE(
    ul.num_sacos::numeric * prod.peso_saco_kg,
    ul.num_sacos::numeric * r.peso_saco_kg,
    ul.consumo_real_g_cab_dia * (ul.num_animais * ul.dias_no_pasto)::numeric / 1000.0
  ) AS kg_fornecido,
  CASE
    WHEN vctr.indice_consumo IS NULL THEN NULL::text
    WHEN vctr.indice_consumo < (
      SELECT (formulas_sistema.parametros ->> 'limite_baixo')::numeric
      FROM public.formulas_sistema
      WHERE formulas_sistema.chave = 'classificacao_consumo'
    ) THEN 'Baixo'::text
    WHEN vctr.indice_consumo > (
      SELECT (formulas_sistema.parametros ->> 'limite_alto')::numeric
      FROM public.formulas_sistema
      WHERE formulas_sistema.chave = 'classificacao_consumo'
    ) THEN 'Alto'::text
    ELSE 'Ideal'::text
  END AS status_global,
  GREATEST(0::numeric, 100::numeric - abs(1::numeric - vctr.indice_consumo) * 100::numeric) AS eficiencia_pasto
FROM ultimo_lancamento ul
JOIN public.pastos p ON p.id = ul.pasto_id AND p.ativo = true
JOIN public.retiros r ON r.id = ul.retiro_id
LEFT JOIN public.produtos prod ON prod.id = p.produto_id
LEFT JOIN public.view_consumo_tempo_real vctr ON vctr.id = ul.lancamento_id;