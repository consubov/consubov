
-- Add audit photo config to fazendas
ALTER TABLE public.fazendas
  ADD COLUMN IF NOT EXISTS auditoria_fotos_por_bloco integer NOT NULL DEFAULT 3
  CONSTRAINT chk_auditoria_fotos CHECK (auditoria_fotos_por_bloco >= 0 AND auditoria_fotos_por_bloco <= 10);

-- Create audit_sorteios table
CREATE TABLE public.audit_sorteios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  retiro_id uuid NOT NULL REFERENCES public.retiros(id) ON DELETE CASCADE,
  fazenda_id uuid NOT NULL REFERENCES public.fazendas(id) ON DELETE CASCADE,
  bloco integer NOT NULL,
  posicoes_com_foto jsonb NOT NULL DEFAULT '[]'::jsonb,
  gerado_em timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (retiro_id, bloco)
);

ALTER TABLE public.audit_sorteios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa todos audit_sorteios"
  ON public.audit_sorteios FOR ALL TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Capataz le audit_sorteios do retiro"
  ON public.audit_sorteios FOR SELECT TO authenticated
  USING (retiro_id IN (
    SELECT c.retiro_id FROM capatazes c
    WHERE c.user_id = auth.uid() AND c.ativo = true
  ));

CREATE POLICY "Capataz insere audit_sorteios do retiro"
  ON public.audit_sorteios FOR INSERT TO authenticated
  WITH CHECK (retiro_id IN (
    SELECT c.retiro_id FROM capatazes c
    WHERE c.user_id = auth.uid() AND c.ativo = true
  ));

CREATE POLICY "Gerente le audit_sorteios da fazenda"
  ON public.audit_sorteios FOR SELECT TO authenticated
  USING (fazenda_id IN (
    SELECT g.fazenda_id FROM gerentes g
    WHERE g.user_id = auth.uid() AND g.ativo = true
  ));

CREATE POLICY "Escritorio le audit_sorteios da fazenda"
  ON public.audit_sorteios FOR SELECT TO authenticated
  USING (fazenda_id = get_escritorio_fazenda_id(auth.uid()));

CREATE INDEX idx_audit_sorteios_retiro_bloco ON public.audit_sorteios(retiro_id, bloco);
