-- Fase 17: autenticação real do time interno (Supabase Auth).
--
-- Problema clássico de bootstrap: `admin_profiles` só aceita insert de
-- quem já é `super_admin` (migration 0001) — mas ninguém é super_admin
-- ainda na primeira vez que o projeto sobe. Sem uma exceção controlada,
-- nenhum usuário conseguiria nunca virar o primeiro admin.
--
-- Solução: uma política de insert adicional, só para o caso "a tabela
-- está vazia" — só o PRIMEIRO usuário autenticado pode se auto-inserir,
-- e só como `super_admin` (nunca outro papel). Depois que existe uma
-- linha, esta política nunca mais permite nada.
--
-- Armadilha real encontrada testando isto contra um banco de verdade:
-- um `exists (select 1 from admin_profiles)` direto dentro do `with
-- check` é, ele mesmo, filtrado pelas policies de SELECT da tabela para
-- quem está inserindo. Um segundo usuário (ainda sem perfil, não
-- super_admin) não enxerga a linha do primeiro admin por causa das
-- próprias policies de leitura — então, do ponto de vista dele, a
-- tabela parece "vazia" mesmo já tendo uma linha, e ele conseguiria se
-- auto-inserir como super_admin também. Por isso a checagem de
-- vazio/não-vazio precisa rodar numa função `security definer` (mesma
-- técnica de `has_admin_role`), que enxerga a tabela real, sem o filtro
-- de RLS do chamador.

create or replace function admin_profiles_is_empty()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from admin_profiles);
$$;

create policy "primeiro usuário autenticado vira super_admin"
  on admin_profiles for insert
  with check (
    id = auth.uid()
    and role = 'super_admin'
    and admin_profiles_is_empty()
  );
