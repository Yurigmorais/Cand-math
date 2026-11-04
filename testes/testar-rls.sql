-- ============================================================
--  CANDY MATH — testes/testar-rls.sql
--  Teste de COMPORTAMENTO da autorização. O outro teste do projeto
--  (testar-politicas-sql.js) só lê o texto do schema; este aqui liga no motor
--  do Postgres e prova, com quatro identidades na mesma mesa, que conhecer o
--  código de uma sala não dá acesso a nada.
--
--  ONDE RODAR: no SQL Editor do seu projeto Supabase (ou em psql apontando
--  para o banco de testes), depois de aplicar supabase/schema.sql.
--
--  NADA FICA NO BANCO: cada cenário é um begin; ... rollback; fechado. A
--  montagem dos dados vive numa função temporária (pg_temp), que morre junto
--  com a conexão.
--
--  DUAS COISAS A SABER ANTES DE RODAR:
--   1. Se o seu editor envolver o script inteiro numa transação, os "begin;"
--      internos viram aviso e o primeiro "rollback" desfaz tudo. Nesse caso
--      rode cenário por cenário (selecione o bloco e execute).
--   2. A montagem tenta criar quatro contas em auth.users. Onde o papel
--      postgres não escreve nessa tabela, crie quatro usuários no painel
--      (Authentication → Users) e cole os uuids deles nos lugares das
--      constantes LOGn abaixo e nos literals correspondentes de cada cenário.
--
--  COMO LER O RESULTADO: cada linha do painel de mensagens precisa dizer
--  "ok". Uma linha com "FALHOU" é um buraco de autorização real — não
--  desative o teste, corrija a política e rode de novo.
-- ============================================================

-- ── Montagem ──────────────────────────────────────────────
-- Quatro identidades fixas:
--   LOG1 …1111 dona da criança e anfitriã das três salas
--   LOG2 …2222 desafiante da mesa ativa
--   LOG3 …3333 estranho que sabe os códigos
--   LOG4 …4444 responsável que vai se vincular por código
create or replace function pg_temp._montar()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  log1 constant uuid := '11111111-1111-1111-1111-111111111111';
  log2 constant uuid := '22222222-2222-2222-2222-222222222222';
  log3 constant uuid := '33333333-3333-3333-3333-333333333333';
  log4 constant uuid := '44444444-4444-4444-4444-444444444444';
begin
  begin
    insert into auth.users (id) values (log1), (log2), (log3), (log4)
      on conflict (id) do nothing;
  exception when insufficient_privilege or undefined_table then
    raise notice 'aviso: sem acesso a auth.users — crie as quatro contas no painel '
      'e troque os uuids dos cenários';
  end;

  insert into public.perfis (id, apelido) values
      (log1, 'Ana'), (log2, 'Bruno'), (log3, 'Carla'), (log4, 'Dadá')
    on conflict (id) do nothing;

  insert into public.criancas (codigo, apelido, responsavel_id, ano, nivel)
    values ('PINPOIN01', 'Cebolinha', log1, 3, 1)
    on conflict (codigo) do nothing;

  insert into public.progressos (codigo_crianca, dados)
    values ('PINPOIN01', '{"estrelas": 7}'::jsonb)
    on conflict (codigo_crianca) do nothing;

  insert into public.salas (codigo, anfitriao, desafiante, estado) values
      ('SALAA1A2', log1, log2, 'ativa'),
      ('SALAESP',  log1, null, 'esperando'),
      ('SALAFIM',  log1, log2, 'encerrada')
    on conflict (codigo) do nothing;

  -- A mesa ativa já recebeu as contas: quem abriu (LOG1, assento 0) entrega,
  -- e a vez de jogar começa com ela.
  insert into public.jogadas (sala, autor, assento, tipo, dado)
    values ('SALAA1A2', log1, 0, 'duelo:partida',
            '{"densidade": 20, "contas": [{'
            || '"txt": "7 + 5", "resposta": "12", "u": "numeros", "ref": "EF03MA01"}]}'::jsonb);
end;
$$;

-- Troca de identidade dentro do cenário. Não mexe no papel outra vez (uma vez
-- authenticated, continuamos authenticated; só o sub muda), o que é justamente
-- o que o PostgREST faz a cada requisição.
create or replace function pg_temp._entrar(p uuid)
returns void
language sql
as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
                    json_build_object('sub', p::text, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p::text, true),
         set_config('request.jwt.claim.role', 'authenticated', true);
$$;

create or replace function pg_temp._sem_login()
returns void
language sql
as $$
  select set_config('role', 'anon', true),
         set_config('request.jwt.claims', '{}', true);
$$;

-- Verdade de laboratório: as asserts que precisam saber o que existe no banco
-- de fato (e não apenas o que a RLS mostra para a conta atual) perguntam aqui.
-- É uma função de teste, temporária, e não faz parte do app.
create or replace function pg_temp._total(tabela text, coluna text, valor text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  execute format('select count(*) from public.%I where %I = %L', tabela, coluna, valor) into n;
  return n;
end;
$$;

create or replace function pg_temp._total_de(tabela text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  execute format('select count(*) from public.%I', tabela) into n;
  return n;
end;
$$;

-- ════════════════════════════════════════════════════════════
--  C1 — a chave pública do navegador, sem login, não vê nada
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._sem_login();
  do $$
  declare n int;
  begin
    begin
      select count(*) into n from public.salas;
      if n = 0 then raise notice 'C1 ok — anon não enxerga sala nenhuma';
      else raise notice 'C1 FALHOU — anon leu % salas', n; end if;
    exception when others then
      raise notice 'C1 ok — anon barrado na leitura de salas (%)', left(sqlerrm, 70);
    end;
    begin
      select count(*) into n from public.jogadas;
      if n = 0 then raise notice 'C1b ok — anon não enxerga lance nenhum';
      else raise notice 'C1b FALHOU — anon leu % lances', n; end if;
    exception when others then
      raise notice 'C1b ok — anon barrado na leitura de jogadas (%)', left(sqlerrm, 70);
    end;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C2 — anon não executa nenhuma porta do duelo
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._sem_login();
  do $$
  begin
    begin
      perform public.criar_sala();
      raise notice 'C2 FALHOU — anon abriu sala sem ter conta';
    exception when others then
      raise notice 'C2 ok — criar_sala() barrada para anon (%)', left(sqlerrm, 60);
    end;
    begin
      perform public.entrar_na_sala('SALAESP');
      raise notice 'C2b FALHOU — anon entrou numa sala';
    exception when others then
      raise notice 'C2b ok — entrar_na_sala() barrada para anon (%)', left(sqlerrm, 60);
    end;
    begin
      perform public.registrar_jogada('SALAA1A2', 'duelo:acerto',
        '{"peca":"x","conta":"7 + 5","tempo":"4"}'::jsonb);
      raise notice 'C2c FALHOU — anon gravou um lance';
    exception when others then
      raise notice 'C2c ok — registrar_jogada() barrada para anon (%)', left(sqlerrm, 60);
    end;
    begin
      perform public.purgar_salas_velhas();
      raise notice 'C2d FALHOU — anon purgou salas';
    exception when others then
      raise notice 'C2d ok — purgar_salas_velhas() é só service_role (%)', left(sqlerrm, 60);
    end;
    begin
      perform public.vincular_por_codigo('PINPOIN01');
      raise notice 'C2e FALHOU — anon se vinculou a uma criança';
    exception when others then
      raise notice 'C2e ok — vincular_por_codigo() exige conta (%)', left(sqlerrm, 60);
    end;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C3 — quem só sabe o código não vê nem toca na mesa alheia
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._entrar('33333333-3333-3333-3333-333333333333');
  do $$
  declare n int;
  begin
    select count(*) into n from public.salas where codigo = 'SALAA1A2';
    if n = 0 then raise notice 'C3 ok — Carla (estranha) não enxerga a sala';
    else raise notice 'C3 FALHOU — estranha leu a sala pelo código (% linha)', n; end if;

    select count(*) into n from public.jogadas where sala = 'SALAA1A2';
    if n = 0 then raise notice 'C3b ok — Carla não lê os lances da mesa alheia';
    else raise notice 'C3b FALHOU — estranha leu % lances de outra mesa', n; end if;

    begin
      perform public.registrar_jogada('SALAA1A2', 'duelo:acerto',
        '{"peca":"x","conta":"7 + 5","tempo":"4"}'::jsonb);
      raise notice 'C3c FALHOU — estranha escreveu na mesa dos outros';
    exception when others then
      raise notice 'C3c ok — lance de estranho recusado (%)', left(sqlerrm, 60);
    end;

    if pg_temp._total('jogadas', 'sala', 'SALAA1A2') = 1 then
      raise notice 'C3d ok — nem um byte a mais na mesa depois da tentativa';
    else
      raise notice 'C3d FALHOU — a recusa deixou um lance gravado';
    end if;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C4 — o navegador não escreve direto nem na própria sala
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._entrar('11111111-1111-1111-1111-111111111111');
  do $$
  begin
    begin
      insert into public.salas (codigo, anfitriao)
        values ('MANU0001', '11111111-1111-1111-1111-111111111111');
      raise notice 'C4 FALHOU — cliente inseriu direto em salas';
    exception when others then
      raise notice 'C4 ok — insert direto em salas barrado (%)', left(sqlerrm, 60);
    end;
    begin
      insert into public.jogadas (sala, autor, assento, tipo)
        values ('SALAA1A2', '11111111-1111-1111-1111-111111111111', 1, 'duelo:acerto');
      raise notice 'C4b FALHOU — cliente inseriu direto em jogadas';
    exception when others then
      raise notice 'C4b ok — insert direto em jogadas barrado (%)', left(sqlerrm, 60);
    end;
    begin
      update public.salas
         set estado = 'ativa', anfitriao = '33333333-3333-3333-3333-333333333333'
       where codigo = 'SALAA1A2';
      raise notice 'C4c FALHOU — cliente alterou o dono de uma sala';
    exception when others then
      raise notice 'C4c ok — update direto em salas barrado (%)', left(sqlerrm, 60);
    end;
    begin
      delete from public.jogadas where sala = 'SALAA1A2';
      raise notice 'C4d FALHOU — cliente apagou lances da mesa';
    exception when others then
      raise notice 'C4d ok — delete direto em jogadas barrado (%)', left(sqlerrm, 60);
    end;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C5 — prova positiva: os dois da mesa enxergam a mesa
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._entrar('22222222-2222-2222-2222-222222222222');
  do $$
  declare n int; s int;
  begin
    select count(*) into n from public.salas where codigo = 'SALAA1A2';
    select count(*) into s from public.jogadas where sala = 'SALAA1A2';
    if n = 1 and s >= 1 then
      raise notice 'C5 ok — o desafiante lê a própria sala e os lances dela (%/% lances)', s, s;
    else
      raise notice 'C5 FALHOU — membro não consegue ver o próprio jogo (salas=%, lances=%)', n, s;
    end if;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C6 — assento e autor quem decide é o banco, não o navegador
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._entrar('11111111-1111-1111-1111-111111111111');
  do $$
  declare feito public.jogadas;
  begin
    -- Ana (assento 0, na vez) manda um JSON pedindo o assento 1 e assinando
    -- como Bruno. O banco tem de gravar a verdade dela.
    perform public.registrar_jogada('SALAA1A2', 'duelo:acerto',
      '{"peca":"caramelo","conta":"7 + 5","tempo":"5",'
      || '"assento":1,"autor":"22222222-2222-2222-2222-222222222222"}'::jsonb);

    select * into feito from public.jogadas
     where sala = 'SALAA1A2' order by id desc limit 1;

    if feito.assento = 0 and feito.autor = '11111111-1111-1111-1111-111111111111' then
      raise notice 'C6 ok — assento/autor forjados ignorados; gravou quem realmente jogou';
    else
      raise notice 'C6 FALHOU — lance gravado com assento=% e autor=%', feito.assento, feito.autor;
    end if;

    -- Bruno tenta se anunciar como anfitrião para entregar as contas.
    begin
      perform public.registrar_jogada('SALAA1A2', 'duelo:partida',
        '{"densidade": 20, "contas": [{"txt":"2 + 2","resposta":"4","u":"numeros"}]}'::jsonb);
      raise notice 'C6b FALHOU — Bruno entregou as contas no lugar da anfitriã';
    exception when others then
      raise notice 'C6b ok — entrega de contas é do anfitrião (%)', left(sqlerrm, 60);
    end;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C7 — a vez alterna de verdade
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._entrar('11111111-1111-1111-1111-111111111111');
  do $$
  declare n int;
  begin
    -- Na montagem a vez é de Ana: o primeiro lance dela deve entrar.
    perform public.registrar_jogada('SALAA1A2', 'duelo:acerto',
      '{"peca":"bala","conta":"7 + 5","tempo":"2"}'::jsonb);
    n := pg_temp._total('jogadas', 'sala', 'SALAA1A2');
    if n = 2 then raise notice 'C7 ok — quem estava na vez jogou';
    else raise notice 'C7 FALHOU — lance da vez não entrou (total=%)', n; end if;

    -- E o segundo seguido da mesma conta não entra.
    begin
      perform public.registrar_jogada('SALAA1A2', 'duelo:acerto',
        '{"peca":"pirulito","conta":"2 + 2","tempo":"1"}'::jsonb);
      raise notice 'C7b FALHOU — a mesma conta jogou duas vezes seguidas';
    exception when others then
      raise notice 'C7b ok — turno travado: a vez agora é do outro (%)', left(sqlerrm, 60);
    end;

    -- Bruno, então, passa a vez.
    perform pg_temp._entrar('22222222-2222-2222-2222-222222222222');
    perform public.registrar_jogada('SALAA1A2', 'duelo:passada', '{"tempo":"9","motivo":"desisti"}'::jsonb);
    if pg_temp._total('jogadas', 'sala', 'SALAA1A2') = 3 then
      raise notice 'C7c ok — o outro lado jogou na vez dele';
    else
      raise notice 'C7c FALHOU — a vez não passou para o outro';
    end if;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C8 — payload malformado, gigante, tipo desconhecido, sala encerrada
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._entrar('11111111-1111-1111-1111-111111111111');
  do $$
  declare grande text;
  begin
    begin
      perform public.registrar_jogada('SALAA1A2', 'duelo:partida',
        '{"densidade": 20, "contas": [{"txt":"2 + 2","resposta":"4","u":"bobagem"}]}'::jsonb);
      raise notice 'C8 FALHOU — unidade fora das cinco da BNCC passou';
    exception when others then
      raise notice 'C8 ok — conta com unidade inválida recusada (%)', left(sqlerrm, 60);
    end;

    begin
      perform public.registrar_jogada('SALAA1A2', 'duelo:acerto', '{"peca":"x"}'::jsonb);
      raise notice 'C8b FALHOU — acerto sem conta nem tempo passou';
    exception when others then
      raise notice 'C8b ok — acerto malformado recusado (%)', left(sqlerrm, 60);
    end;

    grande := repeat('a', 70000);
    begin
      perform public.registrar_jogada('SALAA1A2', 'duelo:acerto',
        jsonb_build_object('peca', 'x', 'conta', grande, 'tempo', '1'));
      raise notice 'C8c FALHOU — um lance de 70 mil caracteres passou';
    exception when others then
      raise notice 'C8c ok — lance gigante recusado (%)', left(sqlerrm, 60);
    end;

    begin
      perform public.registrar_jogada('SALAFIM', 'duelo:passada', '{"tempo":"1"}'::jsonb);
      raise notice 'C8d FALHOU — lance aceito em sala encerrada';
    exception when others then
      raise notice 'C8d ok — sala encerrada não aceita lance (%)', left(sqlerrm, 60);
    end;

    begin
      perform public.registrar_jogada('SALAA1A2', 'duelo:qualquer-coisa', '{"tempo":"1"}'::jsonb);
      raise notice 'C8e FALHOU — tipo de lance arbitrário passou';
    exception when others then
      raise notice 'C8e ok — tipo fora da lista recusado (%)', left(sqlerrm, 60);
    end;

    begin
      perform public.registrar_jogada('SALAA1A2', 'duelo:acerto', '"texto solto"'::jsonb);
      raise notice 'C8f FALHOU — um lance que não é objeto passou';
    exception when others then
      raise notice 'C8f ok — lance precisa ser objeto (%)', left(sqlerrm, 60);
    end;

    if pg_temp._total('jogadas', 'sala', 'SALAA1A2') = 1 then
      raise notice 'C8g ok — nenhuma das tentativas deixou rastro no banco';
    else
      raise notice 'C8g FALHOU — alguma tentativa proibida gravou linha';
    end if;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C9 — mesa cheia e código errado respondem igual (sem oráculo)
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._entrar('33333333-3333-3333-3333-333333333333');
  do $$
  declare cheia text; vazio text;
  begin
    begin perform public.entrar_na_sala('SALAA1A2'); cheia := '(aceitou!)';
    exception when others then cheia := sqlerrm; end;
    begin perform public.entrar_na_sala('NAOEXISTE'); vazio := '(aceitou!)';
    exception when others then vazio := sqlerrm; end;

    if cheia = vazio then
      raise notice 'C9 ok — sala cheia e código inexistente devolvem o mesmo texto';
    else
      raise notice 'C9 FALHOU — a resposta distingue sala cheia de sala inexistente '
        '(serve para enumerar): "%" vs "%"', left(cheia, 40), left(vazio, 40);
    end if;

    begin
      perform public.encerrar_sala('SALAA1A2');
      raise notice 'C9b FALHOU — estranho encerrou a mesa dos outros';
    exception when others then
      raise notice 'C9b ok — encerrar_sala() exige participação (%)', left(sqlerrm, 60);
    end;
    begin
      perform public.sair_da_sala('SALAA1A2');
      raise notice 'C9c FALHOU — estranho saiu de uma mesa onde nunca sentou';
    exception when others then
      raise notice 'C9c ok — sair_da_sala() também exige participação';
    end;
    if pg_temp._total('salas', 'estado', 'ativa') = 1 then
      raise notice 'C9d ok — as tentativas não mudaram o estado de sala nenhuma';
    else
      raise notice 'C9d FALHOU — o estado de alguma sala foi tocado por quem não joga nela';
    end if;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C10 — progresso: vinculados leem, só o dono escreve
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._entrar('44444444-4444-4444-4444-444444444444');
  do $$
  declare n int;
  begin
    select count(*) into n from public.progressos where codigo_crianca = 'PINPOIN01';
    if n = 0 then raise notice 'C10 ok — sem vínculo, sem boletim';
    else raise notice 'C10 FALHOU — estranho leu o progresso de outra criança'; end if;

    begin
      insert into public.progressos (codigo_crianca, dados)
        values ('PINPOIN01', '{"estrelas": 999}'::jsonb)
        on conflict (codigo_crianca) do update set dados = excluded.dados;
      raise notice 'C10b FALHOU — estranho reescreveu o progresso alheio';
    exception when others then
      raise notice 'C10b ok — escrita de progresso é do dono (%)', left(sqlerrm, 60);
    end;

    begin
      perform public.vincular_por_codigo('pinpoin01');  -- minúsculas: o banco normaliza
      raise notice 'C10c ok — vincular por código aceita a forma que o aparelho mostra';
    exception when others then
      raise notice 'C10c FALHOU — o vínculo por um código válido foi recusado: %', left(sqlerrm, 60);
    end;

    select count(*) into n from public.progressos where codigo_crianca = 'PINPOIN01';
    if n = 1 then raise notice 'C10d ok — vinculado por código passa a ler o boletim';
    else raise notice 'C10d FALHOU — vínculo criado e a leitura continua vazia'; end if;

    -- RLS não erro para UPDATE sem permissão: ela simplesmente não mexe em
    -- linha nenhuma. O que importa é o número de linhas afetadas.
    update public.progressos set dados = '{"estrelas": 1}'::jsonb
      where codigo_crianca = 'PINPOIN01';
    get diagnostics n = row_count;
    if n = 0 then
      raise notice 'C10e ok — vínculo dá leitura, não reescrita (0 linhas alteradas)';
    else
      raise notice 'C10e FALHOU — quem foi vinculado reescreveu o progresso';
    end if;

    delete from public.criancas where codigo = 'PINPOIN01';
    get diagnostics n = row_count;
    if n = 0 then
      raise notice 'C10f ok — apagar a criança é só do dono (0 linhas apagadas)';
    else
      raise notice 'C10f FALHOU — um vinculado apagou a criança alheia';
    end if;

    if pg_temp._total('progressos', 'codigo_crianca', 'PINPOIN01') = 1 then
      raise notice 'C10g ok — o boletim continua intacto, do jeito que a dona o deixou';
    else
      raise notice 'C10g FALHOU — os dados da criança foram tocados';
    end if;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C11 — adivinhação de código de criança é cortada por hora
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._entrar('44444444-4444-4444-4444-444444444444');
  do $$
  declare i int; travado boolean := false; texto text := '';
  begin
    for i in 1 .. 12 loop
      begin
        perform public.vincular_por_codigo('XXXXXX' || lpad(i::text, 2, '0'));
      exception when others then
        texto := sqlerrm;
        if texto like '%muitas tentativas%' then travado := true; exit; end if;
      end;
    end loop;
    if travado then
      raise notice 'C11 ok — enumerar códigos foi cortado na tentativa % (%)', i, left(texto, 50);
    else
      raise notice 'C11 FALHOU — 12 tentativas de código seguidas sem nenhuma trava';
    end if;

    begin
      perform public.vincular_por_codigo('código errado com acento e espaço');
      raise notice 'C11b FALHOU — um formato impossível passou pela validação';
    exception when others then
      raise notice 'C11b ok — formato conferido antes de procurar (%)', left(sqlerrm, 50);
    end;

    begin
      perform public.vincular_por_codigo('1');
      raise notice 'C11c FALHOU — um código de um caractere chegou à busca';
    exception when others then
      raise notice 'C11c ok — comprimento mínimo aplicado (%)', left(sqlerrm, 50);
    end;

    if pg_temp._total('vinculos', 'responsavel',
       '44444444-4444-4444-4444-444444444444') = 0 then
      raise notice 'C11d ok — nenhuma tentativa errada criou vínculo';
    else
      raise notice 'C11d FALHOU — alguma tentativa de adivinhação deu vínculo';
    end if;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C12 — dono não transfere a própria criança por UPDATE
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._entrar('11111111-1111-1111-1111-111111111111');
  do $$
  begin
    begin
      update public.criancas
         set responsavel_id = '33333333-3333-3333-3333-333333333333'
       where codigo = 'PINPOIN01';
      raise notice 'C12 FALHOU — a criança mudou de dono por edição';
    exception when others then
      raise notice 'C12 ok — guarda de integridade impede transferir a criança (%)', left(sqlerrm, 60);
    end;
    begin
      update public.criancas set codigo = 'OUTROCOD' where codigo = 'PINPOIN01';
      raise notice 'C12b FALHOU — o código da criança foi trocado';
    exception when others then
      raise notice 'C12b ok — código da criança é imutável (%)', left(sqlerrm, 60);
    end;
    begin
      update public.progressos set codigo_crianca = 'OUTROCOD' where codigo_crianca = 'PINPOIN01';
      raise notice 'C12c FALHOU — o progresso mudou de criança';
    exception when others then
      raise notice 'C12c ok — progresso não muda de dono (%)', left(sqlerrm, 60);
    end;
    if pg_temp._total('criancas', 'codigo', 'PINPOIN01') = 1 then
      raise notice 'C12d ok — o registro original continua no lugar';
    else
      raise notice 'C12d FALHOU — a tentativa de transferência bagunçou o cadastro';
    end if;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C13 — exclusão: cada conta apaga só o que é dela
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._entrar('33333333-3333-3333-3333-333333333333');
  do $$
  begin
    perform public.apagar_meus_registros();

    if pg_temp._total('criancas', 'codigo', 'PINPOIN01') = 1 then
      raise notice 'C13 ok — apagar-se não encosta na criança de outra conta';
    else
      raise notice 'C13 FALHOU — a criança de outra conta desapareceu';
    end if;

    if pg_temp._total('progressos', 'codigo_crianca', 'PINPOIN01') = 1 then
      raise notice 'C13b ok — o boletim da outra conta ficou inteiro';
    else
      raise notice 'C13b FALHOU — apagar um estranho levou progresso junto';
    end if;

    if pg_temp._total('perfis', 'id', '33333333-3333-3333-3333-333333333333') = 0 then
      raise notice 'C13c ok — o estranho apagou a si mesmo';
    else
      raise notice 'C13c FALHOU — apagar_meus_registros() não removeu o próprio perfil';
    end if;

    if pg_temp._total('salas', 'codigo', 'SALAA1A2') = 1 then
      raise notice 'C13d ok — a mesa em que ele não jogava continua lá';
    else
      raise notice 'C13d FALHOU — a exclusão própria derrubou uma sala alheia';
    end if;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C14 — abrir e sentar pelas portas autorizadas (prova positiva)
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._entrar('22222222-2222-2222-2222-222222222222');
  do $$
  declare aberta record; cadeira int; adves text; viu int;
  begin
    select * into aberta from public.criar_sala();
    if aberta.codigo is null or char_length(aberta.codigo) <> 8 then
      raise notice 'C14 FALHOU — sala criada com código "%"', coalesce(aberta.codigo, 'nulo');
    elsif aberta.assento <> 0 then
      raise notice 'C14 FALHOU — quem abriu a sala recebeu o assento %', aberta.assento;
    else
      if pg_temp._total('salas', 'codigo', aberta.codigo) = 1 then
        raise notice 'C14 ok — criar_sala() devolve 8 caracteres e grava o dono real';
      else
        raise notice 'C14 FALHOU — a sala apareceu para o chamador mas não no banco';
      end if;
    end if;

    -- O que senta do outro lado recebe o apelido, nunca o e-mail ou o uuid.
    perform pg_temp._entrar('11111111-1111-1111-1111-111111111111');
    select e.assento, e.adversario into cadeira, adves
      from public.entrar_na_sala(aberta.codigo) e;
    if adves = 'Bruno' and cadeira = 1 then
      raise notice 'C14b ok — o adversário aparece como apelido, assento %', cadeira;
    else
      raise notice 'C14b FALHOU — entrou e recebeu "%" no assento %', adves, cadeira;
    end if;

    -- Bruno entrou na sala nova; a sala esperando de Ana continua fora do
    -- radar dele.
    perform pg_temp._entrar('22222222-2222-2222-2222-222222222222');
    select count(*) into viu from public.salas where codigo = 'SALAESP';
    if viu = 0 then
      raise notice 'C14c ok — Bruno vê a mesa dele e nada além dela';
    else
      raise notice 'C14c FALHOU — Bruno enxerga a sala de outra mesa';
    end if;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C15 — ninguém enxerga mais mesas do que as próprias
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  select pg_temp._entrar('11111111-1111-1111-1111-111111111111');
  do $$
  declare todas int; minhas int;
  begin
    select count(*) into todas from public.salas;
    select count(*) into minhas from public.salas
     where anfitriao = '11111111-1111-1111-1111-111111111111'
        or desafiante = '11111111-1111-1111-1111-111111111111';
    if minhas = todas and minhas = 3 then
      raise notice 'C15 ok — Ana vê exatamente as % mesas em que joga', minhas;
    else
      raise notice 'C15 FALHOU — leitura desalinhada da participação (% de %)', minhas, todas;
    end if;

    perform pg_temp._entrar('22222222-2222-2222-2222-222222222222');
    select count(*) into todas from public.salas;
    if todas = 1 then
      raise notice 'C15b ok — Bruno vê só a mesa dele (1 de 3)';
    else
      raise notice 'C15b FALHOU — Bruno vê % salas', todas;
    end if;
  end $$;
rollback;

-- ════════════════════════════════════════════════════════════
--  C16 — uma segunda conta na mesma mesa ativa é recusada
-- ════════════════════════════════════════════════════════════
begin;
  select pg_temp._montar();
  -- Ana tenta sentar na própria sala: o anfitrião não é o desafiante.
  select pg_temp._entrar('11111111-1111-1111-1111-111111111111');
  do $$
  declare antes int;
  begin
    antes := pg_temp._total('salas', 'codigo', 'SALAESP');
    begin
      perform public.entrar_na_sala('SALAESP');
      raise notice 'C16 FALHOU — o anfitrião sentou na própria sala como desafiante';
    exception when others then
      raise notice 'C16 ok — criar sala não dá o segundo lugar nela (%)', left(sqlerrm, 50);
    end;
    if pg_temp._total('salas', 'codigo', 'SALAESP') = antes then
      raise notice 'C16b ok — a sala esperando continua esperando, sem dono novo';
    else
      raise notice 'C16b FALHOU — a recusa mexeu na sala';
    end if;
  end $$;
rollback;

-- Fim. Nada foi commitado: cada rollback desfaz as contas, salas, lances e
-- vínculos de teste. Se alguma linha disser FALHOU, o buraco está na política
-- ou na função correspondente — conserte o schema, reaplique, rode outra vez.
-- Depois de aplicar o schema num banco novo, rode este arquivo e cole a saída
-- em RELATORIO-TESTES.md.
