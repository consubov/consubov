
CREATE POLICY "Capataz atualiza pastos do seu retiro"
ON public.pastos
FOR UPDATE
TO authenticated
USING (retiro_id IN (
  SELECT c.retiro_id FROM capatazes c
  WHERE c.user_id = auth.uid() AND c.ativo = true
))
WITH CHECK (retiro_id IN (
  SELECT c.retiro_id FROM capatazes c
  WHERE c.user_id = auth.uid() AND c.ativo = true
));
