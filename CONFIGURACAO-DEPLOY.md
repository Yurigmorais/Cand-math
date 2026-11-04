# Configuração de publicação — Candy Math

Vercel, Supabase e Fish Audio AI, na ordem em que fazem sentido. Data: 30/10/2026.

**Nada aqui foi executado numa conta real.** Este arquivo descreve o que está no
repositório e o que o dono precisa fazer, com os comandos exatos. Nenhuma chave,
domínio ou valor de projeto foi inventado — onde falta um valor, está escrito que
falta.

O jogo funciona sem este arquivo inteiro: aberto no navegador, ele roda 100% no
aparelho. A nuvem é opcional, e a voz por IA é opcional dentro da nuvem.

---

## 0. Pré-requisitos

| para | o que precisa |
|---|---|
| só jogar | navegador e os arquivos da pasta. Node não é necessário |
| rodar a suíte de testes | Node 20+ (isto foi desenvolvido em 24.15.0). Sem `npm install`: zero dependências de execução |
| nuvem (contas, vínculo, boletim lido de outro aparelho) | conta no Supabase (plano gratuito basta) |
| voz por IA | conta na Vercel **e** chave de API da Fish Audio |
| duelo em rede | tudo acima, mais os dois testes de autorização passando (item 4) |

---

## 1. Supabase

1. Criar o projeto em `supabase.com` (região próxima de quem joga).
2. **SQL Editor → colar o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) → Run.**
   O arquivo é idempotente: pode rodar de novo. Ele cria `perfis`, `criancas`,
   `vinculos`, `progressos`, `salas`, `jogadas`, `tentativas_vinculo` e
   `narracoes` (o cache do áudio da narração), liga o RLS nas oito tabelas, cria as
   17 políticas, as funções RPC, os gatilhos de integridade e entra `jogadas` na
   publicação do Realtime. No fim, cria também o bucket privado `narracoes` —
   em Postgres puro este passo passa direto, porque a tabela de buckets não existe
   lá ([schema.sql:994-1003](supabase/schema.sql#L994)).
3. **Se (e somente se) o projeto já tinha o schema da versão 3.0**, rodar também
   [`supabase/migrations/00001_endurecer_autorizacao_salas.sql`](supabase/migrations/00001_endurecer_autorizacao_salas.sql).
   Ela desfaz as quatro políticas permissivas antigas e **recria `salas` e
   `jogadas`**. O que se perde: linhas de salas abertas e lances em andamento —
   estado transitório, sem dado pessoal, com validade de um dia. Nenhuma outra
   tabela é tocada, e o arquivo termina com um `SELECT` de verificação que deve
   devolver zero linhas. Projeto novo: pule, o schema já nasce endurecido.
4. **Se o banco já estava aplicado antes de existir o cache de narração**, rodar
   [`supabase/migrations/00002_cache_narracao.sql`](supabase/migrations/00002_cache_narracao.sql).
   Diferente da anterior, esta é adição pura: nenhuma tabela existente é tocada e
   nenhuma linha é apagada. Ela cria `narracoes`, as duas funções de poda e de uso
   e o bucket privado. Termina com um `SELECT` de conferência que deve devolver
   **zero linhas**. Projeto novo: pule — o item 2 já cria tudo isso.
5. **Project Settings → API**: copiar **Project URL** e **anon public key**. São os
   dois únicos valores que entram em `config.js`. A `service_role` não entra em
   arquivo nenhum do navegador: ela serve à rotina de purga da seção 6 e, agora, à
   função de voz — é com ela que `api/voz.js` lê e escreve o cache de áudio. Vai
   para a Vercel como segredo (item 3) e para mais lugar nenhum.
6. **Authentication → Providers → Email**: deixar habilitado.
7. **Authentication → URL configuration**: **Site URL** = o endereço público do jogo
   (ex.: `https://SEU-PROJETO.vercel.app`), para o link de confirmação voltar para a
   mesma página. Enquanto o jogo não estiver publicado, use `http://127.0.0.1:8765`
   e lembre de trocar depois.
8. **Redirect URLs**: adicionar o mesmo endereço, com e sem `/index.html`.
9. **SMTP**: o envio de e-mail pelo Supabase tem cota baixa no plano gratuito. Para
   produção escolar, configurar SMTP próprio em *Authentication → SMTP*. **Pendente
   do dono** — não há como testar daqui, e sem e-mail a verificação não chega.

Com 1 a 8 feitos e `config.js` preenchido, a nuvem acende sozinha: o jogo detecta,
cria o cliente e mostra o painel de conexão. Com `config.js` vazio, nada é pedido.

A verificação de e-mail é tratada como o que ela é: **sem o clique no link, o jogo
avisa que a conta existe mas não está verificada, e não sincroniza nada.** O cadastro
do adulto e o vínculo com a criança dependem dessa confirmação — e um checkbox de
"li e aceito" no jogo não é prova de responsabilidade legal; ver
`privacidade.html`, seção 5.

---

## 2. `config.js` — os únicos campos que o navegador lê

```js
root.CM_CONFIG = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',   // linha 1
  supabaseAnonKey: 'colA Publica',                  // linha 2
  supabaseJs: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
  dueloRedeHabilitado: false,                       // deixe false até o item 4
  varreduraSalaMs: 900,
  atrasoSubidaMs: 2500,
  narracao: { endpoint: '/api/voz', preferencia: 'peixe', maximoCaracteres: 320,
              vozes: [ {id:'sara',…}, {id:'bruna',…}, {id:'miguel',…}, {id:'evelyn',…} ] },
};
```

Este arquivo é texto público no repositório. Só a anon key vai nele. A chave do Fish
Audio **nunca** entra aqui — ela mora na Vercel.

`narracao.vozes[].id` é a única coisa que o navegador pode pedir; o `reference_id`
da plataforma vive só em [api/_voz-nucleo.js:31-34](api/_voz-nucleo.js#L31), e um
confere que as duas listas batem (`testes/testar-narracao.js`).

---

## 3. Vercel

1. **Add New → Project → Import** da pasta `Candy-Math-main` (Git ou `npx vercel`).
2. Framework: **Other**. O [vercel.json](vercel.json) já declara
   `framework: null`, `buildCommand: ""`, `outputDirectory: "."`, `cleanUrls: true`,
   rewrite de `/` para `/index.html` e os cabeçalhos de cache e segurança. Não há
   variável de build: o projeto é estático.

   Um efeito de publicar a raiz inteira: `supabase/schema.sql`,
   `testes/testar-rls.sql` e os documentos de auditoria ficam em endereço público.
   Não há segredo nesses arquivos (é o que `testes/testar-segredos.js` confere), mas
   a lógica de autorização e os cenários de teste ficam legíveis. Se isso não for
   aceitável, gere um `dist/` com os arquivos do navegador e aponte
   `outputDirectory` para ele — as três saídas estão descritas em `SEGURANCA.md`,
   item 11.
3. **Settings → Environment Variables** (Production e Preview, escopo *Sensitive*
   nas secretas, **"Exposed to the Browser" desmarcado em todas**):

| variável | onde é lida | obrigatória | o que faz |
|---|---|---|---|
| `FISH_AUDIO_API_KEY` | `api/voz.js` | para a voz por IA funcionar | sem ela a função devolve 503 e o jogo usa a voz do aparelho |
| `FISH_AUDIO_MODELO` | idem | não | default `s2.1-pro-free` (rota de custo zero descrita pela plataforma em 30/10/2026 — **confira o custo no seu painel antes de confiar**) |
| `FISH_AUDIO_MAX` | idem | não | teto de caracteres por frase (default 320, faixa 8–2000) |
| `FISH_AUDIO_POR_HORA` | idem | não | teto de chamadas por IP por hora (default 240) |
| `CM_ORIGENS` | idem | recomendado | origens separadas por vírgula autorizadas a chamar a função de outro lugar; **sem ela, POSTs de outras origens são aceitos e gastam cota** (a resposta continua protegida por CORS) |
| `SUPABASE_URL` | idem | para o cache de áudio | Project URL do mesmo projeto do `config.js`, **sem barra no fim**. A função confere o padrão `https://<projeto>.supabase.co` (ou `.in`) e recusa qualquer outro endereço: sem isso ela viraria encaminhador para o servidor que a variável apontar |
| `SUPABASE_SERVICE_ROLE_KEY` | idem | para o cache de áudio | a única chave deste projeto que escreve em `public.narracoes` e no bucket privado. É segredo pesado — bypassa o RLS — e por isso mora aqui, não em `config.js`. **Sem as duas, o cache fica desligado e a função fala direto com a Fish Audio, exatamente como antes** |
| `CM_CACHE_TETO` | idem | não | quantas frases ficam guardadas antes da poda das menos usadas (default 6000) |
| `CM_CACHE` | idem | não | `off` desliga o cache com as chaves no ar — o interruptor de quem quer medir a diferença ou conter um problema no banco sem tocar na chave de síntese |

   `SUPABASE_URL` e `SUPABASE_ANON_KEY` continuam sendo o que o **navegador** lê,
   por `config.js`: o que a função serverless precisa é `SUPABASE_URL` de novo
   (valor público, repetido à parte por clareza) mais a `service_role`. A anon key
   não vai para a Vercel — ela não conseguiria escrever no cache, e é melhor que a
   função precise de uma chave que o navegador não tem.
4. A função é descoberta sozinha: `api/voz.js` vira `POST /api/voz`. Nada de
   `functions` extra no `vercel.json`. Runtime Node padrão da Vercel serve; o
   arquivo é CommonJS puro, sem dependência externa.

   **Isto não foi verificado em hospedagem real** — nenhuma publicação saiu
   desta máquina. A regra de decisão no primeiro preview: se o site abre, a
   home responde e `curl -I .../api/voz` devolve **405** (o método certo é
   POST) ou **503** (sem chave), a função foi descoberta e o `vercel.json`
   está certo. Se devolver **404** enquanto o resto do site vive, o par
   `buildCommand: ""` + `outputDirectory: "."` não está deixando a pasta `api/`
   entrar como função — tire essas duas linhas do `vercel.json` (presets
   estáticos da Vercel servem a raiz do projeto e descobrem `api/` sem
   configuração) e publique de novo. Os cabeçalhos e as rewrites continuam
   válidos nos dois caminhos.
5. **Primeira conferência depois do deploy:**

```bash
curl -I https://SEU-PROJETO.vercel.app/
#   Content-Security-Policy deve trazer script-src 'self' https://cdn.jsdelivr.net
#   (sem 'unsafe-inline' de script), X-Frame-Options: DENY, Referrer-Policy: no-referrer,
#   Permissions-Policy com câmera/microfone/localização desligados.
curl -I https://SEU-PROJETO.vercel.app/privacidade.html   # Cache-Control: no-cache
curl -s -X POST https://SEU-PROJETO.vercel.app/api/voz -H 'content-type: application/json' \
     -d '{"texto":"Quanto é 2 mais 2?","voz":"sara"}' -o /dev/null -w '%{http_code}\n'
#   200 com áudio (chave certa) · 503 sem chave · 400 voz/texto inválidos · 429 no teto
```

### Preview e produção

- Push de branch → **deployment de preview** (URL `https://<hash>-seu-projeto.vercel.app`).
  É aí que se confere visual, a11y e a função de voz antes de mexer em produção.
- Push em `main` (ou `--prod`) → produção.
- **Cada environment precisa do seu Site URL no Supabase** (item 1.6) se você for usar
  o link de confirmação de e-mail no preview também.
- O `config.js` é versionado: ao trocar os valores de nuvem, é commit — e a anon key
  vai junto, o que é aceitável **só** porque o RLS é quem guarda os dados. Se um dia
  houver segredo no front, isso muda de figura.

---

## 4. Ligar o duelo em rede (só depois disto)

O padrão é `dueloRedeHabilitado: false`. Não é timidez: a autorização nova nunca foi
executada contra um Postgres real.

1. Itens 1 a 3 acima feitos no SEU projeto.
2. Rodar [`testes/testar-rls.sql`](testes/testar-rls.sql) no SQL Editor do Supabase.
   São 16 cenários (C1–C16) de teste positivo **e** negativo: anon lendo, anon
   chamando RPC, conhecer o código sem ser membro, escrita direta mesmo do anfitrião,
   leitura legítima de membro, assento/autor forjados ignorados, alternância de vez,
   payload malformado/gigante/tipo desconhecido/sala encerrada, resposta idêntica para
   sala cheia e sala inexistente, semântica de vínculo e progresso, teto de tentativas,
   transferência de dono, autoexclusão sem tocar nos outros, `criar_sala`/`entrar_na_sala`
   e visibilidade por conta. **Todo resultado precisa dizer `ok`.**
3. Criar três contas de teste no próprio projeto e rodar:

```bash
cp .env.example .env            # preencha SUPABASE_URL, ANON_KEY e CM_TESTE_{1,2,3}_{EMAIL,SENHA}
node testes/testar-autorizacao.js
```

   Sem credenciais ele imprime `NÃO EXECUTADO — faltam credenciais de teste. Nada foi
   provado aqui.` e sai 0 — ausência de prova, não sucesso.
4. Aí sim trocar `dueloRedeHabilitado` para `true`, com o registro de quem rodou,
   quando e com que resultado em `AUDITORIA.md`.

O portão do navegador ([nuvem.js:81](nuvem.js#L81)) é conferido em 12 portas de rede
pelo teste A0, que roda sem credenciais. Tirar o bloqueio "para testar" está fora de
questão: o `testar-autorizacao.js` falha se `config.js` for entregue com o duelo
ligado.

---

## 5. Fish Audio AI

1. `fish.audio → Developer → API Keys` → criar a chave → guardar como
   `FISH_AUDIO_API_KEY` na Vercel (Sensitive). **Nunca** em `config.js`, em HTML, em
   JS de navegador ou em log.
2. As quatro vozes da tela (`Sara`, `Bruna`, `Miguel`, `Evelyn`) foram conferidas em
   30/10/2026 contra o catálogo público (`GET https://api.fish.audio/model?title=<nome>&language=pt`),
   escolhendo a correspondência exata de título: SARA (137 usos), Bruna (2661),
   Miguel (308), Evelyn (60). **São vozes da comunidade, não oficiais** — podem
   mudar de nome ou sair do ar, e a leitura de números em português só se confirma
   ouvindo.
3. **Obrigar-se a ouvir antes de publicar:** abrir o jogo no preview, ir em **Voz**,
   escolher cada uma das quatro e tocar o botão "Testar". Se alguma não servir,
   crie a sua voz no painel da Fish e troque **nas duas listas** — `config.js` (id +
   rótulo) e `VOZES` em `api/_voz-nucleo.js` (id + `reference_id`). O teste
   `testar-narracao.js` confere que as duas continuam batendo.
4. Arquitetura (não mude sem ler `SEGURANCA.md`): navegador → `POST /api/voz` com
   `{texto, voz}` → função serverless → `https://api.fish.audio/v1/tts` com a chave.
   O `modelo` é decisão do servidor. Nenhum dado pessoal, identidade, código ou
   progresso sai do aparelho além da frase da pergunta.
5. Preferências: `'peixe'` (tenta a API e cai para a voz do aparelho), `'aparelho'`
   (nunca sai do navegador) e `'desligada'`. Em `file://`, offline, ou sem função
   publicada, a tela desliga a opção de IA e explica o motivo em vez de mostrar botão
   que só falha. Quem escolhe fica no `localStorage` (`candymath_voz_v1`), não no
   banco.
6. **Custo:** `FISH_AUDIO_POR_HORA` e `FISH_AUDIO_MAX` são os freios. O contador é
   por instância (memória), então o teto efetivo sobe com o escalonamento — risco
   registrado em `SEGURANCA.md`, item 8.
7. **Cache de áudio no Supabase (o que ele realmente economiza).** Ligando
   `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, a função passa a procurar a frase
   na tabela `public.narracoes` antes de chamar a Fish Audio, e grava o resultado
   depois de sintetizar. O navegador não vê nada disso: continua um `POST /api/voz`
   recebendo `audio/mpeg` com `no-store`, e o CSP não muda uma linha.

   Medido neste repositório (180.000 perguntas geradas com os geradores reais):
   **82.671 frases distintas**, ou seja, ~54% de repetição no geral, variando por
   célula — 1º ano entre 53% e 77%, e células como 5º ano nv1 em 11% porque o
   espaço de números é grande. Cada (ano, nível) fechado produziu entre ~700 e
   ~4.400 frases em 5.000 desenhos, e os 311 itens escritos + 96 afirmações do
   banco autoral repetem 100%. Tradução prática: **as séries iniciais e as frases
   fixas (regras, feedbacks, "a resposta está brilhando") são o ganho; contas
   grandes com decimais são o desperdício.** O `CM_CACHE_TETO` existe para o
   desperdício não expulsar o ganho.

   Com o modelo gratuito (`s2.1-pro-free`), o que se economiza é **latência e cota
   de fair use**, não dinheiro. O que passa a custar é armazenamento e tráfego: a
   estimativa é ~130 KB por frase em mp3, então um teto de 6.000 frases ocupa ordem
   de 780 MB dos 1 GB gratuitos do Storage, e reproduzir a frase baixada do bucket
   conta no egress do Supabase (2 GB/mês no plano gratuito ≈ 15 mil frases servidas
   por mês). **Estimativa, não medição** — o tamanho real só se confirma ouvindo a
   primeira frase com a chave publicada; confira o painel antes de subir o teto.
8. **Conferir que o cache pegou.** SQL Editor:
   `select voz, count(*) as frases, sum(usos) as audições, max(visto_em) from
   public.narracoes group by voz;` — linha aparecendo é frase guardada. Se a
   tabela nascer mas ficar vazia, a escrita está falhando (permissão no bucket,
   chave errada) e a função continua funcionando: ela só não guarda. Para ver o
   contrário, `select purgar_narracoes(1, 10);` derruba as dez menos usadas.
   O navegador nunca lê esta tabela: RLS ligado sem política nenhuma é "nega
   tudo", e o `revoke all ... from anon, authenticated` é a segunda fechadura.

---

## 6. Rotina de limpeza de salas (pendente de agendamento)

`purgar_salas_velhas()` apaga salas com mais de um dia, junto com suas jogadas, e é
executável **apenas por `service_role`** ([schema.sql:834](supabase/schema.sql#L834)).
Nada neste repositório a chama — não há cron configurado, e uma função com a
`service_role` não pode morar no navegador.

Duas saídas, ambas decisão do dono:

```sql
-- (a) no projeto Supabase, com pg_cron habilitado:
select cron.schedule('cm-purga-salas', '17 4 * * *',
  $$ select public.purgar_salas_velhas() $$);
```

```js
// (b) Vercel Cron chamando uma rota própria, com a service_role como segredo de
// servidor (vercel.json com "crons") — exige criar a rota e NUNCA expor a chave.
```

Sem agendamento, o efeito é tolerável: as linhas de salas ficam paradas, o RLS não
deixa ninguém lê-las, e o armazenamento cresce devagar. Registrar como débito, não
como funcionando.

---

## 7. Checklist de publicação

- [ ] `npm test` verde na máquina de quem publica (os cinco itens pendentes da tabela
      final de `RELATORIO-TESTES.md` continuam pendentes até serem rodados por gente).
- [ ] `npm start` + `node testes/auditar-layout.js` e `--prova` antes do push.
- [ ] Schema aplicado no Supabase (e migração 00001, se o banco era da 3.0).
- [ ] Site URL e Redirect URLs apontando para o endereço publicado.
- [ ] SMTP configurado (senão a verificação de e-mail não chega em produção).
- [ ] `config.js` com URL e anon key; `dueloRedeHabilitado: false`.
- [ ] Variáveis secretas na Vercel, *Sensitive*, sem "Exposed to the Browser".
- [ ] `curl -I` confirmando CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- [ ] Ouvir as quatro vozes no preview (item 5.3).
- [ ] Preencher os campos de controlador em `privacidade.html` (hoje marcados "a
      preencher") **com revisão de quem responde pela base legal** — isto não é
      conformidade automática.
- [ ] Testar num aparelho de verdade: telefone, toque, leitor de tela.
- [ ] Rotina de purga agendada (item 6).

## 8. Reversão

- Jogo: o deploy anterior fica disponível na Vercel (Promote/Rollback na lista de
  deployments). Nada no aparelho do jogador precisa ser desfeito.
- Banco: o `schema.sql` é idempotente e as políticas têm nome — para reverter uma
  regra, `drop policy <nome> on public.<tabela>;` e reapply. **Não rode `drop table`**
  em `perfis`/`criancas`/`vinculos`/`progressos`: são os dados de quem joga.
- Voz: deixar `FISH_AUDIO_API_KEY` ausente derruba a rota para 503, e o jogo cai
  sozinho para a voz do aparelho. Nenhuma mudança de código é necessária para
  desligar a IA.
- Duelo: `dueloRedeHabilitado: false` devolve o jogo ao modo local na hora, sem
  perder estrelas, nível nem histórico.
