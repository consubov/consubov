
-- 1. Add fazenda_id to notificacoes for proper filtering
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS fazenda_id uuid;

-- 2. Update existing trigger to include fazenda_id
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
  RETURN NEW;
END;
$$;

-- 3. Create trigger function for transfer notifications
CREATE OR REPLACE FUNCTION public.notificar_transferencia_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_origem_nome text;
  v_destino_nome text;
  v_fazenda_id uuid;
  v_solicitante_email text;
BEGIN
  -- Get retiro names and fazenda_id
  SELECT r.nome, r.fazenda_id INTO v_origem_nome, v_fazenda_id
  FROM retiros r WHERE r.id = NEW.retiro_origem_id;

  SELECT r.nome INTO v_destino_nome
  FROM retiros r WHERE r.id = NEW.retiro_destino_id;

  -- Get solicitante email
  IF NEW.solicitado_por IS NOT NULL THEN
    SELECT email INTO v_solicitante_email
    FROM auth.users WHERE id = NEW.solicitado_por;
  END IF;

  RAISE LOG 'notificar_transferencia_estoque: transfer_id=%, origem=%, destino=%, fazenda=%, qty=%',
    NEW.id, v_origem_nome, v_destino_nome, v_fazenda_id, NEW.quantidade;

  -- Create notification
  INSERT INTO notificacoes (tipo, titulo, mensagem, fazenda_id, dados)
  VALUES (
    'transferencia_estoque',
    CASE NEW.tipo_acao
      WHEN 'solicitacao' THEN COALESCE(v_destino_nome, '?') || ' solicita ' || NEW.quantidade || ' sacos de ' || COALESCE(v_origem_nome, '?')
      ELSE COALESCE(v_origem_nome, '?') || ' deseja enviar ' || NEW.quantidade || ' sacos para ' || COALESCE(v_destino_nome, '?')
    END,
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

  RAISE LOG 'notificar_transferencia_estoque: notification created for fazenda=%', v_fazenda_id;

  RETURN NEW;
END;
$$;

-- 4. Create the trigger
DROP TRIGGER IF EXISTS trg_notificar_transferencia_estoque ON transferencias_estoque;
CREATE TRIGGER trg_notificar_transferencia_estoque
  AFTER INSERT ON transferencias_estoque
  FOR EACH ROW
  EXECUTE FUNCTION notificar_transferencia_estoque();

-- 5. Recreate mortalidade trigger
DROP TRIGGER IF EXISTS trg_notificar_mortalidade ON mortalidades;
CREATE TRIGGER trg_notificar_mortalidade
  AFTER INSERT ON mortalidades
  FOR EACH ROW
  EXECUTE FUNCTION notificar_mortalidade();

-- 6. Add RLS policy for gerentes to read notifications of their fazenda
CREATE POLICY "Gerente acessa notificacoes da fazenda"
  ON public.notificacoes
  FOR SELECT
  TO authenticated
  USING (
    fazenda_id IN (
      SELECT g.fazenda_id FROM gerentes g
      WHERE g.user_id = auth.uid() AND g.ativo = true
    )
  );

-- 7. Allow gerentes to update notifications (mark as read)
CREATE POLICY "Gerente atualiza notificacoes da fazenda"
  ON public.notificacoes
  FOR UPDATE
  TO authenticated
  USING (
    fazenda_id IN (
      SELECT g.fazenda_id FROM gerentes g
      WHERE g.user_id = auth.uid() AND g.ativo = true
    )
  );
