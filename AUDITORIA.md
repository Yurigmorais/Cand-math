# Auditoria — Candy Math

Data: 30/10/2026. Escopo: todo o arquivo deste repositório — HTML, CSS, JavaScript,
SQL, configuração de publicação, testes e documentação.

Como ler este arquivo: cada entrada diz **o que estava errado**, **o que foi feito**
e **como isso foi conferido**. Quando a conferência não foi possível neste ambiente,
a entrada diz isso em vez de sugerir que passou. A lista do que ficou pendente está
no item 5, e os riscos aceitos estão no item 6. Nada aqui é um teste de invasão.

---

## 1. Método

- Leitura completa antes da primeira linha alterada: os 12 arquivos JS da raiz,
  `index.html`, `style.css`, `supabase/schema.sql`, `vercel.json`, `README.md` e os
  quatro validadores que já existiam.
- Toda correção abaixo ou tem um teste novo que a confere, ou foi conferida no
  navegador real aberto sobre estes arquivos. Correção sem conferência não entra
  neste relatório como concluída — entra no item 5.
- Os números citados (itens, checagens, políticas, linhas) saem dos scripts, não
  da memória. `npm test` imprime a maioria deles.

Ferramentas que hoje existem no projeto para sustentar esta auditoria:

| instrumento | o que ele prova |
|---|---|
| `testes/testar-estrutura.js` | raiz única, referências inteiras, ordem de carregamento, `node --check` em todo JS |
| `testes/testar-segredos.js` | nenhuma chave privilegiada ou token em arquivo versionado |
| `testes/testar-politicas-sql.js` | invariantes de autorização dentro do SQL (estático) |
| `testes/testar-rls.sql` | 16 cenários de autorização **rodando no Postgres** (não executado aqui) |
| `testes/testar-autorizacao.js` | os mesmos cenários contra um projeto Supabase real com contas de teste |
| `testes/testar-narracao.js` | a ponte de voz: teto, vozes, erros, ausência de segredo no navegador |
| `testes/validar-banco.js` | o banco autoral, item por item |
| `testes/validar-conteudo.js` | os 55 geradores em todo ano × nível, mais o banco inteiro |
| `testes/validar-css.js` | escala fluida, larguras sem freio, variável sem definição |
| `testes/relatorio-bncc.js` | vínculo código ↔ ano ↔ unidade e cobertura (`RELATORIO-BNCC.md`) |
| `testes/auditar-layout.js` | geometria tela por tela em Chrome headless, com `--prova` de si mesmo |

---

## 2. Correções críticas

### C1 — O código da sala era a credencial (autorização do duelo)

**O que estava errado.** As políticas de `salas` e `jogadas` permitiam a operação
quando a sala **existisse**. Quem soubesse o código — por adivinhação, por um
print, por um link compartilhado — lia o estado da partida e escrevia lances no
nome de outra pessoa. Conhecimento do código funcionava como senha, e código de
seis caracteres não sustenta essa função.

**O que foi feito** (em [supabase/schema.sql](supabase/schema.sql)):

- RLS ligado nas 8 tabelas — as 7 alcançáveis pelo navegador e `narracoes`, que
  não é alcançável de jeito nenhum ([schema.sql:184-191](supabase/schema.sql#L184),
  [204-209](supabase/schema.sql#L204)).
- 17 políticas separadas por operação (SELECT / INSERT / UPDATE / DELETE), nenhuma
  com `using (true)` — [schema.sql:219-312](supabase/schema.sql#L219).
- `revoke all ... from anon, authenticated` em todas as tabelas, e só então o
  `grant` estreito: `salas` e `jogadas` ficam **somente com SELECT** para
  membros ([schema.sql:196-202](supabase/schema.sql#L196),
  [213-215](supabase/schema.sql#L213), [299](supabase/schema.sql#L299), [310](supabase/schema.sql#L310)). Não existe
  política de escrita nessas duas tabelas: o navegador não pode escrever nelas,
  nem o anfitrião.
- A escrita passou a acontecer dentro de funções: `criar_sala()`,
  `entrar_na_sala(text)`, `registrar_jogada(text, text, jsonb)`, `encerrar_sala(text)`,
  `sair_da_sala(text)` ([schema.sql:418](supabase/schema.sql#L418),
  [463](supabase/schema.sql#L463), [501](supabase/schema.sql#L501),
  [588](supabase/schema.sql#L588), [609](supabase/schema.sql#L609)). Quem calcula
  autor e assento é o banco, a partir de `auth.uid()` — o cliente não envia
  identidade nenhuma.
- Lances conferidos no servidor por `_contas_validas` / `_acerto_valido` /
  `_passada_valida` ([schema.sql:635](supabase/schema.sql#L635),
  [670](supabase/schema.sql#L670), [685](supabase/schema.sql#L685)): tipo
  conhecido, formato, tamanho, turno da vez, sala ativa.
- Gatilho `_sem_transferencia` ([schema.sql:909](supabase/schema.sql#L909)) impede
  reatribuir dono ou código de uma sala já criada.
- `vincular_por_codigo` ([schema.sql:752](supabase/schema.sql#L752)) passou a
  exigir formato `^[A-Z0-9]{3,24}$` e a registrar tentativas em
  `tentativas_vinculo`, com teto de 8 por hora por conta — o código de sala e o
  código de vínculo deixaram de ser oráculo de enumeração.
- Toda função `security definer` declara `set search_path = public` (20 de 20,
  conferidas por teste). `purgar_salas_velhas()` é executável apenas por
  `service_role` ([schema.sql:834](supabase/schema.sql#L834)).
- Códigos sorteados sem viés. O de **vínculo** da criança nasce no aparelho com
  `crypto.getRandomValues` e 10 caracteres ([nuvem.js:24](nuvem.js#L24),
  [nuvem.js:28](nuvem.js#L28)); o de **sala** nasce no banco, com 8, por
  `_novo_codigo` ([schema.sql:394](supabase/schema.sql#L394)) e rejeição de
  módulo exata (248 = 8 × 31). O alfabeto dos dois omite I, L, O, 0 e 1, que se
  confundem quando alguém copia à mão.
- O lado do navegador obedece a um portão único, `dueloLiberado()`
  ([nuvem.js:81](nuvem.js#L81)), e o botão de sala por código nasce **desligado**
  com a explicação do motivo. A bandeira está em
  [config.js:58](config.js#L58) (`dueloRedeHabilitado: false`) e o caminho de
  entrada na rede a consulta antes de qualquer ação.

**Como foi conferido.**
`testes/testar-politicas-sql.js` — 77 invariantes estáticas sobre o SQL e sobre os
arquivos do navegador, 0 falhas. `testes/testar-estrutura.js` e
`testes/testar-segredos.js` também batem nesse ponto.

**O que NÃO foi conferido.** Nenhuma linha de `testar-rls.sql` rodou contra um
Postgres de verdade — a máquina deste trabalho não tem `psql` nem Docker. Os 16
cenários (positivos e negativos) estão escritos para o dono rodar no SQL Editor do
SEU projeto, e `testes/testar-autorizacao.js` se autodeclara "NÃO EXECUTADO" sem
credenciais. **Enquanto esses dois não passarem, o duelo em rede continua
desligado por padrão, e o schema deste repositório não pode ser declarado seguro.**

### C2 — Qualquer escrita do navegador chegava cru ao banco

**O que estava errado.** O cliente montava o pacote de progresso e o payload do
duelo e os entregava ao PostgREST. Campos numéricos sem faixa, texto onde devia
haver número e payload gigante passavam todos.

**O que foi feito.** Filtros antes de subir e depois de descer:
`frearLance`, `frearConta`, `textoSeguro`, `numeroEntre`
([nuvem.js:34-40](nuvem.js#L34) traz os tetos — 3 tipos de lance, 60 000 bytes por
lance, densidade no máximo 80, igual ao teto do banco), `entregar()` conferindo
tipo, assento e eco, e `detalhe()` redigindo o erro antes de aparecer na tela. A
gravação de progresso continua com `upsert` em chave do próprio aparelho.

**Conferido por** `testar-politicas-sql.js` (nenhuma escrita direta às tabelas do
duelo a partir dos arquivos do navegador) e `auditar-layout.js` nos fluxos.

### C3 — Sesgos de script inline e CSP

**O que estava errado.** 64 atributos `onclick` no HTML e mais alguns gerados por
JS. Enquanto existissem, `script-src` precisava de `'unsafe-inline'` — que anula
boa parte do sentido de uma Content-Security-Policy.

**O que foi feito.** Dispatcher delegado com lista fechada de funções
([script.js:2893](script.js#L2893), [2936](script.js#L2936)): os botões declaran
`data-acao` e `data-args` (JSON, no máximo 3 argumentos, só `string|number|boolean`),
e `ACOES_DOS_BOTOES` decide o que pode ser chamado. `attrJson` escapa os valores.
O CSP servido em [vercel.json:17](vercel.json#L17) ficou
`script-src 'self' https://cdn.jsdelivr.net` — sem `unsafe-inline` de script.
`como-jogar.js`, `avaliacao.js` e `duelo.js` adotaram o mesmo caminho.

**Conferido por** `testar-estrutura.js` (nenhum `<script>` inline, nenhum atributo
`on*`, nenhum `javascript:` nos HTML da raiz) e pela partida completa no navegador.

---

## 3. Correções altas

### A1 — A raiz estava achatada; os validadores apontavam para arquivos inexistentes

`README.md` e os scripts descreviam `supabase/` e `testes/`, mas os arquivos estavam
espalhados na raiz, e `validar-*.js` resolviam caminho com `__dirname/..` — o que
fazia os três rodarem contra `C:\Users\pc\Downloads\conteudo.js` e falharem com
`ENOENT` antes da primeira asserção. Restaurada a estrutura documentada e criado
[testes/_raiz.js](testes/_raiz.js), que sobe a partir de `__dirname` até achar os
marcadores `index.html · style.css · script.js · conteudo.js`. Os validadores agora
rodam de qualquer diretório, inclusive de um clone limpo.
Criados também [testes/servidor-estatico.js](testes/servidor-estatico.js) (zero
dependências, serve os mesmos cabeçalhos de segurança do `vercel.json` e devolve
501 para `/api/*`, que só existe na hospedagem) e [package.json](package.json) com
os scripts que o README manda digitar.

### A2 — `validar-css.js` nunca saía com erro

O README prometia "código de saída 1 quando encontram erro". O script calculava as
listas e não fixava `process.exitCode`. Corrigido — a contagem de erros agora inclui
as sete famílias de achado, e `testar-estrutura.js` entraria em falha se um CSS novo
quebrar a escala.

### A3 — Com a verificação de e-mail ligada, o cadastro do adulto quebrava o vínculo

`perfis` só era escrito no momento do cadastro. Com "confirm your email" ativo, o
usuário confirmava em outra janela e entrava por um caminho que **não** criava a
linha — aí `criancas` esbarrava na chave estrangeira e o registro da criança
falhava com um erro sem explicação. Corrigido com `criarPerfil()` chamado dentro de
`entrar()` e `ignoreDuplicates: true` para não amassar um apelido já escolhido.

### A4 — Dois formatos de código convivendo

`duelo.js` aceitava 6 ou mais caracteres enquanto `nuvem.js` exigia exatamente 6.
Uma sala criada num lado não podia ser relida no outro, e o campo pedia 6 quando o
banco gerava outro comprimento. Substituídos por uma expressão única compartilhada
e pelo `maxlength`/`placeholder` do campo ([index.html](index.html), `#dueloCodigo`).

### A5 — A página de privacidade não rolava

[privacidade.html](privacidade.html) carrega `style.css`, e a linha
`html, body { height:100%; overflow:hidden }` — correta para as telas do jogo —
presa o documento de texto numa janela que não passava da primeira tela. Corrigido
com override local, e o auditor ganhou o achado `documentoPreso` mais um caso de
`--prova` que injeta o bloqueio de propósito e exige vê-lo notado. Leitura real
medida: 3788 px roláveis.

### A6 — Questões com duas alternativas numericamente iguais

Esta era a falha pedagógica mais séria do conteúdo: a criança marcava a fração
certa por dois caminhos diferentes, ou a distrator "errada" estava certa. O
parser de texto puro não enxergava isso porque `1/5` e `8/40` são strings
diferentes.

- `opcoes()` já deduplicava por valor; **`itemTexto()` deduplicava por
  semelhança de texto**, e era por ali que passavam os geradores de resposta em
  texto. Criados `valorOpcao` ([conteudo.js:179](conteudo.js#L179)) e
  `mesmaOpcao` ([conteudo.js:210](conteudo.js#L210)) — leitura de fração,
  porcentagem, moeda, decimal com vírgula, notação científica com expoente
  unicode — e `itemTexto` passou a comparar **valor com unidade**
  ([conteudo.js:255-262](conteudo.js#L255)).
- Geradores que ficaram com menos de 3 candidatos depois da deduplicação estrita
  tiveram seus sorteios de distrato ampliados: `dizima` (`54/99` ≡ `6/11`),
  `prob` (`4/10` ≡ `2/5`), `notCient` (`25,7 × 10²` ≡ `2,57 × 10³`),
  `fracEquiv`, `fracSoma`.
- Quatro itens do banco autoral corrigidos, mantendo `alt[0]` certa e trocando o
  distrator que colidia — B174 (`2/12` ≡ `1/6`), B180 (`8/40` ≡ `1/5`),
  B233 (`4,5 × 10⁸` repetido), B243 (`6/10` ≡ `3/5` — duas respostas certas para
  a geratriz de 0,666…).
- A ordem dos candidatos em `itemTexto` agora é sorteada; com sorteio, listas
  grandes de distrato variam de fato entre partidas em vez de mostrar sempre as
  três primeiras.

**Conferido por** regra nova em `confereItem` ([testes/validar-conteudo.js:30-40](testes/validar-conteudo.js#L30)):
igual numérico **com a resposta certa** é erro grave; igual numérico entre
distratores é erro; e o varredor agora percorre os 311 itens do banco **um a um**,
não só os que o sorteio resolvia pescar. As regras foram provadas com duas
sabotagens temporárias em B174 (uma cópia de distrator → 1 erro; cópia da resposta
→ 2 erros) e depois desfeitas.

### A7 — Texto de ralo reaching as crianças: `(opção 1)`

Quando `itemTexto` não achava 3 distratores, ele completava com
`certa + ' (opção N)'` — um lixo visível na tela da criança. Isso acontecia de verdade
em `plano` (quando as duas contas tinham o mesmo resultado) e em `prob`. Corrigido
ampliando os dois sorteios, e o validador passou a falhar se qualquer item contiver
`/\(opção \d\)/`. O galho de reserva continua no código como última linha de defesa,
mas hoje é inalcançável — e deixaria de ser em silêncio se um gerador novo chegar a
isso, porque o teste avisa.

### A8 — O aviso em texto nunca era lido

`.toast` é criado dinamicamente, depois de `marcarDecoracao()` rodar: o
`aria-live` que o README descrevia como existente não estava em lugar nenhum. Agora
o aviso fala por uma região `role="status"` persistente
([script.js:2674-2685](script.js#L2674)), limpa antes de escrever para que a mesma
frase repetida seja anunciada de novo, e o balão visual fica `aria-hidden`.

Junto disso: 181 ícones Font Awesome decorativos no HTML (só 1 tinha `aria-hidden`)
passaram a ser escondidos por [script.js:300-323](script.js#L300), com a regra
conservadora de **não** emudecer ícone que é o único nome de um controle — um
`script.js:2993`-estilo "esconder tudo" teria apagado o nome acessível de botões.
Um `MutationObserver` cobre o que é montado depois do boot (boletim, loja,
tabuleiros). A prova disso entrou como sexto caso do `--prova` do auditor, que
injeta um ícone novo, um botão sem texto e um aviso, e exige ver os três tratados.

### A9 — O auditor de layout media telas que não estavam na tela

As quatro famílias de `--prova` acusaram **CEGO**. A causa não era o medidor: o
portão do tutorial engolia o `startMode`, então o tabuleiro nunca era montado e o
script media uma tela invisível achando que estava tudo bem. Corrigido com
`passarTutorial()` antes de cada caso e com a asserção `conferirFrente`, que reporta
`telaErrada` em vez de medir em silêncio. **Consequência honesta: as 13 telas de
jogo jamais tinham sido medidas antes disto** — e foram, 204 medições em 4 larguras,
0 achados.

### A10 — Os três comprimentos de código não tinham nenhuma amarra

Não era um defeito visível: o banco emitia sala com 8 caracteres
(`supabase/schema.sql:442` → `public._novo_codigo(8)`) e o campo `#dueloCodigo` tinha
`maxlength="8"`, o justo. O problema é o "justo": as duas expressões regulares de
formato aceitam de 6 a 24 (`nuvem.js:25-26`, `duelo.js:40`), o código de vínculo do
aparelho tem 10 (`nuvem.js:24`), e nada prendia uma ponta à outra. Se alguém
aumentasse `_novo_codigo(8)` para 10 — que é exatamente o que se faz quando se quer
mais entropia — o campo cortaria o código digitado em silêncio, e o usuário veria
"entrou" com um código incompleto. Hoje, com o teto do campo em 24, o limite real
volta a ser o do banco, que é onde a decisão mora.

O que entrou de verdade aqui é a **invariante** que faltava, em
`testar-politicas-sql.js`: extrair o comprimento emitido pelo SQL e pelo `nuvem.js` e
exigir que o campo e as duas regex o comportem, mais a coerência de alfabeto entre
os dois lados (o `ALFABETO` do gerador e a classe de `FORMA_CODIGO_SALA`). Prova de
dente, feita por sabotagem e desfeita logo depois: com `maxlength="6"` o teste falha
citando os dois números; com `_novo_codigo(26)` no schema ele falha na faixa aceita.
O comentário de `duelo.js`, que dizia "8 letras hoje" sem dizer onde isso era
decidido, passou a apontar para `criar_sala()`.

---

## 4. Correções médias e baixas

- **Retorno de toque perdido.** `:hover` com `:not()` pesa mais que `:active`
  sozinho, e o afundamento do chip desaparecia nos chips sem seleção. Ajustado em
  `style.css` (seção 19) para `.stab`, `.chip-opcao`, `.chip-voz`, com a prova real
  em `auditar-layout.js --rolagem` (`none → matrix(0.99,0,0,0.99,0,4) → none`).
- **Botão "Apagar dados" com sublinhado de link e alvos pequenos** na página de
  privacidade — alvos reavaliados a 390 px.
- **Comentários misturando idiomas** (espanhol em `testar-politicas-sql.js`,
  inglês em `schema.sql`, palavras chinesas em `narracao.js` e em
  `testar-autorizacao.js`) — tudo reescrito em português do Brasil, que é a língua
  do projeto.
- **Assinatura trocada** `tocarUrl(url, chave)` contra chamadas
  `tocarUrl(chave, url)` em `narracao.js`.
- **`id`s de voz do navegador ≠ lista fechada do servidor**: `config.js` expunha
  `referenceId` e um campo de modelo que o servidor não usava. O navegador agora
  escolhe só `sara|bruna|miguel|evelyn`, e um teste confere que as duas listas
  batem — o `reference_id` mora apenas em
  [api/_voz-nucleo.js:31-34](api/_voz-nucleo.js#L31).
- **Funções mortas** `buscarAudio`/`apagarSilencioso` removidas de `narracao.js`.
- **Pasta `capturas/` criada na raiz** por uma rodada antiga do auditor: removida;
  as capturas agora vivem em `testes/capturas/`.
- **Tabela duplicando cabeçalho** em `RELATORIO-BNCC.md`: linha escrita à mão antes
  do cabeçalho gerado; o gerador foi corrigido.

---

## 5. Pendências — o que este ambiente não permitiu conferir

Nada desta lista foi "concluído". Cada item tem o teste que falta e quem precisa
rodá-lo.

1. **RLS contra Postgres real.** Rodar `testes/testar-rls.sql` (16 cenários) no SQL
   Editor do projeto; toda linha precisa terminar em `ok`. Sem isso, a autorização
   do duelo é *escrita*, não *verificada*.
2. **Autorização contra Supabase real.** `testes/testar-autorizacao.js` com duas ou
   três contas de teste (`CM_TESTE_*` em `.env.local`). Sem credenciais ele imprime
   "NÃO EXECUTADO — faltam credenciais de teste. Nada foi provado aqui." e sai 0 —
   não como sucesso, como ausência de prova.
3. **Chamada real à Fish Audio.** A função está escrita e testada contra uma `fetch`
   falsa rotulada como simulada (`testes/testar-narracao.js`, 260 verificações). Falta
   `FISH_AUDIO_API_KEY` na Vercel e ouvir a primeira frase. As quatro vozes vieram do
   catálogo público conferido em 30/10/2026, são vozes **de comunidade**, e a leitura
   de números em pt-BR só se confirma ouvindo.
4. **Publicação na Vercel.** Nenhuma deploy foi feita daqui. `vercel.json` e
   `package.json` foram validados como configuração (JSON lido, caminhos
   conferidos por `testar-estrutura.js`); o comportamento hospedado é pendente —
   inclusive se `buildCommand: ""` + `outputDirectory: "."` deixam `api/voz.js`
   ser descoberta como função. A regra de decisão está em
   `CONFIGURACAO-DEPLOY.md` §3, item 4.
5. **Revisão pedagógica humana.** Os 30 códigos que aparecem uma única vez e os 6 com
   unidade ambígua estão listados em `RELATORIO-BNCC.md`. Isto exige quem ensina.
6. **Conferência do índice BNCC.** `testes/bncc-matematica.txt` é cópia ASCII sem
   acentuação, não conferida linha a linha contra o PDF do MEC.
7. **Acessibilidade em aparelho real.** Ordem de tabulação e contorno de foco foram
   provados por código (incluindo prova de sabotagem: desligando a entrada do
   diálogo, o vazamento aparece). Leitor de tela de verdade, óculos de toque e
   dedo de criança faltam. **Nenhuma conformidade WCAG 2.2 AA total é declarada aqui.**
8. **Avaliação legal (LGPD / ECA Digital).** Os campos de controlador em
   `privacidade.html` estão marcados "a preencher" de propósito. Não foi inventado
   nome, e-mail, endereço nem base legal. **Isto não é conformidade legal.**
9. **Nada disto foi um teste de invasão.** Não houve pentest, nem varredura de
   vulnerabilidades, nem tentativa de burlar RLS a partir de um cliente hostil real.

---

## 6. Riscos aceitos e registrados

- **`style-src 'unsafe-inline'` continua no CSP.** Motivo: 22 atributos `style=`
  no HTML e 40 escritas `.style.` no JS, concentradas em animações e posições
  calculadas. Redução planejada: mover os `style=` estáticos para classes e
  conservar `unsafe-inline` só enquanto as escritas calculadas existirem, ou adotar
  nonce (imcompatível com cache estático puro). Script não usa `unsafe-inline`.
- **Limitador de requisições da função de voz é em memória.** Cada instância tem seu
  contador (`FISH_AUDIO_POR_HORA`, padrão 240/h). Protege contra deslize de dedo,
  não contra abuso coordenado. Registrado de propósito em `SEGURANCA.md`.
- **Bibliotecas por CDN sem SRI.** `font-awesome` (cdnjs), fonte (Google Fonts) e
  `@supabase/supabase-js` (jsdelivr, fixado em 2.45.4) não têm `integrity`. O
  `nuvem.js` confere a origem antes de injetar ([nuvem.js:156-163](nuvem.js#L156)), e
  o CSP lista as origens. Para uso em escola com rede bloqueada, baixar os arquivos
  e apontar os `<link>` para o caminho local.
- **Sem chave privilegiada no navegador.** A anon key é pública por desenho; o que
  protege são as políticas. `testes/testar-segredos.js` varre os 40 arquivos e proíbe
  `service_role`, JWT `eyJ…` e chave Fish em texto versionado.
- **Duelos simultâneos na mesma sala** não são controlados: a sala tem dois lugares e
  o assento é calculado pelo banco, mas duas partidas em paralelo na mesma sala não
  fazem sentido e não foram bloqueadas além do estado `esperando`/`ativa`/`encerrada`.
- **Perda de dados aceita na migração 00001**: `salas` e `jogadas` são recriadas.
  Estado transitório de partida, sem dado pessoal — documentado no arquivo da
  migração e em `CONFIGURACAO-DEPLOY.md`.
- **A migração de chave antiga de armazenamento** (`candymath_v2` → `candymath_v3`)
  continua lendo a chave antiga; um payload corrompido agora é copiado para
  `candymath_v3_danificado` antes de o jogo recomeçar limpo, para que a família
  possa imprimir o que havia.
- **Publicar a raiz publica `supabase/` e `testes/`.** Com `outputDirectory: "."`, o
  schema, o `testar-rls.sql` e estes documentos ficam em endereço público. Nenhum
  segredo está aí — e é o que a varredura de segredos garante — mas a regra de
  autorização escrita vira leitura pública. As três saídas (aceitar, gerar um
  `dist/` do navegador, ou mover `testes/` e `supabase/` para fora da raiz) estão em
  `SEGURANCA.md`, item 11. Não foi implementada nenhuma: escolher é decisão do dono,
  e a opção (b) mudaria o modelo de "abrir sem build".

---

## 7. Arquivos desta auditoria

**Criados:** `testes/_raiz.js`, `testes/servidor-estatico.js`,
`testes/testar-estrutura.js`, `testes/testar-segredos.js`,
`testes/testar-politicas-sql.js`, `testes/testar-rls.sql`,
`testes/testar-autorizacao.js`, `testes/testar-narracao.js`,
`testes/relatorio-bncc.js`, `api/_voz-nucleo.js`, `api/voz.js`, `narracao.js`,
`privacidade.html`, `package.json`, `.gitignore`, `.env.example`,
`supabase/migrations/00001_endurecer_autorizacao_salas.sql`,
`AUDITORIA.md`, `RELATORIO-TESTES.md`, `SEGURANCA.md`, `CONFIGURACAO-DEPLOY.md`.

**Alterados:** `supabase/schema.sql`, `nuvem.js`, `duelo.js`, `config.js`,
`index.html`, `script.js`, `style.css`, `conteudo.js`, `banco-itens.js`,
`como-jogar.js`, `avaliacao.js`, `guarda-roupa.js` (só leitura), `vercel.json`,
`README.md`, `testes/validar-conteudo.js`, `testes/validar-css.js`,
`testes/validar-banco.js`, `testes/auditar-layout.js`.

**Removidos:** a pasta `capturas/` solta na raiz (as capturas viveram em
`testes/capturas/` o tempo todo, e foi lá que voltaram a ser gravadas).

Nenhuma duplicata de arquivo de projeto foi encontrada — o diagnóstico inicial
citava uma `Candy-Math-main/Candy-Math-main/` e referências a `assets/fonts/`;
nenhum dos dois existe nesta árvore, e a correção foi fazer os scripts apontarem
para a raiz real.
