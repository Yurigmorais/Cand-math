# Histórico e Contexto do Projeto "Candy Math"
*(Contexto para futuras sessões com IAs — atualizado em Outubro/2026)*

## 1. O que é o projeto?
Jogo educativo de Matemática para o Ensino Fundamental (1º ao 9º ano), com temática
de doces estilo cartoon. A criança joga por **trilhas alinhadas à BNCC**; o
responsável acompanha o progresso na **Área dos Pais** (protegida por PIN).
Projeto pensado para publicação: nada de cara genérica de "gerado por IA" — todo
o visual é CSS puro, sem imagens externas além das quatro do mascote.

## 2. Tecnologias
- **Frontend**: HTML5, CSS puro, JavaScript vanilla (ES Modules). Sem framework de UI.
- **Build**: Vite multi-page (`index.html` + `login.html`, ver `vite.config.js`).
- **Mobile**: Capacitor (`capacitor.config.ts`).
- **Persistência local**: `src/storage/storageAdapter.js` escolhe `@capacitor/preferences`
  (nativo) ou `localForage`/IndexedDB (web). **O save local continua sendo a fonte da verdade.**
- **Nuvem (opcional)**: `src/services/` fala com Supabase pela API REST (PostgREST),
  **sem SDK no bundle**. Ligado apenas por `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
  (ver `.env.example` e `supabase/schema.sql`). Sem as variáveis, nenhuma chamada de rede acontece.
- **Hospedagem**: `vercel.json` pronto (framework Vite, `dist/`, cache de assets, headers).
- **Fontes**: Luckiest Guy (títulos), Comic Neue (contagem/perguntas), Nunito (interface),
  Lexend (modo dislexia) — todas via `<link>` nas duas páginas. **Não usar `@import` no meio do `style.css`** (o navegador ignora).
- **Ícones**: Font Awesome 6.5.0 via CDN nas duas páginas (manter as versões iguais).

## 3. Arquitetura
- `src/data/curriculum.js`: a matriz BNCC — 5 unidades temáticas (`UNITS`), 16 trilhas
  (`TRACKS`), 77 habilidades (`h(id, nome, gen, cfg, grades, codes)`), índices
  `TRACKS_BY_ID` / `SKILLS_BY_ID`, `MODO_SKILLS` (habilidades que só existem por modo de jogo,
  como a grade da cruzadinha) e `MIX_TRACK`.
- `src/engine/generators/*.js`: um arquivo por unidade temática. Cada gerador devolve
  `{ prompt, value, opts:{options, answer}, explain, visual:{kind,...}, eq, icon, unidade, op }`.
  `generators/index.js` monta o contrato único de pergunta, valida (opções duplicadas/vazias)
  e tem `fallback()`. `paraTrueFalse()` converte qualquer pergunta em afirmação de V/F.
- `src/engine/questionGenerator.js`: sorteio **adaptativo** — `peso()` dá mais chance às
  habilidades com mais erros; `novaPergunta({trackId, grade})` é a entrada de todos os modos.
- `src/engine/mathDifficulty.js`: escala de dificuldade por ano (`ramp`, `perfilPorAno`).
- `src/games/`: um arquivo por modo — quiz, falling (Chuva de Doces), race (Corrida Doce),
  tf, memory, puzzle (cruzadinha), fraction (Fatia de Bolo), balance (Balança da Juju),
  market (Mercadinho). `gameManager.js` tem o mapa `MODOS` (chave → nome/start/tela) e o
  modal de trilhas; `gameUtils.js` tem timer de resposta, placar por modo (`registrarPartida`)
  e `finishRound()`.
- `src/state/gameState.js`: objeto global `G` + `registrarTentativa(q, ok, ms, modo)`, que é
  **o único ponto que alimenta** skillStats, unitStats, modeStats, sessions e o log `attempts`.
- `src/storage/persistence.js`: `CAMPOS` lista tudo que é salvo; `saveState()` também chama
  `queueRemoteSync()` da camada de nuvem.
- `src/services/`: `supabaseClient.js` (REST + `X-Device-Token`) e `dataService.js`
  (monta lotes, fila em `localStorage candymath_sync_queue_v1`, reenvio ao voltar a rede,
  `pullProgress()`, `syncStatus()` exposto em `window.candySync`).
- `src/ui/`: `hubUI.js` (faixa da trilha, missões, recorde por modo), `visuals.js`
  (**desenho CSS de cada `visual.kind`**), `parentsUI.js` (relatório), `progressUtils.js`
  (`masteryDe`, `domineiu`), `screenManager.js`, `modalManager.js`, `shopUI.js`,
  `studyOverlay.js`, `toastManager.js`.
- `login.html` + `src/loginMain.js`: cadastro (nome, idade, **ano escolar**, responsável,
  e-mail e **PIN de 4 dígitos**). Não existe mais `src/ui/loginUI.js`.

## 4. Contrato visual das perguntas
Toda pergunta traz `visual = { kind, ... }` e `visuals.js` sabe desenhar o kind.
Hoje geradores e desenhos batem 1:1 (32 kinds). Ao criar um kind novo:
1. emitir em um gerador; 2. tratar em `renderVisual()`; 3. criar as classes `.dv-*` no `style.css`.
Os campos lidos por `renderVisual()` precisam existir no objeto enviado pelo gerador —
uma checagem simples é grep dos `kind:` contra os `tipo ===`.

## 5. Área dos Pais
`openParents()` exige PIN (o primeiro PIN criado vale para perfis antigos/visitante).
O relatório lê `G.unitStats`, `G.skillStats`, `G.sessions` e `G.attempts` e mostra:
domínio por unidade, habilidades para reforçar / já firmadas, tempo de resposta,
sessões por dia, plano de estudo com modo de jogo sugerido, troca de ano escolar,
exportação CSV (separador `;`, com códigos BNCC) e impressão (`@media print`).
Domínio usa suavização de Laplace `(c+0.5)/(c+w+1)` para não mostrar 0%/100% com 1 resposta.

## 6. Registro de progresso (o que sobe para o Supabase)
`profiles` ← perfil + ajustes + placar; `skill_progress` ← uma linha por habilidade;
`sessions` ← uma linha por dia; `attempts` ← cada resposta (append, incremental por cursor).
As colunas estão em snake_case e espelham `CAMPOS` de `persistence.js`.
**Ao mexer em `gameState.js`, atualizar `supabase/schema.sql` junto.**
RLS fase 1 isola por `X-Device-Token`; antes de abrir contas reais migrar para a fase 2
(Supabase Auth) descrita no próprio SQL — necessário quando há dados de criança.

## 7. Armadilhas conhecidas
- `package.json` só tem Vite + Capacitor; **não adicionar dependência sem rodar `npm install`**.
- Toda função chamada por `onclick=""` no HTML precisa estar em `window.*` (exportada em `main.js`).
- `resetGame()` preserva `G.profile` (senão a criança volta para a tela de entrada).
- IDs criados em `innerHTML` (ex.: `balSaco`, `cell-<r>-<c>`) não existem no HTML estático — são normais.
- Modo sem `finishRound()` (cruzadinha) precisa chamar `registrarPartida()` para entrar no placar.
- A missão `correct_math` sobe em `registrarTentativa()`; **não chamar `progressQuest('correct_math')`
  dentro de um minigame** (duplicaria).
- Sem Node nesta máquina: não dá para rodar `npm run dev/build` aqui — validar estaticamente
  (IDs usados por `$('...')` vs HTML, imports vs exports, balanceamento de chaves, `onclick` vs `window`).
