\set ON_ERROR_STOP on
-- Run ONLY against a disposable local clone of qa_f12_l34_green_20261101.
-- All UUIDs below are synthetic; test writes are wrapped in ROLLBACK.
BEGIN;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000020a1', false);

-- Capataz A1 can insert his own observation, optionally without a pasture.
INSERT INTO public.observacoes
  (id,fazenda_id,retiro_id,pasto_id,tipo,descricao,resolvido)
VALUES
  ('00000000-0000-4000-8000-000000009001',
   '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000001a1',
   '00000000-0000-4000-8000-0000000002a1',
   'geral','F12-L34 valid capataz observation',false);

INSERT INTO public.observacoes
  (id,fazenda_id,retiro_id,pasto_id,tipo,resolvido)
VALUES
  ('00000000-0000-4000-8000-000000009002',
   '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000001a1',
   NULL,'geral',false);

-- A1 cannot mix his own retiro with another retiro C1, even in same farm A.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.observacoes
      (id,fazenda_id,retiro_id,pasto_id,tipo)
    VALUES (
      '00000000-0000-4000-8000-000000009003',
      '00000000-0000-4000-8000-0000000000a1',
      '00000000-0000-4000-8000-0000000001a1',
      '00000000-0000-4000-8000-0000000002c1','geral');
    RAISE EXCEPTION 'FAIL: capataz inserted pasture from another retiro';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
END $$;

-- Cross-tenant insert (farm B with capataz A1) fails closed.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.observacoes
      (id,fazenda_id,retiro_id,pasto_id,tipo)
    VALUES (
      '00000000-0000-4000-8000-000000009004',
      '00000000-0000-4000-8000-0000000000b2',
      '00000000-0000-4000-8000-0000000001b2',
      '00000000-0000-4000-8000-0000000002b2','geral');
    RAISE EXCEPTION 'FAIL: capataz A1 inserted B tenant row';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
END $$;

-- Replay of an observation already resolved must not reset resolvido.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000010a1', false);
UPDATE public.observacoes SET resolvido = true
WHERE id = '00000000-0000-4000-8000-000000009001';

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000020a1', false);
INSERT INTO public.observacoes
 (id,fazenda_id,retiro_id,pasto_id,resolvido)
VALUES
 ('00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-0000000000a1',
  '00000000-0000-4000-8000-0000000001a1',
  '00000000-0000-4000-8000-0000000002a1',false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF (SELECT resolvido FROM public.observacoes
      WHERE id='00000000-0000-4000-8000-000000009001') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: replay reopened a resolved observation';
  END IF;
END $$;

-- Manager A can update a record within farm A, but cannot mismatch parent retiro/pasto.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000010a1', false);
UPDATE public.observacoes SET descricao = 'manager update authorized'
WHERE id='00000000-0000-4000-8000-000000009001';

DO $$
BEGIN
  BEGIN
    UPDATE public.observacoes
       SET pasto_id='00000000-0000-4000-8000-0000000002c1'
     WHERE id='00000000-0000-4000-8000-000000009001';
    RAISE EXCEPTION 'FAIL: manager A changed pasture to different retiro';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE public.observacoes
       SET fazenda_id='00000000-0000-4000-8000-0000000000b2',
           retiro_id='00000000-0000-4000-8000-0000000001b2',
           pasto_id='00000000-0000-4000-8000-0000000002b2'
     WHERE id='00000000-0000-4000-8000-000000009001';
    RAISE EXCEPTION 'FAIL: manager A moved row to B';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
END $$;

-- An unauthorized actor must see zero rows of farm A.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000010b2', false);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.observacoes
       WHERE id='00000000-0000-4000-8000-000000009001') <> 0 THEN
    RAISE EXCEPTION 'FAIL: manager B saw observation of farm A';
  END IF;
END $$;

-- Admin is allowed to keep both optional parent IDs NULL.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000050a1', false);
INSERT INTO public.observacoes
  (id,fazenda_id,retiro_id,pasto_id,tipo)
VALUES
  ('00000000-0000-4000-8000-000000009005',
   '00000000-0000-4000-8000-0000000000a1',NULL,NULL,'geral');

-- Every write under test must preserve farm and parent match.
RESET ROLE;
DO $$
BEGIN
  IF EXISTS (
      SELECT 1 FROM public.observacoes o
      WHERE (o.retiro_id IS NOT NULL AND NOT EXISTS
               (SELECT 1 FROM public.retiros r
                 WHERE r.id=o.retiro_id AND r.fazenda_id=o.fazenda_id))
         OR (o.pasto_id IS NOT NULL AND NOT EXISTS
               (SELECT 1 FROM public.pastos p
                JOIN public.retiros pr ON pr.id=p.retiro_id
                WHERE p.id=o.pasto_id AND p.retiro_id=o.retiro_id
                  AND pr.fazenda_id=o.fazenda_id))
  ) THEN RAISE EXCEPTION 'FAIL: database has inconsistent references';
  END IF;
END $$;

SELECT 'QA_PR76_F12_L34_RLS_ROLE_MATRIX_PASS' AS result;
ROLLBACK;
