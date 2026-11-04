/* ===================================================
   CANDY MATH — duelo.js
   Caça ao Número — partida 1 x 1 por turnos.

   A tela se enche de números e uma conta aparece. É a sua vez: resolva
   a conta, ache o número no meio de todos os outros e toque nele. O seu
   relógio corre; o do adversário fica parado.

   As regras cabem em quatro linhas:
     · cada número na tela é a resposta de uma conta ainda pendente;
     · acertou  → o número sai da tela e a vez passa;
     · errou    → nada muda, e é o relógio quem cobra;
     · o tempo  da vez acabou → a vez passa com a conta de volta na fila.

   Como peças e contas nascem juntas e saem juntas, sempre sobra um
   número tocável para a conta da vez — e a partida só termina quando
   todos os números forem selecionados.
   =================================================== */
(function (root) {
'use strict';

const C = root.CM;

// ── 1. AS REGRAS, EM UM LUGAR SÓ ──────────────────────────
const DENSIDADES = [20, 40, 60, 80];        // números na tela
const POR_ACHADO = 1;                        // estrela por número encontrado
const BONUS_VITORIA = 15;                    // quem fecha a partida na frente
const SEGUNDOS_POR_NIVEL = [30, 30, 40, 45]; // tempo de cada vez, pelo nível
const REVELA_APOS = 3;                       // passadas seguidas sem achar
const CELULA_MINIMA = 44;                    // alvo de toque, em px
const VÃO = 6;                               // espaço entre as peças

// A peça guarda número puro: "36" e "1,5" servem; "12 cm" e "R$ 4,00" não,
// porque a criança teria de comparar texto, e não valor.
const NUMERO_LIMPO = /^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$/;

// Formato do código de sala que o campo aceita antes de incomodar o servidor.
// Quem emite o código é o banco, com 8 caracteres (supabase/schema.sql,
// `_novo_codigo(8)` em criar_sala); a faixa 6 a 24 deixa entrar um código já
// anotado no aparelho de alguém e sobrevive a uma mudança de tamanho. Não é
// checagem de direito — quem decide se a sala existe e se você pode entrar nela
// é o banco. O conjunto de letras é o mesmo de ALFABETO em nuvem.js: sem I, L,
// O, 0 e 1, que se confundem quando alguém copia à mão. (O código de vínculo da
// criança, esse sim tem 10 caracteres — TAMANHO_CODIGO em nuvem.js — e é digitado
// em outro campo, montado por nuvem.js sem teto de comprimento.)
const FORMA_CODIGO_SALA = /^[A-HJ-KM-NP-Z2-9]{6,24}$/i;

const P = {
  fase: 'setup',            // setup · passagem · jogando · fim
  densidade: 40,
  modo: 'local',            // local · rede
  assento: 0,               // 0 = dono do aparelho (anfitrião) · 1 = convidado
  tempoExtra: false,
  nomes: ['Você', 'Desafiante'],
  pecas: [],                // {id, texto, vivo, el}
  fila: [],                 // contas ainda não resolvidas — sempre = peças vivas
  conta: null,
  vez: 0,
  achados: [0, 0],
  erros: [0, 0],
  tempos: [0, 0],           // ms de relógio corrido por jogador
  inicioTurno: 0,
  limite: 0,
  semAchar: 0,
  errouNesta: false,
  travada: true,            // tabuleiro congelado: não é a sua vez de correr
  tick: null,
  sala: null,               // transporte da sala (nuvem.js)
};

// ── 2. AJUDAS DE CASA ─────────────────────────────────────
function el(id) { return document.getElementById(id); }
function tem(fn) { return typeof root[fn] === 'function'; }
function estado() { try { return G; } catch (e) { return null; } }
function som(t) { if (tem('playSound')) root.playSound(t); }
// numBR é const no script.js: está no escopo global, mas não cola em window.
function br(n) { try { return numBR(n); } catch (e) { return String(n); } }
function semMovimento() { try { return MOVIMENTO_REDUTO; } catch (e) { return false; } }

function anoNv() {
  const g = estado();
  return { ano: g ? g.ano : 5, nv: g ? g.nivel : 1 };
}
function tempoDaVez() {
  return SEGUNDOS_POR_NIVEL[anoNv().nv - 1] * (P.tempoExtra ? 2 : 1);
}
function naRede() { return P.modo === 'rede' && !!(P.sala && P.sala.enviar); }
function doMeuLado() { return P.modo === 'local' ? true : P.vez === P.assento; }

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// "1.234,5" vira número, do jeito que se escreve no Brasil.
function paraNum(texto) {
  const limpo = String(texto).replace(/[^\d,.-]/g, '');
  if (!limpo) return NaN;
  if (limpo.indexOf(',') >= 0) return parseFloat(limpo.replace(/\./g, '').replace(',', '.'));
  return parseFloat(/^-?\d{1,3}(\.\d{3})+$/.test(limpo) ? limpo.replace(/\./g, '') : limpo);
}

function relogio(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// ── 3. FÁBRICA DA PARTIDA ─────────────────────────────────
// N contas numeradas viram N peças. É daqui que sai a invariante do
// tabuleiro: nunca existe peça sem conta, nem conta sem peça.
function montarContas(n) {
  const { ano, nv } = anoNv();
  const chaves = C.chavesDo(ano, nv).filter((k) => C.GER[k]);
  if (!chaves.length) chaves.push('adi');
  const lista = [];
  const enunciados = {};
  let giro = 0;
  let tentativas = 0;

  while (lista.length < n && tentativas < n * 30) {
    tentativas++;
    const item = C.gerarChave(chaves[giro % chaves.length], ano, nv);
    giro++;
    if (!item || !item.alt || item.alt.length < 2) continue;
    const resposta = String(item.alt[0]);
    if (!NUMERO_LIMPO.test(resposta)) continue;
    if (typeof item.valor !== 'number' || !isFinite(item.valor)) continue;
    if (enunciados[item.txt]) continue;
    enunciados[item.txt] = true;
    lista.push(embalar(item, resposta));
  }

  // 1º ano Base tem poucas faixas de valor: repetimos o número, nunca o
  // enunciado. Cada peça repetida continua com sua própria conta.
  let sobra = 0;
  while (lista.length < n && sobra < 60) {
    sobra++;
    const item = C.gerarChave(chaves[sobra % chaves.length], ano, nv);
    if (!item || !item.alt || !item.alt.length) continue;
    const resposta = String(item.alt[0]);
    if (!NUMERO_LIMPO.test(resposta)) continue;
    if (enunciados[item.txt]) continue;
    enunciados[item.txt] = true;
    lista.push(embalar(item, resposta));
  }

  // Último recurso: contas simples na faixa do ano, para a tela nunca chegar
  // com menos números do que o jogador escolheu.
  while (lista.length < n) lista.push(contaBasica(ano, nv, lista.length));
  return C.embaralhar(lista);
}

function embalar(item, resposta) {
  return { txt: item.txt, o: item.o, u: item.u, bncc: item.bncc, resposta: resposta, ref: item.ref || item.o };
}

function contaBasica(ano, nv, semente) {
  const topo = Math.max(6, Math.min(199, C.faixaDe(ano, nv, 'adicao')[1]));
  const a = C.ri(1, topo);
  const b = C.ri(1, topo);
  let txt, resposta, conteudo;
  if (nv >= 3 && semente % 3 === 0) {
    const x = C.ri(2, 9), y = C.ri(2, 9);
    txt = x + ' × ' + y + ' = ?'; resposta = String(x * y); conteudo = 'Sentenças de multiplicação';
  } else if (semente % 2 === 0) {
    txt = a + ' + ' + b + ' = ?'; resposta = String(a + b); conteudo = 'Sentenças de adição';
  } else {
    const maior = Math.max(a, b), menor = Math.min(a, b);
    txt = maior + ' − ' + menor + ' = ?'; resposta = String(maior - menor); conteudo = 'Sentenças de subtração';
  }
  return { txt: txt, o: conteudo, u: 'numeros', bncc: '', resposta: resposta, ref: 'duelo:' + semente + ':' + txt };
}

// ── 4. ENTRADA ───────────────────────────────────────────
function abrir() {
  P.fase = 'setup';
  P.travada = true;
  pararRelogio();
  if (tem('showScreen')) root.showScreen('screenDuelo');
  el('dueloSetup').hidden = false;
  el('dueloJogo').hidden = true;
  el('dueloPassagem').hidden = true;
  armar();
  pintarSetup();
}

// Os controles são fixos no HTML; aqui só ligamos os eventos uma vez.
function armar() {
  const caixa = el('dueloDens');
  if (!caixa || caixa.dataset.armado === '1') return;
  caixa.dataset.armado = '1';

  caixa.querySelectorAll('[data-d]').forEach((b) => {
    b.onclick = () => { P.densidade = parseInt(b.dataset.d, 10); pintarSetup(); };
  });
  document.querySelectorAll('#dueloModoChips [data-modo]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.modo === 'rede' && !redeLigada()) {
        pintarSetup();
        return aviso('A sala por código está ' + (motivoDaRede() || 'indisponível') +
          '. Por enquanto os dois jogam neste aparelho.');
      }
      P.modo = b.dataset.modo; P.sala = null; sairDaSala(); pintarSetup();
    };
  });
  const extra = el('dueloTempoExtra');
  if (extra) extra.onchange = () => { P.tempoExtra = extra.checked; pintarSetup(); };

  [1, 2].forEach((i) => {
    const campo = el('dueloNome' + i);
    if (!campo) return;
    campo.value = P.nomes[i - 1];
    campo.oninput = () => {
      const v = campo.value.trim();
      if (v) P.nomes[i - 1] = v.slice(0, 14);
    };
  });

  const criar = el('dueloCriar');
  const entrar = el('dueloEntrar');
  if (criar) criar.onclick = () => sala('criar');
  if (entrar) entrar.onclick = () => {
    const codigo = (el('dueloCodigo').value || '').trim().toUpperCase();
    // Formato só é conferido aqui para evitar uma ida ao banco à toa. Quem
    // decide se a sala existe e se você pode entrar nela é o banco.
    if (!FORMA_CODIGO_SALA.test(codigo)) return aviso('O código da sala tem de 6 a 24 letras e números.');
    sala('entrar', codigo);
  };

  const comecar = el('dueloComecar');
  if (comecar) comecar.onclick = comecarPartida;
  const pronto = el('dueloPronto');
  if (pronto) pronto.onclick = lancarVez;
  const passar = el('dueloPassarVez');
  if (passar) passar.onclick = () => passarVez('Você passou a vez.');

  window.addEventListener('resize', ajustarGrade, { passive: true });
  // O corpo de letra das peças vem de uma webfont. Ela chega depois do primeiro
  // desenho, e a régua que mediu a coluna foi feita com a fonte provisória:
  // quando a definitiva carrega, a grade é conferida de novo.
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(() => { try { ajustarGrade(); } catch (e) {} }).catch(() => {});
  }
  pintarSetup();
}

function aviso(msg) {
  const s = el('dueloAviso');
  if (!s) return;
  s.textContent = msg;
  s.hidden = !msg;
}

// A nuvem devolve a sala pronta pelo mesmo caminho (promise), então o duelo
// só precisa esperar: criar abre, entrar confere o código no banco.
function sala(acao, codigo) {
  const nuvem = root.CM_NUVEM;
  if (!nuvem || !nuvem.ativa || !nuvem.ativa()) return aviso('A sala por código precisa da conexão ativada.');
  aviso('Ligando a sala…');
  const promise = acao === 'criar' ? nuvem.criarSala() : nuvem.entrarSala(codigo);
  if (!promise || !promise.then) return aviso('A sala não abriu: o banco não respondeu.');
  promise.then(aoEntrarNaSala).catch((e) => aviso('A sala não abriu: ' + erroDe(e)));
}

function erroDe(e) { return e && e.message ? e.message : 'sem conexão com o banco.'; }

function aoEntrarNaSala(info) {
  if (!info || !info.codigo) return aviso('A sala não abriu: o banco devolveu uma resposta vazia.');
  P.sala = info;
  P.assento = info.assento;
  if (info.nome) P.nomes[0] = info.nome;
  if (info.adversario) P.nomes[1] = info.adversario;
  aviso(info.assento === 0
    ? 'Sala ' + info.codigo + ' aberta. Passe o código para o outro jogador.'
    : 'Você entrou na sala ' + info.codigo + '. Espere o anfitrião começar.');
  el('dueloCodigo') && (el('dueloCodigo').value = info.codigo || '');
  pintarPlacar();
}

function sairDaSala() {
  if (P.sala && P.sala.sair) { try { P.sala.sair(); } catch (e) {} }
}

// O chip "sala por código" continua visível sem a nuvem configurada — a
// criança vê que existe — mas a nota explica o que falta e o modo local
// segue inteiro, no mesmo aparelho.
function redeLigada() {
  const n = root.CM_NUVEM;
  return !!(n && n.dueloLiberado && n.dueloLiberado());
}

// O motivo escrito do bloqueio, para a tela dizer a verdade em vez de um
// botão que não faz nada.
function motivoDaRede() {
  const n = root.CM_NUVEM;
  if (!n) return 'a conexão não carregou neste aparelho';
  if (typeof n.bloqueioDoDuelo !== 'function') return 'sem módulo de conexão';
  return n.bloqueioDoDuelo() || '';
}

function pintarSetup() {
  document.querySelectorAll('#dueloDens [data-d]').forEach((b) => {
    const ativa = parseInt(b.dataset.d, 10) === P.densidade;
    b.classList.toggle('ativa', ativa);
    b.setAttribute('aria-checked', String(ativa));
  });
  const bloqueado = !redeLigada();
  if (bloqueado && P.modo === 'rede') { P.modo = 'local'; P.sala = null; }
  document.querySelectorAll('#dueloModoChips [data-modo]').forEach((b) => {
    const ativa = b.dataset.modo === P.modo;
    b.classList.toggle('ativa', ativa);
    b.setAttribute('aria-checked', String(ativa));
    const semDireito = b.dataset.modo === 'rede' && bloqueado;
    b.disabled = semDireito;
    // Bloqueio dito em palavras, não só no botão acinzentado.
    b.title = semDireito ? 'Sala por código: ' + motivoDaRede() : '';
  });

  const nota = el('dueloNotaDens');
  if (nota) nota.textContent = notaDensidade();
  const recorde = el('dueloRecorde');
  if (recorde) {
    const texto = notaRecorde();
    recorde.textContent = texto;
    recorde.hidden = !texto;
  }
  const tempo = el('dueloNotaTempo');
  if (tempo) {
    tempo.innerHTML = '<i class="fa-solid fa-clock"></i> Cada vez dura <b>' + tempoDaVez() +
      ' s</b> no ' + C.NIVEIS[anoNv().nv - 1] + '. Acertou, o número sai e a vez passa. ' +
      'Errou, a mesma conta fica com você — e é o seu relógio que corre.';
  }
  el('dueloNomes').hidden = P.modo !== 'local';
  el('dueloRede').hidden = P.modo !== 'rede';
  const porque = motivoDaRede();
  const falta = el('dueloFaltaNuvem');
  if (falta) falta.hidden = redeLigada() || !!porque;
  const notaBloqueio = el('dueloBloqueio');
  const textoBloqueio = el('dueloBloqueioTexto');
  if (notaBloqueio) notaBloqueio.hidden = !porque;
  if (textoBloqueio) textoBloqueio.textContent = porque
    ? 'Sala por código ' + porque + '. O duelo continua inteiro no mesmo aparelho. O que falta para liberar está em SEGURANCA.md.'
    : '';
  aviso('');
}

function notaDensidade() {
  const d = P.densidade;
  if (d <= 20) return '20 números: cabem confortáveis e sobra tempo para conferir a conta.';
  if (d <= 40) return '40 números: a tela fica cheia e a hesitação custa caro.';
  if (d <= 60) return '60 números: vale separar com o olhar os vizinhos parecidos.';
  return '80 números: tela lotada. A partida só termina quando o último sair dela.';
}

// O recorde é sempre comparado com a MESMA tela: relógio de uma partida de 20
// números não diz nada contra uma de 80. Por isso a linha fala da densidade
// escolhida agora, e some quando ainda não há com o que comparar.
function notaRecorde() {
  const g = estado();
  const d = g && g.duelos;
  if (!d || !d.jogados) return '';
  const mesmas = (d.recorde || []).filter((e) => e && e.densidade === P.densidade);
  const tempos = mesmas.map((e) => e.tempoMeu).filter((t) => typeof t === 'number' && t > 0);
  if (!tempos.length) {
    return 'Ainda não há um relógio seu para ' + P.densidade +
      ' números nesta tela — jogue uma partida e ele aparece aqui.';
  }
  const melhor = Math.min.apply(null, tempos);
  const semPerder = mesmas.filter((e) => e.vencedor === P.assento || e.vencedor === -1).length;
  return 'Seu melhor relógio com ' + P.densidade + ' números: ' + relogio(melhor) +
    ' · ' + semPerder + ' de ' + mesmas.length + ' partidas terminaram sem perder.';
}

// ── 5. MONTAGEM E VEZ ────────────────────────────────────
function comecarPartida() {
  if (P.modo === 'rede' && !redeLigada()) {
    P.modo = 'local';
    pintarSetup();
    return aviso('Sem conexão, a partida acontece no mesmo aparelho. Ative a sala em Responsáveis › Conexão.');
  }
  if (P.modo === 'rede' && !P.sala) return aviso('Crie uma sala ou digite o código que o outro jogador passou.');

  if (naRede()) {
    if (P.assento !== 0) return aviso('Aguardando o anfitrião começar a caçada.');
    const contas = montarContas(P.densidade);
    P.sala.enviar('duelo:partida', { densidade: P.densidade, contas: contas });
    return iniciarCom(contas);
  }
  iniciarCom(montarContas(P.densidade));
}

// O convidado não sorteia de novo: recebe exatamente as contas que o
// anfitrião sorteou, para os dois aparelhos mostrarem o mesmo tabuleiro.
function iniciarCom(contas) {
  if (!contas || !contas.length) return;
  pararRelogio();
  P.pecas = C.embaralhar(contas.map((q, i) => ({ id: 'pc' + i, texto: q.resposta, vivo: true, el: null })));
  P.fila = contas.slice();
  P.vez = 0;
  P.achados = [0, 0];
  P.erros = [0, 0];
  P.tempos = [0, 0];
  P.semAchar = 0;
  P.errouNesta = false;
  P.fase = 'passagem';
  P.travada = true;

  el('dueloSetup').hidden = true;
  el('dueloJogo').hidden = false;
  desenharTabuleiro();
  sortearConta();
  pintarPlacar();
  chamarVez('A caçada começa com ' + P.densidade + ' números na tela.');
}

function sortearConta() {
  P.conta = P.fila.length ? C.d1(P.fila) : null;
  const alvo = el('dueloConta');
  if (alvo) alvo.textContent = P.conta ? P.conta.txt : '—';
  const tag = el('dueloTag');
  if (tag) tag.textContent = P.conta ? (P.conta.o || '') : '';
  pintarProgresso();
}

// Portão de passagem: o relógio só anda depois que quem joga diz "estou
// pronto". Sem isso, a troca de aparelho no modo local comeria tempo de
// quem acabou de receber o jogo.
// O motivo vem pronto, como frase inteira: ele é colado antes da instrução,
// então nunca pode começar com verbo amarrado ao nome de quem fala.
function chamarVez(motivo) {
  P.fase = 'passagem';
  P.travada = true;
  pararRelogio();
  limparBrilho();
  const caixa = el('dueloPassagem');
  if (caixa) {
    caixa.hidden = false;
    el('dueloPassaNome').textContent = P.nomes[P.vez];
    el('dueloPassaTexto').textContent = motivo + ' ' + (P.modo === 'local'
      ? 'Passe o aparelho para ' + P.nomes[P.vez] + ' e toque em Estou pronto.'
      : (P.vez === P.assento
        ? 'É a sua vez. Quando estiver olhando para a tela, toque em Estou pronto.'
        : 'Vez de ' + P.nomes[P.vez] + '. Seu relógio está parado — é a vez do outro lado.'));
  }
  const botao = el('dueloPronto');
  if (botao) botao.disabled = !(P.modo === 'local' || P.vez === P.assento);
  const barra = el('dueloTempoBarra');
  if (barra) { barra.style.width = '100%'; barra.classList.remove('aperta'); }
  pintarPlacar();
}

function lancarVez() {
  if (P.fase !== 'passagem') return;
  if (P.modo === 'rede' && P.vez !== P.assento) return;
  const caixa = el('dueloPassagem');
  if (caixa) caixa.hidden = true;
  P.fase = 'jogando';
  P.travada = false;
  P.inicioTurno = Date.now();
  P.errouNesta = false;
  P.limite = tempoDaVez();
  pintarPlacar();
  pararRelogio();
  P.tick = tem('safeSetInterval') ? root.safeSetInterval(pulsar, 200) : setInterval(pulsar, 200);
  pulsar();
}

function pararRelogio() {
  if (P.tick) { clearInterval(P.tick); P.tick = null; }
}

function tempoCorrido(i) {
  return P.tempos[i] + (P.fase === 'jogando' && P.vez === i && !P.travada ? Date.now() - P.inicioTurno : 0);
}

function pulsar() {
  if (P.fase !== 'jogando') return pararRelogio();
  relojios();
  if (P.travada) return;
  const restante = Math.max(0, P.limite * 1000 - (Date.now() - P.inicioTurno));
  const barra = el('dueloTempoBarra');
  if (barra) {
    barra.style.width = ((restante / (P.limite * 1000)) * 100).toFixed(1) + '%';
    barra.classList.toggle('aperta', restante < 6000);
  }
  const texto = el('dueloTempoTexto');
  if (texto) texto.textContent = (restante / 1000).toFixed(0) + ' s';
  if (restante <= 0) passarVez('Acabou o tempo da vez!');
}

function relojios() {
  [0, 1].forEach((i) => {
    const alvo = el('dueloRel' + i);
    if (alvo) alvo.textContent = relogio(tempoCorrido(i));
  });
}

// ── 6. O LANCE ───────────────────────────────────────────
function tocarPeca(peca) {
  if (P.fase !== 'jogando' || P.travada || !peca.vivo || !P.conta) return;
  if (peca.texto === P.conta.resposta) return achou(peca);

  P.errouNesta = true;
  P.erros[P.vez]++;
  if (peca.el) {
    peca.el.classList.add('tremendo');
    setTimeout(() => peca.el && peca.el.classList.remove('tremendo'), 450);
  }
  som('wrong');
  falar(vizinho(peca.texto, P.conta.resposta)
    ? 'Chegou perto, mas não é esse. A conta continua com você — e o relógio também.'
    : 'Não é esse. Refaça a conta: nada mudou no tabuleiro e a vez ainda é sua.');
  pintarPlacar();
}

function vizinho(a, b) {
  const x = paraNum(a), y = paraNum(b);
  if (!isFinite(x) || !isFinite(y)) return false;
  return Math.abs(x - y) <= Math.max(1, Math.abs(y) * 0.1);
}

function achou(peca) {
  const quem = P.vez;
  const tempoVez = Date.now() - P.inicioTurno;
  peca.vivo = false;
  if (peca.el) peca.el.classList.add('sumiu');
  const lugar = P.fila.indexOf(P.conta);
  if (lugar >= 0) P.fila.splice(lugar, 1);

  P.achados[quem]++;
  P.tempos[quem] += tempoVez;
  P.semAchar = 0;
  G.stars += POR_ACHADO;
  som('correct');
  registrarNoHistoria(P.conta, !P.errouNesta);
  if (naRede()) P.sala.enviar('duelo:acerto', { peca: peca.id, conta: P.conta.ref, assento: quem, tempo: P.tempos[quem] });
  limparBrilho();
  pintarPlacar();
  pintarProgresso();

  if (!P.fila.length) return encerrar();
  P.vez = 1 - quem;
  sortearConta();
  chamarVez(P.nomes[quem] + ' achou! Ainda restam ' + P.fila.length + ' números na tela.');
}

function passarVez(motivo) {
  if (P.fase !== 'jogando' || P.travada) return;
  const quem = P.vez;
  P.tempos[quem] += Date.now() - P.inicioTurno;
  pararRelogio();
  if (naRede()) P.sala.enviar('duelo:passada', { assento: quem, tempo: P.tempos[quem], motivo: motivo });
  P.semAchar++;

  // Três passadas seguidas sem tirar ninguém do tabuleiro querem dizer que a
  // conta está difícil demais para o tempo. Em vez de travar a partida, a
  // resposta ganha um brilho: ela continua valendo para quem tocar.
  if (P.semAchar >= REVELA_APOS) {
    P.semAchar = 0;
    P.fase = 'jogando';
    P.travada = false;
    el('dueloPassagem').hidden = true;
    brilharResposta();
    falar(motivo + ' Ninguém achou em três vezes — a resposta certa está brilhando.');
    P.inicioTurno = Date.now();
    P.tick = tem('safeSetInterval') ? root.safeSetInterval(pulsar, 200) : setInterval(pulsar, 200);
    return;
  }

  P.vez = 1 - quem;
  falar(motivo);
  chamarVez(motivo + ' A conta é a mesma: ela ainda está na fila.');
}

function brilharResposta() {
  if (!P.conta) return;
  P.pecas.forEach((p) => {
    if (p.vivo && p.el) p.el.classList.toggle('brilhando', p.texto === P.conta.resposta);
  });
}
function limparBrilho() {
  document.querySelectorAll('.duelo-num.brilhando').forEach((b) => b.classList.remove('brilhando'));
}

// O duelo também é estudo: cada conta entra no mesmo histórico dos outros
// jogos. A nota é honesta — vira erro quando a peça certa só veio depois de
// uma tacada errada.
function registrarNoHistoria(conta, limpo) {
  if (!conta || !tem('registrarTrabalho')) return;
  root.registrarTrabalho({ o: conta.o, u: conta.u, bncc: conta.bncc, txt: conta.txt, ref: conta.ref });
  if (tem('registrarResultado')) root.registrarResultado(!!limpo);
}

// ── 7. REDE: APLICAR O LANCE DO OUTRO LADO ───────────────
function receber(tipo, dado) {
  if (tipo === 'duelo:partida') {
    P.densidade = dado.densidade || P.densidade;
    if (Array.isArray(dado.contas) && dado.contas.length) iniciarCom(dado.contas);
    return true;
  }
  if (tipo === 'duelo:acerto') {
    const peca = P.pecas.filter((p) => p.id === dado.peca)[0];
    if (peca) { peca.vivo = false; if (peca.el) peca.el.classList.add('sumiu'); }
    const lugar = P.fila.map((q) => q.ref).indexOf(dado.conta);
    if (lugar >= 0) P.fila.splice(lugar, 1);
    P.achados[dado.assento]++;
    if (typeof dado.tempo === 'number') P.tempos[dado.assento] = dado.tempo;
    P.semAchar = 0;
    G.stars += 0;                     // estrela é de quem achou, não dos dois
    limparBrilho();
    pintarPlacar();
    pintarProgresso();
    if (!P.fila.length) { encerrar(); return true; }
    P.vez = 1 - dado.assento;
    sortearConta();
    chamarVez((P.nomes[dado.assento] || 'O outro lado') + ' achou na rede! Ainda restam ' + P.fila.length + '.');
    return true;
  }
  if (tipo === 'duelo:passada') {
    if (typeof dado.tempo === 'number') P.tempos[dado.assento] = dado.tempo;
    P.semAchar++;
    P.vez = 1 - dado.assento;
    if (P.semAchar >= REVELA_APOS) {
      P.semAchar = 0;
      P.fase = 'jogando';
      P.travada = doMeuLado() ? false : true;
      el('dueloPassagem').hidden = P.vez === P.assento;
      brilharResposta();
      falar(dado.motivo + ' A resposta está brilhando.');
      P.inicioTurno = Date.now();
      if (P.vez === P.assento) P.tick = tem('safeSetInterval') ? root.safeSetInterval(pulsar, 200) : setInterval(pulsar, 200);
    } else {
      falar(dado.motivo || 'A vez passou.');
      chamarVez((P.nomes[dado.assento] || 'O outro lado') + ' passou a vez no tempo.');
    }
    return true;
  }
  return false;
}

// ── 8. TABULEIRO ─────────────────────────────────────────
function desenharTabuleiro() {
  const area = el('dueloTabuleiro');
  if (!area) return;
  area.innerHTML = '';
  const frag = document.createDocumentFragment();
  P.pecas.forEach((peca) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'duelo-num';
    b.textContent = peca.texto;
    b.dataset.id = peca.id;
    b.setAttribute('aria-label', 'Número ' + peca.texto);
    b.onclick = () => tocarPeca(peca);
    peca.el = b;
    frag.appendChild(b);
  });
  area.appendChild(frag);
  ajustarGrade();
}

// A grade é medida, não adivinhada: as colunas cabem na largura real com
// alvo de toque de 44 px. Se as linhas não couberem na altura, a própria
// área vira rolável — sempre dá para chegar em todos os números.
function ajustarGrade() {
  const area = el('dueloTabuleiro');
  if (!area || !P.pecas.length) return;
  const restantes = P.pecas.filter((p) => p.vivo).length || P.pecas.length;
  const largura = area.clientWidth || 320;
  const altura = area.clientHeight || 320;
  // O número É a peça: se ele quebrar no meio ("19.96" / "8"), a criança fica
  // procurando um número que não existe no tabuleiro. Por isso a largura mínima
  // da coluna vem da medida do maior número da rodada, no corpo de letra que a
  // peça realmente está usando — um fator fixo por caractere subestima quando a
  // fonte cresce na tela grande e a quebra volta.
  const minima = larguraMinima(area);
  const passo = minima + VÃO;
  const porLargura = Math.floor((largura + VÃO) / passo);
  const porAspecto = Math.round(Math.sqrt(restantes * (largura / Math.max(140, altura))));
  const colunas = Math.max(3, Math.min(12, Math.max(3, Math.min(porLargura, Math.max(porAspecto, 3)))));
  area.style.setProperty('--colunas', String(colunas));
  area.style.setProperty('--vão', VÃO + 'px');
}

// Mede com canvas 2D, na fonte computada da primeira peça. Cai para uma
// estimativa proporcional ao corpo de letra se o navegador não der canvas.
function larguraMinima(area) {
  const maior = P.pecas.reduce((m, p) => {
    const t = String(p.texto || '');
    return t.length > m.length ? t : m;
  }, '');
  const num = area.querySelector('.duelo-num');
  if (!num || !maior) return CELULA_MINIMA;
  const cs = root.getComputedStyle(num);
  const corpo = parseFloat(cs.fontSize) || 14;
  const sobra = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) +
                (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0) + 2;
  const ctx = trena();
  if (!ctx) return Math.max(CELULA_MINIMA, Math.ceil(maior.length * corpo * 0.66 + sobra));
  const fonte = (cs.fontStyle === 'normal' ? '' : cs.fontStyle + ' ') +
                (cs.fontWeight === 'normal' ? '' : cs.fontWeight + ' ') +
                corpo + 'px ' + (cs.fontFamily || 'sans-serif');
  if (trenaUso.fonte !== fonte) { ctx.font = fonte; trenaUso.fonte = fonte; }
  return Math.max(CELULA_MINIMA, Math.ceil(ctx.measureText(maior).width + sobra));
}

const trenaUso = { ctx: null, fonte: '' };
function trena() {
  if (trenaUso.ctx === null) {
    try {
      trenaUso.ctx = document.createElement('canvas').getContext('2d') || false;
    } catch (e) { trenaUso.ctx = false; }
  }
  return trenaUso.ctx || null;
}

function pintarPlacar() {
  [0, 1].forEach((i) => {
    const nome = el('dueloLadoNome' + i);
    const ach = el('dueloAch' + i);
    const erros = el('dueloErros' + i);
    const lado = el('dueloLado' + i);
    if (nome) nome.textContent = P.nomes[i];
    if (ach) ach.textContent = br(P.achados[i]);
    if (erros) erros.textContent = String(P.erros[i]);
    if (lado) lado.classList.toggle('ativo', i === P.vez && P.fase !== 'setup');
  });
  relojios();
}

function pintarProgresso() {
  const alvo = el('dueloProg');
  if (alvo) alvo.textContent = br(P.fila.length) + ' na tela';
  if (tem('atualizarBarra')) root.atualizarBarra('dueloStarsBar');
  const vez = el('dueloVez');
  if (vez) {
    vez.textContent = P.travada
      ? 'Relógio parado: vez de ' + P.nomes[P.vez] + '.'
      : P.nomes[P.vez] + ' na vez — ' + P.limite + ' s no relógio.';
  }
  const jogo = el('dueloJogo');
  if (jogo) {
    jogo.classList.toggle('vez-0', P.vez === 0);
    jogo.classList.toggle('vez-1', P.vez === 1);
  }
  ajustarGrade();
}

function falar(msg) {
  const caixa = el('dueloFala');
  const bolha = el('dueloFalaMsg');
  if (!caixa || !bolha) return;
  bolha.textContent = msg;
  caixa.classList.add('show');
  clearTimeout(falar.t);
  falar.t = setTimeout(() => caixa.classList.remove('show'), 3400);
}

// ── 9. FIM DE PARTIDA ────────────────────────────────────
function encerrar() {
  if (P.fase === 'fim') return;
  pararRelogio();
  if (P.fase === 'jogando' && !P.travada) P.tempos[P.vez] += Date.now() - P.inicioTurno;
  P.fase = 'fim';
  P.travada = true;
  limparBrilho();

  const empatados = P.achados[0] === P.achados[1];
  const vencedor = empatados
    ? (Math.abs(P.tempos[0] - P.tempos[1]) < 500 ? -1 : (P.tempos[0] < P.tempos[1] ? 0 : 1))
    : (P.achados[0] > P.achados[1] ? 0 : 1);
  const meuVitoria = vencedor === P.assento;
  const premio = P.achados[0] + P.achados[1] + (meuVitoria ? BONUS_VITORIA : 0);
  if (meuVitoria) G.stars += BONUS_VITORIA;

  registrarDuelo(vencedor, empatados);
  pintarPlacar();
  if (tem('atualizarBarra')) root.atualizarBarra('dueloStarsBar');
  desenharFim(vencedor, empatados, premio);
  som(meuVitoria ? 'levelup' : 'wrong');
  if (meuVitoria && !semMovimento() && tem('showConfetti')) root.showConfetti();
}

// O duelo não mexe no nível: quem sobe ou desce degrau é a rodada completa
// dos outros jogos. Aqui fica o recorde da caçada.
function registrarDuelo(vencedor, empatados) {
  const g = estado();
  if (!g) return;
  const d = g.duelos;
  d.jogados++;
  d.achados += P.achados[0] + P.achados[1];
  if (vencedor === P.assento) d.ganhos++;
  const meu = Math.round(P.tempos[P.assento]);
  if ((vencedor === P.assento || empatados) && meu > 0 && (!d.melhorTempo || meu < d.melhorTempo)) d.melhorTempo = meu;
  d.recorde = (d.recorde || []).concat([{
    quando: Date.now(), densidade: P.densidade, modo: P.modo,
    placar: [P.achados[0], P.achados[1]], tempo: Math.round(P.tempos[0] + P.tempos[1]),
    tempoMeu: Math.round(P.tempos[P.assento]),
    vencedor: vencedor,
  }]).slice(-12);
  if (tem('saveState')) root.saveState();
}

function desenharFim(vencedor, empatados, premio) {
  const caixa = el('dueloFim');
  if (!caixa) return;
  const outro = 1 - vencedor;
  const titulo = vencedor < 0 ? 'Empate!' : P.nomes[vencedor] + ' levou a caçada!';
  const motivo = vencedor < 0
    ? 'Os dois acharam o mesmo tanto de números e gastaram o mesmo tempo.'
    : empatados
      ? 'Mesma quantidade: ' + P.achados[0] + ' para cada lado. Ganhou quem correu menos relógio.'
      : 'Foram ' + P.achados[vencedor] + ' números achados contra ' + P.achados[vencedor >= 0 ? outro : 0] + '.';

  // Cada número vira uma fichinha: em 320 px a linha quebra entre as fichas,
  // nunca no meio de "12 toques errados".
  function lado(i) {
    const fichas = [
      ['fa-magnifying-glass', '', P.achados[i] + (P.achados[i] === 1 ? ' achado' : ' achados')],
      ['fa-xmark', ' erro', P.erros[i] + (P.erros[i] === 1 ? ' toque errado' : ' toques errados')],
      ['fa-clock', '', relogio(P.tempos[i])]
    ].map((f) => '<span class="duelo-fim-stat' + f[1] + '"><i class="fa-solid ' + f[0] +
                 '"></i>' + esc(f[2]) + '</span>').join('');
    return '<div class="duelo-fim-jogador' + (i === vencedor ? ' venceu' : '') + '">' +
             '<b>' + esc(P.nomes[i]) + '</b>' +
             '<span class="duelo-fim-linha">' + fichas + '</span>' +
           '</div>';
  }

  caixa.innerHTML = '' +
    '<div class="duelo-fim-onca"><i class="fa-solid fa-paw"></i></div>' +
    '<h3 class="duelo-fim-titulo">' + esc(titulo) + '</h3>' +
    '<p class="duelo-fim-motivo">' + esc(motivo) + '</p>' +
    '<div class="duelo-fim-marcador">' +
      lado(0) + lado(1) +
    '</div>' +
    '<p class="duelo-fim-estrelas">+' + premio + ' <i class="fa-solid fa-star"></i>' +
      (vencedor === P.assento ? ' <span>(' + BONUS_VITORIA + ' do bônus de vitória)</span>' : '') + '</p>' +
    '<p class="duelo-fim-nota">A tela tinha ' + P.densidade + ' números e saiu inteira: ' +
      (P.achados[0] + P.achados[1]) + ' achados, ' + (P.erros[0] + P.erros[1]) + ' toques errados. ' +
      'A caçada não muda o nível do ano — ela treina conta rápida com a atenção dividida, ' +
      'que é o que a prova depois cobra.</p>' +
    '<div class="duelo-fim-acoes">' +
      '<button type="button" class="btn-duelo btn-duelo-primario" id="dueloRevanche">' +
        '<i class="fa-solid fa-rotate"></i> Jogar de novo</button>' +
      '<button type="button" class="btn-duelo" data-acao="goHub">' +
        '<i class="fa-solid fa-arrow-left"></i> Voltar aos jogos</button>' +
    '</div>';
  const repetir = el('dueloRevanche');
  if (repetir) repetir.onclick = () => { if (tem('closeModal')) root.closeModal('modalDuelo'); abrir(); };
  if (tem('openModal')) root.openModal('modalDuelo');
}

// ── 10. API ──────────────────────────────────────────────
root.CM_DUELO = {
  armar: armar,
  abrir: abrir,
  receber: receber,
  redeLigada: redeLigada,
  motivoDaRede: motivoDaRede,
  FORMA_CODIGO_SALA: FORMA_CODIGO_SALA,
  regras: {
    densidades: DENSIDADES, porAchado: POR_ACHADO, bonus: BONUS_VITORIA,
    segundos: SEGUNDOS_POR_NIVEL, revelarApos: REVELA_APOS,
  },
  // Sair do jogo (Voltar, Esc) desliga relógio e sala.
  parar: function () {
    pararRelogio();
    P.fase = 'setup';
    P.travada = true;
    sairDaSala();
    P.sala = null;
  },
  detalhes: function () { return P; },
};

// Chamada pelo script.js quando o jogo abre pelo hub.
root.iniciarDuelo = function () { abrir(); };
})(typeof window !== 'undefined' ? window : this);
