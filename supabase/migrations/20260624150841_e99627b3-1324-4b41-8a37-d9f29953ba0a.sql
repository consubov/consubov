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
  v_resumo text;
  v_titulo text;
  v_contexto text;
BEGIN
  SELECT p.nome, r.nome, f.nome
    INTO v_pasto_nome, v_retiro_nome, v_fazenda_nome
  FROM pastos p
  LEFT JOIN retiros r ON r.id = p.retiro_id
  LEFT JOIN fazendas f ON f.id = r.fazenda_id
  WHERE p.id = NEW.pasto_id;

  INSERT INTO notificacoes (tipo, titulo, mensagem, dados)
  VALUES (
    'observacao',
    'Nova observação no pasto ' || COALESCE(v_pasto_nome, 'desconhecido'),
    COALESCE(NEW.descricao, 'Sem descrição'),
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
  IF v_contexto = '' THEN v_contexto := 'Consubov'; END IF;

  v_titulo := v_contexto;
  v_resumo := COALESCE(NULLIF(trim(NEW.descricao), ''), 'Nova observação registrada')
              || ' — ' || COALESCE(NEW.capataz_nome, 'Capataz')
              || CASE WHEN v_pasto_nome IS NOT NULL THEN ' (' || v_pasto_nome || ')' ELSE '' END;

  PERFORM public.send_push_async(v_titulo, left(v_resumo, 200), '/gerente', NEW.fazenda_id);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notificar_mortalidade()
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
BEGIN
  SELECT p.nome, r.nome, f.nome
    INTO v_pasto_nome, v_retiro_nome, v_fazenda_nome
  FROM pastos p
  LEFT JOIN retiros r ON r.id = p.retiro_id
  LEFT JOIN fazendas f ON f.id = r.fazenda_id
  WHERE p.id = NEW.pasto_id;

  INSERT INTO notificacoes (tipo, titulo, mensagem, fazenda_id, dados)
  VALUES (
    'mortalidade',
    'Mortalidade registrada no pasto ' || COALESCE(v_pasto_nome, 'desconhecido'),
    NEW.quantidade || ' animal(is) registrado(s) como mortalidade.',
    NEW.fazenda_id,
    jsonb_build_object(
      'pasto_id', NEW.pasto_id,
      'pasto_nome', COALESCE(v_pasto_nome, ''),
      'retiro_nome', COALESCE(v_retiro_nome, ''),
      'fazenda_nome', COALESCE(v_fazenda_nome, ''),
      'quantidade', NEW.quantidade,
      'fazenda_id', NEW.fazenda_id,
      'retiro_id', NEW.retiro_id
    )
  );

  v_contexto := trim(both ' - ' from concat_ws(' - ', NULLIF(v_fazenda_nome, ''), NULLIF(v_retiro_nome, '')));
  IF v_contexto = '' THEN v_contexto := 'Consubov'; END IF;

  PERFORM public.send_push_async(
    v_contexto,
    '⚠️ Mortalidade: ' || NEW.quantidade || ' animal(is)'
      || CASE WHEN v_pasto_nome IS NOT NULL THEN ' no pasto ' || v_pasto_nome ELSE '' END,
    '/gerente',
    NEW.fazenda_id
  );

  RETURN NEW;
END;
$function$;