-- Add checks alongside the existing owner RLS policies. Do not broaden grants,
-- rewrite rows, or change the nullable drinking_record_id contract.
-- Apply only after inspecting the target's current policies and existing data.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';

CREATE POLICY sake_photos_insert_reference_ownership
ON public.sake_photos AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND split_part(storage_path, '/', 1) = (SELECT auth.uid())::text
  AND position('/' IN storage_path) > 0
  AND right(storage_path, 1) <> '/'
  AND position('//' IN storage_path) = 0
  AND position(chr(92) IN storage_path) = 0
  AND position('%' IN storage_path) = 0
  AND position('?' IN storage_path) = 0
  AND position('#' IN storage_path) = 0
  AND storage_path !~ '[[:cntrl:]]'
  AND storage_path !~ '(^|/)\.\.?(/|$)'
  AND (
    drinking_record_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.drinking_records AS record
      WHERE record.id = sake_photos.drinking_record_id
        AND record.user_id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY sake_photos_update_reference_ownership
ON public.sake_photos AS RESTRICTIVE FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND split_part(storage_path, '/', 1) = (SELECT auth.uid())::text
  AND position('/' IN storage_path) > 0
  AND right(storage_path, 1) <> '/'
  AND position('//' IN storage_path) = 0
  AND position(chr(92) IN storage_path) = 0
  AND position('%' IN storage_path) = 0
  AND position('?' IN storage_path) = 0
  AND position('#' IN storage_path) = 0
  AND storage_path !~ '[[:cntrl:]]'
  AND storage_path !~ '(^|/)\.\.?(/|$)'
  AND (
    drinking_record_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.drinking_records AS record
      WHERE record.id = sake_photos.drinking_record_id
        AND record.user_id = (SELECT auth.uid())
    )
  )
);

COMMIT;
