
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

  -- Traduz o código do tipo para rótulo legível
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

  v_body := 'Nova observação registrada - ' || COALESCE(NULLIF(NEW.capataz_nome, ''), 'Capataz')
            || E'\n' || v_linha2;

  IF NEW.descricao IS NOT NULL AND trim(NEW.descricao) <> '' THEN
    v_body := v_body || E'\n' || trim(NEW.descricao);
  END IF;

  PERFORM public.send_push_async(v_contexto, left(v_body, 250), '/gerente', NEW.fazenda_id);

  RETURN NEW;
END;
$function$;
