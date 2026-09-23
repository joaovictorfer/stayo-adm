CREATE POLICY "time interno le capas de implantacao"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'implementation-covers'
  AND public.has_admin_role('super_admin','admin','commercial','operations','finance','viewer')
);

CREATE POLICY "time interno envia capas de implantacao"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'implementation-covers'
  AND public.has_admin_role('super_admin','admin','commercial','operations')
);

CREATE POLICY "time interno atualiza capas de implantacao"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'implementation-covers'
  AND public.has_admin_role('super_admin','admin','commercial','operations')
)
WITH CHECK (
  bucket_id = 'implementation-covers'
  AND public.has_admin_role('super_admin','admin','commercial','operations')
);

CREATE POLICY "time interno remove capas de implantacao"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'implementation-covers'
  AND public.has_admin_role('super_admin','admin','commercial','operations')
);