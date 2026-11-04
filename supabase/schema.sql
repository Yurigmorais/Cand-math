-- ============================================================
--  CANDY MATH — schema do Supabase
--  Cole este arquivo inteiro no SQL Editor do seu projeto e rode
--  uma vez. Ele é idempotente: pode rodar de novo sem quebrar, e
--  também funciona sobre um banco que já tenha o schema antigo.
--
--  O que este schema guarda, e o que ele deliberadamente não guarda:
--    guarda   → desempenho por conteúdo, provas aplicadas, registro de
--               duelos, nível/ano, código de vínculo, sala do duelo.
--    não guarda → nome real, foto, endereço, escola, CPF, geolocalização.
--               A criança aparece como um apelido que você digita e um
--               código gerado no aparelho dela.
--  Nenhuma chave deste arquivo é secreta: a anon key pública fica no
--  config.js, e é o RLS abaixo que decide o que ela pode fazer.
--
--  ── COMO A AUTORIZAÇÃO FUNCIONA (mudança da versão anterior) ──
--  Antes, a porta de entrada da sala era o código: quem tivesse o código
--  conseguia ler e escrever. Isso não é autorização — código não é
--  credencial. Agora:
--    1. sala e jogada pertencem a CONTAS (auth.uid()), não a códigos;
--    2. o código só escolhe qual sala, nunca quem você é;
--    3. o assento (0 = anfitrião, 1 = desafiante) é calculado pelo banco;
--    4. o navegador não escreve em salas nem em jogadas: ele chama as
--       funções abaixo, que conferem participação, estado da partida,
--       formato do lance e limite de abuso;
--    5. a chave anon não tem privilégio nenhum neste schema (revoke total),
--       então duelo exige conta autenticada.
--  Quem usa o jogo 100% offline não toca nada daqui.
-- ============================================================

create extension if not exists "pgcrypto";

-- O jogo conversa com o banco através dos papéis do Supabase. Criá-los quando
-- não existem deixa este arquivo aplicável também num Postgres puro, que é
-- como se roda a bateria de testes de autorização localmente.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

-- ── 1. TABELAS ────────────────────────────────────────────

-- Conta de quem acompanha. O id espelha auth.users; nenhum dado sensível.
create table if not exists public.perfis (
  id          uuid primary key references auth.users (id) on delete cascade,
  papel       text not null default 'responsavel' check (papel in ('responsavel')),
  apelido     text not null default 'Responsável',
  criado_em   timestamptz not null default now()
);

-- A criança: um apelido, um código curto e nada que a identifique fora daqui.
create table if not exists public.criancas (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique,
  apelido         text not null default 'Criança',
  responsavel_id  uuid references public.perfis (id) on delete cascade,
  id_aparelho     text,
  ano             int,
  nivel           int,
  criada_em       timestamptz not null default now(),
  check (char_length(codigo) between 3 and 24)
);

-- Adulto que enxerga esta criança. Várias contas podem se vincular ao mesmo
-- código (mãe e pai, por exemplo).
create table if not exists public.vinculos (
  crianca       uuid not null references public.criancas (id) on delete cascade,
  responsavel   uuid not null references public.perfis (id) on delete cascade,
  criado_em     timestamptz not null default now(),
  primary key (crianca, responsavel)
);

-- Snapshot do progresso. Uma linha por criança; o aparelho da criança escreve,
-- os responsáveis leem.
create table if not exists public.progressos (
  codigo_crianca  text primary key references public.criancas (codigo) on delete cascade,
  dados           jsonb not null default '{}'::jsonb,
  atualizado_em   timestamptz not null default now(),
  -- Um pacote de progresso é pequeno por natureza. O teto segura um cliente
  -- modificado que tente usar a tabela como depósito.
  check (jsonb_typeof(dados) = 'object'),
  check (octet_length(dados::text) <= 400000)
);

-- ── SALAS DO DUELO: modelo novo ───────────────────────────
-- A tabela antiga (versão 3.0) tinha apenas codigo + anfitriao(text) e uma
-- política "for all using (true)". Detectamos o legado abaixo e recomeçamos:
-- salas e jogadas são estado temporário de partida, sem dado pessoal, então
-- reconstruí-las é o caminho seguro. Nada mais neste arquivo é tocado.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'salas' and column_name = 'anfitriao'
      and data_type = 'text'
  ) then
    drop table if exists public.jogadas;
    drop table if exists public.salas;
  end if;
end;
$$;

create table if not exists public.salas (
  codigo        text primary key,
  anfitriao     uuid not null references auth.users (id) on delete cascade,
  desafiante    uuid references auth.users (id) on delete set null,
  estado        text not null default 'esperando'
                check (estado in ('esperando', 'ativa', 'encerrada')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Jogadas trocadas dentro de uma sala. Lixo temporário: dura um dia e não
-- contém nada além do lance do tabuleiro. autor é quem enviou, de verdade —
-- o banco escreve esse campo, o navegador não.
create table if not exists public.jogadas (
  id          bigint generated always as identity primary key,
  sala        text not null references public.salas (codigo) on delete cascade,
  autor       uuid not null references auth.users (id) on delete cascade,
  assento     int not null check (assento in (0, 1)),
  tipo        text not null check (tipo in ('duelo:partida', 'duelo:acerto', 'duelo:passada')),
  dado        jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now(),
  check (jsonb_typeof(dado) = 'object')
);

-- Tentativas de vínculo por código, por conta e por hora. Serve de trava
-- contra alguém que tente adivinhar códigos de crianças de outras famílias.
create table if not exists public.tentativas_vinculo (
  responsavel uuid not null references auth.users (id) on delete cascade,
  quando      timestamptz not null default now()
);

-- O áudio que a Fish Audio já sintetizou, guardado para a mesma frase não ser
-- pedida duas vezes. É a memória do jogo, mas fora do aparelho: uma frase ouvida
-- por uma criança serve para todas as outras, em todas as abas.
--
-- O que entra aqui e o que não entra: entra o texto da pergunta (um problema de
-- Matemática) e nada mais. Nenhum nome, e-mail, código, id de conta, id de
-- aparelho ou histórico. A coluna texto existe para a poda entender o que está
-- guardado e para permitir auditoria humana; ela não é uma chave de busca e não
-- identifica ninguém.
--
-- Só a função serverless mexe nesta tabela, com a chave de serviço. O navegador
-- continua chamando POST /api/voz e recebendo os bytes de áudio, igual antes: é
-- por isso que nada aqui é público e o CSP do jogo não precisa mudar.
create table if not exists public.narracoes (
  id        uuid primary key default gen_random_uuid(),
  -- sha256 do texto já limpo, em hex minúsculo. É a chave do cache.
  chave     text not null check (char_length(chave) = 64 and chave ~ '^[0-9a-f]{64}$'),
  -- O nome da voz, não o reference_id: a lista fechada mora na função de voz,
  -- e uma terceira cópia dela aqui só criaria o descompasso que a auditoria de
  -- 30/10/2026 passou para consertar. O formato basta.
  voz       text not null check (voz ~ '^[a-z]{3,12}$'),
  modelo    text not null check (char_length(modelo) between 1 and 40),
  texto     text not null check (char_length(texto) between 1 and 2000),
  -- Caminho do objeto no bucket, derivado: nunca diverge da chave.
  caminho   text not null generated always as (voz || '/' || chave || '.mp3') stored,
  bytes     int  not null default 0 check (bytes between 0 and 4000000),
  usos      int  not null default 1 check (usos >= 0),
  criado_em timestamptz not null default now(),
  visto_em  timestamptz not null default now(),
  unique (chave, voz, modelo)
);

create index if not exists idx_narracoes_sobras on public.narracoes (usos, visto_em);
create index if not exists idx_narracoes_chave  on public.narracoes (chave, voz, modelo);

create index if not exists idx_jogadas_sala_em on public.jogadas (sala, criado_em);
create index if not exists idx_criancas_responsavel on public.criancas (responsavel_id);
create index if not exists idx_salas_anfitriao on public.salas (anfitriao, criado_em);
create index if not exists idx_tentativas_responsavel on public.tentativas_vinculo (responsavel, quando);

-- ── 2. QUEM PODE O QUÊ (RLS) ──────────────────────────────
alter table public.perfis             enable row level security;
alter table public.criancas           enable row level security;
alter table public.vinculos           enable row level security;
alter table public.progressos         enable row level security;
alter table public.salas              enable row level security;
alter table public.jogadas            enable row level security;
alter table public.tentativas_vinculo enable row level security;
alter table public.narracoes          enable row level security;

-- Sem isso, uma consulta mal escrita no config.js faria qualquer chave anon
-- navegar pelas tabelas. Aqui a chave pública do navegador não tem nenhum
-- privilégio de tabela: ela só executa as funções autorizadas abaixo.
revoke all on public.perfis             from anon, authenticated;
revoke all on public.criancas           from anon, authenticated;
revoke all on public.vinculos           from anon, authenticated;
revoke all on public.progressos         from anon, authenticated;
revoke all on public.salas              from anon, authenticated;
revoke all on public.jogadas            from anon, authenticated;
revoke all on public.tentativas_vinculo from anon, authenticated;

-- narracoes é o único caso do schema sem política nenhuma e sem grant nenhum:
-- nem a conta autenticada, nem o próprio dono da conta leem esta tabela pelo
-- navegador. RLS ligado sem política significa "nega tudo", e quem entra é o
-- service_role da função serverless — que bypassa RLS por ser papel de serviço.
-- Nada aqui vira superfície de leitura para quem joga.
revoke all on public.narracoes          from anon, authenticated;

-- Leitura das próprias linhas continua possível para conta autenticada;
-- escrita em salas/jogadas é exclusiva das funções definidoras (item 3).
grant select on public.perfis, public.criancas, public.vinculos, public.progressos to authenticated;
grant insert, update, delete on public.perfis, public.criancas, public.vinculos, public.progressos to authenticated;
grant select on public.salas, public.jogadas to authenticated;

-- Perfil: só a própria conta lê e escreve no próprio registro.
drop policy if exists perfis_ler_proprio on public.perfis;
create policy perfis_ler_proprio on public.perfis
  for select using (id = (select auth.uid()));

drop policy if exists perfis_gravar_proprio on public.perfis;
create policy perfis_gravar_proprio on public.perfis
  for insert with check (id = (select auth.uid()));

drop policy if exists perfis_editar_proprio on public.perfis;
create policy perfis_editar_proprio on public.perfis
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists perfis_apagar_proprio on public.perfis;
create policy perfis_apagar_proprio on public.perfis
  for delete using (id = (select auth.uid()));

-- Criança: quem registrou enxerga; os demais enxergam pelo vínculo.
drop policy if exists criancas_ler_vinculados on public.criancas;
create policy criancas_ler_vinculados on public.criancas
  for select using (
    responsavel_id = (select auth.uid())
    or exists (select 1 from public.vinculos v
               where v.crianca = criancas.id and v.responsavel = (select auth.uid()))
  );

drop policy if exists criancas_registrar on public.criancas;
create policy criancas_registrar on public.criancas
  for insert with check (responsavel_id = (select auth.uid()));

drop policy if exists criancas_editar_donos on public.criancas;
create policy criancas_editar_donos on public.criancas
  for update using (responsavel_id = (select auth.uid()))
  with check (responsavel_id = (select auth.uid()));

drop policy if exists criancas_apagar_donos on public.criancas;
create policy criancas_apagar_donos on public.criancas
  for delete using (responsavel_id = (select auth.uid()));

-- Vínculo: só a própria conta cria o seu; ninguém lista vínculos alheios.
drop policy if exists vinculos_criar_proprio on public.vinculos;
create policy vinculos_criar_proprio on public.vinculos
  for insert with check (responsavel = (select auth.uid()));

drop policy if exists vinculos_ler_meus on public.vinculos;
create policy vinculos_ler_meus on public.vinculos
  for select using (
    responsavel = (select auth.uid())
    or exists (select 1 from public.criancas c
               where c.id = vinculos.crianca and c.responsavel_id = (select auth.uid()))
  );

drop policy if exists vinculos_soltar_proprio on public.vinculos;
create policy vinculos_soltar_proprio on public.vinculos
  for delete using (responsavel = (select auth.uid()));

-- Progresso: cada operação tem a sua política. O "for all" anterior misturava
-- leitura e escrita e não impedia mover a linha para outro código.
-- Lê quem é dono ou está vinculado à criança desse código.
drop policy if exists progressos_ler on public.progressos;
create policy progressos_ler on public.progressos
  for select using (public._e_cuidador(codigo_crianca));

-- Só escreve o aparelho que tem a criança registrada por esta conta. Quem foi
-- vinculado por código enxerga o boletim, mas não reescreve o progresso.
drop policy if exists progressos_gravar on public.progressos;
create policy progressos_gravar on public.progressos
  for insert with check (public._e_dono(codigo_crianca));

drop policy if exists progressos_atualizar on public.progressos;
create policy progressos_atualizar on public.progressos
  for update using (public._e_dono(codigo_crianca))
  with check (public._e_dono(codigo_crianca));

drop policy if exists progressos_apagar on public.progressos;
create policy progressos_apagar on public.progressos
  for delete using (public._e_dono(codigo_crianca));

-- Salas: a linha é visível e editável apenas para as duas contas da mesa.
-- O código, sozinho, não abre nada.
drop policy if exists salas_usar on public.salas;
drop policy if exists salas_ler_membros on public.salas;
create policy salas_ler_membros on public.salas
  for select using (anfitriao = (select auth.uid()) or desafiante = (select auth.uid()));

-- Sem política de insert/update/delete: o navegador não mexe aqui. Criar sala,
-- sentar, encerrar e sair acontecem só pelas funções do item 3.
drop policy if exists salas_escrever on public.salas;

-- Jogadas: o membro lê os lances da própria mesa; mais ninguém vê nada.
drop policy if exists jogadas_ler on public.jogadas;
drop policy if exists jogadas_inserir on public.jogadas;
drop policy if exists jogadas_apagar on public.jogadas;
create policy jogadas_ler_membros on public.jogadas
  for select using (public._e_membro(sala));

-- Imutáveis: sem insert, update ou delete diretos do cliente.

-- ── 3. FUNÇÕES DE APOIO E AS UNICAS PORTAS DE ENTRADA ─────

-- Estes auxiliares atravessam tabelas dentro das políticas. SECURITY DEFINER
-- mantém a consulta fora do caminho recursivo do RLS; eles devolvem apenas um
-- booleano sobre a conta que chamou, nunca as linhas de outra conta.
create or replace function public._membro_de(p_codigo text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
           when s.anfitriao  = auth.uid() then s.anfitriao
           when s.desafiante = auth.uid() then s.desafiante
           else null
         end
  from public.salas s
  where s.codigo = p_codigo;
$$;

create or replace function public._e_membro(p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._membro_de(p_codigo) is not null;
$$;

-- Cuidador = dono ou vinculado por código (usado pela leitura do progresso).
create or replace function public._e_cuidador(p_codigo_crianca text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.criancas c
    where c.codigo = p_codigo_crianca
      and (c.responsavel_id = auth.uid()
           or exists (select 1 from public.vinculos v
                      where v.crianca = c.id and v.responsavel = auth.uid()))
  );
$$;

-- Dono = a conta que registrou a criança neste código.
create or replace function public._e_dono(p_codigo_crianca text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.criancas c
    where c.codigo = p_codigo_crianca and c.responsavel_id = auth.uid()
  );
$$;

revoke all on function public._membro_de(text)              from public;
revoke all on function public._novo_codigo(int)             from public;
-- As três funções abaixo são chamadas DENTRO das políticas, ou seja, no papel
-- da conta autenticada que consulta. Se elas ficassem sem privilégio, toda
-- leitura de jogada e de progresso daria "permission denied" — por isso a
-- autorização do RLS depende deste grant, e não de uma chave secreta.
revoke all on function public._e_membro(text)   from public, anon;
revoke all on function public._e_cuidador(text) from public, anon;
revoke all on function public._e_dono(text)     from public, anon;
grant execute on function public._e_membro(text)   to authenticated;
grant execute on function public._e_cuidador(text) to authenticated;
grant execute on function public._e_dono(text)     to authenticated;

-- Um código de sala não é segredo, mas também não pode ser adivinhado.
-- 8 letras de um alfabeto sem caracteres ambíguos, com byte criptográfico
-- (pgcrypto) por letra: ~8,5 × 10^11 combinações e as letras parecidas
-- (I/1, O/0) ficaram de fora porque alguém precisa ler o código em voz alta.
create or replace function public._novo_codigo(p_comprimento int)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  alfabeto text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  saida    text := '';
  byte_val int;
  i        int;
begin
  for i in 1 .. p_comprimento loop
    select ('x' || encode(gen_random_bytes(1), 'hex'))::bit(8)::int into byte_val;
    saida := saida || substr(alfabeto, (abs(byte_val) % length(alfabeto)) + 1, 1);
  end loop;
  return saida;
end;
$$;

revoke all on function public._novo_codigo(int) from public;

-- ── criar_sala(): abre a mesa e devolve o assento de quem abriu ──
create or replace function public.criar_sala()
returns table (codigo text, assento int, adversario text, estado_sala text)
language plpgsql
security definer
set search_path = public
as $$
declare
  dono   uuid := auth.uid();
  aberta public.salas;
  tenta  int;
  novo   text;
begin
  if dono is null then
    raise exception 'entre na sua conta antes de abrir uma sala';
  end if;

  -- Trave contra criação em série: três salas esperando nos últimos minutos.
  if (select count(*) from public.salas
      where anfitriao = dono and estado = 'esperando'
        and criado_em > now() - interval '10 minutes') >= 3 then
    raise exception 'você já tem salas abertas demais; feche uma e tente de novo';
  end if;

  for tenta in 1 .. 12 loop
    novo := public._novo_codigo(8);
    begin
      insert into public.salas (codigo, anfitriao) values (novo, dono);
      exit;
    exception when unique_violation then
      if tenta = 12 then
        raise exception 'não consegui abrir a sala agora, tente de novo';
      end if;
    end;
  end loop;

  select * into aberta from public.salas where codigo = novo;
  return query select aberta.codigo, 0, null::text, aberta.estado;
end;
$$;

-- ── entrar_na_sala(): senta na mesa, calcula o assento, não aceita engano ──
-- O update é condicional e atômico: se duas pessoas tentarem o mesmo código ao
-- mesmo tempo, uma delas entra e a outra ouve a mesma resposta genérica que
-- um código errado daria — assim a API não serve de oráculo para enumerar
-- salas.
create or replace function public.entrar_na_sala(p_codigo text)
returns table (codigo text, assento int, adversario text, estado_sala text)
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid := auth.uid();
  achada public.salas;
  nome_adversario text;
begin
  if dono is null then
    raise exception 'entre na sua conta antes de entrar numa sala';
  end if;

  update public.salas
     set desafiante = dono, estado = 'ativa', atualizado_em = now()
   where codigo = upper(trim(coalesce(p_codigo, '')))
     and estado = 'esperando'
     and desafiante is null
     and anfitriao <> dono
  returning * into achada;

  if not found then
    raise exception 'não deu para entrar: código inválido, sala cheia ou partida já encerrada';
  end if;

  -- O que chega para o desafiante é só o apelido do anfitrião, nunca o e-mail
  -- nem o id da conta dele.
  select p.apelido into nome_adversario from public.perfis p where p.id = achada.anfitriao;
  return query select achada.codigo, 1, coalesce(nome_adversario, 'Anfitrião'), achada.estado;
end;
$$;

-- ── registrar_jogada(): o único caminho para escrever um lance ──
-- O banco decide autor e assento a partir da conta que chama; o campo
-- "assento" enviado pelo navegador é ignorado. Valida estado da partida,
-- tipo conhecido, formato e tamanho do lance e a frequência da conta.
create or replace function public.registrar_jogada(
  p_sala text,
  p_tipo text,
  p_dado jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dono    uuid := auth.uid();
  mesa    public.salas;
  cadeira int;
  na_vez  uuid;
begin
  if dono is null then
    raise exception 'entre na sua conta antes de jogar';
  end if;

  -- Nada aqui confia no que o navegador mandou para decidir permissão: nem o
  -- assento, nem o autor, nem o "eu sou o anfitrião". O banco olha a sala e
  -- descobre.
  if coalesce(p_tipo, '') not in ('duelo:partida', 'duelo:acerto', 'duelo:passada') then
    raise exception 'tipo de lance desconhecido';
  end if;

  if p_dado is null or jsonb_typeof(p_dado) <> 'object' then
    raise exception 'o lance precisa ser um objeto';
  end if;
  if octet_length(p_dado::text) > 60000 then
    raise exception 'o lance é grande demais';
  end if;

  select * into mesa from public.salas where codigo = upper(trim(coalesce(p_sala, '')));
  if not found then
    raise exception 'essa sala não existe';
  end if;
  if mesa.estado <> 'ativa' then
    raise exception 'a sala não está em jogo';
  end if;

  if mesa.anfitriao = dono then
    cadeira := 0;
  elsif mesa.desafiante = dono then
    cadeira := 1;
  else
    raise exception 'você não participa desta sala';
  end if;

  if p_tipo = 'duelo:partida' then
    -- Só quem abriu a mesa sorteia as contas. Uma nova partida na mesma sala
    -- é permitida: é assim que acontece a revanche.
    if cadeira <> 0 then
      raise exception 'só o anfitrião entrega as contas';
    end if;
    if not public._contas_validas(p_dado) then
      raise exception 'as contas não estão no formato esperado';
    end if;
  else
    -- A vez alterna de verdade, e ela é contada a partir da ÚLTIMA entrega de
    -- contas — senão a revanche nasceria com a vez errado.
    if p_tipo = 'duelo:acerto' and not public._acerto_valido(p_dado) then
      raise exception 'o acerto não está no formato esperado';
    end if;
    if p_tipo = 'duelo:passada' and not public._passada_valida(p_dado) then
      raise exception 'a passagem não está no formato esperado';
    end if;
    na_vez := public._vez_de(mesa.codigo);
    if na_vez is not null and na_vez <> dono then
      raise exception 'ainda não é a sua vez';
    end if;
  end if;

  -- Frequência: ninguém inunda a mesa.
  if (select count(*) from public.jogadas
      where sala = mesa.codigo and autor = dono
        and criado_em > now() - interval '5 seconds') >= 12 then
    raise exception 'devagar: muitos lances em pouco tempo';
  end if;

  insert into public.jogadas (sala, autor, assento, tipo, dado)
  values (mesa.codigo, dono, cadeira, p_tipo, p_dado);
end;
$$;

-- ── encerrar_sala() e sair_da_sala(): estados previsíveis da mesa ──
create or replace function public.encerrar_sala(p_sala text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid := auth.uid();
begin
  if dono is null then
    raise exception 'entre na sua conta antes';
  end if;
  update public.salas
     set estado = 'encerrada', atualizado_em = now()
   where codigo = upper(trim(coalesce(p_sala, ''))) and (anfitriao = dono or desafiante = dono);
  if not found then
    raise exception 'você não participa desta sala';
  end if;
end;
$$;

create or replace function public.sair_da_sala(p_sala text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid := auth.uid();
begin
  if dono is null then
    raise exception 'entre na sua conta antes';
  end if;
  update public.salas
     set estado = 'encerrada', atualizado_em = now()
   where codigo = upper(trim(coalesce(p_sala, ''))) and anfitriao = dono;
  update public.salas
     set desafiante = null, estado = 'esperando', atualizado_em = now()
   where codigo = upper(trim(coalesce(p_sala, ''))) and desafiante = dono;
end;
$$;

-- ── Validadores de formato dos lances ────────────────────
-- Os textos do tabuleiro vêm de um dos dois aparelhos. Antes de virar fala,
-- placar ou desenho no outro lado, o banco confere tamanho, tipo e unidades.
-- São funções plpgsql com saída booleana sempre definida: uma checagem que
-- devolvesse NULL deixaria o lance passar pela porta dos fundos.
create or replace function public._contas_validas(p_dado jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  conta   jsonb;
  lista   jsonb := p_dado -> 'contas';
  quantas int;
begin
  if jsonb_typeof(lista) <> 'array' then return false; end if;
  quantas := jsonb_array_length(lista);
  if quantas < 1 or quantas > 80 then return false; end if;
  if coalesce(p_dado ->> 'densidade', '') !~ '^[0-9]{1,3}$' then return false; end if;
  if (p_dado ->> 'densidade')::int not between 1 and 80 then return false; end if;

  for conta in select jsonb_array_elements(lista) loop
    if jsonb_typeof(conta) <> 'object' then return false; end if;
    if coalesce(octet_length(conta ->> 'txt'), 0) not between 1 and 300 then return false; end if;
    if coalesce(octet_length(conta ->> 'resposta'), 0) not between 1 and 40 then return false; end if;
    if coalesce(octet_length(conta ->> 'ref'), 0) > 40 then return false; end if;
    if coalesce(conta ->> 'u', '') not in ('numeros', 'algebra', 'geometria', 'medidas', 'dados') then
      return false;
    end if;
    if coalesce(octet_length(conta ->> 'o'), 0) > 200 then return false; end if;
    if conta ? 'bncc' and jsonb_typeof(conta -> 'bncc') not in ('array', 'string') then return false; end if;
    if conta ? 'valor' and jsonb_typeof(conta -> 'valor') <> 'number' then return false; end if;
    if conta ? 'alt' and jsonb_typeof(conta -> 'alt') <> 'array' then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function public._acerto_valido(p_dado jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(octet_length(p_dado ->> 'peca'), 0) not between 1 and 24 then return false; end if;
  if coalesce(octet_length(p_dado ->> 'conta'), 0) not between 1 and 40 then return false; end if;
  if coalesce(p_dado ->> 'tempo', '') !~ '^[0-9]{1,7}$' then return false; end if;
  return true;
end;
$$;

create or replace function public._passada_valida(p_dado jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(p_dado ->> 'tempo', '') !~ '^[0-9]{1,7}$' then return false; end if;
  if coalesce(octet_length(p_dado ->> 'motivo'), 0) > 80 then return false; end if;
  return true;
end;
$$;

-- De quem é a vez? O tabuleiro alterna: começa o anfitrião (que entrega as
-- contas) e cada acerto ou passagem devolve a vez ao outro lado. A contagem
-- recomeça a cada entrega de contas, para a revanche sair com a vez certa.
create or replace function public._vez_de(p_codigo text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  mesa    public.salas;
  ultimo  public.jogadas;
  desde   bigint;
begin
  select * into mesa from public.salas where codigo = p_codigo;
  if not found then
    return null;
  end if;

  select coalesce(max(id), 0) into desde from public.jogadas
   where sala = p_codigo and tipo = 'duelo:partida';

  select * into ultimo from public.jogadas
   where sala = p_codigo and id > desde and tipo in ('duelo:acerto', 'duelo:passada')
   order by id desc limit 1;

  if not found then
    return mesa.anfitriao;              -- a caçada começa com o anfitrião
  end if;
  if ultimo.assento = 0 then
    return mesa.desafiante;
  end if;
  return mesa.anfitriao;
end;
$$;

-- Visão usada pelo app para listar as crianças que a conta enxerga.
create or replace view public.criancas_visiveis
with (security_invoker = true) as
select c.id, c.codigo, c.apelido, c.ano, c.nivel, c.criada_em,
       p.atualizado_em as sincronizado_em
from public.criancas c
left join public.progressos p on p.codigo_crianca = c.codigo;

revoke all on public.criancas_visiveis from anon;
grant select on public.criancas_visiveis to authenticated;

-- Vincular por código: transforma o código que o aparelho da criança mostrou
-- em um vínculo desta conta. SECURITY DEFINER porque a conta precisa procurar
-- a criança pelo código antes de ter direito de vê-la — por isso mesmo a
-- tentativa é contada e limitada, senão bastaria martelar códigos de seis
-- letras para achar crianças alheias.
create or replace function public.vincular_por_codigo(p_codigo text)
returns table (id uuid, codigo text, apelido text, ano int, nivel int)
language plpgsql
security definer
set search_path = public
as $$
declare
  achada public.criancas%rowtype;
  dono uuid := auth.uid();
  limpo text := upper(trim(coalesce(p_codigo, '')));
begin
  if dono is null then
    raise exception 'entre na conta antes de vincular';
  end if;

  if limpo !~ '^[A-Z0-9]{3,24}$' then
    raise exception 'esse código não tem um formato válido';
  end if;

  -- Oito tentativas por hora por conta. O código da criança tem hoje dez
  -- caracteres, então adivinhação já não é um caminho; a trava segura quem
  -- insistir mesmo assim.
  insert into public.tentativas_vinculo (responsavel) values (dono);
  delete from public.tentativas_vinculo
   where responsavel = dono and quando < now() - interval '1 hour';
  if (select count(*) from public.tentativas_vinculo
      where responsavel = dono and quando > now() - interval '1 hour') > 8 then
    raise exception 'muitas tentativas seguidas; espere uma hora e tente de novo';
  end if;

  select * into achada
  from public.criancas
  where codigo = limpo
  limit 1;

  if not found then
    raise exception 'código não encontrado';
  end if;

  insert into public.vinculos (crianca, responsavel)
  values (achada.id, dono)
  on conflict (crianca, responsavel) do nothing;

  return query
  select achada.id, achada.codigo, achada.apelido, achada.ano, achada.nivel;
end;
$$;

revoke all on function public.vincular_por_codigo(text) from public;
grant execute on function public.vincular_por_codigo(text) to authenticated;

-- ── Exclusão: apagar a criança leva progresso e vínculos ──
-- Fluxo de "meus dados, minha conta" do jogo. A conta apaga o próprio perfil e
-- o que for dela; o que era de outra criança (vínculo) apenas se solta.
create or replace function public.apagar_meus_registros()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid := auth.uid();
begin
  if dono is null then
    raise exception 'entre na conta antes de apagar';
  end if;

  delete from public.vinculos where responsavel = dono;
  delete from public.progressos
   where codigo_crianca in (select codigo from public.criancas where responsavel_id = dono);
  delete from public.criancas where responsavel_id = dono;
  delete from public.perfis where id = dono;
  delete from public.tentativas_vinculo where responsavel = dono;
end;
$$;

revoke all on function public.apagar_meus_registros() from public;
grant execute on function public.apagar_meus_registros() to authenticated;

-- Limpeza das salas paradas há mais de um dia. Não é porta de entrada do app:
-- roda pelo cron do projeto (chave de serviço) ou manualmente no SQL Editor.
-- Na versão anterior qualquer conta autenticada podia chamar isto.
create or replace function public.purgar_salas_velhas()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  removidas int;
begin
  delete from public.salas where criado_em < now() - interval '1 day';
  get diagnostics removidas = row_count;
  return removidas;
end;
$$;

revoke all on function public.purgar_salas_velhas() from public;
grant execute on function public.purgar_salas_velhas() to service_role;

-- ── 3.7 PODA E USO DO CACHE DE NARRAÇÃO ───────────────────
-- Marca que uma frase guardada foi ouvida outra vez. Sem isto, a poda não tem
-- como saber o que ainda serve. É "update e pronto": se a frase não está
-- guardada, nenhuma linha muda e nada quebra.
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

-- Devolve (e apaga da tabela) as frases que passam do teto, começando pelas
-- menos usadas. O teto existe porque o bucket é finito: sem poda, o armazenamento
-- cresce até o plano estourar e as frases novas param de entrar.
--
-- Quem chama é a função de voz, e ela apaga o arquivo no Storage em seguida. O
-- nome do objeto é derivado da chave, então se a frase podada voltar a ser
-- pedida ela reescreve no mesmo caminho: não sobra corpo estranho no bucket.
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

-- Trava de integridade: dono e código da criança não mudam de mão por UPDATE.
-- Sem isso, um update bem colocado transferiria o registro para outra conta.
create or replace function public._sem_transferencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.role() <> 'service_role' then
    if new.responsavel_id is distinct from old.responsavel_id then
      raise exception 'o responsável de uma criança não muda por edição';
    end if;
    if tg_table_name = 'criancas' and new.codigo is distinct from old.codigo then
      raise exception 'o código da criança não muda';
    end if;
    if tg_table_name = 'progressos' and new.codigo_crianca is distinct from old.codigo_crianca then
      raise exception 'o progresso não muda de criança';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists criancas_sem_transferencia on public.criancas;
create trigger criancas_sem_transferencia
  before update on public.criancas
  for each row execute function public._sem_transferencia();

drop trigger if exists progressos_sem_transferencia on public.progressos;
create trigger progressos_sem_transferencia
  before update on public.progressos
  for each row execute function public._sem_transferencia();

-- ── 3.9 PORTAS DE ENTRADA: quem pode chamar o quê ─────────
-- O Postgres entrega EXECUTE de função a PUBLIC por padrão, e é exatamente
-- isso que não serve aqui: sem estes revoke, qualquer chave anon chamaria
-- criar_sala() e registrar_jogada() com o assento que quisesse.
revoke all on function public.criar_sala()                         from public, anon;
revoke all on function public.entrar_na_sala(text)                 from public, anon;
revoke all on function public.registrar_jogada(text, text, jsonb)  from public, anon;
revoke all on function public.encerrar_sala(text)                  from public, anon;
revoke all on function public.sair_da_sala(text)                   from public, anon;
revoke all on function public._vez_de(text)                        from public, anon;
revoke all on function public._contas_validas(jsonb)               from public, anon;
revoke all on function public._acerto_valido(jsonb)                from public, anon;
revoke all on function public._passada_valida(jsonb)               from public, anon;

grant execute on function public.criar_sala()                        to authenticated;
grant execute on function public.entrar_na_sala(text)                to authenticated;
grant execute on function public.registrar_jogada(text, text, jsonb) to authenticated;
grant execute on function public.encerrar_sala(text)                 to authenticated;
grant execute on function public.sair_da_sala(text)                  to authenticated;

-- ── 4. REALTIME ───────────────────────────────────────────
-- Sem isto, o duelo em rede ainda funciona: o nuvem.js cai para varredura a
-- cada 900 ms. Com isto, a jogada chega no instante em que acontece.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public'
                   and tablename = 'jogadas') then
    alter publication supabase_realtime add table public.jogadas;
  end if;
end;
$$;

-- ── 5. BUCKET DO ÁUDIO DA NARRAÇÃO ────────────────────────
-- Privado de propósito: nenhum arquivo desse bucket tem URL pública. É a
-- função serverless, com a chave de serviço, que pega os bytes e os devolve
-- pelo mesmo POST /api/voz de sempre. Um bucket público colocaria o áudio de
-- cada pergunta detrás de um endereço que dá para colar no navegador de
-- qualquer um — e aqui a chave do nome é um resumo da frase, o que transformaria
-- "quem conhece a pergunta" em "quem pode ouvir a resposta".
--
-- O guardamento em storage.buckets só existe no Supabase; num Postgres puro,
-- como o dos testes locais de RLS, a tabela não existe e este bloco passa
-- direto. A função de voz trata a ausência do bucket como "cache indisponível",
-- nunca como erro de quem joga.
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

-- Fim. Se aparecer "already exists" em alguma linha, é porque o schema já
-- estava aplicado: pode seguir, nada foi perdido.
