-- Add consumo_g_cab_dia column to store the pre-calculated consumption value
ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS consumo_g_cab_dia numeric;

-- Update the trigger function to also store the actual g/cab/dia value
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

  -- Calculate consumo real (g/cab/dia)
  IF NEW.num_animais > 0 AND v_dias > 0 AND v_peso_saco IS NOT NULL AND NEW.num_sacos > 0 THEN
    v_consumo_real_g := (NEW.num_sacos * v_peso_saco * 1000.0) / (NEW.num_animais * v_dias);
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

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS trg_calcular_consumo ON lancamentos;
CREATE TRIGGER trg_calcular_consumo
  BEFORE INSERT OR UPDATE ON lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION calcular_consumo();

-- Backfill existing lancamentos with consumo_g_cab_dia
UPDATE lancamentos l
SET consumo_g_cab_dia = ROUND(
  (l.num_sacos * p.peso_saco_kg * 1000.0) / (l.num_animais * l.dias_no_pasto),
  2
)
FROM pastos pa
JOIN retiros r ON r.id = pa.retiro_id
JOIN produtos p ON p.id = COALESCE(pa.produto_id, r.produto_id)
WHERE l.pasto_id = pa.id
  AND l.num_animais > 0
  AND l.dias_no_pasto > 0
  AND l.num_sacos > 0;