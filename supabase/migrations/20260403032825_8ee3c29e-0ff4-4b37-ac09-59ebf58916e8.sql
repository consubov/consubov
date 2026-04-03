
-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trg_calcular_consumo ON lancamentos;

-- Replace the calcular_consumo function with margin-aware logic
CREATE OR REPLACE FUNCTION public.calcular_consumo()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_peso_saco NUMERIC;
  v_consumo_por_100kg NUMERIC;
  v_margem NUMERIC;
  v_categoria TEXT;
  v_peso_medio NUMERIC;
  v_consumo_esperado_kg NUMERIC;
  v_consumo_real_g NUMERIC;
  v_consumo_esperado_g NUMERIC;
  v_limite_inferior_g NUMERIC;
  v_limite_superior_g NUMERIC;
  v_dias INTEGER;
BEGIN
  -- Get peso_saco from product
  SELECT peso_saco_kg INTO v_peso_saco
  FROM produtos WHERE id = NEW.produto_id;

  -- Use dias_no_pasto if set, otherwise dias_intervalo, fallback to ciclo num_dias
  v_dias := COALESCE(NEW.dias_no_pasto, NEW.dias_intervalo);
  IF v_dias IS NULL OR v_dias <= 0 THEN
    SELECT num_dias INTO v_dias FROM ciclos WHERE id = NEW.ciclo_id;
  END IF;

  v_peso_medio := COALESCE(NEW.peso_medio_kg, 0);
  v_categoria := COALESCE(NEW.categoria, '');

  -- Get consumo_por_100kg and margem based on category
  IF NEW.produto_id IS NOT NULL THEN
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
    FROM produtos WHERE id = NEW.produto_id;
  ELSE
    v_consumo_por_100kg := 0;
    v_margem := 0;
  END IF;

  -- Calculate consumo real (g/cab/dia)
  IF NEW.num_animais > 0 AND v_dias > 0 AND v_peso_saco IS NOT NULL THEN
    v_consumo_real_g := (NEW.num_sacos * v_peso_saco * 1000.0) / (NEW.num_animais * v_dias);
    NEW.consumo_g_cab_dia := v_consumo_real_g;
    NEW.consumo_real_kg := NEW.num_sacos * v_peso_saco;
  ELSE
    v_consumo_real_g := 0;
    NEW.consumo_g_cab_dia := NULL;
    NEW.consumo_real_kg := NULL;
  END IF;

  -- Calculate consumo esperado
  -- Formula: (consumo_por_100kg * peso_medio) / 100 = kg/cab/dia
  v_consumo_esperado_kg := (v_consumo_por_100kg * v_peso_medio) / 100;
  v_consumo_esperado_g := v_consumo_esperado_kg * 1000;
  NEW.consumo_esperado_kg := v_consumo_esperado_kg;

  -- Classification with margin (margem is in kg/cab/dia, convert to g)
  v_limite_inferior_g := v_consumo_esperado_g - (v_margem * 1000);
  v_limite_superior_g := v_consumo_esperado_g + (v_margem * 1000);

  IF v_consumo_esperado_g > 0 AND v_consumo_real_g > 0 THEN
    NEW.indice_consumo := ROUND((NEW.consumo_real_kg / (v_consumo_esperado_kg * NEW.num_animais * v_dias))::numeric, 2);
    IF v_margem > 0 THEN
      IF v_consumo_real_g < v_limite_inferior_g THEN
        NEW.status_consumo := 'ABAIXO';
      ELSIF v_consumo_real_g > v_limite_superior_g THEN
        NEW.status_consumo := 'ACIMA';
      ELSE
        NEW.status_consumo := 'IDEAL';
      END IF;
    ELSE
      -- Fallback to index-based
      IF NEW.indice_consumo < 0.9 THEN
        NEW.status_consumo := 'ABAIXO';
      ELSIF NEW.indice_consumo > 1.1 THEN
        NEW.status_consumo := 'ACIMA';
      ELSE
        NEW.status_consumo := 'IDEAL';
      END IF;
    END IF;
  ELSE
    NEW.indice_consumo := NULL;
    NEW.status_consumo := 'ERRO';
  END IF;

  -- Calculate cost
  IF v_peso_saco IS NOT NULL AND NEW.produto_id IS NOT NULL THEN
    SELECT (NEW.num_sacos * v_peso_saco * COALESCE(preco_por_kg, 0)) INTO NEW.custo_total
    FROM produtos WHERE id = NEW.produto_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger
CREATE TRIGGER trg_calcular_consumo
BEFORE INSERT OR UPDATE ON lancamentos
FOR EACH ROW
EXECUTE FUNCTION calcular_consumo();
