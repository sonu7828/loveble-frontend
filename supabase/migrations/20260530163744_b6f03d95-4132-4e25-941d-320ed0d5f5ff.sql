
CREATE TABLE public.phi_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_name text,
  actor_email text,
  resource_type text NOT NULL, -- 'chart_note' | 'gfe' | 'consent' | 'clinical_photo' | 'client_id' | 'client_profile' | 'appointment'
  resource_id uuid,
  client_email text,
  action text NOT NULL DEFAULT 'view', -- 'view' | 'download' | 'print' | 'export'
  route text,
  ip inet,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_phi_access_log_actor ON public.phi_access_log(actor_user_id, created_at DESC);
CREATE INDEX idx_phi_access_log_client ON public.phi_access_log(client_email, created_at DESC);
CREATE INDEX idx_phi_access_log_resource ON public.phi_access_log(resource_type, resource_id);
CREATE INDEX idx_phi_access_log_created ON public.phi_access_log(created_at DESC);

GRANT SELECT, INSERT ON public.phi_access_log TO authenticated;
GRANT ALL ON public.phi_access_log TO service_role;

ALTER TABLE public.phi_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read PHI access log"
ON public.phi_access_log
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Clinical staff can insert their own access events"
ON public.phi_access_log
FOR INSERT
TO authenticated
WITH CHECK (
  actor_user_id = auth.uid()
  AND public.is_clinical_staff(auth.uid())
);

-- Helper: app calls this from a single place. Always logs the caller.
CREATE OR REPLACE FUNCTION public.log_phi_access(
  _resource_type text,
  _resource_id uuid,
  _client_email text,
  _action text DEFAULT 'view',
  _route text DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_clinical_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT full_name INTO v_name FROM public.staff_profiles
    WHERE user_id = auth.uid() LIMIT 1;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.phi_access_log(
    actor_user_id, actor_name, actor_email,
    resource_type, resource_id, client_email,
    action, route, metadata
  ) VALUES (
    auth.uid(), v_name, v_email,
    _resource_type, _resource_id, lower(coalesce(_client_email, '')),
    coalesce(_action, 'view'), _route, _metadata
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_phi_access(text, uuid, text, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.log_phi_access(text, uuid, text, text, text, jsonb) TO authenticated;
