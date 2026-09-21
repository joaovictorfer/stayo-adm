CREATE POLICY "time interno lê capas de implantação"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'implementation-covers'
  AND public.has_admin_role('super_admin', 'admin', 'commercial', 'operations', 'finance', 'viewer')
);

CREATE POLICY "comercial/operations gerenciam capas de implantação"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'implementation-covers'
  AND public.has_admin_role('super_admin', 'admin', 'commercial', 'operations')
)
WITH CHECK (
  bucket_id = 'implementation-covers'
  AND public.has_admin_role('super_admin', 'admin', 'commercial', 'operations')
);