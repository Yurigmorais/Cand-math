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
   lá ([schema.sql:1006-1016](supabase/schema.sql#L1006)).
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
5. **Project Settings → API Keys**: copiar **Project URL** e **Publishable key** (o
   painel antigo chama isso de **anon public key**; o papel é `anon` nos dois). São os
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

0. **Do repositório para o GitHub** (o caminho escolhido; só funciona com a sua
   identidade, porque é login na sua conta):

   1. `github.com → Settings → SSH and GPG keys → New SSH key` e cole o conteúdo de
      `~/.ssh/id_ed25519_github.pub` (a chave privada nunca sai da máquina).
   2. O repositório. Com um repositório **vazio** — `github.com/new`, sem README,
      sem `.gitignore`, sem licença — o push vai direto no `main`:

      ```bash
      git remote add origin git@github.com:SEU-USUARIO/SEU-REPO.git
      git push -u origin main
      ```

      Privado ou público tanto faz — o `config.js` só carrega valores públicos, e é
      o que `testes/testar-segredos.js` garante a cada `npm test`.

   **O que aconteceu de verdade com o `Yurigmorais/Cand-math`.** Ele já existia e
   tinha 14 commits num formato diferente do nosso: um projeto Vite/Capacitor, com
   `src/engine/`, `src/games/`, `capacitor.config.ts` e as artes em
   `public/assets/images/*.jpg` — 97 arquivos contra os nossos 42, sem nenhum
   ancestral em comum (`git merge-base main origin/main` não devolve nada). O
   `git push -u origin main` é recusado, e tudo faz parecer que a única saída é
   reescrever o `main` alheio com `--force`. Não é. Existe um caminho que casa as
   duas histórias sem apagar nada:

   ```bash
   git push origin c37fa09:refs/heads/arquivo-vite-antigo          # rede de segurança
   git merge -s ours origin/main --allow-unrelated-histories       # árvore = a nossa
   git push origin main:main                                       # sem --force
   ```

   `-s ours` é a estratégia de merge que registra os dois lados na história e escolhe
   uma única árvore — a do commit de origem, a nossa. Depois dela, o
   `git diff 8944acd HEAD` no topo é vazio: os 42 arquivos são byte a byte os mesmos
   que passaram nos testes. E como o `c37fa09` antigo virou **pai** do merge, o
   `main` avança por fast-forward de grafo e o GitHub aceita sem força.

   Estado do repositório hoje: `main` = o jogo com voz e cache; `voz-supabase` = o
   mesmo commit; `arquivo-vite-antigo` = os 14 commits da era Vite, com as artes em
   `public/assets/` intactas. Para recuperar um arquivo de lá,
   `git checkout arquivo-vite-antigo -- public/assets/images/jaguar.jpg` — ou
   `git log main -- src/main.js` mostra a história antiga sem sair do `main`.

   O `.env` fica de fora por construção: está no `.gitignore`, não aparece entre os
   42 arquivos rastreados, e `git ls-files --error-unmatch .env` responde que o
   arquivo não é acompanhado. Depois do push, a Vercel lê o repositório — não a
   pasta local.
1. **Add New → Project → Import** do repositório que você acabou de empurrar (ou da
   pasta `Candy-Math-main`, via `npx vercel`). No import, a Vercel pergunta **em qual
   branch ela publica**: aqui é o `main`, que já é o jogo com voz e cache. Confira
   essa linha antes de apertar *Deploy* — publicar a branch errada dá um site que
   funciona e não fala, porque o `api/voz.js` e o cache não estão nela. Depois,
   `Settings → Environment Variables` tem um botão *Edit Production Branch* para
   trocar isso sem reimportar.
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

### O estado publicado em 04/11/2026

Produção: **https://candy-math-eight.vercel.app** — projeto `equaldiagra/candy-math`,
framework *Other*, raiz e saída `.`, região `iad1`. O repositório
`Yurigmorais/Cand-math` está **conectado** ao projeto, então `git push` no `main`
gera deploy sozinho; o primeiro estado veio de `npx vercel deploy --prod` feito da
máquina, depois de um `vercel login` por código de dispositivo (a identidade é sua;
a CLI só recebeu o token no fim).

| variável | ambiente | tipo | estado |
|---|---|---|---|
| `FISH_AUDIO_API_KEY` | Production + Preview | Secret | **no ar** — lida do `.env` por `vercel env add`, sem nunca passar pela tela |
| `CM_ORIGENS` | Production | Config | **no ar** — `https://candy-math-eight.vercel.app` |
| `SUPABASE_URL` | — | — | **pendente**: o endereço do projeto que está em `config.js` e no `.env` não existe (veja o bloco abaixo) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Secret | **pendente**: só você tem; digite-a na Vercel, nunca aqui |
| `FISH_AUDIO_MODELO`, `FISH_AUDIO_MAX`, `FISH_AUDIO_POR_HORA` | — | — | não postas de propósito: os padrões do código valem (`s2.1-pro-free`, 320, 240/h) |

**O Project URL precisa ser copiado do painel.** `jomezruaohlgvqizcsdf.supabase.co`
e a variante `.supabase.in` foram consultados por DNS-over-HTTPS no Cloudflare e
pelo navegador: os dois devolvem *NXDOMAIN* — o mesmo que uma referência inventada
devolve. O endereço foi montado por mim a partir do ref visto na barra do painel, e
montar não é copiar. Enquanto ele não for o verdadeiro, `Settings → Configuration →
API Keys` (ou o diálogo *Connect*) devolve a string exata:

- o **cache de áudio** fica desligado (a função fala direto com a Fish Audio — que é
  exatamente o comportamento de antes do cache, e é o que está acontecendo agora);
- **login, prova na nuvem e duelo em rede** não funcionam; o jogo segue inteiro
  offline, com progresso no aparelho;
- nada disso quebra a voz: ela não depende do Supabase.

**`.vercelignore` foi criado neste deploy, e ele é obrigatório.** Com
`outputDirectory: "."` tudo que sobe vira endereço público, e a CLI da Vercel **não
lê o `.gitignore`** quando o projeto não tem esse arquivo — um `vercel --prod` feito
da máquina mandaria o `.env` (chave da Fish inclusa) para o servidor. Conferido no
ar: `/​.env` 404, `/.env.local` 404, `/vercel.json` 404. `supabase/schema.sql` e
`testes/testar-rls.sql` seguem 200 — é o comércio descrito em `SEGURANCA.md`, item 11.

O que foi executado contra a hospedagem real:

| teste | resposta |
|---|---|
| `GET /` | 200, 50 KB de HTML, CSP sem `unsafe-inline` de script, HSTS, `X-Frame-Options: DENY` |
| `POST /api/voz` com as quatro vozes, `Origin:` do próprio site | 200 `audio/mpeg` em `sara`, `bruna`, `miguel`, `evelyn` (25–36 KB cada) |
| `POST /api/voz` de origem estranha | 403 `{"erro":"origem não permitida"}` |
| `POST /api/voz` sem cabeçalho de origem | 200 (é o caminho do `curl` e do jogo local) |
| voz fora da lista | 400 `{"erro":"voz não faz parte da lista deste jogo"}` |
| texto vazio | 400 |
| `GET /api/voz` | 405 |
| jogo de verdade, no navegador | menu → *Quiz Doce* → responder → *Ouvir a pergunta em voz alta* → `POST /api/voz` 200 e um `blob:` servido como mídia (206): a fala tocou |

Uma nota sobre o teto: `limparTexto` **corta** em `FISH_AUDIO_MAX` (`slice(0, maximo)`)
em vez de recusar. Um texto de 400 caracteres virou 320 e ainda virou uma chamada de
síntese — que estourou os 15 s e devolveu 502. O desenho está certo (a criança nunca
ouve metade de uma frase longa, e a cota não estoura), mas ele significa que frase
demais custa: o navegador já corta em `narracao.maximoCaracteres` antes de perguntar.

### O que mudou na rodada de 04/11 (noite): celular, vozes novas e login

**As vozes.** Os quatro `reference_id` agora são os códigos das vozes do próprio
projeto (Sara `4e78…`, Bruna `67e9…`, Miguel `8c3a…`, Evelyn `0e30…`), conferidos um
por um contra `POST https://api.fish.audio/v1/tts` com a chave da conta do dono: as
quatro devolveram `audio/mpeg`. Uma chave autoriza a conta, não uma voz — por isso a
conta do Thalisson **não** entrou em lugar nenhum; o que estava errado era o
`reference_id`, que apontava para vozes da comunidade. As duas listas pinadas
(`config.js` e `api/_voz-nucleo.js`) batem, e o `testes/testar-narracao.js` confere.

**O hub no celular, medido no navegador** (janela de 390×844, jogo aberto no hub, com
`testes/capturas/medidor.html` — arquivo de trabalho, gitignored):

| faixa | antes | depois |
|---|---|---|
| cabeçalho | 101 px | 61 px |
| seletor de ano/nível | 251 px | 200 px |
| atalhos (5 botões) | 156 px | 101 px |
| **as três juntas** | **508 px (60% da tela)** | **362 px (43%)** |
| lista de jogos | 315 px | 470 px |

O corte não esconde informação nenhuma: as fichas de *ano* e *nível* do placar saíram
do cabeçalho porque repetem os chips selecionados dois dedos abaixo (as estrelas
ficaram); o 1º–9º virou uma linha só de 34 px por ficha acima de 352 px de largura
— abaixo disso continua em cinco colunas, porque nove numa linha dariam fichas de
29 px, menores que o alvo de toque; e os atalhos passaram de três linhas para duas.
Nenhum botão ficou abaixo de 40×32 e nenhuma faixa virou trilho de rolagem lateral
(essa é a checagem do `testes/auditar-layout.js`, que aqui não roda: os binários
listados são de Windows). Em 320×640 as faixas somam 416 px, mas o hub já rola
inteiro nesse caso (o `@media (max-height: 780px)` cuida disso).

**O botão Voz e os chips de voz.** `.btn-hub-action` só definia `color:#fff` e o
`.bha-voz` não tinha regra nenhuma: letra branca sobre o hub branco. Agora o Voz veste
o degradê `#2A8FE0 → #1E4FA8` (5,5:1 com o rótulo branco) e os `.chip-voz` do modal
ganham texto `var(--text)` sobre `#FFFDF7` com borda forte (11:1) e um
`:focus-visible` de 3 px. Conferido em tela, não só na conta.

**Login dos responsáveis.** Quatro defeitos reais, cada um com a correção do lado:

1. Criar conta com confirmação de e-mail não devolve sessão, então `logado()` era
   falso e a tela voltava para "Criar conta". Quem tentava entrar depois recebia
   "Email not confirmed" — que a tela tratava como senha errada. Agora
   `registrar()` guarda `N.pendente = {email}` e `entrar()` reconhece o erro de
   e-mail não confirmado; `pintar()` manda os dois para o painel de verificação, que
   ganhou "Usar outro e-mail" para sair do beco.
2. O `pintar()` destrói o `.nuvem-msg` a cada repintura: a mensagem de erro morria
   antes de ser lida. `recado(chave)` agora guarda o último recado por painel
   (`criar`, `entrar`, `verificar`, `ligado`, `redefinir`) e o devolve ao mesmo
   painel.
3. Abrir "Conta e conexão" mostrava o retrato de quando a página carregou. O
   `openModal` do `script.js` chama `CM_NUVEM.repintar()`, que rele a sessão e
   redesenha.
4. `iniciar()` pintava sem try/catch: um erro de desenho derrubava a inicialização da
   nuvem inteira. Agora o erro aparece escrito na tela e o jogo segue local.

**"Não lembro a senha" (novo).** `recuperar()` chama `resetPasswordForEmail` com
`redirectTo = <endereço do jogo>#redefinir-senha`; o `supabase-js` já traz a sessão de
recuperação no retorno, `iniciar()` lê o hash (e o evento `PASSWORD_RECOVERY`) e abre
o painel que pede a senha nova via `updateUser`. **Depende de duas coisas no painel do
Supabase**, e nenhuma delas foi exercitada em projeto real ainda — o Project URL
correto continua pendente:

- `Authentication → URL Configuration → Redirect URLs` precisa conter
  `https://candy-math-eight.vercel.app/#redefinir-senha` (e o mesmo para o preview);
- o `Site URL` precisa ser o endereço publicado, ou o link de confirmação volta para
  outro lugar.

Até o Project URL ser o verdadeiro, nada do acima funciona de fato — e a tela agora
diz isso em português: `traduzErro()` transforma "Failed to fetch" em "o banco não
responde. Confira o Project URL no config.js e a sua conexão."

**Os painéis foram conferidos no navegador** com um dublê do `supabase-js`
(`testes/capturas/medidor-nuvem.html`, instalado no `window` do iframe antes de o jogo
pedir o cliente): "Criar conta" → painel *Falta confirmar o e-mail* com os três
botões, painel *Definir a senha nova*, painel *Conta ativa*, e o recado de erro
sobrevivendo à repintura. O que o dublê **não** prova: resposta real de e-mail,
link de verdade, `updateUser` de verdade.

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
   JS de navegador ou em log. Uma chave basta: ela autoriza a **conta**, não uma voz —
   qual voz fala é decidido por requisição, pelo `reference_id` pinado em
   `api/_voz-nucleo.js` (a lista fechada `sara`/`bruna`/`miguel`/`evelyn`). Se a tela
   mostrar várias chaves com nomes de voz, isso é rótulo de quem criou: qualquer uma
   delas sintetiza as quatro, e as que sobrarem podem ser revogadas.
   **Use a chave da SUA conta**, e não a de quem emprestou uma: a `sk-fish-…` é
   credencial de conta inteira (enxerga e gasta o que o dono tem), e o limite de
   frases cai no plano de quem paga. Os quatro `reference_id` do projeto respondem
   à chave da conta do dono — foi com ela que os testei um a um, e os quatro
   voltaram com áudio — o que dispensa uma segunda chave no servidor. Se alguma
   vier 404 ou 403, a voz saiu do ar ou ficou privada na conta de origem: troque o
   id nas duas listas (`api/_voz-nucleo.js` e `config.js`) por uma que a sua conta
   enxergue.
   Conferência de 60 segundos, antes de qualquer deploy, no terminal de quem tem
   rede (o modelo vai no **cabeçalho**, como na função):

   ```bash
   read -rs KEY                       # a chave não fica no histórico
   curl -s https://api.fish.audio/v1/tts -H "Authorization: Bearer $KEY" -H "model: s2.1-pro-free" \
     -H "Content-Type: application/json" \
     -d '{"text":"Bruna, quanto é dois mais dois?","reference_id":"67e90549433041759a61e2272367e160","format":"mp3","language":"pt"}' \
     -o /tmp/voz-bruna.mp3 -w "%{http_code}\n"
   unset KEY
   ```

   `200` com um arquivo de dezenas de KB é a chave, o modelo e a voz funcionando;
   `401`/`403` é conta ou plano, não código. Sem rede, nada disso se prova — e o
   jogo segue falando pela voz do aparelho.
2. As quatro vozes da tela (`Sara`, `Bruna`, `Miguel`, `Evelyn`) são os ids
   indicados pelo dono em 04/11/2026, cada um chamado de verdade contra a API antes
   de entrar no código. **Não foi mais uma escolha de catálogo** — são as vozes do
   projeto, e a leitura de números em português só se confirma ouvindo.
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

   **Já é medição, desde 04/11/2026**, com a chave publicada na Vercel: uma frase
   curta de feedback ("Muito bem, você acertou essa.") sai em **25–36 KB** e uma
   pergunta inteira de 213 caracteres em **186 KB** — mp3 MPEG-1 Layer III, 128 kbps,
   44,1 kHz, ou seja ~16 KB por segundo de fala. O teto de 6.000 frases vale na faixa
   de **100 MB a 1,1 GB** dependendo de quanto o texto é longo: o "feedback" é barato,
   o "enunciado completo" é o que come o Storage. Antes de subir `CM_CACHE_TETO`,
   olhe o painel.
8. **Conferir que o cache pegou.** SQL Editor:
   `select voz, count(*) as frases, sum(usos) as audições, max(visto_em) from
   public.narracoes group by voz;` — linha aparecendo é frase guardada. Se a
   tabela nascer mas ficar vazia, a escrita está falhando (permissão no bucket,
   chave errada) e a função continua funcionando: ela só não guarda. Para ver o
   contrário, `select purgar_narracoes(1, 10);` derruba as dez menos usadas.
   O navegador nunca lê esta tabela: RLS ligado sem política nenhuma é "nega
   tudo", e o `revoke all ... from anon, authenticated` é a segunda fechadura.
9. **Duas contas, duas chaves — e uma só chega.** O jogo tem quatro vozes
   (`sara`, `bruna`, `miguel`, `evelyn`), e elas vieram de dois lugares: Bruna e
   Sara na conta do dono do projeto, Miguel e Evelyn na conta de um amigo. A
   pergunta natural é se a função precisa das duas chaves. **Não precisa, e isto foi
   medido** em 04/11/2026 com a chave de uma única conta, chamando
   `POST https://api.fish.audio/v1/tts` com os quatro `reference_id` pinados em
   `api/_voz-nucleo.js` — a mesma frase, `"Que bom, você acertou!"`:

   | voz | HTTP | mp3 | ~duração |
   |---|---|---|---|
   | sara | 200 | 22.568 B | 1,4 s |
   | bruna | 200 | 24.240 B | 1,5 s |
   | miguel | 200 | 27.166 B | 1,7 s |
   | evelyn | 200 | 30.092 B | 1,9 s |

   O motivo é o desenho da plataforma: a chave autoriza **uma conta** (o faturamento
   e os modelos dela), e a voz é escolhida por `reference_id`. Voz pública do
   catálogo qualquer chave alcança; voz da própria conta também. O que não se faz é
   a conta A pagar a voz que só existe, privada, na conta B — para isso seria
   preciso um segundo segredo no servidor. Como as quatro responderam, o projeto
   fica com uma chave só:

   - `FISH_AUDIO_API_KEY` é **uma** string, a da sua conta. Não há segunda variável,
     e adicionar a chave do amigo seria pior: o gasto da voz dele sairia no
     faturamento dele, e um `429` na conta dele calaria o seu jogo.
   - Se alguma das quatro virar **voz privada** (clonada e marcada como não pública),
     aí sim a chave precisa ser da conta dona daquela voz — e a troca é uma linha em
     `api/_voz-nucleo.js`, não uma arquitetura de duas chaves.
   - A chave que foi colada em conversa **não é mais utilizável**: trate como vazada e
     revogue no painel (`Fish Audio → API Keys → Delete`). Ela é a da outra conta, o
     que não muda nada: vazou, revoga.

---

## 6. Rotina de limpeza de salas (pendente de agendamento)

`purgar_salas_velhas()` apaga salas com mais de um dia, junto com suas jogadas, e é
executável **apenas por `service_role`** ([schema.sql:846](supabase/schema.sql#L846)).
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

Estado em 04/11/2026, depois do primeiro deploy real: `[x]` é o que foi conferido;
`[ ]` continua devendo gente — inclusive ouvir, que máquina nenhuma faz.

- [x] `npm test` verde na máquina de quem publica (os cinco itens pendentes da tabela
      final de `RELATORIO-TESTES.md` continuam pendentes até serem rodados por gente).
- [ ] `npm start` + `node testes/auditar-layout.js` e `--prova` antes do push.
- [x] Schema aplicado no Supabase — `8 · 8 · 17 · 0 · 1` na consulta de conferência.
      A migração 00001 só interessa se o banco veio da 3.0.
- [ ] **Copiar o Project URL verdadeiro do painel** e substituir em `config.js`,
      `.env` e na variável `SUPABASE_URL` da Vercel. O endereço que está hoje no
      repositório não resolve (NXDOMAIN) — foi montado a partir do ref da tela, e
      isso não é o mesmo que copiá-lo. Sem ele certo, cache de áudio, login e duelo
      ficam no escuro; o jogo e a voz seguem funcionando.
- [ ] Site URL e Redirect URLs apontando para `https://candy-math-eight.vercel.app`.
      A lista de redirects precisa conter também
      `https://candy-math-eight.vercel.app/#redefinir-senha`, que é para onde o link de
      "Não lembro a senha" devolve a pessoa; sem essa linha o fluxo para no meio.
- [ ] Login de responsável conferido em projeto real: criar conta → clicar no link →
      "Já cliquei — conferir" → registrar a criança → trocar a senha pelo link de
      recuperação. Os painéis foram vistos no navegador com um dublê do cliente, o que
      não prova nada do caminho de e-mail.
- [ ] SMTP configurado (senão a verificação de e-mail não chega em produção).
- [x] Variáveis secretas na Vercel, *Sensitive*, sem "Exposed to the Browser" —
      `FISH_AUDIO_API_KEY` e `CM_ORIGENS` no ar; as duas do Supabase dependem do item
      acima.
- [x] `curl -I` confirmando CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`
      no endereço publicado.
- [x] As quatro vozes respondendo `audio/mpeg` na função publicada — e o `blob:` de
      mídia no navegador provando que a fala tocou. **Falta ouvir uma por uma e dizer
      qual serve**: a leitura de números em pt-BR é a que mais muda de voz para voz.
- [x] `dueloRedeHabilitado: false` — continua false, e só muda depois dos itens 2 e 3
      da seção 4 rodados contra o projeto certo.
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
