
-- 1. Create mortalidades table
CREATE TABLE public.mortalidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id uuid NOT NULL,
  retiro_id uuid NOT NULL,
  pasto_id uuid NOT NULL,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  data timestamp with time zone NOT NULL DEFAULT now(),
  mes integer NOT NULL,
  ano integer NOT NULL,
  usuario_id uuid DEFAULT auth.uid(),
  foto_url text NOT NULL,
  observacao text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.mortalidades ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin acessa mortalidades" ON public.mortalidades
  FOR ALL TO authenticated
  USING (fazenda_id IN (
    SELECT f.id FROM fazendas f
    WHERE f.administrador_id IN (
      SELECT a.id FROM administradores a WHERE a.user_id = auth.uid()
    )
  ));

-- Capataz insert + read
CREATE POLICY "Capataz insere mortalidades" ON public.mortalidades
  FOR INSERT TO authenticated
  WITH CHECK (retiro_id IN (
    SELECT c.retiro_id FROM capatazes c
    WHERE c.user_id = auth.uid() AND c.ativo = true
  ));

CREATE POLICY "Capataz le mortalidades" ON public.mortalidades
  FOR SELECT TO authenticated
  USING (retiro_id IN (
    SELECT c.retiro_id FROM capatazes c
    WHERE c.user_id = auth.uid() AND c.ativo = true
  ));

-- Gerente read
CREATE POLICY "Gerente acessa mortalidades" ON public.mortalidades
  FOR SELECT TO authenticated
  USING (fazenda_id IN (
    SELECT g.fazenda_id FROM gerentes g
    WHERE g.user_id = auth.uid() AND g.ativo = true
  ));

-- 2. Trigger: auto-notify on mortalidade insert
CREATE OR REPLACE FUNCTION public.notificar_mortalidade()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_pasto_nome text;
BEGIN
  SELECT nome INTO v_pasto_nome FROM pastos WHERE id = NEW.pasto_id;
  INSERT INTO notificacoes (tipo, titulo, mensagem, dados)
  VALUES (
    'mortalidade',
    'Mortalidade registrada no pasto ' || COALESCE(v_pasto_nome, 'desconhecido'),
    NEW.quantidade || ' animal(is) registrado(s) como mortalidade.',
    jsonb_build_object(
      'pasto_id', NEW.pasto_id,
      'pasto_nome', COALESCE(v_pasto_nome, ''),
      'quantidade', NEW.quantidade,
      'fazenda_id', NEW.fazenda_id,
      'retiro_id', NEW.retiro_id
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notificar_mortalidade
  AFTER INSERT ON public.mortalidades
  FOR EACH ROW EXECUTE FUNCTION public.notificar_mortalidade();

-- 3. Trigger: auto-notify on observacao insert
CREATE OR REPLACE FUNCTION public.notificar_observacao()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_pasto_nome text;
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notificar_observacao
  AFTER INSERT ON public.observacoes
  FOR EACH ROW EXECUTE FUNCTION public.notificar_observacao();
