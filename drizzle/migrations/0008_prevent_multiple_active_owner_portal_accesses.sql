CREATE UNIQUE INDEX IF NOT EXISTS owner_portal_invitations_one_active_per_implementation
ON public.owner_portal_invitations (implementation_id)
WHERE revoked_at IS NULL AND used_at IS NULL;