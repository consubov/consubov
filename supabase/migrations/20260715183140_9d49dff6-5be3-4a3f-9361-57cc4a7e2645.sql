
-- 1) View única de consumo em tempo real: mesma projeção de view_consumo_consolidado,
-- mas com consumo_g_cab_dia / indice_consumo / dias_no_pasto ajustados dinamicamente
-- para lançamentos de "período aberto" (última salga do pasto no mês corrente sem salga
-- seguinte) usando CURRENT_DATE. Todas as telas passam a ler daqui.
CREATE OR REPLACE VIEW public.view_consumo_tempo_real AS
WITH base AS (
  SELECT l.id, l.fazenda_id, l.retiro_id, l.pasto_id,
         l.mes_referencia, l.ano_referencia,
         l.num_animais, l.peso_medio_kg, l.categoria, l.sexo,
         l.num_sacos, l.dias_no_pasto,
         l.status_consumo, l.indice_consumo, l.consumo_g_cab_dia,
         l.ciclo_id, l.created_at
  FROM public.lancamentos l
  WHERE l.num_sacos > 0 AND l.num_animais > 0 AND l.dias_no_pasto > 0
),
latest_per_pasto AS (
  SELECT pasto_id, MAX(created_at) AS max_created
  FROM public.lancamentos
  WHERE num_sacos > 0 AND num_animais > 0 AND dias_no_pasto > 0
  GROUP BY pasto_id
),
adjusted AS (
  SELECT b.*,
    CASE
      WHEN b.mes_referencia = EXTRACT(MONTH FROM CURRENT_DATE)::int
       AND b.ano_referencia = EXTRACT(YEAR  FROM CURRENT_DATE)::int
       AND b.created_at = lpp.max_created
       AND FLOOR(EXTRACT(EPOCH FROM (now() - b.created_at)) / 86400)::int > b.dias_no_pasto
       AND COALESCE(b.consumo_g_cab_dia, 0) > 0
      THEN true ELSE false
    END AS is_open_period,
    FLOOR(EXTRACT(EPOCH FROM (now() - b.created_at)) / 86400)::int AS dias_decorridos
  FROM base b
  LEFT JOIN latest_per_pasto lpp ON lpp.pasto_id = b.pasto_id
)
SELECT
  id, fazenda_id, retiro_id, pasto_id,
  mes_referencia, ano_referencia,
  num_animais, peso_medio_kg, categoria, sexo,
  num_sacos,
  CASE WHEN is_open_period THEN dias_decorridos ELSE dias_no_pasto END AS dias_no_pasto,
  status_consumo,
  CASE WHEN is_open_period AND dias_decorridos > 0
       THEN indice_consumo * (dias_no_pasto::numeric / dias_decorridos::numeric)
       ELSE indice_consumo END AS indice_consumo,
  CASE WHEN is_open_period AND dias_decorridos > 0
       THEN consumo_g_cab_dia * (dias_no_pasto::numeric / dias_decorridos::numeric)
       ELSE consumo_g_cab_dia END AS consumo_g_cab_dia,
  ciclo_id, created_at,
  is_open_period
FROM adjusted;

GRANT SELECT ON public.view_consumo_tempo_real TO anon, authenticated, service_role;

-- 2) get_consumo_mineral: aplicar o mesmo ajuste dinâmico no `dias_no_pasto`
-- usado pela CTE lanc_derived. Assim consumo_medio_g, custo_diario, custo_mensal
-- e eficiência do RPC batem com a view acima.
CREATE OR REPLACE FUNCTION public.get_consumo_mineral(p_fazenda_id uuid, p_mes integer, p_ano integer)
 RETURNS TABLE(retiro_id uuid, retiro_nome text, capataz text, total_animais bigint, total_sacos bigint, total_kg_consumido numeric, total_cab_dias numeric, consumo_medio_g numeric, custo_diario numeric, custo_mensal numeric, gmd_medio numeric, status_baixo bigint, status_ideal bigint, status_alto bigint, pastos_na_meta bigint, total_pastos bigint, eficiencia numeric, total_salgas bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ciclo_fechado boolean;
BEGIN
  SELECT COALESCE(fechado, false) INTO v_ciclo_fechado
  FROM ciclos
  WHERE fazenda_id = p_fazenda_id AND mes = p_mes AND ano = p_ano
  LIMIT 1;
  v_ciclo_fechado := COALESCE(v_ciclo_fechado, false);

  RETURN QUERY
  WITH periodo AS (
    SELECT
      make_date(p_ano, p_mes, 1) AS inicio,
      (make_date(p_ano, p_mes, 1) + INTERVAL '1 month - 1 day')::date AS fim
  ),
  retiros_fazenda AS (
    SELECT r.id, r.nome, r.capataz, r.produto_id
    FROM retiros r
    WHERE r.fazenda_id = p_fazenda_id AND r.ativo = true
  ),
  pastos_fazenda AS (
    SELECT p.id, p.retiro_id, p.num_animais, p.gmd_kg_dia, p.produto_id
    FROM pastos p
    WHERE p.retiro_id IN (SELECT rf.id FROM retiros_fazenda rf) AND p.ativo = true
  ),
  lancamentos_periodo AS (
    SELECT l.id, l.pasto_id, l.retiro_id, l.num_sacos, l.num_animais,
           l.dias_no_pasto, l.created_at, l.consumo_g_cab_dia, l.status_consumo, l.indice_consumo,
           l.is_open_period
    FROM public.view_consumo_tempo_real l
    WHERE l.fazenda_id = p_fazenda_id
      AND l.mes_referencia = p_mes
      AND l.ano_referencia = p_ano
  ),
  lanc_derived AS (
    SELECT
      lp.id AS lanc_id,
      lp.pasto_id,
      lp.retiro_id,
      lp.num_sacos,
      lp.num_animais,
      lp.dias_no_pasto,
      lp.consumo_g_cab_dia,
      lp.status_consumo,
      lp.indice_consumo,
      CASE WHEN lp.num_animais > 0 AND lp.dias_no_pasto > 0
           THEN lp.num_animais::numeric * GREATEST(
             0,
             LEAST(lp.created_at::date, per.fim)
             - GREATEST(lp.created_at::date - (lp.dias_no_pasto - 1), per.inicio)
             + 1
           )::numeric
           ELSE 0 END AS cab_dias,
      CASE WHEN lp.num_sacos > 0 AND COALESCE(prod.peso_saco_kg, 0) > 0
           THEN lp.num_sacos::numeric * prod.peso_saco_kg
           ELSE CASE WHEN lp.num_animais > 0 AND lp.dias_no_pasto > 0 AND COALESCE(lp.consumo_g_cab_dia, 0) > 0
                     THEN (lp.consumo_g_cab_dia * lp.num_animais::numeric * GREATEST(
                       0,
                       LEAST(lp.created_at::date, per.fim)
                       - GREATEST(lp.created_at::date - (lp.dias_no_pasto - 1), per.inicio)
                       + 1
                     )::numeric) / 1000
                     ELSE 0 END
           END AS total_kg,
      COALESCE(prod.preco_por_kg, 0) AS preco_por_kg
    FROM lancamentos_periodo lp
    CROSS JOIN periodo per
    LEFT JOIN pastos_fazenda pf ON pf.id = lp.pasto_id
    LEFT JOIN retiros_fazenda rf ON rf.id = lp.retiro_id
    LEFT JOIN produtos prod ON prod.id = COALESCE(pf.produto_id, rf.produto_id)
  ),
  retiro_lanc_agg AS (
    SELECT
      ld.retiro_id,
      SUM(ld.num_sacos) AS sum_sacos,
      SUM(ld.cab_dias) AS sum_cab_dias,
      SUM(ld.total_kg) AS sum_kg,
      SUM(ld.total_kg * ld.preco_por_kg) AS sum_custo,
      COUNT(*) AS cnt_lancamentos,
      COUNT(*) FILTER (WHERE ld.status_consumo = 'Baixo') AS cnt_baixo,
      COUNT(*) FILTER (WHERE ld.status_consumo = 'Ideal') AS cnt_ideal,
      COUNT(*) FILTER (WHERE ld.status_consumo = 'Alto') AS cnt_alto,
      AVG(ld.indice_consumo) FILTER (WHERE ld.indice_consumo > 0) AS avg_indice
    FROM lanc_derived ld
    GROUP BY ld.retiro_id
  ),
  max_animais_lanc AS (
    SELECT lp2.retiro_id, SUM(max_anim) AS total_from_lanc
    FROM (
      SELECT lp3.retiro_id, lp3.pasto_id, MAX(lp3.num_animais) AS max_anim
      FROM lancamentos_periodo lp3
      GROUP BY lp3.retiro_id, lp3.pasto_id
    ) lp2
    GROUP BY lp2.retiro_id
  ),
  last_status_per_pasto AS (
    SELECT DISTINCT ON (lp.pasto_id) lp.retiro_id, lp.pasto_id, lp.status_consumo
    FROM lancamentos_periodo lp
    WHERE lp.status_consumo IS NOT NULL
    ORDER BY lp.pasto_id, lp.id DESC
  ),
  pastos_meta_agg AS (
    SELECT ls.retiro_id, COUNT(*) FILTER (WHERE ls.status_consumo = 'Ideal') AS na_meta
    FROM last_status_per_pasto ls
    GROUP BY ls.retiro_id
  ),
  pastos_agg AS (
    SELECT
      pf.retiro_id,
      COUNT(*) AS cnt_pastos,
      SUM(pf.num_animais) AS sum_animais_pastos,
      AVG(pf.gmd_kg_dia) FILTER (WHERE pf.gmd_kg_dia > 0) AS avg_gmd
    FROM pastos_fazenda pf
    GROUP BY pf.retiro_id
  ),
  pastos_com_lanc AS (
    SELECT DISTINCT lp.pasto_id, lp.retiro_id FROM lancamentos_periodo lp
  ),
  gmd_periodo AS (
    SELECT
      pcl.retiro_id,
      AVG(pf.gmd_kg_dia) FILTER (WHERE pf.gmd_kg_dia > 0) AS avg_gmd_periodo
    FROM pastos_com_lanc pcl
    JOIN pastos_fazenda pf ON pf.id = pcl.pasto_id
    GROUP BY pcl.retiro_id
  )
  SELECT
    rf.id AS retiro_id,
    rf.nome AS retiro_nome,
    rf.capataz,
    CASE
      WHEN v_ciclo_fechado THEN COALESCE(mal.total_from_lanc, pa.sum_animais_pastos, 0)::bigint
      ELSE COALESCE(pa.sum_animais_pastos, 0)::bigint
    END AS total_animais,
    COALESCE(rla.sum_sacos, 0)::bigint AS total_sacos,
    ROUND(COALESCE(rla.sum_kg, 0), 2) AS total_kg_consumido,
    ROUND(COALESCE(rla.sum_cab_dias, 0), 2) AS total_cab_dias,
    CASE WHEN COALESCE(rla.sum_cab_dias, 0) > 0
         THEN ROUND((rla.sum_kg * 1000.0) / rla.sum_cab_dias, 2)
         ELSE 0 END AS consumo_medio_g,
    CASE WHEN COALESCE(rla.sum_cab_dias, 0) > 0
         THEN ROUND(rla.sum_custo / rla.sum_cab_dias, 4)
         ELSE 0 END AS custo_diario,
    ROUND(COALESCE(rla.sum_custo, 0), 2) AS custo_mensal,
    ROUND(COALESCE(gp.avg_gmd_periodo, pa.avg_gmd, 0), 4) AS gmd_medio,
    COALESCE(rla.cnt_baixo, 0)::bigint AS status_baixo,
    COALESCE(rla.cnt_ideal, 0)::bigint AS status_ideal,
    COALESCE(rla.cnt_alto, 0)::bigint AS status_alto,
    COALESCE(pma.na_meta, 0)::bigint AS pastos_na_meta,
    COALESCE(pa.cnt_pastos, 0)::bigint AS total_pastos,
    CASE WHEN rla.avg_indice IS NOT NULL
         THEN ROUND(rla.avg_indice * 100, 1)
         ELSE 0 END AS eficiencia,
    COALESCE(rla.cnt_lancamentos, 0)::bigint AS total_salgas
  FROM retiros_fazenda rf
  LEFT JOIN retiro_lanc_agg rla ON rla.retiro_id = rf.id
  LEFT JOIN max_animais_lanc mal ON mal.retiro_id = rf.id
  LEFT JOIN pastos_agg pa ON pa.retiro_id = rf.id
  LEFT JOIN pastos_meta_agg pma ON pma.retiro_id = rf.id
  LEFT JOIN gmd_periodo gp ON gp.retiro_id = rf.id
  ORDER BY rf.nome;
END;
$function$;
