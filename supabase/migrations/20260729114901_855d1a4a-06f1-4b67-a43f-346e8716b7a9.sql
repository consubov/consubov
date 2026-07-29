ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS modulo text NOT NULL DEFAULT 'geral';

ALTER TABLE public.notificacoes
  DROP CONSTRAINT IF EXISTS notificacoes_modulo_check;

ALTER TABLE public.notificacoes
  ADD CONSTRAINT notificacoes_modulo_check
  CHECK (modulo IN ('consubov', 'relatto', 'mais_arrobas', 'geral'));

CREATE INDEX IF NOT EXISTS notificacoes_modulo_idx ON public.notificacoes (modulo);