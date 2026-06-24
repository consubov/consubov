-- 1. Extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Tabela de configuração interna para guardar a URL/chave de serviço.
--    Mantemos só linhas de uso interno, restringimos por RLS.
CREATE TABLE IF NOT EXISTS public.app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_secrets TO service_role;
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role manages app_secrets" ON public.app_secrets;
CREATE POLICY "service_role manages app_secrets"
  ON public.app_secrets FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 3. Função utilitária: dispara push HTTP para a edge function send-push-notification
CREATE OR REPLACE FUNCTION public.send_push_async(
  p_title text,
  p_body text,
  p_url text,
  p_fazenda_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_base_url text;
  v_service_key text;
  v_payload jsonb;
BEGIN
  SELECT value INTO v_base_url FROM public.app_secrets WHERE key = 'supabase_url';
  SELECT value INTO v_service_key FROM public.app_secrets WHERE key = 'service_role_key';

  IF v_base_url IS NULL OR v_service_key IS NULL THEN
    RAISE LOG 'send_push_async: app_secrets ausentes (supabase_url/service_role_key)';
    RETURN;
  END IF;

  v_payload := jsonb_build_object(
    'title', p_title,
    'body', p_body,
    'url', p_url,
    'fazenda_id', p_fazenda_id
  );

  PERFORM net.http_post(
    url := v_base_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key,
      'apikey', v_service_key
    ),
    body := v_payload,
    timeout_milliseconds := 5000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'send_push_async falhou: %', SQLERRM;
END;
$$;

-- 4. Atualiza trigger de observacoes para também disparar push
CREATE OR REPLACE FUNCTION public.notificar_observacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pasto_nome text;
  v_resumo text;
  v_titulo text;
BEGIN
  SELECT nome INTO v_pasto_nome FROM pastos WHERE id = NEW.pasto_id;

  INSERT INTO notificacoes (tipo, titulo, mensagem, dados)
  VALUES (
    'observacao',
    'Nova observação no pasto ' || COALESCE(v_pasto_nome, 'desconhecido'),
    COALESCE(NEW.descricao, 'Sem descrição'),
    jsonb_build_object(
      'pasto_id', NEW.pasto_id,
      'pasto_nome', COALESCE(v_pasto_nome, ''),
      'tipo', COALESCE(NEW.tipo, 'geral'),
      'fazenda_id', NEW.fazenda_id,
      'retiro_id', NEW.retiro_id
    )
  );

  v_resumo := COALESCE(NULLIF(trim(NEW.descricao), ''), 'Nova observação registrada');
  v_titulo := '📋 ' || COALESCE(NEW.capataz_nome, 'Capataz') || ' — ' || COALESCE(v_pasto_nome, 'observação');
  PERFORM public.send_push_async(v_titulo, left(v_resumo, 140), '/gerente', NEW.fazenda_id);

  RETURN NEW;
END;
$$;

-- 5. Atualiza trigger de mortalidades para também disparar push
CREATE OR REPLACE FUNCTION public.notificar_mortalidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pasto_nome text;
BEGIN
  SELECT nome INTO v_pasto_nome FROM pastos WHERE id = NEW.pasto_id;

  INSERT INTO notificacoes (tipo, titulo, mensagem, fazenda_id, dados)
  VALUES (
    'mortalidade',
    'Mortalidade registrada no pasto ' || COALESCE(v_pasto_nome, 'desconhecido'),
    NEW.quantidade || ' animal(is) registrado(s) como mortalidade.',
    NEW.fazenda_id,
    jsonb_build_object(
      'pasto_id', NEW.pasto_id,
      'pasto_nome', COALESCE(v_pasto_nome, ''),
      'quantidade', NEW.quantidade,
      'fazenda_id', NEW.fazenda_id,
      'retiro_id', NEW.retiro_id
    )
  );

  PERFORM public.send_push_async(
    '⚠️ Mortalidade no pasto ' || COALESCE(v_pasto_nome, ''),
    NEW.quantidade || ' animal(is) registrado(s).',
    '/gerente',
    NEW.fazenda_id
  );

  RETURN NEW;
END;
$$;

-- Garante triggers ativos (idempotente)
DROP TRIGGER IF EXISTS trg_notificar_observacao ON public.observacoes;
CREATE TRIGGER trg_notificar_observacao
  AFTER INSERT ON public.observacoes
  FOR EACH ROW EXECUTE FUNCTION public.notificar_observacao();

DROP TRIGGER IF EXISTS trg_notificar_mortalidade ON public.mortalidades;
CREATE TRIGGER trg_notificar_mortalidade
  AFTER INSERT ON public.mortalidades
  FOR EACH ROW EXECUTE FUNCTION public.notificar_mortalidade();