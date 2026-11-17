-- Operação: matriz de permissões por perfil (executa em transação e desfaz tudo).
begin;
create temp table r(role text, tbl text, can_read bool, can_write bool) on commit drop;
grant all on r to authenticated;
do $$
declare ro text; uid uuid := (select id from admin_profiles where active limit 1); t text; ok bool; n int;
begin
  foreach ro in array array['super_admin','admin','operations','finance','commercial','viewer'] loop
    update admin_profiles set role = ro::admin_role where id = uid;
    perform set_config('request.jwt.claims', json_build_object('sub',uid,'role','authenticated')::text, true);
    set local role authenticated;
    foreach t in array array['op_tasks','op_task_team','op_task_checklist','op_staff','op_staff_links','op_expenses','op_routine_rules','op_checklist_templates'] loop
      begin execute format('select count(*) from %I', t) into n; ok := true; exception when others then ok := false; end;
      insert into r values (ro, t, ok, null);
    end loop;
    begin
      insert into op_tasks(title, kind, due_date) values ('matriz', 'limpeza', current_date);
      update r set can_write = true where role = ro and tbl = 'op_tasks';
    exception when others then update r set can_write = false where role = ro and tbl = 'op_tasks'; end;
    begin
      insert into op_expenses(expense_date, category, description, amount) values (current_date, 'material', 'matriz', 1);
      update r set can_write = true where role = ro and tbl = 'op_expenses';
    exception when others then update r set can_write = false where role = ro and tbl = 'op_expenses'; end;
    reset role;
  end loop;
end $$;
select role, tbl, can_write from r where can_write is not null order by role, tbl;
-- links do Meu Dia: só super_admin/admin/operations veem registros (RLS filtra os demais)
select 'anon ctx exec', has_function_privilege('anon','public.op_staff_link_ctx(text)','execute'),
       has_function_privilege('authenticated','public.op_staff_link_ctx(text)','execute');
rollback;
