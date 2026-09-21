-- 1. send_push_async com destino ampliado (fábrica / somente admins)
DROP FUNCTION IF EXISTS public.send_push_async(text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.send_push_async(
  p_title text,
  p_body text,
  p_url text,
  p_fazenda_id uuid,
  p_fabrica_id uuid DEFAULT NULL,
  p_admins_only boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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
    'fazenda_id', p_fazenda_id,
    'fabrica_id', p_fabrica_id,
    'admins_only', p_admins_only
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
$function$;

-- 2. Observação: grava fazenda_id na coluna
CREATE OR REPLACE FUNCTION public.notificar_observacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pasto_nome text;
  v_retiro_nome text;
  v_fazenda_nome text;
  v_contexto text;
  v_tipo_label text;
  v_linha2 text;
  v_body text;
BEGIN
  SELECT p.nome, r.nome, f.nome
    INTO v_pasto_nome, v_retiro_nome, v_fazenda_nome
  FROM pastos p
  LEFT JOIN retiros r ON r.id = p.retiro_id
  LEFT JOIN fazendas f ON f.id = r.fazenda_id
  WHERE p.id = NEW.pasto_id;

  INSERT INTO notificacoes (tipo, titulo, mensagem, fazenda_id, dados)
  VALUES (
    'observacao',
    'Nova observação no pasto ' || COALESCE(v_pasto_nome, 'desconhecido'),
    COALESCE(NEW.descricao, 'Sem descrição'),
    NEW.fazenda_id,
    jsonb_build_object(
      'pasto_id', NEW.pasto_id,
      'pasto_nome', COALESCE(v_pasto_nome, ''),
      'retiro_nome', COALESCE(v_retiro_nome, ''),
      'fazenda_nome', COALESCE(v_fazenda_nome, ''),
      'tipo', COALESCE(NEW.tipo, 'geral'),
      'fazenda_id', NEW.fazenda_id,
      'retiro_id', NEW.retiro_id
    )
  );

  v_contexto := trim(both ' - ' from concat_ws(' - ', NULLIF(v_fazenda_nome, ''), NULLIF(v_retiro_nome, '')));

  v_tipo_label := CASE COALESCE(NEW.tipo, '')
    WHEN 'porteira'         THEN 'Porteira'
    WHEN 'fio_rompido'      THEN 'Fio rompido'
    WHEN 'cocho'            THEN 'Cocho'
    WHEN 'estaca'           THEN 'Estaca'
    WHEN 'agua'             THEN 'Água'
    WHEN 'colchete'         THEN 'Colchete'
    WHEN 'animal_doente'    THEN 'Animal doente'
    WHEN 'animal_machucado' THEN 'Animal machucado'
    ELSE initcap(replace(COALESCE(NULLIF(NEW.tipo, ''), 'Observação'), '_', ' '))
  END;

  v_linha2 := v_tipo_label
              || CASE WHEN v_pasto_nome IS NOT NULL AND v_pasto_nome <> ''
                      THEN ' - Pasto: ' || v_pasto_nome ELSE '' END;

  v_body := COALESCE(v_contexto, 'Consubov')
            || E'\n' || 'Nova observação registrada - ' || COALESCE(NULLIF(NEW.capataz_nome, ''), 'Capataz')
            || E'\n' || v_linha2;

  IF NEW.descricao IS NOT NULL AND trim(NEW.descricao) <> '' THEN
    v_body := v_body || E'\n' || trim(NEW.descricao);
  END IF;

  PERFORM public.send_push_async('Consubov', left(v_body, 250), '/gerente', NEW.fazenda_id);

  RETURN NEW;
END;
$function$;

-- 3. Transferência de fábrica: passa a fábrica para o filtro de vínculo
CREATE OR REPLACE FUNCTION public.notificar_transferencia_fabrica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fabrica_nome  text;
  v_produto_nome  text;
  v_fazenda_id    uuid;
  v_fazenda_nome  text;
  v_retiro_nome   text;
  v_destino_label text;
  v_titulo        text;
  v_mensagem      text;
BEGIN
  IF COALESCE(NEW.status, '') <> 'em_transito' THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_fabrica_nome FROM public.fabricas WHERE id = NEW.fabrica_id;
  SELECT nome INTO v_produto_nome FROM public.produtos WHERE id = NEW.produto_id;

  IF NEW.fazenda_destino_id IS NOT NULL THEN
    v_fazenda_id := NEW.fazenda_destino_id;
    SELECT nome INTO v_fazenda_nome FROM public.fazendas WHERE id = NEW.fazenda_destino_id;
    v_destino_label := 'Fazenda ' || COALESCE(v_fazenda_nome, 'destino');
  ELSIF NEW.retiro_destino_id IS NOT NULL THEN
    SELECT r.nome, r.fazenda_id, f.nome
      INTO v_retiro_nome, v_fazenda_id, v_fazenda_nome
    FROM public.retiros r
    LEFT JOIN public.fazendas f ON f.id = r.fazenda_id
    WHERE r.id = NEW.retiro_destino_id;
    v_destino_label := 'Fazenda ' || COALESCE(v_fazenda_nome, '') ||
                       ' • Retiro ' || COALESCE(v_retiro_nome, '');
  ELSE
    v_destino_label := 'destino';
  END IF;

  v_titulo   := 'Nova transferência de ' || COALESCE(v_produto_nome, 'produto');
  v_mensagem := 'Fábrica ' || COALESCE(v_fabrica_nome, '') ||
                ' enviou ' || NEW.quantidade_sacos || ' sacos para ' ||
                v_destino_label || '. Aguardando recebimento.';

  INSERT INTO public.notificacoes (tipo, titulo, mensagem, fazenda_id, dados)
  VALUES (
    'transferencia_fabrica',
    v_titulo,
    v_mensagem,
    v_fazenda_id,
    jsonb_build_object(
      'transferencia_id', NEW.id,
      'fabrica_id', NEW.fabrica_id,
      'fabrica_nome', COALESCE(v_fabrica_nome, ''),
      'produto_id', NEW.produto_id,
      'produto_nome', COALESCE(v_produto_nome, ''),
      'quantidade_sacos', NEW.quantidade_sacos,
      'quantidade_kg', NEW.quantidade_kg,
      'fazenda_destino_id', NEW.fazenda_destino_id,
      'retiro_destino_id', NEW.retiro_destino_id,
      'fazenda_id', v_fazenda_id,
      'rota', '/gerente/transferencias?transferencia=' || NEW.id
    )
  );

  IF v_fazenda_id IS NOT NULL THEN
    PERFORM public.send_push_async(
      v_titulo,
      left(v_mensagem, 250),
      '/gerente/transferencias?transferencia=' || NEW.id,
      v_fazenda_id,
      NEW.fabrica_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Transferência entre retiros: agora envia push também
CREATE OR REPLACE FUNCTION public.notificar_transferencia_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_origem_nome text;
  v_destino_nome text;
  v_fazenda_id uuid;
  v_solicitante_email text;
  v_titulo text;
BEGIN
  SELECT r.nome, r.fazenda_id INTO v_origem_nome, v_fazenda_id
  FROM retiros r WHERE r.id = NEW.retiro_origem_id;

  SELECT r.nome INTO v_destino_nome
  FROM retiros r WHERE r.id = NEW.retiro_destino_id;

  IF NEW.solicitado_por IS NOT NULL THEN
    SELECT email INTO v_solicitante_email
    FROM auth.users WHERE id = NEW.solicitado_por;
  END IF;

  v_titulo := CASE NEW.tipo_acao
    WHEN 'solicitacao' THEN COALESCE(v_destino_nome, '?') || ' solicita ' || NEW.quantidade || ' sacos de ' || COALESCE(v_origem_nome, '?')
    ELSE COALESCE(v_origem_nome, '?') || ' deseja enviar ' || NEW.quantidade || ' sacos para ' || COALESCE(v_destino_nome, '?')
  END;

  INSERT INTO notificacoes (tipo, titulo, mensagem, fazenda_id, dados)
  VALUES (
    'transferencia_estoque',
    v_titulo,
    'Transferência de sal entre retiros aguardando aprovação do gerente.',
    v_fazenda_id,
    jsonb_build_object(
      'transferencia_id', NEW.id,
      'retiro_origem_id', NEW.retiro_origem_id,
      'retiro_origem_nome', COALESCE(v_origem_nome, ''),
      'retiro_destino_id', NEW.retiro_destino_id,
      'retiro_destino_nome', COALESCE(v_destino_nome, ''),
      'quantidade', NEW.quantidade,
      'tipo_acao', NEW.tipo_acao,
      'solicitado_por', COALESCE(v_solicitante_email, ''),
      'fazenda_id', v_fazenda_id
    )
  );

  IF v_fazenda_id IS NOT NULL THEN
    PERFORM public.send_push_async(
      v_titulo,
      'Transferência de sal entre retiros aguardando aprovação do gerente.',
      '/gerente',
      v_fazenda_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 5. Lead do site: push somente para administradores
CREATE OR REPLACE FUNCTION public.notificar_novo_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO notificacoes (tipo, titulo, mensagem, dados)
  VALUES (
    'lead',
    'Novo lead: ' || NEW.nome,
    COALESCE(NEW.mensagem, 'Sem mensagem'),
    jsonb_build_object(
      'nome', NEW.nome,
      'email', NEW.email,
      'telefone', NEW.telefone,
      'whatsapp', NEW.whatsapp,
      'mensagem', COALESCE(NEW.mensagem, '')
    )
  );
  RETURN NEW;
END;
$function$;

-- 6. Regras de leitura/permissão
CREATE OR REPLACE FUNCTION public.fazendas_operacionais_do_usuario(_user_id uuid)
RETURNS TABLE (fazenda_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT g.fazenda_id FROM gerentes g
   WHERE g.user_id = _user_id AND g.ativo = true AND g.fazenda_id IS NOT NULL
  UNION
  SELECT r.fazenda_id FROM capatazes c
    JOIN retiros r ON r.id = c.retiro_id
   WHERE c.user_id = _user_id AND c.ativo = true AND r.fazenda_id IS NOT NULL
$function$;

GRANT EXECUTE ON FUNCTION public.fazendas_operacionais_do_usuario(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Admin acessa notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Gerente acessa notificacoes da fazenda" ON public.notificacoes;
DROP POLICY IF EXISTS "Gerente atualiza notificacoes da fazenda" ON public.notificacoes;

CREATE POLICY "Admin acessa notificacoes de sistema"
ON public.notificacoes FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) AND fazenda_id IS NULL AND tipo IN ('lead', 'aviso'))
WITH CHECK (public.is_admin(auth.uid()) AND fazenda_id IS NULL AND tipo IN ('lead', 'aviso'));

CREATE POLICY "Operacional le notificacoes da fazenda"
ON public.notificacoes FOR SELECT TO authenticated
USING (fazenda_id IN (SELECT f.fazenda_id FROM public.fazendas_operacionais_do_usuario(auth.uid()) f));

CREATE POLICY "Operacional atualiza notificacoes da fazenda"
ON public.notificacoes FOR UPDATE TO authenticated
USING (fazenda_id IN (SELECT f.fazenda_id FROM public.fazendas_operacionais_do_usuario(auth.uid()) f));

CREATE POLICY "Operacional apaga notificacoes da fazenda"
ON public.notificacoes FOR DELETE TO authenticated
USING (fazenda_id IN (SELECT f.fazenda_id FROM public.fazendas_operacionais_do_usuario(auth.uid()) f));