
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pecuaristas TO authenticated;
GRANT ALL ON public.pecuaristas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fazendas_pecuarista TO authenticated;
GRANT ALL ON public.fazendas_pecuarista TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lotes_pecuarista TO authenticated;
GRANT ALL ON public.lotes_pecuarista TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_pecuarista TO authenticated;
GRANT ALL ON public.categorias_pecuarista TO service_role;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lotes_pecuarista_pecuarista_codigo_key') THEN
    ALTER TABLE public.lotes_pecuarista ADD CONSTRAINT lotes_pecuarista_pecuarista_codigo_key UNIQUE (pecuarista_id, codigo);
  END IF;
END $$;
