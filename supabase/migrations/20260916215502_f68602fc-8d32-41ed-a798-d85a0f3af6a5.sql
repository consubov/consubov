CREATE OR REPLACE FUNCTION public.classificar_consumo(
  consumo_g numeric, esperado_g numeric, margem_mais_pct numeric, margem_menos_pct numeric, buffer_g numeric
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  limite_inf numeric;
  limite_sup numeric;
  v_buffer numeric := COALESCE(buffer_g, 0);
BEGIN
  IF consumo_g IS NULL OR esperado_g IS NULL OR esperado_g = 0 THEN RETURN NULL; END IF;
  limite_inf := esperado_g * (1 - COALESCE(margem_menos_pct, 0)/100.0);
  limite_sup := esperado_g * (1 + COALESCE(margem_mais_pct, 0)/100.0);
  IF consumo_g < limite_inf THEN RETURN 'Baixo';
  ELSIF consumo_g < limite_inf + v_buffer THEN RETURN 'Atenção';
  ELSIF consumo_g > limite_sup THEN RETURN 'Alto';
  ELSIF consumo_g > limite_sup - v_buffer THEN RETURN 'Atenção';
  ELSE RETURN 'Ideal';
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.classificar_consumo(numeric, numeric, numeric, numeric, numeric) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.view_painel_mae_pasto_atual AS
WITH ultimo_lancamento AS (
  SELECT DISTINCT ON (l.pasto_id) l.id AS lancamento_id,
     l.pasto_id,
     l.retiro_id,
     l.fazenda_id,
     l.ocupacao_id,
     l.categoria AS categoria_lanc,
     COALESCE(NULLIF(l.num_animais, 0), p0.num_animais, 0) AS num_animais,
     l.num_sacos,
     GREATEST(COALESCE(NULLIF(l.dias_no_pasto, 0), 1), 1) AS dias_no_pasto,
     COALESCE(NULLIF(l.peso_medio_kg, 0::numeric), p0.peso_medio_kg) AS peso_medio_kg,
     l.consumo_g_cab_dia AS consumo_real_g_cab_dia,
     l.indice_consumo AS indice_real,
     l.status_consumo AS status_real,
     l.mes_referencia,
     l.ano_referencia,
     l.created_at
  FROM lancamentos l
  LEFT JOIN pastos p0 ON p0.id = l.pasto_id
  WHERE l.num_sacos > 0 AND COALESCE(NULLIF(l.num_animais, 0), p0.num_animais, 0) > 0
  ORDER BY l.pasto_id, l.created_at DESC
)
SELECT ul.pasto_id,
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
   public.classificar_consumo(
     vctr.consumo_g_cab_dia,
     cat.esperado_g,
     cat.margem_mais_pct,
     cat.margem_menos_pct,
     COALESCE(prod.amarelo_buffer_g, 0)
   ) AS status_global,
   GREATEST(0::numeric, 100::numeric - abs(1::numeric - vctr.indice_consumo) * 100::numeric) AS eficiencia_pasto,
   ul.created_at AS ultima_salga_real_em,
   cat.esperado_g
FROM ultimo_lancamento ul
JOIN pastos p ON p.id = ul.pasto_id AND p.ativo = true
LEFT JOIN view_consumo_tempo_real vctr ON vctr.id = ul.lancamento_id
LEFT JOIN retiros r ON r.id = p.retiro_id
LEFT JOIN ocupacoes_pasto op ON op.id = ul.ocupacao_id
LEFT JOIN produtos prod ON prod.id = COALESCE(op.produto_id, p.produto_id, r.produto_id)
LEFT JOIN LATERAL (
  SELECT
    CASE
      WHEN COALESCE(ul.categoria_lanc, p.categoria) ILIKE '%recria 1%' OR COALESCE(ul.categoria_lanc, p.categoria) ILIKE '%recria1%'
        THEN prod.consumo_recria1
      WHEN COALESCE(ul.categoria_lanc, p.categoria) ILIKE '%recria 2%' OR COALESCE(ul.categoria_lanc, p.categoria) ILIKE '%recria2%'
        THEN prod.consumo_recria2
      ELSE prod.consumo_engorda
    END AS consumo_categoria,
    CASE
      WHEN COALESCE(ul.categoria_lanc, p.categoria) ILIKE '%recria 1%' OR COALESCE(ul.categoria_lanc, p.categoria) ILIKE '%recria1%'
        THEN prod.margem_mais_recria1_pct
      WHEN COALESCE(ul.categoria_lanc, p.categoria) ILIKE '%recria 2%' OR COALESCE(ul.categoria_lanc, p.categoria) ILIKE '%recria2%'
        THEN prod.margem_mais_recria2_pct
      ELSE prod.margem_mais_engorda_pct
    END AS margem_mais_pct,
    CASE
      WHEN COALESCE(ul.categoria_lanc, p.categoria) ILIKE '%recria 1%' OR COALESCE(ul.categoria_lanc, p.categoria) ILIKE '%recria1%'
        THEN prod.margem_menos_recria1_pct
      WHEN COALESCE(ul.categoria_lanc, p.categoria) ILIKE '%recria 2%' OR COALESCE(ul.categoria_lanc, p.categoria) ILIKE '%recria2%'
        THEN prod.margem_menos_recria2_pct
      ELSE prod.margem_menos_engorda_pct
    END AS margem_menos_pct
) mc ON true
LEFT JOIN LATERAL (
  SELECT mc.margem_mais_pct, mc.margem_menos_pct,
    CASE WHEN COALESCE(mc.consumo_categoria, 0) > 0 AND COALESCE(ul.peso_medio_kg, 0) > 0
      THEN mc.consumo_categoria / 100.0 * ul.peso_medio_kg * 1000.0
      ELSE NULL END AS esperado_g
) cat ON true;