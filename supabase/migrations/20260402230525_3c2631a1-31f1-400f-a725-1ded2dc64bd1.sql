
CREATE OR REPLACE FUNCTION public.notificar_novo_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE TRIGGER trg_lead_notificacao
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.notificar_novo_lead();
