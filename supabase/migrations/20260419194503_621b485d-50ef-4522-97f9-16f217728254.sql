-- Ensure sync_commands is in the realtime publication so capataz PWAs receive INSERT events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sync_commands'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_commands';
  END IF;
END $$;

-- Ensure REPLICA IDENTITY FULL so payload.new is complete
ALTER TABLE public.sync_commands REPLICA IDENTITY FULL;

-- Make sure capataz can SELECT their own sync_commands (for polling fallback)
DROP POLICY IF EXISTS "Capataz le seus sync_commands" ON public.sync_commands;
CREATE POLICY "Capataz le seus sync_commands"
ON public.sync_commands
FOR SELECT
TO authenticated
USING (target_user_id = auth.uid());

-- Make sure capataz can UPDATE acknowledged_at on their own commands
DROP POLICY IF EXISTS "Capataz reconhece seus sync_commands" ON public.sync_commands;
CREATE POLICY "Capataz reconhece seus sync_commands"
ON public.sync_commands
FOR UPDATE
TO authenticated
USING (target_user_id = auth.uid())
WITH CHECK (target_user_id = auth.uid());