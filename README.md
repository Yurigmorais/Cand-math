# Candy Math

Jogo de matemática para o Ensino Fundamental (1º ao 9º ano), com conteúdo
alinhado às habilidades da BNCC. Abre direto no navegador, sem instalação,
sem servidor e sem dependências externas para jogar.

Na tela inicial há 15 cartões: **13 jogos de rodada** (Quiz Doce, Verdadeiro
ou Falso, Roleta, Pescaria, Balões, Chuva Numérica, Caça-Toupeira, Memória,
Cruzadinha, Ordene, Sequência, Operador e Balança), o **Caça ao Número** — um
duelo 1 x 1 por turnos — e a **Prova de Aprendizagem**, que verifica se o
conteúdo ficou quando ninguém ajuda.

## Pré-requisitos

| Para | Você precisa de |
|---|---|
| jogar | um navegador moderno. Nada mais — nem Node, nem internet, nem conta |
| rodar os validadores e o auditor de layout | Node 20+ (`node --version`) |
| ligar a nuvem (login, boletim de outro aparelho, sincronizar) | um projeto Supabase gratuito e a `Publishable key` dele (a antiga `anon public key`) |
| ligar a narração por IA | uma conta na Fish Audio AI e a hospedagem na Vercel (a chave é secreta e mora lá, nunca no navegador) |
| ligar o duelo em rede | **só depois** de aplicar o schema e rodar os dois testes de autorização — veja "Recursos desativados por segurança" |

## Como rodar

Abra o arquivo `index.html` no navegador. Ele funciona com o protocolo
`file://`, então basta dar dois cliques.

Para servir por HTTP — o caminho que a publicação usa, e o único em que os
cabeçalhos de segurança do `vercel.json` existem — rode o servidor que já vem
no projeto:

```bash
npm start          # http://127.0.0.1:8765 (Node 20+, sem instalar dependência)
```

Ele serve os mesmos cabeçalhos de CSP, `nosniff`, `X-Frame-Options` e cache
do `vercel.json`, e responde **501** para `/api/*`: função serverless só
existe na hospedagem. Isso é proposital — deixa o caminho de falha da voz
visível localmente em vez de fingir que a função respondeu.

Se preferir outro servidor estático, `npx serve .` na raiz também abre o jogo.

O jogo inteiro funciona **sem internet e sem conta**. A nuvem (login,
verificação de e-mail, boletim lido de outro aparelho e sala por código no
duelo) é opcional e só acende quando você preenche `config.js` com o seu
próprio projeto Supabase — veja "Publicar e ligar a nuvem".

## Estrutura

```
index.html            telas, hub dos 15 cartões, guarda-roupa, recordes, boletim dos responsáveis
privacidade.html      página de texto sobre o tratamento de dados (sem nenhum script)
style.css             visual candy, responsivo, foco de teclado e movimento reduzido
script.js             estado, fluxo de rodada, feedback pedagógico, save/load
conteudo.js           motor de conteúdo: 55 geradores com valores calculados
banco-itens.js        banco autoral: 311 situações escritas + 96 afirmações V/F
guarda-roupa.js       catálogo da loja: 79 peças, preços, abas e conjuntos
como-jogar.js         explicação de regras que entra antes da primeira partida de cada jogo
avaliacao.js          prova de aprendizagem (12 perguntas) + boletim dos responsáveis
duelo.js              Caça ao Número: tabuleiro de números, turnos e relógio dos dois lados
narracao.js           voz do Juba Candy: função remota → voz do aparelho → silêncio
config.js             o que liga o jogo ao Supabase e à narração (vazio = offline)
nuvem.js              conta, verificação de e-mail, vínculo com o responsável, sincronização e salas
api/voz.js            casca Vercel da função de voz (só req/res)
api/_voz-nucleo.js    toda a decisão da função: vozes válidas, teto de texto, limite, cache, upstream
supabase/schema.sql   tabelas, RLS por operação, funções RPC, view, bucket do cache e lista do Realtime
supabase/migrations/  00001_endurecer_autorizacao_salas.sql e 00002_cache_narracao.sql — para quem já tinha dados
testes/               validadores, auditor de layout e o servidor estático de desenvolvimento
vercel.json           build estático + cabeçalhos de segurança e de cache
package.json          npm start, npm test e um comando por validador
.env.example          nomes das variáveis (públicas e secretas) — sem valor real
.gitignore            .env, capturas e lixo de editor
```

Mais seis documentos, no mesmo nível do README:

| Arquivo | O que responde |
|---|---|
| `AUDITORIA.md` | o que estava errado, o que foi corrigido e o que continua pendente |
| `RELATORIO-TESTES.md` | resultado real de cada teste, nesta máquina, e o que não rodou |
| `SEGURANCA.md` | modelo de ameaça, matriz de autorização por tabela e o contrato da função de voz |
| `CONFIGURACAO-DEPLOY.md` | passo a passo de Supabase, Vercel, Fish Audio e a ordem de publicação |
| `APRESENTACAO-ONLINE.md` | roteiro de apresentação: como o jogo foi parar na internet, em 15 blocos |
| `RELATORIO-BNCC.md` | cobertura por unidade, ano e código — gerado por `npm run bncc` |

Os dados ficam separados da interface. `script.js` só consome a API pública
`window.CM` exposta por `conteudo.js`, as listas de `banco-itens.js` e o
catálogo `window.CM_GUARDAROPA` de `guarda-roupa.js`. A ordem de
carregamento no HTML é essa e não deve mudar:

```
conteudo → banco-itens → guarda-roupa → como-jogar → avaliacao → duelo
         → config → narracao → nuvem → script
```

`testes/testar-estrutura.js` confere essa ordem, a presença de cada arquivo,
os caminhos relativos, os comandos deste README e `node --check` em todo JS —
foi aqui que o projeto quebrou uma vez (validadores na raiz procurando
arquivo em `../`), então isto ficou como guarda.

Uma nota sobre escopo, porque ela pega quem mexe nesses arquivos tarde:
função declarada no topo de um `<script>` clássico vira propriedade de
`window`, mas `const`/`let` do topo não. Por isso os módulos novos leem o
estado por `try { return G; } catch (e) {}` e não por `window.G`.

## Recursos desativados por segurança

**O duelo em rede está desligado** — `dueloRedeHabilitado: false` em
`config.js:58`. A versão 3.0 tinha políticas que deixavam qualquer pessoa ler
e escrever nas salas a partir do código; conhecer o código era a credencial. O
`supabase/schema.sql` deste repositório corrige isso (autorização por conta,
assento calculado no banco, lances conferidos, SELECT-only nas tabelas de
duelo), mas **a correção só vale depois de aplicada no seu projeto e
verificada**, e essa verificação depende de conta Supabase — por isso ela não
foi feita aqui. Enquanto os passos abaixo não passarem, deixe `false`:

1. aplicar `supabase/schema.sql` (e `supabase/migrations/00001_*.sql` se já
   existir dado da v3.0) no seu projeto;
2. rodar `testes/testar-rls.sql` no SQL Editor — ele tenta as quatro leituras
   e escritas cruzadas entre duas contas;
3. rodar `node testes/testar-autorizacao.js` com três contas de teste
   declaradas em `.env` (copie `.env.example`);
4. só então ligar a flag, e conferir uma partida real entre dois aparelhos.

Nada mais muda no jogo com a flag desligada: o Caça ao Número continua
inteiro com os dois jogadores no mesmo aparelho, e o cartão avisa por que a
sala por código não está oferecida. `testes/testar-autorizacao.js` (parte
estática, A0) confere que o interruptor é lido **antes** de cada chamada de
rede, em 12 portas — não só no desenho do botão.

Também por segurança: a `service_role` key e a `FISH_AUDIO_API_KEY` não
aparecem em nenhum arquivo deste repositório, e o navegador não conhece o
`reference_id` de nenhuma voz — a lista fechada mora no servidor.

## Modelo de progressão

O jogador escolhe **ano** (1º ao 9º) e **nível** (Base, Prática, Desafio,
Domínio) no hub. A dupla ano + nível define o baralho da rodada:

- faixas numéricas e tipos de operação escalam por ano e por nível, a partir
  de `PERFIS` em `conteudo.js`;
- cada item carrega `ano`, `nv`, unidade temática, `o` (objeto de
  conhecimento), `bncc` (código da habilidade) e, quando numérica, `valor`;
- dentro de uma rodada nada se repete, e as últimas 12 perguntas ficam em
  memória para não repetir enunciado ao trocar de jogo.

As cinco unidades seguem a BNCC: Números, Álgebra, Geometria, Grandezas e
Medidas, Probabilidade e Estatística.

### O que cada nível faz

O nível não troca o conteúdo do ano — troca o tamanho dos números e quantas
etapas a resolução tem. O hub mostra esta explicação em uma linha, que muda
conforme o nível escolhido:

- **Base** — números menores e uma etapa por vez. É o começo tranquilo do
  conteúdo do ano.
- **Prática** — os números do seu ano, ainda com tempo para pensar. Aqui a
  conta fica mais completa.
- **Desafio** — problemas com mais etapas, medidas para converter e números
  que exigem atenção.
- **Domínio** — o mesmo conteúdo, misturado e com conta mais longa. Aqui você
  resolve sozinho.

A regra de movimento é uma só, e aparece no fim de cada rodada: rodada
completa sobe um degrau, um acerto ou nenhum desce um. O ano nunca muda sem o
jogador pedir. Os chips de nível também levam a descrição em `title` e
`aria-label`, para quem passa o mouse ou usa leitor de tela.

## Conteúdo

Duas fontes, usadas em conjunto:

- **Motor** (`conteudo.js`): gera a questão na hora, com os números
  calculados. Usado quando a dificuldade precisa de ajuste fino por nível —
  operações, frações, porcentagem, expressões algébricas, equações, sistemas,
  potenciação, radiciação, Teorema de Pitágoras, funções, volume,
  probabilidade e estatística.
- **Banco autoral** (`banco-itens.js`): situações escritas uma a uma para os
  temas que o motor não alcança bem, principalmente geometria, grandezas e
  medidas e tratamento da informação no Fundamental 1, e leitura de gráficos
  e tabelas.

O sorteio (`C.sortear`) combina as duas fontes e prioriza o que o jogador
ainda não usou.

## Ciclo de aprendizagem em cada jogo

Todos os 13 jogos de rodada devolvem um texto que diz o que aconteceu, não só
um som de acerto ou erro. "Qual o Sinal?" explica qual era o sinal certo;
Verdadeiro ou Falso sempre traz a justificativa da afirmação; Ordene os
Números aponta a posição que está fora de lugar; Pescaria, Balões Doces, Chuva
Numérica e Caça-Toupeira avisam que a resposta certa ainda está em jogo.

No **Quiz Doce**, que é a atividade de questão única com tempo para pensar, o
erro tem três degraus:

1. **Primeiro erro** — aparece uma pista, escrita por unidade temática, que
   orienta como ler o enunciado. Nenhuma pista entrega a resposta. A
   alternativa errada fica indisponível, mas a criança ainda pode acertar e
   recebe a estrela cheia.
2. **Segundo erro** — aparece a **representação da situação em doces**, se o
   item tiver estrutura representável. A criança continua podendo responder.
3. **Terceiro erro** — a resposta certa é revelada junto com o nome do
   conteúdo praticado, e uma questão de **consolidação** do mesmo objeto de
   conhecimento entra como a próxima pergunta. A rodada continua com cinco
   questões; a de reforço ocupa um desses lugares.

Na Roleta da Sorte, que é de tempo curto, o degrau do meio não cabe: lá são
pista no primeiro erro e revelação no segundo.

## Representação em doces

Quatro tipos de desenho explicam a estrutura da conta, em vez de enfeitar:

- **grupos** — fileiras de bombons para a ideia de "a caixas com b em cada
  uma";
- **repartir** — balas distribuídas uma a uma em pratos, para divisão exata;
- **barra** — barra dividida em partes iguais, com as partes contadas
  pintadas, para fração de uma quantidade;
- **malha** — malha de 100 quadradinhos com a porcentagem pintada, dizendo
  quanto vale cada quadradinho.

O `visual` é dado, criado junto com o item em `conteudo.js`; `script.js` só o
desenha. Um item vem sem visual quando os números são grandes demais para o
desenho fazer sentido (mais de 10 grupos, mais de 60 balas, mais de 12 partes)
ou quando a situação é textual demais para uma representação honesta — nesses
casos o Quiz para na pista e na revelação. Os validadores conferem se o
desenho bate com a resposta: `grupos × cada`, `total ÷ partes` e o valor da
parte pintada.

Nas afirmações de Verdadeiro ou Falso a justificativa sempre acompanha o
resultado.

## Fim de rodada

Cada rodada tem 5 questões (3 na Cruzadinha e na Memória Doce, onde o esforço
é de outra ordem). Pontuação por acerto varia por jogo, e o fim da rodada soma
bônus: 25 estrelas no acerto completo, 10 a partir de 3 acertos. A tela de fim
de rodada diz o que aconteceu com o nível e por quê.

## Como se jogar (tutorial)

Antes da **primeira** partida de cada jogo, uma tela de regras entra no
caminho: o que o jogo treina, quantos passos tem, o que acontece quando se
erra e como a partida termina. São passos numerados, curtos, na linguagem do
jogo. No duelo, a explicação ainda traz um tabuleiro de mentira para tocar: a
criança escolhe o número da conta e vê na hora o que acerto e erro fazem.

Depois da primeira vez o cartão abre o jogo direto, e o "?" no canto do
cartão reabre a mesma explicação. O registro de "já viu" mora no
`localStorage`, então trocar de aparelho mostra o tutorial de novo — o que é
o comportamento desejado para quem joga pela primeira vez em outro lugar.

Arquivo: `como-jogar.js` (`window.CM_TUTORIAL`). Cada jogo tem seu próprio
texto; os números citados nele vêm das mesmas constantes usadas pelo jogo, e
não de um texto solto.

## Caça ao Número — duelo 1 x 1 por turnos

Um cartão do hub (`hc-duelo`) abre uma partida em que a tela se enche de
números e uma conta aparece no topo. O jogador resolve a conta e toca no
número certo no meio de todos os outros.

- **Densidade**: 20, 40, 60 ou 80 números na tela, escolhidos antes da
  partida. A partida só termina quando **todos** os números forem achados —
  por isso a fila de contas tem exatamente o tamanho do tabuleiro, e essa
  igualdade (peças vivas = contas na fila) é a invariante do jogo.
- **Turnos**: cada vez é de um jogador. O relógio dele corre; o do outro fica
  parado. Ao passar a vez — acerto, erro, tempo esgotado ou "Passar a vez" —
  entra um portão com "Estou pronto", para ninguém ser pego com o relógio
  rodando sem olhar a tela.
- **Tempo por vez**: 30 s no Base e no Prática, 40 s no Desafio, 45 s no
  Domínio, com a opção "Dobrar o tempo de cada vez" para quem ainda está
  ganhando fôlego.
- **Erro**: não elimina. A mesma conta volta na próxima vez da pessoa, e o
  custo é tempo. Se ninguém achar a resposta em três passadas seguidas, o
  número certo começa a brilhar e vale para quem tocar primeiro.
- **Placar**: 1 estrela por número achado, mais 15 de bônus de vitória para
  quem fecha a caçada. Empate é um resultado possível e explicado.
- **Dois modos**: *Dois no aparelho* (local, os dois se revezando no mesmo
  celular) e *Sala por código*, em que cada um joga do seu aparelho e as
  jogadas trafegam pelo banco. **A sala por código está desligada por
  segurança** — ver "Recursos desativados por segurança". Sem nuvem
  configurada, ou com a flag desligada, o modo rede avisa e a partida
  acontece local, com o mesmo tabuleiro e as mesmas regras.

O duelo **não muda o nível** do ano: ele treina conta rápida com atenção
dividida. Isso aparece na tela de fim e no boletim, para o número não ser
lido como se fosse outra coisa. Arquivo: `duelo.js` (`window.CM_DUELO`).

Uma nota sobre o tabuleiro, porque é o tipo de coisa que volta a quebrar se
alguém mexer na fonte: o número é a peça, e um `19.968` partido ao meio
("19.96" / "8") cria um número que não existe na rodada. `ajustarGrade()` mede
o maior número da tela com `canvas.measureText`, na fonte computada da própria
peça, e usa essa medida como largura mínima de coluna — por isso a régua vale
tanto com a webfont carregada quanto sem ela, e é refeita quando o
`document.fonts.ready` chega. Se mesmo assim a largura não der, o tabuleiro
rola dentro do próprio quadro (o teto é `max-height`) em vez de deixar a conta
e o relógio saírem da tela. Em janela a partir de 900 px a coluna da partida
abre para 920 px: aqui a tela cheia é o jogo.

## Voz e narração

O botão **Ouvir** fala a pergunta em voz alta. Três caminhos, em ordem:

- **peixe** — pede o áudio à função `api/voz.js` (Vercel → Fish Audio AI) e,
  se ela não vier por qualquer motivo, cai para a voz do aparelho no mesmo
  instante;
- **aparelho** — Web Speech API, nunca sai deste navegador;
- **desligada** — silêncio, que é escolha de quem joga.

Quatro vozes aparecem na tela: **Sara, Bruna, Miguel e Evelyn**. São vozes da
comunidade Fish Audio, conferidas em 30/10/2026 contra o catálogo público e
pinadas por `reference_id` na lista fechada de `api/_voz-nucleo.js:31-34` — o
navegador manda só o rótulo curto (`sara`, `bruna`, `miguel`, `evelyn`) e o
servidor resolve o id. Voz fora da lista é 400. Se uma delas sair do ar ou
não servir, troque o id nas duas listas (`config.js` e o núcleo da função) e
o rótulo da tela continua o mesmo; os testes conferem que as duas listas
batem.

O que **não** acontece: o texto enviado à função é só a frase da pergunta —
nem nome, nem e-mail, nem código, nem estrelas, nem histórico. A chave da Fish
Audio não existe no navegador. Sem a variável secreta na Vercel, a função
responde 503 e o jogo usa a voz do aparelho com uma nota discreta — nunca uma
tela quebrada.

O que **é** gravado, quando o banco está configurado: a frase, o nome da voz e
o áudio, na tabela `narracoes` e no bucket privado de mesmo nome, para a mesma
pergunta não ser sintetizada duas vezes (ver `CONFIGURACAO-DEPLOY.md`, seção
5). Nenhuma identidade acompanha a linha, ela não é ligada a ninguém, as menos
usadas saem com o tempo dentro do teto `CM_CACHE_TETO`, e nem a tabela nem o
bucket são legíveis pelo navegador — quem serve os bytes é a função, pelo
mesmo `/api/voz` de sempre. Além disso, a aba mantém um cache curto em memória
(teto de 8 frases) para a repetição imediata, e ele desaparece ao fechar.

A leitura de números em português ainda precisa ser **ouvida por um humano**
antes de virar padrão: nenhuma síntese real foi executada nesta máquina (ver
`RELATORIO-TESTES.md`). Arquivo: `narracao.js`; contrato da função em
`SEGURANCA.md`; variáveis em `CONFIGURACAO-DEPLOY.md`.

## Prova de aprendizagem

Um cartão próprio no hub abre 12 perguntas do ano escolhido, do nível Base até
o nível em que a criança está agora — ela é cobrada pelo conteúdo que lhe foi
proposto, não por um degrau acima.

A diferença para o jogo é deliberada: **sem pista, sem desenho de doce, sem
correção na hora**. A criança marca uma resposta e segue; o resultado só
aparece no fim, com a leitura por unidade temática. A prova não dá estrela e
não mexe no nível — se desse, todo mundo faria a prova pelo prêmio e o número
deixaria de valer alguma coisa.

Ficam guardadas as últimas 10 provas no aparelho (data, acertos, leitura por
unidade), e elas alimentam a seção de provas do boletim. Arquivo:
`avaliacao.js` (`window.CM_AVALIACAO`).

## Recordes e painel de estudo

O modal de recordes traz estrelas, conteúdos praticados, sequência e acertos,
e um painel **Por onde continuar**. Ele só considera conteúdos com pelo menos
3 tentativas e mostra dois grupos: "Vale revisar" (menos de 60% de acerto) e
"Você já domina" (80% ou mais). É uma estimativa baseada no que foi jogado
aqui, não uma nota escolar — o texto na tela diz isso.

## Boletim dos responsáveis

O botão **Responsáveis** no hub abre um documento — não um painel de
pontuação. A linguagem é formal e a leitura é declaradamente parcial: o
boletim diz o que o jogo registrou, o que isso permite concluir e o que ele
**não** mede. São dez seções numeradas:

1. **Situação observada** — ano, nível, período e o tamanho da amostra em uma
   linha, com os números ao lado (respostas registradas, acertos, conteúdos
   tocados, duelos, provas, estrelas).
2. **O que o jogo está medindo** — e, com o mesmo cuidado, o que ele não
   mede: atenção em sala, sono, humor, competência da professora.
3. **Resultado por unidade temática** — uma barra por unidade da BNCC, com
   acertos sobre tentativas escritos na linha. Unidade sem jogo aparece como
   "ainda não jogado", sem percentual inventado.
4. **Onde deve focar e onde já se adapta melhor** — conteúdos travando
   (abaixo de 60%) e conteúdos que a criança já resolve sozinha (80% ou
   mais), sempre a partir de 3 tentativas; abaixo disso o texto diz que a
   observação é insuficiente. A seção fecha com a **cobertura do ano**:
   quanto do previsto já apareceu pelo menos uma vez. Aparição não é domínio,
   e a linha diz isso.
5. **Provas de aprendizagem aplicadas** — cada prova de 12 perguntas com a
   data e a leitura por unidade, para comparar uma aplicação com a seguinte.
6. **Leitura combinada: jogo e prova** — a comparação que importa: o acerto
   nas rodadas (onde existe pista, desenho e consolidação) contra o acerto na
   prova (onde não existe nada disso). A distância entre os dois é o que diz
   se o conteúdo ficou ou se estava sendo carregado pela ajuda.
7. **Recomendações para quem acompanha** — o que fazer com o que foi lido
   acima, escrito para o adulto, não para a criança.
8. **Como o jogo regula a dificuldade** — a escada de ajuda (pista → desenho
   → resposta com consolidação) e a regra de subir e descer de nível.
9. **Habilidades da BNCC que apareceram** — só o vocabulário comum com a
   escola: os códigos, nunca uma nota.
10. **Conta e onde ficam os dados** — o aparelho, e o que muda se a conexão
    for ligada.

Sem a nuvem ligada, o boletim lê somente o `localStorage` do aparelho e a
primeira seção diz que nada saiu dali. Com a nuvem ligada, ele explica o
cadastro do adulto, o e-mail verificado e que apenas o apelido escolhido viaja
junto com o desempenho.

## Guarda-roupa

Estrelas compram peças para o mascote. São **79 itens em 8 abas**, e a lista
de abas é montada a partir do catálogo — criar uma categoria nova em
`guarda-roupa.js` não exige mexer no HTML.

| Aba | Itens | O que tem |
|---|---|---|
| Conjuntos | 16 | fantasias completas (herói, armadura, colosso verde, motoqueiro, cowboy, baile e doces) |
| Roupas | 16 | camisetas e calças tradicionais, enfeitadas para o lado do doce e com contas matemáticas |
| Calçados | 16 | 4 saltos, 3 tênis sociais, 5 crocs (branca, lilás, azul-bebê, preta, rosa), botinas e botas |
| Chapéus | 9 | coroas, bonés, capacetes e máscaras de baile |
| Óculos | 8 | todos de confeitaria: rosquinha, calda de chocolate escorrendo, pirulito de menta, algodão-doce |
| Perucas | 6 | só franja, cabelo curto completo, longa, e as outras três variações do mascote |
| Extras | 8 | acessórios soltos |
| Tudo | 79 | a loja inteira em uma lista |

Conjunto (`tipo: 'conjunto'`) é a fantasia completa e por isso custa mais
(150–180 estrelas): a compra desconta uma vez e entrega as peças avulsas que
o compõem, listadas no cartão como "Vem junto". Os nomes são autorais e
inspirados em tipos consagrados — nenhum pertence a marca ou estúdio.

A compra desconta estrelas na hora, o item entra em `owned` e o que está
vestido em `equip`. Nada na loja é decoração falsa: todo item listado pode
ser comprado e equipado, e o retrato do mascote reflete o conjunto.

## Publicar e ligar a nuvem (opcional)

O jogo é 100% local até você preencher `config.js`. A nuvem traz quatro
coisas: cadastro de quem acompanha, com **e-mail verificado**, vínculo com a
criança por código de 10 caracteres, leitura do boletim em outro aparelho e —
depois de verificada a autorização — o duelo em **sala por código**.

O passo a passo completo, com as variáveis de ambiente e a ordem de
verificação, está em **`CONFIGURACAO-DEPLOY.md`**. O resumo:

**1. Banco (Supabase).** Crie um projeto gratuito em `supabase.com`, abra o
*SQL Editor*, cole `supabase/schema.sql` e rode. O arquivo é idempotente —
pode rodar de novo. Ele cria `perfis`, `criancas`, `vinculos`, `progressos`,
`salas`, `jogadas`, `tentativas_vinculo` e `narracoes`, ativa RLS com 17
políticas por operação, revoga o acesso direto do `anon` e entra `jogadas` na
lista de mensagens do Realtime. `narracoes` é o cache de áudio: a frase já
narrada volta do banco em vez de ser paga de novo na Fish Audio, e é a única
tabela sem política nenhuma — ela só existe para a `service_role` ler e
escrever, nunca para o navegador. Se o projeto já tem dados da v3.0, aplique
antes `supabase/migrations/00001_endurecer_autorizacao_salas.sql`; se já tem
dados e a `narracoes` ainda não existe, aplique também
`supabase/migrations/00002_cache_narracao.sql` (ele é aditivo: não mexe em
nada que já está lá).

**2. Chaves.** Em *Project Settings → API Keys*, copie o **Project URL** e a
**Publishable key** (no painel antigo, **anon public key** — mesmo papel `anon`) e cole
nas duas primeiras linhas de `config.js`. A anon
key é pública por natureza: quem protege os dados são as políticas RLS, não a
chave. A **service role key nunca entra em arquivo algum do navegador** — ela
tem um único lugar legítimo neste projeto: a variável `SUPABASE_SERVICE_ROLE_KEY`
da Vercel, que a função de voz usa para ler e escrever o cache de áudio. Se
você colar uma chave secreta — `eyJ…` no formato antigo, o prefixo de secreta no
formato novo (`sb_…`) — num lugar que não seja o painel da
hospedagem, está errado. `testes/testar-segredos.js` varre os 40 arquivos
deste repositório atrás disso.

**3. Função de voz (Vercel).** Importe a pasta. O `vercel.json` já declara o
build como estático (`framework: null`, `outputDirectory: "."`), com
`index.html` na raiz e cabeçalhos de cache e segurança; `api/voz.js` vira
função serverless em `/api/voz`. Em *Settings → Environment Variables*
declare, como **Sensitive** e sem marcar "Exposed to the Browser" em nada:
`FISH_AUDIO_API_KEY` (a síntese) e `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
(o cache de áudio — sem essas duas o jogo funciona, só volta a pagar cada
frase). `CM_ORIGENS` é recomendado; `CM_CACHE_TETO`, `CM_CACHE`,
`FISH_AUDIO_MODELO`, `FISH_AUDIO_MAX` e `FISH_AUDIO_POR_HORA` são opcionais.
Os nomes e os padrões estão em `.env.example` e na tabela de
`CONFIGURACAO-DEPLOY.md`.

**4. Verificação de e-mail.** Em *Authentication → URL configuration*, ponha
o endereço público do jogo como **Site URL**, para o link de confirmação
voltar para a mesma página. Em *Authentication → Providers → Email*, deixe o
e-mail habilitado. Sem o clique no link, o jogo avisa que a conta existe mas
não está verificada, e nada sincroniza até verificar.

**5. Confirmar antes de abrir o duelo.** Rode `testes/testar-rls.sql` e
`node testes/testar-autorizacao.js` contra o seu projeto. Sem os dois verdes,
a flag fica `false`.

**O que sobe para o banco**: apelido da criança, ano, nível, estrelas,
histórico por conteúdo, provas e o registro dos duelos. **O que não sobe**:
nome real, foto, escola, endereço, CPF, geolocalização. A criança aparece
como um apelido que o adulto digita e um código gerado no aparelho dela.

**Se a nuvem estiver desligada** (configuração vazia, sem internet, ou rede
que bloqueia websocket), o jogo continua igual: o painel de conexão explica o
que falta, a sala por código cede lugar ao modo local com um aviso honesto, e
o Realtime tem varredura a cada 900 ms como reserva. A sincronização nunca é
apresentada como concluída quando falhou — `nuvem.js:subirProgresso` devolve
`{ok, erro}` e a interface só escreve "Sincronizado às…" quando o `ok` chega.

## Persistência e privacidade

O progresso é salvo em `localStorage` na chave `candymath_v3` (há leitura de
migração da chave antiga `candymath_v2`). São guardados apenas estrelas, ano,
nível, sequência, histórico por conteúdo, duelos, provas e itens da loja.
Ao carregar, cada campo é validado antes de ser aceito: números fora de faixa,
`certas > feitas` ou texto onde deveria haver número fazem o campo ser
descartado em vez de quebrar a interface. Se a estrutura inteira estiver
corrompida, ela é movida para `candymath_v3_danificado` antes de recomeçar,
para não perder o que ainda presta.

Sem a nuvem ligada, não há contas, não há serviços externos e nenhuma
informação do jogador sai do aparelho. Os únicos recursos remotos da página
são a fonte (Google Fonts) e os ícones (Font Awesome), carregados no início;
sem internet eles desaparecem, mas o jogo continua funcionando. O cliente do
Supabase vem do jsDelivr **só quando** `config.js` tem projeto preenchido — e
o `vercel.json` lista as origens permitidas no CSP. Se o jogo for usado em
escola com rede bloqueada, vale baixar essas duas referências e apontar os
`<link>` do `index.html` para os arquivos locais.

**Como limpar o progresso** — o boletim dos responsáveis tem o botão
**Apagar dados**, que abre um modal com as duas operações, e nenhuma delas
roda com um clique só: o botão se arma e confirma no segundo toque.

- **Apagar deste aparelho** — estrelas, ano e nível, histórico por assunto,
  provas, itens da loja e o apelido. O que existe na conta não muda, e nada é
  reenviado por cima;
- **Apagar da conta** — o perfil deste adulto, as crianças que ele registrou,
  os vínculos e as cópias de progresso no banco, pela RPC
  `apagar_meus_registros()` ([supabase/schema.sql:818](supabase/schema.sql#L818)).
  O botão só acende com conta ativa; se o banco recusar, a linha escreve o
  erro em vez de fingir que apagou.

Fora do jogo, limpar os dados do site no navegador remove `candymath_v3*`.

**Com a nuvem ligada**, quem decide é a conta criada pelo adulto: ela é a
única que pode registrar uma criança, ler o progresso dela e desvincular. O
vínculo é por código de 10 caracteres gerado no aparelho da criança, e várias
contas podem se vincular ao mesmo código (mãe e pai, por exemplo). A conta da
criança não existe: ela é um apelido e um código. A exclusão remota é por RPC
— `apagar_meus_registros()` ([supabase/schema.sql:818](supabase/schema.sql#L818))
apaga a conta e tudo que ela gerou, e há um caminho para desvincular uma
criança sem apagar a conta. As salas antigas saem com `purgar_salas_velhas()`,
que **só a `service_role` executa** e ainda não tem agenda configurada —
`CONFIGURACAO-DEPLOY.md` mostra as duas opções de agendamento.

A página `privacidade.html` é a versão legível de tudo isto, para o adulto.
Ela não carrega nenhum script — não há o que coletar ali. O texto tem os
campos de identificação do responsável (**nome/contato pendente**) marcados
como pendentes: preencha antes de publicar, porque dados de contato de um
projeto que toca dados de crianças não são escolha do código.

Nada aqui é conformidade legal atestada. O que foi feito é técnica
(autorização por conta, teto de dado que sai do aparelho, exclusão por RPC,
nenhum log de texto de voz); a leitura jurídica de LGPD não foi feita.

## Acessibilidade

- Navegação por teclado: `Tab` percorre o hub e os jogos, `Enter` ou `Espaço`
  aciona qualquer elemento clicável, `Esc` fecha modais ou volta ao hub. Em
  modal, o foco entra no primeiro controle e volta para quem abriu.
- Telas ocultas saem da ordem de tabulação e da árvore de acessibilidade. O
  atributo `hidden` manda em qualquer regra de `display` — é a linha
  `[hidden] { display:none !important }` no alto do `style.css`, e é ela que
  impede o formulário de montagem da caçada de continuar aparecendo por baixo
  do tabuleiro.
- Foco visível com contorno de 3px; alvos de toque com no mínimo 40px.
- Acerto e erro não dependem só de cor: ✓ e ✗ aparecem nos botões por CSS.
- Avisos (sincronização, voz, erro de conta) vão para uma região viva com
  `role="status"` e `aria-live="polite"` (`script.js:2674`), reanunciada a
  cada repetição. O feedback das perguntas e a troca de vez no duelo também
  são anunciados, e o portão "Estou pronto" exige um toque deliberado antes de
  o relógio de alguém começar a correr.
- Ícones de enfeite (`<i class="fa…">`) saem da árvore de acessibilidade —
  `script.js:300` esconde os que existem e um `MutationObserver` cobre os
  criados depois. A regra é conservadora: ícone que acompanha texto não é
  tocado.
- Cada chip de nível traz a descrição no `aria-label` e no `title`, e as barras
  do boletim têm rótulo em texto ("Números: 8 acertos em 15
  tentativas"), então a informação não depende da largura do traço colorido.
- O `role="radiogroup"` dos chips da caçada (densidade e modo de jogo) faz a
  escolha ser lida como opção, não como botão solto.
- `prefers-reduced-motion` desliga confete, encurta o giro da roleta e reduz
  animações.
- O CSP não usa `unsafe-inline` para script: os botões declaram
  `data-acao`/`data-args` e um despachante único liga o clique à função — o
  que também fecha a porta para HTML injetado virar código.

Nada disto foi lido por um leitor de tela real. O que existe é verificação de
código e de árvore de acessibilidade em navegador headless
(`node testes/auditar-layout.js --prova`), não uma avaliação WCAG completa.

## Testes

Nove validadores em Node puro, sem uma dependência instalada, mais o auditor
de layout. Para jogar, nada disso é necessário.

```bash
npm test     # roda os nove, em ordem, e para na primeira falha
npm start    # servidor de arquivos em http://127.0.0.1:8765 (o auditor usa ele)
```

| Comando | O que confere |
|---|---|
| `node testes/testar-estrutura.js` | raiz, caminhos relativos, ordem de carga dos módulos, comandos deste README, `node --check` em todo JS e HTML sem script inline, sem `on*`, sem `javascript:` |
| `node testes/testar-segredos.js` | `service_role`, JWT `eyJ…`, chave de voz, token genérico e chave SSH em todo o repositório; `.gitignore` e `.env.example` |
| `node testes/testar-politicas-sql.js` | invariantes de autorização no schema, na migração e nos arquivos do navegador |
| `node testes/testar-autorizacao.js` | A0: o interruptor do duelo é lido antes de cada chamada de rede. A parte remota pede três contas de teste em `.env` e, sem elas, se declara **não executada** |
| `node testes/testar-narracao.js` | a função de voz com `fetch` e `env` falsos: validação, limite, upstream, o cache de áudio no Supabase (procura, acerto, gravação, poda e as quedas do banco) — e um aviso na primeira linha de que é simulado |
| `node testes/validar-banco.js` | os 311 itens e as 96 afirmações: id único, 4 alternativas sem repetição (por valor, não por texto), `valor` batendo com a resposta, unidade válida, código BNCC na lista oficial (`testes/bncc-matematica.txt`) |
| `node testes/validar-conteudo.js` | os 55 geradores em 9 anos × 4 níveis, cada item do banco, afirmações V/F, os jogos de sequência/ordenação/memória/cruzadinha/balança, as representações em doces, a duplicata numérica e o texto de reserva `(opção N)` |
| `node testes/relatorio-bncc.js` | vínculo código ↔ ano ↔ unidade e cobertura; regrava `RELATORIO-BNCC.md` com semente fixa |
| `node testes/validar-css.js` | escala fluida, largura fixa sem freio, variável sem definição, regras duplicadas em conflito, id citado no JS ausente no HTML |

Cada validador resolve o caminho da raiz por `testes/_raiz.js`, então funciona
de qualquer diretório. Os nove terminam com código 1 quando encontram erro.

```bash
node testes/auditar-layout.js            # todas as telas, vários tamanhos de janela
node testes/auditar-layout.js --prova    # injeta quebras e confere se o medidor pega
node testes/auditar-layout.js --rolagem  # quadro do tabuleiro, rolagem e fuga de foco
node testes/auditar-layout.js --doces    # as quatro representações em doces
node testes/auditar-layout.js --sem-foto # não grava capturas em testes/capturas/
```

O auditor precisa de um servidor na porta 8765 (`npm start`) e de um Chrome
que ele mesmo sobe em modo headless, na porta 9333. Ele mede, tela por tela:
corte vertical, caixa que passa da largura da janela, trilho de rolagem
horizontal, texto cortado, alvo de toque com menos de 40 px e elemento
colapsado a 0×0.

O resultado real de cada um deles, executado nesta máquina (Windows 10, Node
v24), está em `RELATORIO-TESTES.md` — incluindo os cinco testes que **não**
rodaram por depender de conta externa, e o que cada prova não cobre.

Eles validam a **lógica** do conteúdo, a **autorização escrita em SQL** e a
**geometria** da interface. Não substituem leitura humana das
situações-problema, avaliação com crianças, nem execução do RLS num banco de
verdade.

## Limitações conhecidas

A lista completa, com evidência e o que falta para fechar cada item, está em
`AUDITORIA.md` (§ "Pendências") e em `SEGURANCA.md`. As principais:

- **O duelo em rede está desligado por segurança.** Na v3.0, conhecer o
  código de uma sala bastava para ler e escrever nela. O schema corrige isso,
  mas a correção ainda não foi verificada num banco de verdade — item acima.
- **As políticas RLS nunca foram executadas em um banco real.** O schema foi
  conferido por invariantes estáticas e por um script de teste que você roda
  no SQL Editor; a verificação contra contas de verdade depende da sua conta
  Supabase.
- **Nenhuma síntese de voz real foi chamada.** A função de voz está escrita,
  testada com rede falsa e pronta para publicar; as quatro vozes foram
  conferidas contra o catálogo público, não ouvidas.
- **O cache de áudio nunca escreveu em um Storage real.** A tabela, o bucket e
  as duas funções RPC passam pelas invariantes de `testes/testar-politicas-sql.js`
  e pela ponte falsa de `testes/testar-narracao.js`; o que falta é o primeiro
  MP3 gravado no seu projeto — conferir a linha em `narracoes`, o objeto no
  bucket e o acerto na segunda leitura da mesma frase.
- **Nenhuma publicação foi feita.** Nada aqui atesta um deploy na Vercel, um
  domínio ou um projeto Supabase existente.
- **Nada aqui é teste de invasão.** É revisão de código e verificação de
  invariantes — não simulação de ataque, e não conformidade legal atestada.
- Geometria e medidas continuam mais dependentes de texto do que de desenho.
  As representações em doces cobrem multiplicação, divisão exata, fração de
  uma quantidade e porcentagem; figuras de sólidos, áreas e ângulos ainda não
  foram implementadas.
- A pista é por unidade temática e o visual só existe nos quatro tipos acima.
  Uma dica escrita por questão, e representações para os outros temas, são o
  próximo passo natural.
- A consolidação exige que exista outro item do mesmo objeto de conhecimento
  no ano e nível. Em células com um único item sobre aquele objeto, o reforço
  não vem — preferimos não forçar uma questão de outro assunto.
- O código BNCC por item é uma escolha editorial, conferida contra a lista
  oficial de habilidades. Isso não equivale a uma auditoria curricular
  formal, e **o jogo não cobre o currículo inteiro**: `RELATORIO-BNCC.md`
  mostra 247 códigos no índice, 195 usados e 52 sem item.
- O duelo pesca do mesmo motor de conteúdo dos outros jogos, no ano e no nível
  escolhidos, mas **só entram no tabuleiro contas cuja resposta é um número
  limpo** — fração escrita como `3/4`, resposta em texto ou número com mais
  casas que a peça comporta ficam de fora.
- A prova sorteia 12 perguntas do ano, do Base até o nível atual. Doze
  perguntas são uma amostra curta: uma aplicação isolada não sustenta
  conclusão, e o boletim diz isso em vez de fingir que sim.
- O boletim é a leitura de um aparelho. Se a criança jogar em dois
  computadores, cada um tem sua história — a nuvem é o que junta as duas.
- A verificação de e-mail depende da configuração do projeto (Site URL e
  provedor *Email* ativo). Sem isso, a conta nasce não verificada e o jogo
  avisa em vez de sincronizar pela metade.
- O limite de requisições à função de voz vive na memória de cada instância:
  na Vercel, o teto efetivo sobe com o escalonamento. Risco registrado em
  `SEGURANCA.md`.
- `style-src` ainda leva `'unsafe-inline'` (22 atributos `style=` e 40 ajustes
  por `.style.` no JS). Não abre execução, mas a redução em três passos está
  escrita em `AUDITORIA.md`. As três referências de CDN também não têm SRI.
- Layout, largura de coluna do tabuleiro e alvos de toque foram conferidos em
  navegador real a 390 px e a 1280 px, tela por tela. A ordem de tabulação e o
  contorno de foco continuam verificados por código, não por navegação com
  `Tab`; vale conferir em um aparelho real, com leitor de tela.
- Nada aqui comprova ganho de aprendizagem. Isso depende de avaliação com
  alunos e professores, ainda não realizada — a prova existe para dar ao jogo
  uma medida interna, não para substituir essa avaliação.
