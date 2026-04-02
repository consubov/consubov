
ALTER TABLE public.fazendas
  ADD COLUMN IF NOT EXISTS intervalo_padrao_dias integer NOT NULL DEFAULT 3;

ALTER TABLE public.retiros
  ADD COLUMN IF NOT EXISTS alerta_atraso_enviado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultima_salga_em timestamp with time zone;
