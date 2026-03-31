
-- Function to ensure a ciclo exists for the current month for a given fazenda
-- Uses SECURITY DEFINER so capataz can trigger it without INSERT permission
CREATE OR REPLACE FUNCTION public.ensure_ciclo_atual(p_fazenda_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ciclo_id uuid;
  v_mes integer := EXTRACT(MONTH FROM now())::integer;
  v_ano integer := EXTRACT(YEAR FROM now())::integer;
BEGIN
  -- Check if ciclo already exists
  SELECT id INTO v_ciclo_id
  FROM ciclos
  WHERE fazenda_id = p_fazenda_id AND mes = v_mes AND ano = v_ano;

  IF v_ciclo_id IS NOT NULL THEN
    RETURN v_ciclo_id;
  END IF;

  -- Create new ciclo
  INSERT INTO ciclos (fazenda_id, mes, ano, num_dias, fechado)
  VALUES (p_fazenda_id, v_mes, v_ano, 30, false)
  RETURNING id INTO v_ciclo_id;

  RETURN v_ciclo_id;
END;
$$;
