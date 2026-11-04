# Relatório de testes — Candy Math

Executado em 30/10/2026, nesta máquina: Windows 10 (10.0.19045), Node **v24.15.0**,
Git Bash. Sem `npm install` — a suíte inteira é Node puro, sem dependências.
Os números abaixo são saída colada dos comandos, não uma conta de memória.

A suíte foi **reexecutada em 04/11/2026** depois de entrar o cache de narração no
Supabase (tabela `narracoes`, bucket privado e as funções da ponte de voz), em Linux
com Node **v22.23.4**. Os números desta tabela são dessa reexecução; o que mudou em
relação a 30/10 está marcado na coluna do meio.

Estado no fim desta auditoria: **`npm test` termina com código 0**, e as quatro
variações do auditor de layout terminam com código 0. **Seis coisas ficaram sem
prova real** e estão listadas no item 5 — elas não passam por aprovadas.

---

## 1. A suíte completa

```bash
cd Candy-Math-main
npm test
```

Encadeia, nesta ordem, e para na primeira falha:

| script | o que ele conferiu | resultado real |
|---|---|---|
| `testes/testar-estrutura.js` | raiz, referências do HTML, ordem de carregamento dos módulos, caminhos dos scripts do `package.json` e do README, `node --check` em todo JS, e as páginas HTML (sem `<script>` inline, sem atributo `on*`, sem `javascript:`) | **725 checagens · 0 problemas** |
| `testes/testar-segredos.js` | 40 arquivos lidos (eram 39; a migração do cache é a nova) atrás de `service_role`, JWT `eyJ…`, chave Fish, token genérico ≥ 32 caracteres e chave SSH; existência de `.gitignore`/`.env.example`; valores falsos no exemplo; 13 referências locais do HTML | **0 problemas · 0 avisos** |
| `testes/testar-politicas-sql.js` | invariantes de autorização no `schema.sql` + 2 migrações + arquivos do navegador: RLS nas 8 tabelas, nenhuma política `using (true)`/`for all`, `revoke` do `anon`, 20/20 `security definer` com `search_path`, SELECT-only em `salas`/`jogadas`, formato e trava de enumeração do código, campo da sala comportando o código que o banco emite — e, do cache: `narracoes` sem política **e** sem grant, `caminho` derivado, chave em hex, bucket privado e as duas RPCs só para `service_role` | **81 verificações · 0 falhas** |
| `testes/testar-autorizacao.js` | parte estática (A0): o interruptor do duelo é conferido **antes** de cada chamada de rede, em 12 portas; e recusa o modo rede no clique, não só no desenho do chip | **17 verificações · 0 falhas** + `NÃO EXECUTADO — faltam credenciais de teste. Nada foi provado aqui.` |
| `testes/testar-narracao.js` | ponte de voz com `fetch` e `env` falsos: teto de texto, vozes fora da lista, sem chave → 503, limite → 429, upstream → 502, interrupção, troca de voz, cache com revogação, ausência de segredo no navegador, ids do `config` batendo com a lista fechada do servidor — e, desde 04/11, o cache de áudio no Supabase: a procura pela chave sha256, o acerto que **não** chama a Fish Audio, a gravação do MP3 no bucket, o `usos` subindo, a poda das menos usadas, o banco caindo no meio de cada etapa, por status e por **queda de rede** (`fetch` rejeitando: dns, conexão resetada — a procura, o arquivo que não desce, o upload e a conta de uso), o SSRF recusado e `CM_CACHE=off` | `★ TESTE SIMULADO: ambiente, rede e navegador são falsos. Nada aqui prova a síntese real da Fish Audio.` — **260 verificações · todas verdes** (eram 208) |
| `testes/validar-banco.js` | os 311 itens autorais e as 96 afirmações: id único, 4 alternativas sem repetição, `valor` batendo com a resposta, unidade válida, código BNCC presente na lista oficial | `itens autorais: 311 \| afirmações: 96` — **erros: 0** |
| `testes/validar-conteudo.js` | os 55 geradores em 9 anos × 4 níveis × 25 sorteios (**49 500 itens**), os **311 itens do banco um a um**, 900 afirmações V/F, 5 400 chamadas dos jogos de sequência/ordenação/memória/cruzadinha/balança, e a conferência das representações em doces. Inclui agora a regra de duplicata numérica e a proibição do texto `(opção N)` | `erros encontrados: 0` |
| `testes/relatorio-bncc.js` | vínculo código ↔ ano ↔ unidade e cobertura; gera `RELATORIO-BNCC.md` com semente fixa (20261030), então os números repetem | **16 conferências estruturais, todas verdes** · índice 247 · usados 195 · sem uso 52 · uma vez só 30 · unidades múltiplas 6 |
| `testes/validar-css.js` | 797 regras lidas (32 ajustes por `@media`): escala fluida, largura fixa sem freio, variável usada sem definição, seletores duplicados em conflito, id citado no JS ausente no HTML, classe criada no JS sem regra no CSS | `regras lidas: 797` · todas as sete famílias **nenhuma** · **css revisado sem pendências** |

Comandos individuais, se quiser rodar um só:

```bash
node testes/testar-estrutura.js
node testes/testar-segredos.js
node testes/testar-politicas-sql.js
node testes/testar-autorizacao.js      # pede credenciais; sem elas se autodeclara pendente
node testes/testar-narracao.js         # simulado, e diz que é simulado
node testes/validar-banco.js
node testes/validar-conteudo.js
node testes/relatorio-bncc.js          # npm run bncc
node testes/validar-css.js
```

**As checagens novas batem de verdade?** Em 04/11 o núcleo da voz foi sabotado três
vezes, numa cópia da árvore em `/tmp` (o projeto não foi tocado): (1) o acerto de
cache parar de contar o uso → **3 falhas contadas**; (2) o `catch` da gravação passar
a deixar o erro subir → a suíte morre exatamente na cena do upload que cai; (3) o
`catch` da procura idem → morre na cena da queda de dns. Duas das três sabotagens só
foram pegas depois de entrarem as oito checagens de **queda de rede** (`fetch`
rejeitando, não devolvendo 500) — antes delas a suíte ficava verde com o cache capaz
de derrubar a narração. É por isso que elas existem: erro de rede com o banco é o
caminho mais provável de acontecer em produção, e era o único não exercido.

---

## 2. O auditor de layout (Chrome headless)

Precisa de um servidor na porta 8765. `npm start` sobe um que serve os mesmos
cabeçalhos de segurança do `vercel.json`; `/api/*` devolve 501 porque função
serverless só existe na hospedagem (isso é proposital: exerce o caminho de
fallback da narração).

```bash
npm start                       # ou: node testes/servidor-estatico.js
node testes/auditar-layout.js   # em outro terminal
```

| modo | o que faz | resultado real |
|---|---|---|
| padrão | mede tela por tela em 320×640, 390×844, 768×1024 e 1440×900: corte vertical, caixa passando da largura da janela, trilho de rolagem horizontal, texto cortado, alvo de toque abaixo de 40 px, elemento colapsado a 0×0, e "o que deveria estar na frente" | **telas medidas: 204 · com achado: 0** · capturas em `testes/capturas/` |
| `--prova` | prova que o medidor enxerga quebra: injeta quatro defeitos conhecidos na tela do jogo, mais um caso de acessibilidade (ícone novo, botão sem texto, aviso) e um de documento preso | **6/6 casos verdes** — os quatro injetados foram achados (`corteVertical 322px`, `foraDaTela direita 1010px`, `alvoPequeno 74x18`, `colapsado 0x0`), "medidor confiável", ícones escondidos com o nome do botão preservado, e leitura limpa de 3788 px com o bloqueio injetado notado |
| `--rolagem` | rola de verdade em janela baixa e barra de tela: barra que sobe, barra grudada, movimento reduzido, retorno de toque e navegação por foco em diálogo | verde — 4 barras grudadas e 1 devolvendo espaço; chip de ano afunda `none → matrix(0.99,0,0,0.99,0,4) → none`; foco entrou em cada diálogo, percorreu 3 alvos sem vazar para a tela de trás e voltou ao hub; desligando a entrada do diálogo, **o vazamento aparece** |
| `--doces` | confere a chuva de doces girando nos dois ramos de movimento | verde — quadros em `testes/capturas/splash-*.png` |

O `--prova` não é decoração: foi ele que mostrou que as quatro famílias de achado
estavam **CEGAS** porque o portão do tutorial engolia a abertura do jogo. Desde
então o auditor passa o tutorial antes de medir e denuncia tela errada em vez de
medir em silêncio.

---

## 3. Jogo aberto em navegador real

Além das medições, o fluxo foi percorrido no navegador sobre estes arquivos:

- boot sem `config.js` preenchido — o jogo abre, a nuvem se declara desligada e o
  duelo aparece com a nota explicando o que falta (modo local continua inteiro);
- uma partida completa do Quiz Doce com os três degraus de erro (pista → desenho
  em doces → revelação com consolidação) e o fim de rodada subindo o nível;
- uma partida completa de Caça ao Número no modo local até o placar final, com o
  portão "Estou pronto" entre turnos e a invariante peças vivas = contas na fila
  respeitada;
- o boletim dos responsáveis montado com as dez seções, e uma prova de 12
  perguntas registrada no armazenamento local e lida depois;
- a tela de voz abrindo, oferecendo as quatro vozes, o estado "falando…" e o botão
  de parar cortando a fala (exercitado pelo `testar-narracao.js`, que é simulado);
- os dois caminhos de exclusão: o modal "Apagar dados" abre do boletim, o botão de
  apagar a conta em nuvem nasce **desabilitado** com a frase honesta do modo
  aparelho fechado, o primeiro clique arma ("Clique de novo para apagar") e o
  segundo limpa o `localStorage`; a contagem de chamadas de subida ficou em **0**,
  provando que a limpeza local não escreve na nuvem.

---

## 4. O que cada prova **não** cobre

- Um teste de sintaxe não diz se a questão é boa para a idade.
- `validar-css.js` e o auditor medem geometria; nenhum leitor de tela de verdade
  (NVDA/VoiceOver) narrou estas telas.
- O auditor roda em Chrome headless num desktop. Telefone de criança, toque com
  dedo úmido e 4G instável não entraram.
- `testar-narracao.js` usa `fetch` falso. Ele prova o contrato da função, não a
  voz que sai da caixinha.
- `testar-politicas-sql.js` lê SQL. Ele prova que a regra está escrita, não que o
  Postgres a aplica.
- O cache de áudio foi exercitado contra um Supabase falso, linha a linha: as
  requisições de tabela, de bucket e de RPC têm o formato esperado e as quedas do
  banco são tratadas. Nenhum MP3 foi gravado num Storage de verdade ainda — isso
  é o item 5.

---

## 5. Testes que **não** rodaram — e o que falta para rodar

Estes seis são a diferença entre "implementado" e "comprovado no ambiente real".
Nenhum foi escondido: `testar-autorizacao.js` entra na cadeia do `npm test` e imprime
"NÃO EXECUTADO" na própria saída, e `testar-rls.sql` está no repositório esperando o
banco — ele não roda em Node, roda no Postgres.

| teste | por que não rodou aqui | quem roda, e como |
|---|---|---|
| `testes/testar-rls.sql` (16 cenários) | sem `psql` e sem Docker nesta máquina; nenhuma linha foi executada contra Postgres | dono do projeto, no SQL Editor do Supabase: colar e executar; **todas** as linhas devem terminar em `ok` |
| `testes/testar-autorizacao.js` (A1–A10 reais) | sem `SUPABASE_URL`, `SUPABASE_ANON_KEY` e três contas de teste | dono: preencher `.env` (modelo `.env.example`) e rodar `node testes/testar-autorizacao.js` |
| chamada real à Fish Audio | sem `FISH_AUDIO_API_KEY`; a chave é do dono e nunca entra no repositório | dono: publicar a função, definir a variável e ouvir a primeira frase em cada uma das quatro vozes |
| cache de áudio em Storage real | sem `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` na Vercel, nenhum objeto foi escrito no bucket e nenhuma linha entrou em `narracoes` | dono: com as duas variáveis no ar, ouvir uma frase duas vezes e conferir (1) a linha em `select voz, usos, bytes from narracoes;`, (2) o objeto `voz/chave.mp3` no bucket privado e (3) na segunda frase o tempo visivelmente menor, sem chamada nova à Fish Audio |
| deploy na Vercel (preview e produção) | nenhuma publicação foi feita a partir daqui | dono: importar a pasta, `framework: null`, conferir os cabeçalhos com `curl -I` no endereço publicado |
| revisão pedagógica humana | isto não é script | professora/professor de Matemática, começando pela lista de 30 códigos que aparecem uma vez só em `RELATORIO-BNCC.md` |

Enquanto os dois primeiros não passarem, **o duelo em rede continua desligado**
(`config.js` → `dueloRedeHabilitado: false`), que é o estado honesto: sem a prova,
não há como dizer que é seguro.

---

## 6. Como reproduzir do zero

```bash
node --version            # qualquer 20+ (rodou em 24.15.0 e, na reexecução do cache, em 22.23.4)
cd Candy-Math-main
npm test                  # a suíte inteira, sem instalar nada
npm start                 # sobe http://127.0.0.1:8765
node testes/auditar-layout.js --prova   # em outro terminal
```

Para jogar sem servidor: abrir `index.html` no navegador funciona por `file://`.
