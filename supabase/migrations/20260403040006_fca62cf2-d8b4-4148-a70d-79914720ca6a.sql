DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lancamentos','ciclos','pastos','retiros','lancamentos_manuais','observacoes']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE %I', t);
    EXCEPTION WHEN OTHERS THEN
      -- table not in publication, ignore
    END;
  END LOOP;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE lancamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE ciclos;
ALTER PUBLICATION supabase_realtime ADD TABLE pastos;
ALTER PUBLICATION supabase_realtime ADD TABLE retiros;
ALTER PUBLICATION supabase_realtime ADD TABLE lancamentos_manuais;
ALTER PUBLICATION supabase_realtime ADD TABLE observacoes;