# Segurança — Candy Math

Modelo de ameaças, políticas de acesso e riscos que ficam. Data: 30/10/2026.

**O que este arquivo não é.** Não é um teste de invasão. Nenhuma tentativa real de
burlar o RLS, o `entrar_na_sala` ou a função de voz foi feita contra um sistema
rodando. O que existe aqui é: regras de acesso escritas no banco, conferidas
estaticamente por teste, com um roteiro de 16 cenários para quem tem o banco e as
contas de teste na mão. **Enquanto esses cenários não rodarem, o duelo em rede
continua desligado**, e nada neste arquivo autoriza ligá-lo.

---

## 1. Ativos e quem os quer

| ativo | por que alguém quere | onde mora |
|---|---|---|
| Apelido, ano, nível e histórico de uma criança | leitura indevida de dado de menor | `localStorage` do aparelho; com a nuvem ligada, tabelas `criancas` e `progressos` no Supabase |
| Vínculo responsável ↔ criança | sequestro do vínculo, exclusão indevida | tabela `vinculos`, chaveada por `auth.uid()` |
| Estado de uma partida e identidade dos assentos | trapaça, perturbação, leitura de terceiros | tabelas `salas` e `jogadas` |
| `FISH_AUDIO_API_KEY` | custo na conta do dono, uso da cota para gerar outra coisa | variável secreta da Vercel, lida só por `api/voz.js` |
| Senha da conta do adulto | — | ela nunca entra no app: fica no serviço de autenticação do Supabase |

## 2. O que é público e o que é secreto

- **Público por natureza:** `SUPABASE_URL` e a `anon key`. Vivem em `config.js`,
  arquivo servido ao navegador. O que protege os dados são as políticas RLS, não a
  chave.
- **Secreto:** `FISH_AUDIO_API_KEY`. Vive só na Vercel (Settings → Environment
  Variables, marcada *Sensitive*, **sem** "Exposed to the Browser"). Ela não aparece
  em `config.js`, em HTML, em JS de navegador, em log, nem em mensagem de erro.
- **Secreto de operação:** `service_role`. Não entra em arquivo nenhum deste
  repositório. Desde o cache de narração ela tem um uso legítimo — a função
  `api/voz.js` a lê da Vercel (`SUPABASE_SERVICE_ROLE_KEY`, *Sensitive*) para escrever
  e ler `public.narracoes` e o bucket privado; nada mais. É o segredo mais pesado do
  projeto, porque bypassa o RLS: se vazar, o leitor não vê só frases de Matemática,
  vê o banco inteiro. Se algum dia aparecer uma string começando com `eyJ…` num
  arquivo servido ao navegador, é incidente.
- **`reference_id` das vozes:** decisão do servidor, lista fechada em
  [api/_voz-nucleo.js:31-34](api/_voz-nucleo.js#L31). O navegador escolhe
  `sara|bruna|miguel|evelyn` e não pode pedir outra voz.

Um teste vigia isso a cada `npm test`: `testes/testar-segredos.js` varre os arquivos
por `service_role`, JWT `eyJ…`, valor de `FISH_AUDIO_API_KEY`, token genérico de 32+
caracteres e chave privada SSH — e `testar-politicas-sql.js` repete a checagem dentro
do caminho específico do duelo.

## 3. Modelo de autorização do banco

Tabela por tabela, o que o navegador pode. As 17 políticas estão em
[supabase/schema.sql](supabase/schema.sql#L302); o `revoke all` anterior a qualquer
`grant` está em [schema.sql:196-202](supabase/schema.sql#L196).

| tabela | SELECT | INSERT/UPDATE/DELETE pelo cliente | como |
|---|---|---|---|
| `perfis` | a própria conta | só a própria conta | `id = auth.uid()` ([302-317](supabase/schema.sql#L302)) |
| `criancas` | conta com vínculo, ou o dono | dono registra, dono edita, dono apaga | `responsavel_id = auth.uid()` ([319-339](supabase/schema.sql#L319)) |
| `vinculos` | os meus | criar com a minha conta; soltar o meu | ([341-358](supabase/schema.sql#L341)) |
| `progressos` | quem tem vínculo com a criança | **só o aparelho dono** grava, apaga e atualiza | `_e_cuidador` / `_e_dono` ([360-379](supabase/schema.sql#L360)) |
| `salas` | apenas anfitrião ou desafiante desta linha | **nenhuma** escrita direta | [382](supabase/schema.sql#L382), [215](supabase/schema.sql#L215) |
| `jogadas` | apenas membro da mesa | **nenhuma** escrita direta | [393](supabase/schema.sql#L393) |
| `tentativas_vinculo` | ninguém | ninguém | só as funções do banco escrevem |
| `narracoes` | ninguém | ninguém | sem política **e** sem grant nenhum: RLS ligado nega tudo, e só a `service_role` da função de voz entra ([204-209](supabase/schema.sql#L204)) |

A escrita do duelo acontece dentro de funções, e o banco calcula identidade e assento
a partir de `auth.uid()` — o cliente não envia "quem sou eu":

| função | o que ela decide |
|---|---|
| `criar_sala()` | dono = `auth.uid()`; recusa sem conta; teto de 3 salas `esperando` nos últimos 10 minutos por conta; código com rejeição de módulo e 12 tentativas contra colisão ([430](supabase/schema.sql#L430)) |
| `entrar_na_sala(text)` | UPDATE condicional atômico: quem chega primeiro senta; o segundo recebe a **mesma resposta genérica** de um código errado — a API não serve de oráculo para enumerar salas ([475](supabase/schema.sql#L475)) |
| `registrar_jogada(text, text, jsonb)` | confere tipo de lance, formato, tamanho, turno (`_vez_de`), sala ativa e consistência das contas antes de inserir; autor e assento vêm da sessão ([513](supabase/schema.sql#L513)) |
| `encerrar_sala` / `sair_da_sala` | só membro; liberam a cadeira certa ([600](supabase/schema.sql#L600), [621](supabase/schema.sql#L621)) |
| `vincular_por_codigo(text)` | formato `^[A-Z0-9]{3,24}$` + 8 tentativas por hora por conta ([764](supabase/schema.sql#L764)) |
| `apagar_meus_registros()` | apaga conta, crianças, vínculos e progressos da própria conta ([818](supabase/schema.sql#L818)) |
| `purgar_salas_velhas()` | `service_role` apenas; salas com mais de 1 dia somem com suas jogadas ([846](supabase/schema.sql#L846)) |
| `narracao_usada(text, text, text)` | `service_role` apenas; conta em que a frase guardada foi ouvida — é o insumo da poda ([868](supabase/schema.sql#L868)) |
| `purgar_narracoes(int, int)` | `service_role` apenas; devolve e apaga as frases além do teto, começando pelas menos usadas; a função de voz apaga o arquivo no bucket em seguida ([886](supabase/schema.sql#L886)) |

A tabela `narracoes` é o único caso do schema **sem política nenhuma e sem grant
nenhum**: RLS ligado sem política significa "nega tudo", e o
`revoke all ... from anon, authenticated` é a segunda fechadura por baixo. Nem a
própria conta autenticada lê o que o jogo guardou — só a função serverless, com a
chave de serviço. A coluna `caminho` é `generated always as (voz || '/' || chave ||
'.mp3') stored`, então o caminho do arquivo não pode divergir da frase: se a poda
levar um objeto e a pergunta voltar, ela reescreve no mesmo lugar e não sobra
corpo estranho no bucket.

Invariantes de integridade:

- 20/20 funções `security definer` com `set search_path = public` (conferido por teste).
- Gatilhos `criancas_sem_transferencia` e `progressos_sem_transferencia`
  ([944](supabase/schema.sql#L944), [949](supabase/schema.sql#L949)) barram UPDATE que
  troque `responsavel_id`/`dono` ou `codigo` — um `UPDATE` não transfere registro.
- `criancas_visiveis` é view com `security_invoker = true` ([749](supabase/schema.sql#L749)):
  não empresta privilégio de dono.
- As funções auxiliares usadas dentro de política têm `grant execute to authenticated`
  ([296-298](supabase/schema.sql#L296)); sem isso todo SELECT quebraria com
  "permission denied" — erro que este projeto cometeu e agora testa.
- Os quatro auxiliares e os grants deles moram na **seção 2.1**
  ([231-298](supabase/schema.sql#L231)), antes da primeira `create policy`
  ([302](supabase/schema.sql#L302)). Não é capricho de formatação: o Postgres resolve
  o nome da função no instante do `CREATE POLICY`, então política acima da função
  derruba o arquivo inteiro com
  `42883: function ... does not exist`. Foi assim que o schema
  falhou na primeira aplicação real, em 04/11/2026; hoje o validador confere a ordem
  e a inversão deliberada desse bloco é provada por sabotagem.

## 4. O que o navegador filtra antes de incomodar o banco

`frearLance` ([nuvem.js](nuvem.js#L36)) aceita os 3 tipos de lance conhecidos, exige
JSON de no máximo 60 000 bytes, densidade entre 1 e 80, contas no máximo 80, texto com
teto (peça 24, conta 40, motivo 80) e tempo entre 0 e 3 600 000 ms. Nada disso é
segurança — é civilidade; **a mesma conferência está no servidor**
(`_contas_validas`, `_acerto_valido`, `_passada_valida`), porque o filtro do
navegador pode ser removido por quem abre o console.

## 5. Função de voz (Fish Audio)

Arquitetura: navegador → `POST /api/voz` (mesma origem) → função serverless →
`https://api.fish.audio/v1/tts`. A chave nunca atravessa o navegador, e o corpo da
resposta é devolvido como `audio/mpeg` com `Cache-Control: no-store`.

- Só `POST`; `OPTIONS` devolve 204; outros métodos, 405 com `Allow`.
- Origem: sem `CM_ORIGENS`, o `POST` de qualquer origem é aceito — a **resposta**
  continua protegida (o cabeçalho de acesso só sai para origem listada, nunca `*`),
  mas a chamada chega e gasta cota. Na produção, liste a origem do jogo em
  `CM_ORIGENS` e o `403` passa a valer.
- Corpo JSON analisado com teto de tamanho; `modelo` **não** vem do navegador.
- Voz: lista fechada (`sara|bruna|miguel|evelyn`). Voz desconhecida → 400.
- Texto: `limparTexto` remove tags inteiras, teto `FISH_AUDIO_MAX` (padrão 320).
  Vazio ou gigante → 400.
- Sem chave no ambiente → 503 com mensagem genérica (o jogo cai para a voz do
  aparelho e a tela de voz explica).
- Limite de chamadas `FISH_AUDIO_POR_HORA` (padrão 240 por hora por IP) → 429 com
  `Retry-After`.
- Falha do serviço de origem → 502 genérico; detalhes upstream não vazam.
- **Log:** nada. Nem texto, nem IP, nem chave — a ponte não escreve em log, e um caso
  de `testar-narracao.js` confere isso.
- **O que o serviço de voz recebe:** apenas a frase da pergunta e o nome da voz. Sem
  nome, e-mail, código, progresso ou identidade.
- **Cache de áudio:** duas memórias, e nenhuma delas vê o navegador mexer.
  (1) Na aba: `narracao.js`, teto de 8 trechos, revogação de `createObjectURL` ao
  descartar, limpa ao trocar de voz ou preferência. (2) No projeto: a função procura
  a frase em `public.narracoes` e desce o mp3 do bucket **privado** `narracoes`
  antes de chamar a Fish Audio, e grava depois de sintetizar. Quem escreve é o
  `service_role` da Vercel; o navegador não recebe URL de bucket, não recebe chave
  e não muda de comportamento — a resposta continua `audio/mpeg` com `no-store`,
  venha de onde vier. Por isso o **CPS da seção 6 não muda uma linha**, e por isso
  o bucket não é público: um bucket público transformaria "quem sabe a pergunta" em
  "quem pode ouvir a resposta", já que o nome do arquivo é um resumo do texto.
- **O cache nunca é caminho de falha.** Banco fora do ar — seja respondendo mal
  (500, corpo torto) seja sumindo no meio (`fetch` rejeita: dns, conexão resetada) —
  linha sem arquivo, upload que cai, conta de uso que falha, chave ausente: em todos
  esses casos a frase sai da síntese como saía antes, e cada um deles tem uma cena de
  `testes/testar-narracao.js`. Nenhum deles segura a resposta para quem ouve: o áudio
  sai, e o trabalho do banco depois disso é agendado sem esperar.
  `SUPABASE_URL` é conferida contra o padrão canônico
  (`https://<projeto>.supabase.co`, ou `.in`) — aceitar endereço arbitrário
  transformaria a função em encaminhador para o servidor que a variável apontar.
  `CM_CACHE=off` desliga tudo sem tocar na chave de síntese.
- **Custo do acerto vs. custo da escrita:** a leitura não segura nada além da
  descida do arquivo; a gravação é a única ida que o navegador espera depois da
  síntese (uma ida e volta, ordem de grandeza menor que a própria síntese). A poda
  das frases menos usadas é disparada a cada 100 escritas e corre sem esperar.
- **O que fica guardado:** o texto da pergunta (problema de Matemática), o nome da
  voz, o modelo e o mp3. Nenhuma identidade, conta, criança, aparelho ou histórico
  — e a chave do nome é um resumo, não o texto. `privacidade.html` §1 e §3 dizem
  isso para quem lê, não só para quem auditoria.

## 6. Cabeçalhos e CSP

Servidos pelo [vercel.json](vercel.json#L11) na hospedagem — e o servidor de testes
local (`testes/servidor-estatico.js`) reproduz os mesmos cabeçalhos para que a
verificação local signifique algo. **Não existe CSP em `<meta>` no HTML**: sem
hospedagem (ou abrindo `index.html` por `file://`), esses cabeçalhos não se aplicam.

| cabeçalho | valor | efeito |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'`; `script-src 'self' https://cdn.jsdelivr.net`; `style-src 'self' 'unsafe-inline' …`; `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net`; `media-src 'self' blob:`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `upgrade-insecure-requests` | sem script inline (conquistado ao trocar os 64 `onclick` por um dispatcher com lista fechada), sem injection por `base`/`form`, sem frame |
| `X-Frame-Options` | `DENY` | ninguém embute o jogo para clickjacking |
| `X-Content-Type-Options` | `nosniff` | |
| `Referrer-Policy` | `no-referrer` | a URL do aparelho não vaza para a CDN |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` | o jogo não pede câmera, microfone nem localização — e a API de voz não precisa deles |
| `Strict-Transport-Security` | `max-age=15552000; includeSubDomains` | |
| `Cache-Control` | `no-cache` em `index.html`/`privacidade.html`, `must-revalidate` nos JS/CSS, `no-store` em `/api/*` | progresso e chave não ficam em cache intermediário |

**`style-src 'unsafe-inline'` ficou.** Motivo honesto: 22 atributos `style=` nos HTML
e 40 escritas `.style.` em `script.js`, usadas para posições e animações calculadas no
momento. Remover exigiria nonce (incompatível com site estático servido de cache
público) ou a migração de todas essas escritas para classes e variáveis CSS. Plano de
redução, na ordem: (1) mover os `style=` estáticos para utilitários do `style.css`;
(2) concentrar as escritas calculadas em `--var` setadas por uma função única;
(3) só então tirar `'unsafe-inline'` de `style-src`. Enquanto isso, um CSS inline não
executa script — o risco residual é de estética/leitura, não de código.

## 7. Ameaça por ameaça

| ameaça | controle | estado |
|---|---|---|
| Leitor anônimo (`anon key`) varre `progressos` | `revoke` + RLS por vínculo | política escrita; **não executada** contra Postgres real |
| Alguém com o código da sala entra nela sem convite | assento calculado pelo banco, sala tem 2 lugares, UPDATE atômico, resposta genérica igual para sala cheia e inexistente | idem |
| Enumerar códigos de sala/vínculo por timing ou mensagem de erro | mesma resposta nos dois casos; 8 tentativas/hora; código do vínculo com 10 caracteres | idem |
| Cliente forja assento/autor no lance | o cliente não escreve em `jogadas`; `registrar_jogada` deriva tudo da sessão | idem |
| payload gigante ou de tipo desconhecido derruba a partida do outro | tetos no cliente **e** no servidor; `estado` e turno conferidos | idem |
| Uma conta abre salas sem fim | 3 salas `esperando` por 10 minutos; purge diário via `service_role` | idem |
| Chave da Fish Audio vaza para o navegador | vive em env var de servidor; teste proíbe a string nos arquivos do navegador; respostas `no-store` | **CONCLUÍDO E TESTADO** (estaticamente) |
| Usuário pede voz/modelo/texto arbitrário à função | lista fechada, modelo no servidor, teto de 320 caracteres, validação de tipo | testado com `fetch` falso; chamada real pendente |
| Abuso de custo na cota de voz | 240 chamadas/h por IP **por instância** | **parcial de propósito** — ver item 8 |
| XSS por conteúdo do jogo | todo texto de item é gerado localmente; nada de texto vindo da rede entra em `innerHTML` sem `esc()`; CSP sem `unsafe-inline` de script | verificado por inspeção e pelo CSP |
| XSS por dado vindo do banco (apelido de outra pessoa, nome de lance) | `textoSeguro` no cliente e teto/regex no servidor; nomes saem por `textContent`/`esc()` | idem |
| Child data harvesting | sem nome real, sem foto, sem escola, sem geolocalização; a criança não tem conta; apelido é escolha do adulto | política do produto, registrada em `privacidade.html` |
| Dispositivo compartilhado lê o progresso do `localStorage` | documentado na página de privacidade e no boletim; nenhum segredo nem token é guardado ali | residual aceito |
| Cadeia de suprimento (CDN) | `@supabase/supabase-js` fixado em 2.45.4 via jsdelivr; origem confere antes de injetar (`ORIGENS_BIBLIOTECA`); CSP lista as origens | sem SRI — ver item 8 |

## 8. Riscos que ficam, escritos sem rodeio

1. **Nada foi executado contra um banco real.** A autorização é *escrita* e
   *estaticamente conferida*. O comportamento do Postgres sob RLS continua por provar
   (`testes/testar-rls.sql`, 16 cenários).
2. **Nenhum teste de invasão foi feito**, nem varredura, nem revisão por terceiros.
3. **Limitador de voz em memória.** Cada instância da função conta a seu próprio
   critério; com escalonamento, o teto efetivo sobe. É proteção contra deslize de
   dedo, não contra abuso coordenado. Correção real exige um contador compartilhado
   (Upstash/Redis ou tabela no próprio Supabase) — decisão de custo, deixada para o
   dono.
4. **Sem `integrity` (SRI)** nas três referências de CDN (Google Fonts, Font Awesome,
   supabase-js). Para uso em escola com rede controlada: baixar os arquivos, apontar
   os `<link>`/`script` para o caminho local e tirar as origens do CSP.
5. **`style-src 'unsafe-inline'`** continua (justificativa e plano no item 6).
6. **A CSP só vale onde os cabeçalhos são servidos.** Em `file://` não há cabeçalho
   nenhum; o jogo funciona, mas sem essa camada.
7. **Duas partidas simultâneas na mesma sala** não são impedidas além do estado e dos
   dois assentos; a sala é de dois lugares e expira em um dia.
8. **Senhas e sessão** são responsabilidade do provedor de autenticação (Supabase).
   Nada neste projeto testa a força da política de senha, o tempo de sessão ou a
   entrega de e-mail de verificação — que ficam na configuração do projeto.
9. **A chave `anon` é pública** por desenho. Quem a copia pode *tentar*; o que a
   contenção dela é o RLS, outra vez dependente do item 1.
10. **Nenhuma dependência de execução.** O `package.json` não lista `dependencies` e
    nada é instalado com `npm install`: os únicos recursos externos são as três CDNs
    e o Supabase. Isso reduz superfície, mas não substitui auditoria de dependência
    quando um build tool entrar.
11. **Publicar a pasta inteira publica os arquivos de desenvolvimento.** Com
    `outputDirectory: "."`, o que está no repositório vira endereço público:
    `supabase/schema.sql` (a lógica de autorização), `testes/testar-rls.sql` (os
    cenários de teste) e os quatro documentos de auditoria. **Nenhum segredo está
    aí** — é justamente o que `testes/testar-segredos.js` garante — mas conhecer a
    regra escrita facilita quem tenta achar buraco nela. Três saídas, todas decisão
    do dono: (a) deixar como está, aceitando a exposição de desenho; (b) publicar
    somente o sítio, copiando os arquivos do navegador para um `dist/` gerado por um
    script Node próprio e apontando `outputDirectory` para ele; (c) mover `testes/`
    e `supabase/` para fora da raiz publicada. A opção (b) é a que preserva o
    princípio de "o jogo abre sem build", porque só o *deploy* passa a copiar.

## 9. Antes de ligar o duelo em rede (procedimento)

1. Aplicar `supabase/schema.sql` e `supabase/migrations/00001_endurecer_autorizacao_salas.sql`
   no SEU projeto. Aceite documentada: `salas` e `jogadas` são recriadas — é estado
   transitório de partida, sem dado pessoal.
2. Rodar `testes/testar-rls.sql` no SQL Editor. **Todas** as linhas devem terminar em `ok`.
3. Criar três contas de teste e rodar `node testes/testar-autorizacao.js` com `.env`
   preenchido (modelo em `.env.example`). A0–A10 positivos e negativos.
4. Só então trocar `dueloRedeHabilitado` para `true` em `config.js` — e registrar em
   `AUDITORIA.md` quem rodou, quando e com que resultado.

Passo 1 sozinho não libera nada: enquanto 2 e 3 não passarem, o portão do navegador
([nuvem.js:81](nuvem.js#L81)) continua fechado, e é assim que o projeto é entregue.
