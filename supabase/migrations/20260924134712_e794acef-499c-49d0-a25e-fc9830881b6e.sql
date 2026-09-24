ALTER TABLE public.pesagens_lote_pecuarista ADD COLUMN IF NOT EXISTS hora_fim timestamptz;
ALTER TABLE public.apartacoes_pecuarista ADD COLUMN IF NOT EXISTS hora_fim timestamptz;
UPDATE public.pesagens_lote_pecuarista SET hora_fim = data_pesagem WHERE hora_fim IS NULL AND quantidade_animais > 0;
UPDATE public.apartacoes_pecuarista SET hora_fim = data_apartacao WHERE hora_fim IS NULL;