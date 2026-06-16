
-- =====================================================================
-- Funcionalidade: Conferência via QR Code
-- =====================================================================

-- 1) Tabela de auditoria automática (cada leitura de QR)
CREATE TABLE public.audit_conferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id uuid REFERENCES public.fazendas(id) ON DELETE SET NULL,
  retiro_id uuid REFERENCES public.retiros(id) ON DELETE SET NULL,
  pasto_id uuid REFERENCES public.pastos(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  perfil text,
  qr_code text NOT NULL,
  latitude numeric,
  longitude numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_conferencias TO authenticated;
GRANT ALL ON public.audit_conferencias TO service_role;

ALTER TABLE public.audit_conferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem todas as auditorias de conferência"
  ON public.audit_conferencias FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Gerentes veem auditorias da própria fazenda"
  ON public.audit_conferencias FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gerentes g
      WHERE g.user_id = auth.uid()
        AND g.ativo = true
        AND g.fazenda_id = audit_conferencias.fazenda_id
    )
  );

CREATE POLICY "Admins e gerentes podem inserir auditorias"
  ON public.audit_conferencias FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.gerentes g
        WHERE g.user_id = auth.uid() AND g.ativo = true
      )
    )
  );

-- 2) Tabela de checklist de conferência (opcional, preenchido pelo usuário)
CREATE TABLE public.conferencias_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id uuid REFERENCES public.fazendas(id) ON DELETE SET NULL,
  retiro_id uuid REFERENCES public.retiros(id) ON DELETE SET NULL,
  pasto_id uuid REFERENCES public.pastos(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  perfil text,
  cocho_abastecido boolean NOT NULL DEFAULT false,
  cocho_parcial boolean NOT NULL DEFAULT false,
  cocho_vazio boolean NOT NULL DEFAULT false,
  cocho_danificado boolean NOT NULL DEFAULT false,
  placa_qr_presente boolean NOT NULL DEFAULT false,
  placa_qr_danificada boolean NOT NULL DEFAULT false,
  qtd_compativel boolean NOT NULL DEFAULT false,
  qtd_divergente boolean NOT NULL DEFAULT false,
  necessita_atencao boolean NOT NULL DEFAULT false,
  observacoes text,
  fotos text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.conferencias_checklist TO authenticated;
GRANT ALL ON public.conferencias_checklist TO service_role;

ALTER TABLE public.conferencias_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem todos os checklists de conferência"
  ON public.conferencias_checklist FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Gerentes veem checklists da própria fazenda"
  ON public.conferencias_checklist FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gerentes g
      WHERE g.user_id = auth.uid()
        AND g.ativo = true
        AND g.fazenda_id = conferencias_checklist.fazenda_id
    )
  );

CREATE POLICY "Admins e gerentes podem inserir checklists"
  ON public.conferencias_checklist FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.gerentes g
        WHERE g.user_id = auth.uid() AND g.ativo = true
      )
    )
  );

CREATE INDEX idx_audit_conf_pasto ON public.audit_conferencias(pasto_id, created_at DESC);
CREATE INDEX idx_conf_checklist_pasto ON public.conferencias_checklist(pasto_id, created_at DESC);
