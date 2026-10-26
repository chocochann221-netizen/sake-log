-- Minimal isolated fixture. These owner policy expressions were read from
-- the live project's pg_policies on 2026-10-26; no production rows are included.
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO authenticated;
CREATE TABLE public.drinking_records (
 id uuid PRIMARY KEY, user_id uuid NOT NULL, brand_name text NOT NULL
);
CREATE TABLE public.sake_photos (
 id uuid PRIMARY KEY, user_id uuid NOT NULL,
 drinking_record_id uuid REFERENCES public.drinking_records(id) ON DELETE CASCADE,
 storage_path text NOT NULL, photo_type text NOT NULL DEFAULT 'front'
);
ALTER TABLE public.drinking_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sake_photos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drinking_records, public.sake_photos TO authenticated;
CREATE POLICY "drinking_records_delete_own" ON public.drinking_records FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "drinking_records_insert_own" ON public.drinking_records FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "drinking_records_select_own" ON public.drinking_records FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "drinking_records_update_own" ON public.drinking_records FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "sake_photos_delete_own" ON public.sake_photos FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "sake_photos_insert_own" ON public.sake_photos FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "sake_photos_select_own" ON public.sake_photos FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "sake_photos_update_own" ON public.sake_photos FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
