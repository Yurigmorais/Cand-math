-- ============================================================
--  Candy Math · schema inicial (Supabase / Postgres 15+)
--  Rode em: Supabase Dashboard → SQL Editor → New query → Run
--
--  As tabelas espelham 1:1 o que o jogo já salva no aparelho
--  (src/state/gameState.js + CAMPOS de src/storage/persistence.js),
--  então ligar o banco não exige mexer no código do jogo.
--
--  chaves em snake_case porque é o que o PostgREST expõe na API.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------ perfis
-- `id` é o token do aparelho (uuid gerado no cliente). Quando o Supabase
-- Auth entrar em cena, preencha auth_user_id e passe a usar a fase 2 abaixo.
create table if not exists public.profiles (
  id                 text primary key,
  auth_user_id       uuid unique,
  device_token       text not null,
  child_name         text not null default '',
  child_age          smallint,
  grade              smallint not null default 3 check (grade between 1 and 9),
  guardian_name      text,
  guardian_email     text,
  parent_pin_hash    text,
  stars              integer not null default 0,
  xp                 integer not null default 0,
  level              integer not null default 1,
  phase              integer not null default 1,
  streak             integer not null default 0,
  best_streak        integer not null default 0,
  total_correct      integer not null default 0,
  total_attempts     integer not null default 0,
  selected_track     text not null default 'mix',
  equip              jsonb not null default '{}'::jsonb,
  owned              jsonb not null default '[]'::jsonb,
  daily_quests       jsonb not null default '[]'::jsonb,
  settings           jsonb not null default '{}'::jsonb,
  last_login_date    date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ----------------------------------------------- progresso por habilidade
create table if not exists public.skill_progress (
  profile_id   text not null references public.profiles(id) on delete cascade,
  skill_id     text not null,
  correct      integer not null default 0,
  wrong        integer not null default 0,
  n            integer not null default 0,
  avg_ms       integer not null default 0,
  best_ms      integer not null default 0,
  mastery      numeric(6,4) not null default 0,
  last_seen    timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (profile_id, skill_id)
);

-- ------------------------------------------------------ resumo por dia
create table if not exists public.sessions (
  id           bigserial primary key,
  profile_id   text not null references public.profiles(id) on delete cascade,
  day          date not null,
  attempts     integer not null default 0,
  correct      integer not null default 0,
  minutes      integer not null default 0,
  skills       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (profile_id, day)
);

-- ------------------------------------------- log fino de cada resposta
create table if not exists public.attempts (
  id           bigint generated always as identity primary key,
  profile_id   text not null references public.profiles(id) on delete cascade,
  answered_at  timestamptz not null,
  skill_id     text,
  trilha_id    text,
  unidade      text,
  grade        smallint,
  ok           boolean not null,
  ms           integer not null default 0,
  mode         text,
  prompt       text,
  answer_text  text,
  created_at   timestamptz not null default now()
);

create index if not exists skill_progress_mastery_idx
  on public.skill_progress (mastery, correct desc);
create index if not exists sessions_day_idx
  on public.sessions (profile_id, day desc);
create index if not exists attempts_time_idx
  on public.attempts (profile_id, answered_at desc);
create index if not exists attempts_skill_idx
  on public.attempts (profile_id, skill_id);

-- ------------------------------------------- visão pronta para a Área dos Pais
create or replace view public.v_parent_report as
select p.id            as profile_id,
       p.child_name,
       p.grade,
       p.stars,
       p.total_correct,
       p.total_attempts,
       sp.skill_id,
       sp.correct,
       sp.wrong,
       sp.mastery,
       sp.avg_ms,
       sp.last_seen
from public.profiles p
join public.skill_progress sp on sp.profile_id = p.id;

-- ============================================================
--  SEGURANÇA (Row Level Security)
--  Nenhuma tabela é legível/gravável sem política: com a chave anon
--  pública, o RLS é o que impede um aparelho de ler dados de outro.
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.skill_progress  enable row level security;
alter table public.sessions        enable row level security;
alter table public.attempts        enable row level security;

-- -------- FASE 1 (hoje): sem login. O cliente manda o cabeçalho
-- X-Device-Token e cada política só aceita a própria linha.
create or replace function public.req_device_token()
returns text
language sql
stable
as $$
  select coalesce(
    current_setting('request.headers', true)::jsonb ->> 'x-device-token',
    ''
  );
$$;

drop policy if exists f1_perfil_lectura on public.profiles;
create policy f1_perfil_lectura on public.profiles
  for select using (device_token = public.req_device_token());

drop policy if exists f1_perfil_escrita on public.profiles;
create policy f1_perfil_escrita on public.profiles
  for insert with check (id = public.req_device_token() and device_token = public.req_device_token());

drop policy if exists f1_perfil_atualiza on public.profiles;
create policy f1_perfil_atualiza on public.profiles
  for update using (id = public.req_device_token()) with check (id = public.req_device_token());

drop policy if exists f1_habilidades on public.skill_progress;
create policy f1_habilidades on public.skill_progress
  for all using (profile_id = public.req_device_token())
  with check (profile_id = public.req_device_token());

drop policy if exists f1_sessoes on public.sessions;
create policy f1_sessoes on public.sessions
  for all using (profile_id = public.req_device_token())
  with check (profile_id = public.req_device_token());

drop policy if exists f1_tentativas_lectura on public.attempts;
create policy f1_tentativas_lectura on public.attempts
  for select using (profile_id = public.req_device_token());

-- append puro: o jogo nunca apaga tentativa, então não há policy de update/delete
drop policy if exists f1_tentativas_escrita on public.attempts;
create policy f1_tentativas_escrita on public.attempts
  for insert with check (profile_id = public.req_device_token());

-- -------- FASE 2 (quando o Supabase Auth for ligado): troque as políticas
-- acima por estas e passe a gravar auth_user_id / user_id = auth.uid().
-- Os dados de criança ficam presos à conta do responsável.
--
-- create policy f2_perfil on public.profiles
--   for all using (auth_user_id = auth.uid())
--   with check (auth_user_id = auth.uid() and device_token = public.req_device_token());
-- create policy f2_habilidades on public.skill_progress
--   for all using (exists (select 1 from public.profiles p
--                         where p.id = profile_id and p.auth_user_id = auth.uid()))
--   with check (exists (select 1 from public.profiles p
--                       where p.id = profile_id and p.auth_user_id = auth.uid()));
-- (repita o mesmo padrão para sessions e attempts)

-- ------------------------------------------------------------ permissões
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles, public.skill_progress, public.sessions to anon, authenticated;
grant insert on public.attempts to anon, authenticated;
grant select on public.attempts to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant select on public.v_parent_report to authenticated;

-- ============================================================
--  Notas para publicar (Vercel + Supabase)
--  1. Crie o projeto no Supabase, rode este arquivo, depois copie
--     Project URL e a chave "anon" para VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
--  2. Em produção com crianças: desabilite o papel `anon` nas políticas (comente
--     os "grant ... to anon") e ative a FASE 2, exigindo conta do responsável.
--  3. Nunca armazene o PIN em texto claro nem o use como chave de acesso.
--  4. O jogo funciona sem banco: se a API falhar o lote fica em fila no
--     aparelho (localStorage candymath_sync_queue_v1) e reenvia ao voltar a rede.
-- ============================================================
