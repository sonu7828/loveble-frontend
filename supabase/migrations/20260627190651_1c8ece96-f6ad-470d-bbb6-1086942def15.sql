CREATE OR REPLACE FUNCTION public.force_create_appointment(
  p_service_id uuid,
  p_staff_id uuid,
  p_location_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_client_first_name text,
  p_client_last_name text,
  p_client_email text,
  p_client_phone text,
  p_client_dob date DEFAULT NULL,
  p_client_notes text DEFAULT NULL,
  p_stripe_customer_id text DEFAULT NULL,
  p_stripe_payment_method_id text DEFAULT NULL,
  p_stripe_setup_intent_id text DEFAULT NULL
)
RETURNS TABLE(id uuid, public_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment_id uuid;
  v_public_token text;
BEGIN
  IF NOT public.is_scheduler_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to override appointment overlap';
  END IF;

  PERFORM set_config('app.allow_appt_overlap', 'on', true);

  INSERT INTO public.appointments (
    service_id,
    staff_id,
    location_id,
    start_at,
    end_at,
    client_first_name,
    client_last_name,
    client_email,
    client_phone,
    client_dob,
    client_notes,
    stripe_customer_id,
    stripe_payment_method_id,
    stripe_setup_intent_id,
    status,
    approved_at,
    approved_by
  ) VALUES (
    p_service_id,
    p_staff_id,
    p_location_id,
    p_start_at,
    p_end_at,
    btrim(p_client_first_name),
    btrim(p_client_last_name),
    lower(btrim(p_client_email)),
    btrim(p_client_phone),
    p_client_dob,
    NULLIF(btrim(COALESCE(p_client_notes, '')), ''),
    p_stripe_customer_id,
    p_stripe_payment_method_id,
    p_stripe_setup_intent_id,
    'approved',
    now(),
    auth.uid()
  )
  RETURNING appointments.id, appointments.public_token INTO v_appointment_id, v_public_token;

  RETURN QUERY SELECT v_appointment_id, v_public_token;
END;
$$;

REVOKE ALL ON FUNCTION public.force_create_appointment(uuid, uuid, uuid, timestamptz, timestamptz, text, text, text, text, date, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.force_create_appointment(uuid, uuid, uuid, timestamptz, timestamptz, text, text, text, text, date, text, text, text, text) TO authenticated;