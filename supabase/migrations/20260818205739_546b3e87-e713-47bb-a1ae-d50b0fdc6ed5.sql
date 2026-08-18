-- 1) Fonte central usada por get_consumo_real_v2
CREATE OR REPLACE VIEW public.view_lancamento_consumo_real AS
WITH base AS (
  SELECT l.id AS lancamento_id,
     l.fazenda_id,
     l.retiro_id,
     l.pasto_id,
     l.ocupacao_id,
     l.ciclo_id,
     l.mes_referencia,
     l.ano_referencia,
     COALESCE(NULLIF(l.num_animais, 0), p.num_animais, 0) AS num_animais,
     l.num_sacos,
     l.created_at,
     l.cobertura_dias_override,
     COALESCE(prod.peso_saco_kg, (0)::numeric) AS peso_saco_kg,
     f.intervalo_padrao_dias,
     p.num_animais AS num_animais_pasto_hoje,
     row_number() OVER (PARTITION BY l.pasto_id ORDER BY l.created_at DESC) AS rn
    FROM ((((lancamentos l
      LEFT JOIN pastos p ON ((p.id = l.pasto_id)))
      LEFT JOIN ocupacoes_pasto o ON ((o.id = l.ocupacao_id)))
      LEFT JOIN produtos prod ON ((prod.id = COALESCE(o.produto_id, ( SELECT COALESCE(p2.produto_id, r.produto_id) AS "coalesce"
            FROM (pastos p2
              JOIN retiros r ON ((r.id = p2.retiro_id)))
           WHERE (p2.id = l.pasto_id))))))
      LEFT JOIN fazendas f ON ((f.id = l.fazenda_id)))
   WHERE ((l.num_sacos > 0) AND (COALESCE(NULLIF(l.num_animais, 0), p.num_animais, 0) > 0))
)
SELECT lancamento_id,
   fazenda_id,
   retiro_id,
   pasto_id,
   ocupacao_id,
   ciclo_id,
   mes_referencia,
   ano_referencia,
   num_animais,
   num_sacos,
   created_at,
   peso_saco_kg,
   ((num_sacos)::numeric * peso_saco_kg) AS kg_fornecido,
   CASE
       WHEN (cobertura_dias_override IS NOT NULL) THEN cobertura_dias_override
       WHEN ((rn = 1) AND (COALESCE(num_animais_pasto_hoje, 0) > 0)) THEN GREATEST(COALESCE(intervalo_padrao_dias, 4), (CURRENT_DATE - (created_at)::date))
       ELSE COALESCE(intervalo_padrao_dias, 4)
   END AS intervalo_padrao_dias,
   (num_animais *
   CASE
       WHEN (cobertura_dias_override IS NOT NULL) THEN cobertura_dias_override
       WHEN ((rn = 1) AND (COALESCE(num_animais_pasto_hoje, 0) > 0)) THEN GREATEST(COALESCE(intervalo_padrao_dias, 4), (CURRENT_DATE - (created_at)::date))
       ELSE COALESCE(intervalo_padrao_dias, 4)
   END) AS cab_dias_assumidos
  FROM base;

-- 2) view_consumo_tempo_real (base do Consumo Global)
CREATE OR REPLACE VIEW public.view_consumo_tempo_real AS
WITH base AS (
  SELECT l.id,
     l.fazenda_id,
     l.retiro_id,
     l.pasto_id,
     l.mes_referencia,
     l.ano_referencia,
     COALESCE(NULLIF(l.num_animais, 0), p.num_animais, 0) AS num_animais,
     COALESCE(NULLIF(l.peso_medio_kg, 0), p.peso_medio_kg) AS peso_medio_kg,
     COALESCE(NULLIF(l.categoria, ''), p.categoria) AS categoria,
     COALESCE(NULLIF(l.sexo, ''), p.sexo) AS sexo,
     l.num_sacos,
     l.created_at,
     l.origem,
     l.ciclo_id,
     COALESCE(prod.peso_saco_kg, (0)::numeric) AS peso_saco_kg,
     ((l.num_sacos)::numeric * COALESCE(prod.peso_saco_kg, (0)::numeric)) AS kg_fornecido,
     COALESCE(l.cobertura_dias_override, f.intervalo_padrao_dias, 4) AS intervalo_padrao_dias,
     CASE
         WHEN ((lower(COALESCE(COALESCE(NULLIF(l.categoria, ''), p.categoria), ''::text)) ~~ '%recria 1%'::text) OR (lower(COALESCE(COALESCE(NULLIF(l.categoria, ''), p.categoria), ''::text)) ~~ '%recria1%'::text)) THEN prod.consumo_recria1
         WHEN ((lower(COALESCE(COALESCE(NULLIF(l.categoria, ''), p.categoria), ''::text)) ~~ '%recria 2%'::text) OR (lower(COALESCE(COALESCE(NULLIF(l.categoria, ''), p.categoria), ''::text)) ~~ '%recria2%'::text)) THEN prod.consumo_recria2
         ELSE prod.consumo_engorda
     END AS consumo_por_100kg,
     l.status_consumo AS status_consumo_original,
     p.num_animais AS num_animais_pasto_hoje
    FROM ((((lancamentos l
      LEFT JOIN ocupacoes_pasto o ON ((o.id = l.ocupacao_id)))
      LEFT JOIN pastos p ON ((p.id = l.pasto_id)))
      LEFT JOIN produtos prod ON ((prod.id = COALESCE(o.produto_id, ( SELECT COALESCE(p2.produto_id, r.produto_id) AS "coalesce"
            FROM (pastos p2
              JOIN retiros r ON ((r.id = p2.retiro_id)))
           WHERE (p2.id = l.pasto_id))))))
      LEFT JOIN fazendas f ON ((f.id = l.fazenda_id)))
   WHERE ((l.num_sacos > 0) AND (COALESCE(NULLIF(l.num_animais, 0), p.num_animais, 0) > 0))
), latest_per_pasto AS (
  SELECT base.pasto_id, max(base.created_at) AS max_created FROM base GROUP BY base.pasto_id
), adjusted AS (
  SELECT b.*,
     (lpp.max_created = b.created_at) AS is_latest,
     (((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date - ((b.created_at AT TIME ZONE 'America/Sao_Paulo'::text))::date) AS dias_decorridos_reais
    FROM (base b LEFT JOIN latest_per_pasto lpp ON ((lpp.pasto_id = b.pasto_id)))
), final AS (
  SELECT adjusted.*,
     CASE
         WHEN (adjusted.is_latest AND (COALESCE(adjusted.num_animais_pasto_hoje, 0) > 0)) THEN GREATEST(adjusted.intervalo_padrao_dias, adjusted.dias_decorridos_reais)
         ELSE adjusted.intervalo_padrao_dias
     END AS dias_considerados
    FROM adjusted
)
SELECT id,
   fazenda_id,
   retiro_id,
   pasto_id,
   mes_referencia,
   ano_referencia,
   num_animais,
   peso_medio_kg,
   categoria,
   sexo,
   num_sacos,
   dias_considerados AS dias_no_pasto,
   status_consumo_original AS status_consumo,
   round((((kg_fornecido * 1000.0) / (NULLIF((num_animais * dias_considerados), 0))::numeric) / NULLIF((((consumo_por_100kg * peso_medio_kg) / 100.0) * 1000.0), (0)::numeric)), 2) AS indice_consumo,
   round(((kg_fornecido * 1000.0) / (NULLIF((num_animais * dias_considerados), 0))::numeric), 2) AS consumo_g_cab_dia,
   ciclo_id,
   created_at,
   (is_latest AND (dias_decorridos_reais > intervalo_padrao_dias)) AS is_open_period,
   origem
  FROM final;

-- 3) view_painel_mae_pasto_atual (usada pela Conferência)
CREATE OR REPLACE VIEW public.view_painel_mae_pasto_atual AS
WITH ultimo_lancamento AS (
  SELECT DISTINCT ON (l.pasto_id) l.id AS lancamento_id,
     l.pasto_id,
     l.retiro_id,
     l.fazenda_id,
     COALESCE(NULLIF(l.num_animais, 0), p0.num_animais, 0) AS num_animais,
     l.num_sacos,
     GREATEST(COALESCE(NULLIF(l.dias_no_pasto, 0), 1), 1) AS dias_no_pasto,
     COALESCE(NULLIF(l.peso_medio_kg, 0), p0.peso_medio_kg) AS peso_medio_kg,
     l.consumo_g_cab_dia AS consumo_real_g_cab_dia,
     l.indice_consumo AS indice_real,
     l.status_consumo AS status_real,
     l.mes_referencia,
     l.ano_referencia,
     l.created_at
    FROM lancamentos l
    LEFT JOIN pastos p0 ON p0.id = l.pasto_id
   WHERE ((l.num_sacos > 0) AND (COALESCE(NULLIF(l.num_animais, 0), p0.num_animais, 0) > 0))
   ORDER BY l.pasto_id, l.created_at DESC
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
   CASE
       WHEN (vctr.indice_consumo IS NULL) THEN NULL::text
       WHEN (vctr.indice_consumo < ( SELECT ((formulas_sistema.parametros ->> 'limite_baixo'::text))::numeric FROM formulas_sistema WHERE (formulas_sistema.chave = 'classificacao_consumo'::text))) THEN 'Baixo'::text
       WHEN (vctr.indice_consumo > ( SELECT ((formulas_sistema.parametros ->> 'limite_alto'::text))::numeric FROM formulas_sistema WHERE (formulas_sistema.chave = 'classificacao_consumo'::text))) THEN 'Alto'::text
       ELSE 'Ideal'::text
   END AS status_global,
   GREATEST((0)::numeric, ((100)::numeric - (abs(((1)::numeric - vctr.indice_consumo)) * (100)::numeric))) AS eficiencia_pasto,
   ul.created_at AS ultima_salga_real_em
  FROM ((ultimo_lancamento ul
    JOIN pastos p ON (((p.id = ul.pasto_id) AND (p.ativo = true))))
    LEFT JOIN view_consumo_tempo_real vctr ON ((vctr.id = ul.lancamento_id)));

-- 4) view_painel_mae_pasto (mensal)
CREATE OR REPLACE VIEW public.view_painel_mae_pasto AS
WITH ultimo_lancamento AS (
  SELECT DISTINCT ON (l.pasto_id, l.mes_referencia, l.ano_referencia) l.id AS lancamento_id,
     l.pasto_id,
     l.retiro_id,
     l.fazenda_id,
     COALESCE(NULLIF(l.num_animais, 0), p0.num_animais, 0) AS num_animais,
     l.num_sacos,
     GREATEST(COALESCE(NULLIF(l.dias_no_pasto, 0), 1), 1) AS dias_no_pasto,
     COALESCE(NULLIF(l.peso_medio_kg, 0), p0.peso_medio_kg) AS peso_medio_kg,
     l.consumo_g_cab_dia AS consumo_real_g_cab_dia,
     l.indice_consumo AS indice_real,
     l.status_consumo AS status_real,
     l.mes_referencia,
     l.ano_referencia,
     l.created_at
    FROM lancamentos l
    LEFT JOIN pastos p0 ON p0.id = l.pasto_id
   WHERE ((l.num_sacos > 0) AND (COALESCE(NULLIF(l.num_animais, 0), p0.num_animais, 0) > 0))
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
   COALESCE(((ul.num_sacos)::numeric * prod.peso_saco_kg), ((ul.num_sacos)::numeric * r.peso_saco_kg), ((ul.consumo_real_g_cab_dia * ((ul.num_animais * ul.dias_no_pasto))::numeric) / 1000.0)) AS kg_fornecido,
   CASE
       WHEN (vctr.indice_consumo IS NULL) THEN NULL::text
       WHEN (vctr.indice_consumo < ( SELECT ((formulas_sistema.parametros ->> 'limite_baixo'::text))::numeric FROM formulas_sistema WHERE (formulas_sistema.chave = 'classificacao_consumo'::text))) THEN 'Baixo'::text
       WHEN (vctr.indice_consumo > ( SELECT ((formulas_sistema.parametros ->> 'limite_alto'::text))::numeric FROM formulas_sistema WHERE (formulas_sistema.chave = 'classificacao_consumo'::text))) THEN 'Alto'::text
       ELSE 'Ideal'::text
   END AS status_global,
   GREATEST((0)::numeric, ((100)::numeric - (abs(((1)::numeric - vctr.indice_consumo)) * (100)::numeric))) AS eficiencia_pasto
  FROM ((((ultimo_lancamento ul
    JOIN pastos p ON (((p.id = ul.pasto_id) AND (p.ativo = true))))
    JOIN retiros r ON ((r.id = ul.retiro_id)))
    LEFT JOIN produtos prod ON ((prod.id = p.produto_id)))
    LEFT JOIN view_consumo_tempo_real vctr ON ((vctr.id = ul.lancamento_id)));