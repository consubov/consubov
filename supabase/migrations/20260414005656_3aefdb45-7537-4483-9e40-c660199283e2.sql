
CREATE OR REPLACE VIEW public.view_consumo_mineral
WITH (security_invoker = true)
AS
SELECT
  l.id,
  l.fazenda_id,
  l.retiro_id,
  l.pasto_id,
  l.mes_referencia,
  l.ano_referencia,
  l.num_animais,
  l.peso_medio_kg,
  l.categoria,
  l.sexo,
  l.num_sacos,
  l.dias_no_pasto,
  l.consumo_g_cab_dia,
  l.indice_consumo,
  l.status_consumo,
  l.ciclo_id,
  l.created_at,
  l.origem,
  (l.num_sacos::numeric * COALESCE(prod.peso_saco_kg, 25)) AS total_sal_kg,
  CASE
    WHEN l.num_animais > 0
    THEN ROUND((l.num_sacos::numeric * COALESCE(prod.peso_saco_kg, 25)) / l.num_animais, 3)
    ELSE 0
  END AS consumo_kg_cabeca,
  (l.num_animais * l.dias_no_pasto)::numeric AS cab_dias,
  COALESCE(prod.preco_por_kg, 0) AS preco_por_kg
FROM lancamentos l
LEFT JOIN pastos p ON p.id = l.pasto_id
LEFT JOIN retiros r ON r.id = l.retiro_id
LEFT JOIN produtos prod ON prod.id = COALESCE(p.produto_id, r.produto_id)
WHERE l.num_sacos > 0
  AND l.num_animais > 0
  AND l.dias_no_pasto > 0;
