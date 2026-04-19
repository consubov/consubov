CREATE TABLE public.sync_commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id UUID NOT NULL,
  sender_user_id UUID,
  command TEXT NOT NULL DEFAULT 'sync',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sync_commands_target ON public.sync_commands(target_user_id, created_at DESC);

ALTER TABLE public.sync_commands ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admin acessa sync_commands"
ON public.sync_commands
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Capataz: view their own
CREATE POLICY "Capataz le seus sync_commands"
ON public.sync_commands
FOR SELECT
TO authenticated
USING (target_user_id = auth.uid());

-- Capataz: acknowledge their own
CREATE POLICY "Capataz atualiza seus sync_commands"
ON public.sync_commands
FOR UPDATE
TO authenticated
USING (target_user_id = auth.uid())
WITH CHECK (target_user_id = auth.uid());

-- Gerente: insert for capatazes of their fazenda
CREATE POLICY "Gerente insere sync_commands para capatazes da fazenda"
ON public.sync_commands
FOR INSERT
TO authenticated
WITH CHECK (
  target_user_id IN (
    SELECT c.user_id FROM capatazes c
    JOIN retiros r ON r.id = c.retiro_id
    WHERE c.ativo = true
      AND r.fazenda_id IN (
        SELECT g.fazenda_id FROM gerentes g
        WHERE g.user_id = auth.uid() AND g.ativo = true
      )
  )
);

-- Gerente: view sync_commands for capatazes of their fazenda
CREATE POLICY "Gerente le sync_commands da fazenda"
ON public.sync_commands
FOR SELECT
TO authenticated
USING (
  target_user_id IN (
    SELECT c.user_id FROM capatazes c
    JOIN retiros r ON r.id = c.retiro_id
    WHERE c.ativo = true
      AND r.fazenda_id IN (
        SELECT g.fazenda_id FROM gerentes g
        WHERE g.user_id = auth.uid() AND g.ativo = true
      )
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_commands;
ALTER TABLE public.sync_commands REPLICA IDENTITY FULL;