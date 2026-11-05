# Candy Math — como este jogo foi parar na internet

Texto de apresentação, em 15 blocos. Cada bloco tem **Na tela** (o que aparece no
slide) e **O que falar** (o roteiro, escrito para ser dito em voz alta, não lido
como lista). Ritmo sugerido: 1 a 2 minutos por bloco — a apresentação inteira fecha
em cerca de 25 minutos, mais perguntas.

Todos os números abaixo foram conferidos nesta máquina e no endereço publicado em
04/11/2026. Onde ainda falta alguma coisa, está dito no bloco 14 — não faz parte da
apresentação esconder o que não foi testado.

---

## 1. O que é, em uma frase

**Na tela**

> Candy Math — matemática com doces, do 1º ao 9º ano, direto do navegador.
> 36 trilhas · 311 questões · 4 vozes · 0 instaladores

**O que falar**

"O Candy Math é um jogo de matemática que roda no navegador. Quem vai jogar não
instala nada, não cria conta, não aceita cookie: abre um endereço e joga. O conteúdo
vai do 1º ao 9º ano, em quatro níveis de dificuldade dentro de cada ano — são 36
trilhas — e o banco tem 311 questões que se embaralham a cada partida. Além da parte
de jogar, ele fala: cada pergunta pode ser narrada em voz alta por uma de quatro vozes
geradas por IA, e ele guarda um boletim do que a criança aprendeu, que um responsável
pode ler de outro aparelho."

---

## 2. As três peças

**Na tela**

```
   O CÓDIGO          O BANCO            A HOSPEDAGEM
   (arquivos)      (Supabase)             (Vercel)
   o jogo          a memória          o lugar na internet
       └───────────────┴──────────────────┘
                conversam por /api/voz
```

**O que falar**

"Três coisas diferentes, e vale separá-las porque cada uma tem um trabalho. O código
são os arquivos do jogo: eles decidem o que aparece na tela e como o jogo pensa. O
banco é a memória: ele guarda contas, vínculos entre adulto e criança e o progresso
sincronizado. A hospedagem é o endereço: ela pega os arquivos, coloca no mundo e
atende quem abre o site. Uma curiosidade honesta: o jogo funciona com o banco
desligado. Ele não depende do banco para existir — depende dele para sincronizar."

---

## 3. O código: dez arquivos que se conhecem

**Na tela**

| arquivo | tamanho | o que faz |
|---|---|---|
| `index.html` | 50 KB | a estrutura e todas as telas |
| `style.css` | 143 KB | visual, responsivo, acessibilidade |
| `script.js` | 114 KB | o jogo: partidas, estrelas, telas |
| `conteudo.js` | 98 KB | as 36 trilhas e a geração de questões |
| `banco-itens.js` | 88 KB | as 311 questões-base |
| `nuvem.js` | 56 KB | login do responsável, vínculo, sincronizar |
| `avaliacao.js` | 33 KB | as provas e o boletim do responsável |
| `duelo.js` | 36 KB | o duelo em rede (hoje desligado) |
| `narracao.js` | 19 KB | a voz: pedir, tocar, escolher quem fala |
| `config.js` | 6 KB | os únicos endereços e chaves públicos |

**O que falar**

"JavaScript puro, sem React, sem Vue, sem build. Não é falta de modernidade, é
escolha: um arquivo a menos que quebra, e o jogo abre em qualquer navegador de
escola. Cada módulo se apresenta por uma única porta — `CM_CONTEUDO`, `CM_NUVEM`,
`CM_AVALIACAO`, `CM_NARRACAO` — e o `script.js` só conhece essas portas. O `config.js`
existe para uma regra: se algum dia o projeto precisa trocar de banco ou de endereço,
muda-se um arquivo e mais nada. No total são cerca de vinte mil linhas, e o projeto
inteiro tem zero dependências para instalar — nem `npm install`."

---

## 4. Onde o jogo mora quando não há internet

**Na tela**

```
localStorage → chave "candymath_v3"
estrelas · histórico por conteúdo · sequência · roupas · provas
```

**O que falar**

"Antes de qualquer nuvem, o jogo guarda tudo no próprio aparelho, numa chave do
`localStorage` chamada `candymath_v3`. Estrelas, o que a criança já aprendeu por
conteúdo, a sequência de acertos, as roupas do boneco, as provas feitas. Isso tem
duas consequências boas: o jogo funciona sem internet e sem conta, e — o que importa
numa escola — nenhuma informação da criança sai do aparelho enquanto a conexão
estiver desligada. Quando a conexão é ligada, o que sobe para o banco é exatamente o
pacote dessa mesma chave. A nuvem é uma cópia, não o original."

---

## 5. A Vercel: o que ela faz por nós

**Na tela**

> **Vercel** = computador da Cloudflare… não: um serviço que recebe arquivos,
> entrega pela rede global de servidores e ainda executa código no servidor.
>
> Projeto `equaldiagra/candy-math` · `candy-math-eight.vercel.app` · região `iad1`
> `framework: null` · `outputDirectory: "."`

**O que falar**

"Hospedar um site é, no fundo, três trabalhos: guardar os arquivos, entregar rápido
para quem está longe, e — quando o site tem uma parte que roda no servidor — executar
essa parte sem que você mantenha um computador ligado. A Vercel faz os três. Ela não
precisa de servidor próprio, não precisa de FTP, não precisa de painel para subir
arquivo. Ela olha para o repositório no GitHub, baixa o que mudou e publica. Como o
nosso projeto é HTML e JavaScript puros, o `vercel.json` diz `framework: null` e
`outputDirectory: "."` — que quer dizer 'não compile nada, publique a pasta como
ela está'."

---

## 6. O caminho de um arquivo até a tela de quem joga

**Na tela**

```
git push ─► GitHub ─► Vercel percebe ─► build ─► produção
   (mim)     (histórico)   (automático)   (0 s)     (CDN global)
```

**O que falar**

"O caminho todo tem quatro lances. Primeiro eu escrevo o arquivo e faço o commit —
uma fotografia comentada do estado do projeto. Segundo, `git push`: esse empurra a
fotografia para o GitHub, que é o histórico versionado, não o site. Terceiro, o
GitHub avisa a Vercel — 'mexeram no `main`' — e a Vercel começa um deploy sozinha.
Quarto, o build: como não há nada para compilar, ele praticamente não existe, e o
estado novo vira produção. Isso foi medido hoje: o commit entrou às 00:38 UTC e o
ar alterado já estava no ar às 00:39 — um minuto e meio entre apertar `git push` e
ler o arquivo publicado. E o deploy anterior continua lá, com endereço
próprio — se a versão nova estiver ruim, o botão de rollback volta no mesmo minuto.
É por isso que publicar deixou de ser um evento assustador."

---

## 7. A parte que roda no servidor: `/api/voz`

**Na tela**

```js
// o navegador pode pedir:
POST /api/voz  { texto: "Quanto é 2 + 2?", voz: "sara" }
// o que volta:
200  audio/mpeg
```

> `api/voz.js` (casca) → `api/_voz-nucleo.js` (decisão, testável)

**O que falar**

"O site tem uma parte que não é arquivo estático: é uma função. Ela mora em `api/` e
a Vercel a executa só quando alguém chama — isso se chama *serverless*, 'sem
servidor', que é uma forma elegante de dizer 'sem servidor para você acordar de
madrugada'. Ela recebe um texto e o nome de uma voz, e devolve o áudio pronto. Todo
o resto do site é entregue direto da rede de distribuição; só esse caminho acende
computador na hora. E ela tem porteiro: confere a origem da chamada, limita a 240
requisições por IP por hora, corta textos acima de 320 caracteres e não aceita voz
fora da lista. Uma origem estranha recebe 403; uma voz inventada recebe 400."

---

## 8. Por que a chave secreta não pode estar no JavaScript

**Na tela**

| | onde mora | quem vê |
|---|---|---|
| `SUPABASE_URL` + *publishable key* | `config.js` | todo mundo — e pode |
| `FISH_AUDIO_API_KEY` | Vercel → Environment Variables, *Sensitive* | só a função |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel, *Sensitive* | só a função |

**O que falar**

"Essa é a decisão de arquitetura mais importante do projeto, e é fácil de explicar.
Tudo que está em `config.js` é texto público: qualquer pessoa aperta F12 e lê. A chave
do Supabase que vai lá é a *publishable*, feita exatamente para isso — ela sozinha não
abre nada, porque o banco tem tranca própria. A chave da Fish Audio não: ela é uma
conta com crédito, e se fosse no navegador qualquer pessoa coparia e gasta o saldo em
uma tarde. Então ela mora nas variáveis de ambiente da Vercel, marcadas como
*Sensitive*, e só a função `/api/voz` a enxerga. O navegador manda o texto; o servidor
fala com a Fish Audio; o navegador recebe o áudio. A chave nunca atravessa o mar. E o
`.env` desta máquina, que tem a mesma chave, está barrado no upload: o endereço
publicado devolve 404 para `/.env` — isso foi conferido no ar."

---

## 9. As quatro vozes

**Na tela**

| voz | código interno | `reference_id` (só no servidor) |
|---|---|---|
| Sara | `sara` | `4e78ff4d…` |
| Bruna | `bruna` | `67e90549…` |
| Miguel | `miguel` | `8c3a3634…` |
| Evelyn | `evelyn` | `0e3026e8…` |

**O que falar**

"As vozes vêm da Fish Audio, uma plataforma de síntese de voz. Cada voz tem um
código de referência, e aqui está o detalhe que evita confusão: o navegador só sabe o
nome — `sara`, `bruna`. O código de referência mora na função, do lado do servidor.
Se um dia a voz muda de lugar, troca-se um arquivo e a criança nem percebe. Hoje as
quatro foram testadas no endereço publicado: cada uma devolveu um MP3 de verdade,
entre 38 e 53 mil bytes, e o verificador de arquivo confirmou MPEG camada 3, 128 kbps,
44,1 kilohertz. O modelo escolhido é o `s2.1-pro-free`, a rota de custo zero da
plataforma — a narração não consome crédito. O que máquina nenhuma fez é o que falta:
ouvir as quatro e dizer qual serve. Em português, a leitura de números é onde as vozes
mais divergem."

---

## 10. O banco: oito tabelas e o que cada uma guarda

**Na tela**

```
perfis              o adulto (e-mail, apelido)
criancas            apelido da criança — nada além disso
vinculos            quem acompanha quem
progressos          o pacote do localStorage espelhado
salas / jogadas     duelo em rede (Realtime)
tentativas_vinculo  contador anti-força-bruta
narracoes           o cache das frases já pagas  +  bucket privado
```

**O que falar**

"O banco é um Postgres gerenciado pelo Supabase, e a regra de desenho foi: guardar o
mínimo. Uma tabela para o adulto, uma para a criança, uma para o vínculo entre eles,
uma para o progresso, duas para o duelo, uma para conter força-bruta e uma para o
cache de áudio. Reparem no que não está lá: não há nome real de criança, não há foto,
não há data de nascimento, não há e-mail da criança. A criança não tem login: ela
entra no vínculo por um código gerado na tela pelo adulto, e o único dado que viaja é
o apelido que o adulto escolheu."

---

## 11. A tranca: RLS, 17 políticas

**Na tela**

> **RLS** — *Row Level Security*: a regra de quem lê é escrita no banco, não no app.
> `alter table ... enable row level security` × 8 tabelas · 17 `create policy`

**O que falar**

"Uma chave *publishable* pública significa que qualquer pessoa pode falar com o banco.
A tranca que impede isso de virar um problema não está no JavaScript — está no
próprio Postgres, e se chama RLS, segurança no nível da linha. Quando a consulta
chega, o banco pergunta 'quem é você?' e aplica uma regra escrita por nós: o adulto lê
o progresso das crianças vinculadas a ele, e só a ele; ninguém lê a sala de outro sem
ser membro; ninguém escreve na conta de outra pessoa. São 17 políticas nas 8 tabelas.
A vantagem é que a regra não pode ser contornada pelo app: mesmo que alguém mande uma
consulta escrita à mão, o banco recusa. As 17 foram conferidas por dois validadores
que rodam aqui — um lê o SQL e confere as cláusulas, o outro simula requisições de
outro usuário e exige a recusa. O que ainda falta é rodar isso contra o projeto real."

---

## 12. O cache de áudio: pagar uma vez só

**Na tela**

```
frase + voz + modelo  ─►  chave
   chave conhecida? ─► devolve o MP3 do bucket  (não paga de novo)
   desconhecida?    ─► sintetiza, grava, devolve
                       poda automática em 6.000 frases
```

**O que falar**

"A pergunta que o dono fez foi esta: o banco tem que guardar as frases geradas, para
economizar. É exatamente o que a função faz. Ela monta uma chave com o texto, a voz e
o modelo; se a chave já existe, o MP3 volta do bucket privado sem nenhuma chamada de
síntese — o trabalho repetitivo do jogo, que é narrar a mesma instrução vinte vezes,
deixa de custar depois da primeira. Se não existe, sintetiza, grava e devolve. Há
índice em `chave` e em `(usos, visto_em)`, e uma poda automática quando o cache passa
de seis mil frases, tirando primeiro as que nunca foram usadas. Quem lê o cache não
sabe de qual memória veio o áudio: a resposta é sempre `audio/mpeg` com `no-store`."

---

## 13. O login do responsável, e o que mudou nesta rodada

**Na tela**

```
Criar conta ─► e-mail chega um link ─► clicar ─► volta ao jogo ─► sincroniza
                                    ▲
              a tela agora PARA aqui e diz "falta confirmar o e-mail"
"Não lembro a senha" ─► link ─► #redefinir-senha ─► senha nova
```

**O que falar**

"Criar conta com confirmação por e-mail tem uma pegadinha que o Supabase impõe: no
cadastro ele não devolve sessão nenhuma — a pessoa só existe de verdade depois do
clique no link. O painel tratava isso como 'não estou logado' e voltava para a tela
de criar conta; quem tentava entrar depois recebia 'Email not confirmed' e a tela
traduzia como senha errada. Quatro correções saíram daí: o cadastro agora lembra o
e-mail pendente e leva a pessoa para a tela de verificação; a mensagem de erro
sobrevive à repintura da tela; abrir 'Conta e conexão' releu a sessão em vez de
mostrar o retrato de quando a página nasceu; e um erro de desenho na inicialização
aparece escrito na tela em vez de derrubar a nuvem inteira. Também entrou um 'Não
lembro a senha' de verdade, com a tela de definir a senha nova. E o português: um
'Failed to fetch' agora diz 'o banco não respondeu, confira o Project URL'."

---

## 14. O que ainda está pendente — dito antes que perguntem

**Na tela**

- [ ] **Project URL verdadeiro** copiado do painel Supabase — o que está no
      `config.js` não resolve (NXDOMAIN). Sem ele: cache de áudio, login e duelo
      ficam desligados. O jogo e a voz seguem funcionando.
- [ ] Redirect URL do link de recuperação no painel do Supabase.
- [ ] SMTP próprio — sem ele, o e-mail de confirmação não chega em produção.
- [ ] Ouvir as quatro vozes e escolher.
- [ ] Testar em celular de verdade, com leitor de tela.
- [ ] Campos de controlador em `privacidade.html` — dependem de quem responde pela
      base legal, não de código.

**O que falar**

"Vale apresentar o que falta, porque é o que separa um projeto publicado de um
projeto terminado. Falta um dado: o endereço exato do projeto Supabase, que precisa
ser copiado do painel — o que está no repositório foi montado a partir de um ref que
apareceu na tela, e montar não é copiar. Enquanto ele não for o verdadeiro, o cache de
áudio, o login e o duelo ficam no escuro, e o jogo roda inteiro no aparelho, com voz
por IA funcionando. Também falta o SMTP, sem o qual a confirmação por e-mail não
chega, e falta o mais simples de todos: ouvir as quatro vozes. Nada disso é
escondido do usuário — a tela de conexão diz exatamente o que está ligado e o que não
está."

---

## 15. Como conferir tudo isso sem pedir nada a ninguém

**Na tela**

```
node testes/testar-estrutura.js      # as portas entre os módulos
node testes/testar-segredos.js       # nenhuma chave em arquivo público
node testes/testar-politicas-sql.js  # as 17 políticas
node testes/testar-autorizacao.js    # consultas de outro usuário → recusa
node testes/testar-narracao.js       # a função de voz com relógio e fetch falsos
node testes/validar-css.js           # contraste, alvo de toque, responsivo
node testes/validar-conteudo.js      # as 36 trilhas
node testes/relatorio-bncc.js        # 247 códigos BNCC
node testes/validar-banco.js         # o schema contra as expectativas
```

**O que falar**

"Estes nove scripts rodam com Node e sem instalar dependência nenhuma. Eles são a
defesa do projeto contra si mesmo: o detector de segredos não deixa uma chave entrar
num arquivo público; o de políticas lê o SQL e reclama se alguma regra ficou de fora;
o de autorização finge ser outro usuário e exige a recusa; o de voz exercita a função
inteira com `fetch` e relógio falsos, sem gastar um caractere de síntese. Hoje, os
nove estão verdes, e o CSS foi revisado sem pendência: 806 regras, 89 ajustes por
faixa de tela. Na última rodada, o cabeçalho do celular caiu de 101 para 61 pixels de
altura, e as três faixas do topo, que ocupavam 60 por cento da tela, passaram a ocupar
43 — sem esconder informação, sem texto cortado e sem nenhum botão abaixo de 40 por
32 pixels de alvo de toque."

---

## Perguntas que vão fazer

**"Por que não React?"** — Porque o jogo é uma tela só, com estado simples, e roda em
computador de escola. Sem build, o arquivo que está no repositório é o arquivo que
está no ar — o que é a condição de o detector de segredos funcionar.

**"Onde ficam os dados da criança?"** — No aparelho, em `localStorage`. Se a conexão
for ligada, uma cópia vai para a tabela `progressos`, vinculada à conta do adulto. A
criança não tem conta, não tem e-mail e não tem nome.

**"Alguém pode gastar a chave da Fish Audio?"** — Não pelo navegador: ela não está no
navegador. O endpoint é limitado por IP, por tamanho de texto e por lista de vozes.

**"E se o Supabase cair?"** — O jogo continua. A nuvem é opcional por desenho, e a
tela diz o que está desligado.

**"Como se volta atrás num deploy ruim?"** — Cada deploy tem endereço próprio e o
estado anterior fica disponível; há um botão de promover/reverter.

**"O duelo está pronto?"** — O código está escrito e o banco tem as tabelas e as
políticas, mas a chave `dueloRedeHabilitado` continua `false` de propósito: os testes
de autorização ainda não rodaram contra um Postgres real.

---

## Ficha técnica (para o slide do final)

| | |
|---|---|
| Endereço | https://candy-math-eight.vercel.app |
| Repositório | `Yurigmorais/Cand-math`, branch `main` |
| Hospedagem | Vercel · projeto `equaldiagra/candy-math` · região `iad1` |
| Banco | Supabase (Postgres) · 8 tabelas · RLS em 8 · 17 políticas |
| Voz | Fish Audio · modelo `s2.1-pro-free` · 4 vozes do projeto |
| Cache de áudio | tabela `narracoes` + bucket privado, poda em 6.000 |
| Conteúdo | 1º ao 9º ano × 4 níveis · 311 questões · BNCC 247 códigos |
| Código | ~20.500 linhas · HTML/CSS/JS puros · zero dependências |
| Segurança no ar | CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS, `/.env` 404 |
| Testes | 9 scripts, todos verdes em 04/11/2026 |
