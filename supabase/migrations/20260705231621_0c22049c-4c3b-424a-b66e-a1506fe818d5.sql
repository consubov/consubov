
-- Sequence + trigger for fabricas.codigo (FAB-000001) and qr_code
CREATE SEQUENCE IF NOT EXISTS public.fabrica_codigo_seq START 1;

CREATE OR REPLACE FUNCTION public.set_fabrica_codigo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := 'FAB-' || lpad(nextval('public.fabrica_codigo_seq')::text, 6, '0');
  END IF;
  IF NEW.qr_code IS NULL OR NEW.qr_code = '' THEN
    NEW.qr_code := NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_fabrica_codigo ON public.fabricas;
CREATE TRIGGER trg_set_fabrica_codigo
BEFORE INSERT ON public.fabricas
FOR EACH ROW EXECUTE FUNCTION public.set_fabrica_codigo();

-- Trigger to update materias_primas.estoque_atual on new entrada
CREATE OR REPLACE FUNCTION public.atualizar_estoque_materia_prima()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.materias_primas
     SET estoque_atual = COALESCE(estoque_atual, 0) + COALESCE(NEW.quantidade, 0)
   WHERE id = NEW.materia_prima_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_estoque_materia_prima ON public.entradas_materias_primas;
CREATE TRIGGER trg_atualizar_estoque_materia_prima
AFTER INSERT ON public.entradas_materias_primas
FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_materia_prima();

-- Role helpers (used by frontend)
CREATE OR REPLACE FUNCTION public.is_operador_fabrica(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.operadores_fabrica
     WHERE user_id = _user_id AND ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_operador_fabrica_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT fabrica_id FROM public.operadores_fabrica
   WHERE user_id = _user_id AND ativo = true LIMIT 1;
$$;

-- Grants (RLS stays disabled, matching the rest of the project)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabricas TO authenticated;
GRANT ALL ON public.fabricas TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabrica_destinos TO authenticated;
GRANT ALL ON public.fabrica_destinos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operadores_fabrica TO authenticated;
GRANT ALL ON public.operadores_fabrica TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.materias_primas TO authenticated;
GRANT ALL ON public.materias_primas TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entradas_materias_primas TO authenticated;
GRANT ALL ON public.entradas_materias_primas TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.fabrica_codigo_seq TO authenticated, service_role;
