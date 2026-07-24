
-- Direction enum
DO $$ BEGIN
  CREATE TYPE public.sms_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.sms_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email    text NOT NULL,
  phone           text,
  appointment_id  uuid,
  direction       public.sms_direction NOT NULL,
  body            text NOT NULL,
  ghl_message_id  text,
  ghl_contact_id  text,
  created_by      uuid,            -- staff user_id when outbound from staff; client user_id when outbound from client
  sender_role     text NOT NULL,   -- 'client' | 'staff' | 'system'
  read_by_staff_at  timestamptz,
  read_by_client_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_client_email ON public.sms_messages (lower(client_email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_appointment ON public.sms_messages (appointment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at  ON public.sms_messages (created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.sms_messages TO authenticated;
GRANT ALL ON public.sms_messages TO service_role;

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

-- Service role full access (inbound webhook)
CREATE POLICY "Service role manages sms_messages"
  ON public.sms_messages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Clients read their own thread
CREATE POLICY "Clients view own sms messages"
  ON public.sms_messages
  FOR SELECT
  TO authenticated
  USING (current_client_email() IS NOT NULL AND lower(client_email) = current_client_email());

-- Clients send outbound (sender_role must be 'client')
CREATE POLICY "Clients insert own outbound sms"
  ON public.sms_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    current_client_email() IS NOT NULL
    AND lower(client_email) = current_client_email()
    AND direction = 'outbound'
    AND sender_role = 'client'
  );

-- Clients mark their inbound messages as read
CREATE POLICY "Clients mark own messages read"
  ON public.sms_messages
  FOR UPDATE
  TO authenticated
  USING (current_client_email() IS NOT NULL AND lower(client_email) = current_client_email())
  WITH CHECK (current_client_email() IS NOT NULL AND lower(client_email) = current_client_email());

-- Staff/admin/scheduler full read
CREATE POLICY "Staff view all sms messages"
  ON public.sms_messages
  FOR SELECT
  TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));

-- Staff insert outbound staff messages
CREATE POLICY "Staff insert outbound sms"
  ON public.sms_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()))
    AND direction = 'outbound'
    AND sender_role = 'staff'
  );

-- Staff mark inbound messages as read
CREATE POLICY "Staff mark messages read"
  ON public.sms_messages
  FOR UPDATE
  TO authenticated
  USING (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()))
  WITH CHECK (is_staff_or_admin(auth.uid()) OR is_scheduler_or_admin(auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;
ALTER TABLE public.sms_messages REPLICA IDENTITY FULL;
