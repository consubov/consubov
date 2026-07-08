
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function: verifica retiros com salga atrasada e envia push ao gerente/admin da fazenda
CREATE OR REPLACE FUNCTION public.verificar_salgas_atrasadas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r RECORD;
  v_dias_sem_salga integer;
  v_intervalo integer;
  v_titulo text;
  v_msg text;
BEGIN
  FOR r IN
    SELECT
      ret.id,
      ret.nome AS retiro_nome,
      ret.capataz,
      ret.ultima_salga_em,
      ret.fazenda_id,
      f.nome AS fazenda_nome,
      COALESCE(f.intervalo_padrao_dias, 3) AS intervalo_padrao_dias
    FROM public.retiros ret
    JOIN public.fazendas f ON f.id = ret.fazenda_id
    WHERE ret.ativo = true
      AND f.ativo = true
      AND ret.ultima_salga_em IS NOT NULL
      AND COALESCE(ret.alerta_atraso_enviado, false) = false
  LOOP
    v_intervalo := r.intervalo_padrao_dias;
    v_dias_sem_salga := FLOOR(EXTRACT(EPOCH FROM (now() - r.ultima_salga_em)) / 86400)::integer;

    IF v_dias_sem_salga >= v_intervalo + 1 THEN
      v_titulo := '⚠️ Salga atrasada — ' || COALESCE(r.retiro_nome, '');
      v_msg := COALESCE(r.fazenda_nome, '') || E'\n'
            || 'Retiro ' || COALESCE(r.retiro_nome, '') ||
               CASE WHEN r.capataz IS NOT NULL AND r.capataz <> ''
                    THEN ' (' || r.capataz || ')' ELSE '' END
            || E'\n'
            || v_dias_sem_salga || ' dias sem salga (intervalo definido: ' || v_intervalo || ' dias)';

      PERFORM public.send_push_async(v_titulo, v_msg, '/gerente', r.fazenda_id);

      UPDATE public.retiros
      SET alerta_atraso_enviado = true
      WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;

-- Agenda a verificação a cada hora
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'verificar-salgas-atrasadas-hourly') THEN
    PERFORM cron.unschedule('verificar-salgas-atrasadas-hourly');
  END IF;
  PERFORM cron.schedule(
    'verificar-salgas-atrasadas-hourly',
    '0 * * * *',
    $cron$ SELECT public.verificar_salgas_atrasadas(); $cron$
  );
END $$;
