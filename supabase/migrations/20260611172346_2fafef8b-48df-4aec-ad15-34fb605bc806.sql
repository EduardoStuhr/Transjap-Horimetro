
-- Fix search_path on functions (security hardening)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- has_role and handle_new_user already have SET search_path = public.
-- The linter warns about EXECUTE on SECURITY DEFINER functions; restrict them.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- handle_new_user is only called by the auth.users trigger; service_role/postgres only

-- Storage policies for horimeter-photos bucket
-- Path convention: <user_id>/<shift_id>/<reading_id>.jpg
CREATE POLICY "Operators upload own photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'horimeter-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Operators read own photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'horimeter-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Admins delete photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'horimeter-photos'
    AND public.has_role(auth.uid(), 'admin')
  );
