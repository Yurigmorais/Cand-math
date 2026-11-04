-- ============================================================
--  MIGRAÇÃO 00001 — endurecer a autorização de salas e jogadas
--
--  PARA QUEM SERVE: só para bancos onde o schema da versão 3.0 já foi
--  aplicado (tabelas salas/jogadas antigas, com anfitrião como texto e a
--  política "salas_usar for all using (true)").
--
--  O que ela desfaz, e por quê:
--    · salas_usar (for all using true with check true)
--        → dava a qualquer chave pública ler, criar, mudar e apagar QUALQUER
--          sala, e o conteúdo de salas alheias era uma listagem trivial.
--    · jogadas_inserir / jogadas_ler / jogadas_apagar
--        → exigiam apenas que a sala existisse. Conhecer o código virava
--          credencial: dava para inserir lance em nome do outro assento,
--          ler a partida inteira e apagar o histórico do adversário.
--    · as tabelas antigas não têm como guardar a participação: o anfitrião é
--          um texto (apelido), não uma conta. Não existe conversão possível,
--          então as duas tabelas são reconstruídas.
--
--  O que é perdido: linhas de salas abertas e jogadas em andamento. São
--  estado temporário de partida, sem dado pessoal, com validade de um dia —
--  e são justamente as linhas que a política permissiva expunha. Nenhuma
--  outra tabela é tocada: perfis, crianças, vínculos, progressos e contas de
--  auth.users ficam intactos.
--
--  DEPOIS desta migração, rode o supabase/schema.sql (idempotente) para criar
--  as tabelas novas, as políticas por operação e as funções que o navegador
--  passa a chamar.
--
--  Como rodar no Supabase: SQL Editor → cole este arquivo → Run → depois
--  cole supabase/schema.sql → Run.
-- ============================================================

begin;

-- 1. As portas escancadas, derrubadas por nome (não por "drop policy if
--    exists" genérico: se o nome mudou, queremos que o erro apareça).
drop policy if exists salas_usar on public.salas;
drop policy if exists jogadas_inserir on public.jogadas;
drop policy if exists jogadas_ler on public.jogadas;
drop policy if exists jogadas_apagar on public.jogadas;

-- 2. Recomeço das duas tabelas de partida, apenas se ainda forem do modelo
--    antigo (anfitrião em texto). Um banco já migrado passa reto por aqui.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'salas' and column_name = 'anfitriao'
      and data_type = 'text'
  ) then
    -- Tira a tabela do publication antes: assim o schema.sql volta a
    -- adicioná-la sem deixar um buraco no Realtime.
    begin
      alter publication supabase_realtime drop table if exists public.jogadas;
    exception when others then
      null;  -- sem publication ainda: nada a soltar
    end;
    drop table if exists public.jogadas;
    drop table if exists public.salas;
  end if;
end;
$$;

commit;

-- 3. Conferência. Estas duas consultas devem devolver zero linhas quando a
--    migração fez o que prometia.
select 'política permissiva ainda viva' as problema, pol.polname
  from pg_policies pol
 where pol.schemaname = 'public' and pol.tablename = 'salas'
   and pol.qual = 'true'
union all
select 'coluna anfitrião ainda é texto', 'salas.anfitriao'
  from information_schema.columns
 where table_schema = 'public' and table_name = 'salas'
   and column_name = 'anfitriao' and data_type = 'text';
