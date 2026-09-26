create or replace function public.admin_delete_implementation(_id uuid, _confirm_code text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.has_admin_role('super_admin','admin') then
    raise exception 'Sem permissão para excluir implantações.';
  end if;
  select id, code, status, core_property_id, core_owner_id into r
    from implementation_projects where id = _id for update;
  if not found then raise exception 'Implantação não encontrada.'; end if;
  if r.code is distinct from _confirm_code then
    raise exception 'Código de confirmação não confere.';
  end if;
  if r.status = 'ativo' or r.core_property_id is not null or r.core_owner_id is not null then
    raise exception 'Implantação ativa ou vinculada ao Core não pode ser excluída.';
  end if;
  delete from implementation_projects where id = _id;
end $$;
revoke all on function public.admin_delete_implementation(uuid, text) from public, anon;
grant execute on function public.admin_delete_implementation(uuid, text) to authenticated;