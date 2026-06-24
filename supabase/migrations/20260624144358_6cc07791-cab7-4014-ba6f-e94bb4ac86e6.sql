
DROP TRIGGER IF EXISTS trg_notificar_observacao ON public.observacoes;
CREATE TRIGGER trg_notificar_observacao
AFTER INSERT ON public.observacoes
FOR EACH ROW EXECUTE FUNCTION public.notificar_observacao();

DROP TRIGGER IF EXISTS trg_notificar_mortalidade ON public.mortalidades;
CREATE TRIGGER trg_notificar_mortalidade
AFTER INSERT ON public.mortalidades
FOR EACH ROW EXECUTE FUNCTION public.notificar_mortalidade();
