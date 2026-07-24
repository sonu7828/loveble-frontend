INSERT INTO storage.buckets (id, name, public) VALUES ('calendar-invites','calendar-invites',true) ON CONFLICT (id) DO UPDATE SET public=true;
DO $$ BEGIN
  CREATE POLICY "Public read calendar invites" ON storage.objects FOR SELECT USING (bucket_id='calendar-invites');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;