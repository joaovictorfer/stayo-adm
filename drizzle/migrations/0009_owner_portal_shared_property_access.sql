CREATE POLICY "coproprietario le implantacoes vinculadas"
ON public.implementation_projects
FOR SELECT TO authenticated
USING (public.owner_can_access_implementation(id));

CREATE POLICY "proprietario le etapas publicas"
ON public.implementation_items
FOR SELECT TO authenticated
USING (owner_visible AND public.owner_can_access_implementation(implementation_id));

CREATE POLICY "proprietario le propostas dos proprios imoveis"
ON public.proposals
FOR SELECT TO authenticated
USING (public.owner_can_access_implementation(implementation_id));