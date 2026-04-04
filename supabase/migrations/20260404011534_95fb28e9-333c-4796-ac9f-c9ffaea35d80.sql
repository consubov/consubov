
CREATE OR REPLACE FUNCTION public.calcular_consumo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_produto_id uuid;
  v_peso_saco numeric;
  v_consumo_por_100kg numeric;
  v_margem numeric;
  v_categoria text;
  v_peso_medio numeric;
  v_consumo_real_g numeric;
  v_consumo_esperado_g numeric;
  v_indice numeric;
  v_dias integer;
  v_num_animais_ponderado numeric;
BEGIN
  -- Resolve produto_id: pasto.produto_id -> retiro.produto_id
  SELECT COALESCE(p.produto_id, r.produto_id)
  INTO v_produto_id
  FROM pastos p
  JOIN retiros r ON r.id = p.retiro_id
  WHERE p.id = NEW.pasto_id;

  IF v_produto_id IS NULL THEN
    NEW.consumo_g_cab_dia := NULL;
    NEW.status_consumo := NULL;
    NEW.indice_consumo := NULL;
    RETURN NEW;
  END IF;

  -- Get product info
  SELECT peso_saco_kg INTO v_peso_saco FROM produtos WHERE id = v_produto_id;

  v_dias := COALESCE(NEW.dias_no_pasto, 1);
  IF v_dias <= 0 THEN v_dias := 1; END IF;

  v_peso_medio := COALESCE(NEW.peso_medio_kg, 0);
  v_categoria := COALESCE(NEW.categoria, '');

  -- Auto-classify category if empty
  IF v_categoria = '' THEN
    IF v_peso_medio < 250 THEN v_categoria := 'Recria 1';
    ELSIF v_peso_medio < 350 THEN v_categoria := 'Recria 2';
    ELSE v_categoria := 'Engorda';
    END IF;
  END IF;

  -- Get consumo_por_100kg and margem based on category
  SELECT
    CASE
      WHEN lower(v_categoria) LIKE '%recria 1%' OR lower(v_categoria) LIKE '%recria1%' THEN COALESCE(consumo_recria1, 0)
      WHEN lower(v_categoria) LIKE '%recria 2%' OR lower(v_categoria) LIKE '%recria2%' THEN COALESCE(consumo_recria2, 0)
      ELSE COALESCE(consumo_engorda, 0)
    END,
    CASE
      WHEN lower(v_categoria) LIKE '%recria 1%' OR lower(v_categoria) LIKE '%recria1%' THEN COALESCE(margem_recria1, 0)
      WHEN lower(v_categoria) LIKE '%recria 2%' OR lower(v_categoria) LIKE '%recria2%' THEN COALESCE(margem_recria2, 0)
      ELSE COALESCE(margem_engorda, 0)
    END
  INTO v_consumo_por_100kg, v_margem
  FROM produtos WHERE id = v_produto_id;

  -- Use num_animais from lancamento as the base value
  -- The weighted average is the responsibility of the reporting layer
  -- since the trigger fires per-lancamento and doesn't have period context
  v_num_animais_ponderado := NEW.num_animais;

  -- Calculate consumo real (g/cab/dia)
  IF v_num_animais_ponderado > 0 AND v_dias > 0 AND v_peso_saco IS NOT NULL AND NEW.num_sacos > 0 THEN
    v_consumo_real_g := (NEW.num_sacos * v_peso_saco * 1000.0) / (v_num_animais_ponderado * v_dias);
  ELSE
    NEW.consumo_g_cab_dia := NULL;
    NEW.status_consumo := NULL;
    NEW.indice_consumo := NULL;
    RETURN NEW;
  END IF;

  -- Store the calculated consumption value
  NEW.consumo_g_cab_dia := ROUND(v_consumo_real_g, 2);

  -- Calculate consumo esperado (g/cab/dia)
  v_consumo_esperado_g := (v_consumo_por_100kg * v_peso_medio) / 100.0 * 1000.0;

  IF v_consumo_esperado_g <= 0 OR v_peso_medio <= 0 THEN
    NEW.status_consumo := NULL;
    NEW.indice_consumo := NULL;
    RETURN NEW;
  END IF;

  -- Calculate index
  v_indice := ROUND((v_consumo_real_g / v_consumo_esperado_g)::numeric, 2);
  NEW.indice_consumo := v_indice;

  -- Classification using margin if available, otherwise index-based
  IF v_margem > 0 THEN
    DECLARE
      v_margem_g numeric := v_margem * 1000.0;
    BEGIN
      IF v_consumo_real_g < (v_consumo_esperado_g - v_margem_g) THEN
        NEW.status_consumo := 'Baixo';
      ELSIF v_consumo_real_g > (v_consumo_esperado_g + v_margem_g) THEN
        NEW.status_consumo := 'Alto';
      ELSE
        NEW.status_consumo := 'Ideal';
      END IF;
    END;
  ELSE
    IF v_indice < 0.8 THEN
      NEW.status_consumo := 'Baixo';
    ELSIF v_indice > 1.2 THEN
      NEW.status_consumo := 'Alto';
    ELSE
      NEW.status_consumo := 'Ideal';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
