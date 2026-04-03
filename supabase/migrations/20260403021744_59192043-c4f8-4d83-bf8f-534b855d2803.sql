
CREATE TABLE public.ciclos_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL,
  fazenda_id uuid NOT NULL,
  acao text NOT NULL,
  usuario_id uuid,
  usuario_email text,
  detalhes jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ciclos_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa ciclos_auditoria"
  ON public.ciclos_auditoria
  FOR ALL
  TO authenticated
  USING (
    fazenda_id IN (
      SELECT f.id FROM fazendas f
      WHERE f.administrador_id IN (
        SELECT a.id FROM administradores a WHERE a.user_id = auth.uid()
      )
    )
  );
