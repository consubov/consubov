CREATE TABLE public.sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  record_count_pending integer NOT NULL DEFAULT 0,
  last_attempt timestamptz,
  last_success timestamptz,
  storage_estimate_bytes bigint,
  storage_quota_bytes bigint,
  device_info jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_log_user_id ON public.sync_log(user_id);

ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admin acessa todos sync_log"
  ON public.sync_log FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Capataz: pode ler e atualizar o próprio log (upsert)
CREATE POLICY "Capataz le seu sync_log"
  ON public.sync_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Capataz insere seu sync_log"
  ON public.sync_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Capataz atualiza seu sync_log"
  ON public.sync_log FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Gerente: vê logs dos capatazes da sua fazenda
CREATE POLICY "Gerente le sync_log dos capatazes da fazenda"
  ON public.sync_log FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT c.user_id FROM capatazes c
      WHERE c.retiro_id IN (
        SELECT r.id FROM retiros r
        WHERE r.fazenda_id IN (
          SELECT g.fazenda_id FROM gerentes g
          WHERE g.user_id = auth.uid() AND g.ativo = true
        )
      )
      AND c.user_id IS NOT NULL
    )
  );

-- Realtime para o Admin ver atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_log;
ALTER TABLE public.sync_log REPLICA IDENTITY FULL;