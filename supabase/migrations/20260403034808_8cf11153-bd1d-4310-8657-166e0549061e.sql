-- Function to ensure ciclo for any month/year (not just current)
CREATE OR REPLACE FUNCTION public.ensure_ciclo(p_fazenda_id uuid, p_mes integer, p_ano integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ciclo_id uuid;
BEGIN
  SELECT id INTO v_ciclo_id
  FROM ciclos
  WHERE fazenda_id = p_fazenda_id AND mes = p_mes AND ano = p_ano;

  IF v_ciclo_id IS NOT NULL THEN
    RETURN v_ciclo_id;
  END IF;

  INSERT INTO ciclos (fazenda_id, mes, ano, num_dias, fechado)
  VALUES (p_fazenda_id, p_mes, p_ano, 30, false)
  RETURNING id INTO v_ciclo_id;

  RETURN v_ciclo_id;
END;
$$;