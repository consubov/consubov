
ALTER TABLE public.retiros
  ADD COLUMN IF NOT EXISTS peso_saco_kg numeric DEFAULT 25,
  ADD COLUMN IF NOT EXISTS produto_id uuid REFERENCES public.produtos(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consumo_recria1 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consumo_recria2 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consumo_engorda numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS margem_recria1 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS margem_recria2 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS margem_engorda numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estoque_sacos integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gmd_recria1 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gmd_recria2 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gmd_engorda numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS peso_abate_kg numeric DEFAULT 500,
  ADD COLUMN IF NOT EXISTS sexo_padrao text DEFAULT 'Macho',
  ADD COLUMN IF NOT EXISTS preco_por_kg numeric DEFAULT NULL;
