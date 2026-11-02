-- F12-L34: protect observation parent references for authenticated writes.
-- Safe to test on isolated local PostgreSQL; do NOT execute on remote databases
-- without separate deployment authorization and a production preflight.
BEGIN;

-- Fail closed if legacy observations already violate the declared farm/retiro/pasto
-- hierarchy. Application owners must repair such rows in a separately reviewed
-- migration before enabling the stricter write gate.
DO $qa_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.observacoes AS o
    WHERE
      (
        o.retiro_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.retiros AS r
          WHERE r.id = o.retiro_id
            AND r.fazenda_id = o.fazenda_id
        )
      )
      OR
      (
        o.pasto_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.pastos AS p
          JOIN public.retiros AS pr ON pr.id = p.retiro_id
          WHERE p.id = o.pasto_id
            AND p.fazenda_id = o.fazenda_id
            AND pr.fazenda_id = o.fazenda_id
            AND o.retiro_id IS NOT NULL
            AND p.retiro_id = o.retiro_id
        )
      )
  ) THEN
    RAISE EXCEPTION
      'F12-L34: inconsistent observacoes parent references; migration aborted'
      USING ERRCODE = 'check_violation';
  END IF;
END
$qa_preflight$;

ALTER TABLE public.observacoes ENABLE ROW LEVEL SECURITY;

-- The restrictive write policies inspect parent tables under invoker RLS.
-- The legacy manager pasture SELECT rule also queries retiros; ensure that
-- an active manager can see only the parents inside their assigned farm.
-- This adds SELECT only; it does not grant DML on parent tables.
DROP POLICY IF EXISTS observacoes_parent_gerente_retiros_read ON public.retiros;
CREATE POLICY observacoes_parent_gerente_retiros_read
ON public.retiros
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gerentes g
    WHERE g.user_id = auth.uid()
      AND g.ativo = true
      AND g.fazenda_id = retiros.fazenda_id
  )
);

DROP POLICY IF EXISTS observacoes_parent_gerente_pastos_read ON public.pastos;
CREATE POLICY observacoes_parent_gerente_pastos_read
ON public.pastos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gerentes g
    WHERE g.user_id = auth.uid()
      AND g.ativo = true
      AND g.fazenda_id = pastos.fazenda_id
  )
  AND EXISTS (
    SELECT 1 FROM public.retiros r
    WHERE r.id = pastos.retiro_id
      AND r.fazenda_id = pastos.fazenda_id
  )
);

DROP POLICY IF EXISTS observacoes_parent_integrity_insert ON public.observacoes;
CREATE POLICY observacoes_parent_integrity_insert
ON public.observacoes
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  (
    retiro_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.retiros AS r
      WHERE r.id = observacoes.retiro_id
        AND r.fazenda_id = observacoes.fazenda_id
    )
  )
  AND
  (
    pasto_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.pastos AS p
      JOIN public.retiros AS pr ON pr.id = p.retiro_id
      WHERE p.id = observacoes.pasto_id
        AND p.fazenda_id = observacoes.fazenda_id
        AND pr.fazenda_id = observacoes.fazenda_id
        AND observacoes.retiro_id IS NOT NULL
        AND p.retiro_id = observacoes.retiro_id
    )
  )
);

DROP POLICY IF EXISTS observacoes_parent_integrity_update ON public.observacoes;
CREATE POLICY observacoes_parent_integrity_update
ON public.observacoes
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  (
    retiro_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.retiros AS r
      WHERE r.id = observacoes.retiro_id
        AND r.fazenda_id = observacoes.fazenda_id
    )
  )
  AND
  (
    pasto_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.pastos AS p
      JOIN public.retiros AS pr ON pr.id = p.retiro_id
      WHERE p.id = observacoes.pasto_id
        AND p.fazenda_id = observacoes.fazenda_id
        AND pr.fazenda_id = observacoes.fazenda_id
        AND observacoes.retiro_id IS NOT NULL
        AND p.retiro_id = observacoes.retiro_id
    )
  )
);

COMMIT;
