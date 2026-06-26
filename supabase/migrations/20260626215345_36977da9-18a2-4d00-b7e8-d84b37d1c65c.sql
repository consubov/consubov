CREATE UNIQUE INDEX IF NOT EXISTS idx_movimentacoes_estoque_salga_referencia_unique
  ON public.movimentacoes_estoque (referencia_id, origem)
  WHERE origem = 'salga' AND referencia_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_capataz_lancamento(p_lancamento jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_fazenda_id uuid;
  v_retiro_id uuid;
  v_pasto_id uuid;
  v_ciclo_id uuid;
  v_mes integer;
  v_ano integer;
  v_num_sacos integer;
  v_num_animais integer;
  v_dias_no_pasto integer;
  v_data_salga timestamptz;
  v_inserted boolean := false;
  v_estoque_baixado boolean := false;
  v_estoque_id uuid;
  v_quantidade_atual integer;
  v_row_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  v_id := (p_lancamento ->> 'id')::uuid;
  v_fazenda_id := (p_lancamento ->> 'fazenda_id')::uuid;
  v_retiro_id := (p_lancamento ->> 'retiro_id')::uuid;
  v_pasto_id := (p_lancamento ->> 'pasto_id')::uuid;
  v_ciclo_id := NULLIF(p_lancamento ->> 'ciclo_id', '')::uuid;
  v_mes := COALESCE((p_lancamento ->> 'mes_referencia')::integer, EXTRACT(MONTH FROM now())::integer);
  v_ano := COALESCE((p_lancamento ->> 'ano_referencia')::integer, EXTRACT(YEAR FROM now())::integer);
  v_num_sacos := COALESCE((p_lancamento ->> 'num_sacos')::integer, 0);
  v_num_animais := COALESCE((p_lancamento ->> 'num_animais')::integer, 0);
  v_dias_no_pasto := GREATEST(1, COALESCE((p_lancamento ->> 'dias_no_pasto')::integer, 1));
  v_data_salga := COALESCE(NULLIF(p_lancamento ->> 'data_salga', '')::timestamptz, now());

  IF v_id IS NULL OR v_fazenda_id IS NULL OR v_retiro_id IS NULL OR v_pasto_id IS NULL THEN
    RAISE EXCEPTION 'Dados obrigatórios ausentes para sincronizar a salga';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.capatazes c
    JOIN public.pastos p ON p.retiro_id = c.retiro_id
    JOIN public.retiros r ON r.id = c.retiro_id
    WHERE c.user_id = v_user_id
      AND c.ativo = true
      AND c.retiro_id = v_retiro_id
      AND p.id = v_pasto_id
      AND r.fazenda_id = v_fazenda_id
  ) THEN
    RAISE EXCEPTION 'Capataz sem permissão para sincronizar este retiro/pasto';
  END IF;

  INSERT INTO public.lancamentos (
    id,
    fazenda_id,
    retiro_id,
    pasto_id,
    mes_referencia,
    ano_referencia,
    ciclo_id,
    num_sacos,
    num_animais,
    origem,
    peso_medio_kg,
    dias_no_pasto,
    categoria,
    sexo,
    cocho_cheio,
    foto_cocho_url,
    created_at,
    data_salga_informada,
    criado_por
  ) VALUES (
    v_id,
    v_fazenda_id,
    v_retiro_id,
    v_pasto_id,
    v_mes,
    v_ano,
    v_ciclo_id,
    v_num_sacos,
    v_num_animais,
    COALESCE(NULLIF(p_lancamento ->> 'origem', ''), 'qr'),
    NULLIF(p_lancamento ->> 'peso_medio_kg', '')::numeric,
    v_dias_no_pasto,
    NULLIF(p_lancamento ->> 'categoria', ''),
    NULLIF(p_lancamento ->> 'sexo', ''),
    COALESCE((p_lancamento ->> 'cocho_cheio')::boolean, false),
    NULLIF(p_lancamento ->> 'foto_cocho_url', ''),
    v_data_salga,
    v_data_salga,
    v_user_id
  )
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_inserted := v_row_count > 0;

  UPDATE public.retiros
  SET ultima_salga_em = GREATEST(COALESCE(ultima_salga_em, v_data_salga), v_data_salga),
      alerta_atraso_enviado = false
  WHERE id = v_retiro_id;

  IF v_num_sacos > 0 THEN
    SELECT e.id, e.quantidade_atual
      INTO v_estoque_id, v_quantidade_atual
    FROM public.estoque_retiro e
    WHERE e.retiro_id = v_retiro_id
      AND e.mes = v_mes
      AND e.ano = v_ano
    ORDER BY e.updated_at DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;

    IF v_estoque_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM public.movimentacoes_estoque m
         WHERE m.referencia_id = v_id
           AND m.origem = 'salga'
       ) THEN
      UPDATE public.estoque_retiro
      SET quantidade_atual = GREATEST(0, v_quantidade_atual - v_num_sacos),
          updated_at = now()
      WHERE id = v_estoque_id;

      INSERT INTO public.movimentacoes_estoque (
        retiro_id,
        mes,
        ano,
        tipo,
        quantidade,
        origem,
        referencia_id
      ) VALUES (
        v_retiro_id,
        v_mes,
        v_ano,
        'saida',
        v_num_sacos,
        'salga',
        v_id
      )
      ON CONFLICT (referencia_id, origem) WHERE origem = 'salga' AND referencia_id IS NOT NULL DO NOTHING;

      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_estoque_baixado := v_row_count > 0;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'estoque_baixado', v_estoque_baixado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_capataz_lancamento(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_capataz_lancamento(jsonb) TO authenticated;