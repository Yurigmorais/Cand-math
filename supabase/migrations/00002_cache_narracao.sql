-- ============================================================
--  CANDY MATH — migração 00002: cache do áudio da narração
--
--  PARA QUEM SERVE: bancos onde o schema já foi aplicado antes de existir o
--  cache de narração. Em um projeto novo isto é desnecessário — o
--  supabase/schema.sql já cria tudo —, mas o arquivo é idempotente e pode
--  rodar duas vezes sem estragar nada.
--
--  O QUE ELA ADICIONA: a tabela public.narracoes, as duas funções de poda e de
--  uso, e o bucket privado "narracoes". Nenhuma tabela existente é tocada,
--  nenhuma linha é apagada, nenhuma política antiga muda.
--
--  POR QUE EXISTE: o jogo fala a pergunta em voz alta. Sem cache, cada frase
--  volta à Fish Audio — inclusive as frases que meia escola inteira ouve todos
--  os dias ("Quanto é 3 + 4?"). Guardando o áudio uma vez, a segunda criança
--  recebe os bytes do próprio banco, mais rápido e sem gastar chamada.
--
--  O QUE FICA DE FORA, de propósito:
--    · nada de dado pessoal — a tabela guarda o texto da pergunta, a voz, o
--      modelo e o caminho do arquivo. Não há conta, criança, aparelho nem
--      histórico envolvido;
--    · nada de leitura pelo navegador: RLS ligado sem política nenhuma é
--      "nega tudo", e só o service_role da função serverless entra;
--    · nada de bucket público: o áudio sai pelo mesmo POST /api/voz de sempre,
--      então o CSP e o config.js não mudam uma linha.
--
--  Como rodar no Supabase: SQL Editor → cole este arquivo → Run.
--  A última consulta é a conferência: ZERO LINHAS significa que deu certo.
-- ============================================================

begin;

-- 1. A tabela do cache. Os constraints são a cinta: a chave tem de ser um
--    sha256, o nome da voz tem de parecer com o da lista da função, e o
--    caminho é derivado — impossível apontar para um arquivo que não é o da
--    própria frase.
create table if not exists public.narracoes (
  id        uuid primary key default gen_random_uuid(),
  chave     text not null check (char_length(chave) = 64 and chave ~ '^[0-9a-f]{64}$'),
  voz       text not null check (voz ~ '^[a-z]{3,12}$'),
  modelo    text not null check (char_length(modelo) between 1 and 40),
  texto     text not null check (char_length(texto) between 1 and 2000),
  caminho   text not null generated always as (voz || '/' || chave || '.mp3') stored,
  bytes     int  not null default 0 check (bytes between 0 and 4000000),
  usos      int  not null default 1 check (usos >= 0),
  criado_em timestamptz not null default now(),
  visto_em  timestamptz not null default now(),
  unique (chave, voz, modelo)
);

create index if not exists idx_narracoes_sobras on public.narracoes (usos, visto_em);
create index if not exists idx_narracoes_chave  on public.narracoes (chave, voz, modelo);

-- 2. Negar tudo a quem joga. Sem política, RLS ligado já nega; o revoke é a
--    segunda fechadura, porque privilégio de tabela sobrevivente a uma política
--    ausente é exatamente o tipo de buraco que a versão 3.0 tinha.
alter table public.narracoes enable row level security;
revoke all on public.narracoes from anon, authenticated;

-- 3. As duas portas de serviço.
create or replace function public.narracao_usada(p_chave text, p_voz text, p_modelo text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.narracoes
     set usos = usos + 1, visto_em = now()
   where chave = p_chave and voz = p_voz and modelo = p_modelo;
$$;

create or replace function public.purgar_narracoes(p_teto int, p_lote int)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  total    int;
  apagar   int;
  endereco text;
begin
  select count(*) into total from public.narracoes;
  apagar := least(greatest(p_lote, 1), greatest(total - least(p_teto, 0), 0));
  if apagar <= 0 then
    return;
  end if;
  for endereco in
    select n.caminho
      from public.narracoes n
     order by n.usos asc, n.visto_em asc
     limit apagar
  loop
    delete from public.narracoes where caminho = endereco;
    return next endereco;
  end loop;
end;
$$;

revoke all on function public.narracao_usada(text, text, text) from public, anon;
revoke all on function public.purgar_narracoes(int, int)       from public, anon;
grant execute on function public.narracao_usada(text, text, text) to service_role;
grant execute on function public.purgar_narracoes(int, int)       to service_role;

-- 4. O bucket privado. Em Postgres puro a tabela de buckets não existe, e o
--    bloco passa direto — é o mesmo arranjo do schema principal.
do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('narracoes', 'narracoes', false, 4000000, array['audio/mpeg'])
  on conflict (id) do nothing;
end;
$$;

commit;

-- 5. Conferência. Estas consultas devem devolver ZERO LINHAS quando a migração
--    fez o que promete. Uma linha devolvida é um item que faltou aplicar.
select 'tabela narracoes não existe' as problema, 'narracoes' as detalhe
 where to_regclass('public.narracoes') is null
union all
select 'RLS desligado em narracoes', 'narracoes'
  from pg_class c
 where c.relname = 'narracoes' and c.relrowsecurity = false
union all
select 'navegador ainda tem privilégio em narracoes', grantee
  from information_schema.table_privileges
 where table_schema = 'public' and table_name = 'narracoes'
   and grantee in ('anon', 'authenticated')
union all
select 'política aberta em narracoes (não deveria ter política nenhuma)', pol.polname
  from pg_policies pol
 where pol.schemaname = 'public' and pol.tablename = 'narracoes'
union all
select 'bucket narracoes público ou ausente',
       coalesce((select b.public::text from storage.buckets b where b.id = 'narracoes'), 'ausente')
  where to_regclass('storage.buckets') is not null
    and not exists (select 1 from storage.buckets b where b.id = 'narracoes' and b.public = false)
union all
select 'função de serviço sem grant de service_role', f.proname
  from pg_proc f
  join pg_namespace n on n.oid = f.pronamespace
 where n.nspname = 'public' and f.proname in ('narracao_usada', 'purgar_narracoes')
   and has_function_privilege('service_role', f.oid, 'EXECUTE') = false;
