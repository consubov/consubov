CREATE OR REPLACE FUNCTION public.notificar_transferencia_fabrica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      v_fazenda_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notificar_transferencia_fabrica ON public.transferencias_fabrica;
CREATE TRIGGER trg_notificar_transferencia_fabrica
AFTER INSERT ON public.transferencias_fabrica
FOR EACH ROW EXECUTE FUNCTION public.notificar_transferencia_fabrica();