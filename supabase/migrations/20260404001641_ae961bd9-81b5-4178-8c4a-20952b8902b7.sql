-- Allow gerentes to read lancamentos from their fazenda
CREATE POLICY "Gerente acessa lancamentos da sua fazenda"
  ON public.lancamentos
  FOR SELECT
  TO authenticated
  USING (
    fazenda_id IN (
      SELECT g.fazenda_id
      FROM gerentes g
      WHERE g.user_id = auth.uid() AND g.ativo = true
    )
  );