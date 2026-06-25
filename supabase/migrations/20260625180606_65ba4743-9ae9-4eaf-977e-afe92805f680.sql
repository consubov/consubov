CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint text,
  p_subscription jsonb,
  p_enabled boolean DEFAULT NULL
) RETURNS public.push_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_existing_user_id uuid;
  v_row public.push_subscriptions;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_endpoint IS NULL OR trim(p_endpoint) = '' THEN
    RAISE EXCEPTION 'Endpoint de notificação ausente';
  END IF;

  SELECT user_id
    INTO v_existing_user_id
  FROM public.push_subscriptions
  WHERE endpoint = p_endpoint;

  IF v_existing_user_id IS NULL THEN
    INSERT INTO public.push_subscriptions (user_id, endpoint, subscription, enabled)
    VALUES (v_user_id, p_endpoint, p_subscription, COALESCE(p_enabled, true))
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.push_subscriptions
       SET user_id = v_user_id,
           subscription = p_subscription,
           enabled = COALESCE(
             p_enabled,
             CASE
               WHEN v_existing_user_id = v_user_id THEN enabled
               ELSE true
             END
           ),
           updated_at = now()
     WHERE endpoint = p_endpoint
     RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_subscription(text, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, jsonb, boolean) TO service_role;