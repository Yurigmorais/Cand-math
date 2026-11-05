/* ===================================================
   CANDY MATH — avaliacao.js
   Duas peças que andam juntas:
     1. PROVA DE APRENDIZAGEM — 12 perguntas sem pista, sem desenho de
        doce e sem correção na hora. Serve para uma coisa só: verificar se
        o conteúdo ficou quando ninguém está ajudando.
     2. BOLETIM DOS RESPONSÁVEIS — a leitura formal e declaradamente
        parcial do que o jogo registrou. Diz onde focar, onde a criança já
        se adapta melhor e o que este boletim NÃO mede.
   A prova não dá estrela e não mexe no nível: se desse, todo mundo faria a
   prova pelo prêmio, e o número deixaria de valer alguma coisa.
   =================================================== */
(function (root) {
'use strict';

const C = root.CM;

const QTD_PROVA = 12;
const MINIMO_POR_UNIDADE = 2;     // senão a leitura por unidade vira ruído
const MINIMO_PARA_CONCLUSAO = 3;  // tentativas necessárias para uma conclusão
const ORDEM_UNIDADES = ['numeros', 'algebra', 'geometria', 'medidas', 'dados'];
const MAX_PROVAS_GUARDADAS = 10;

// Faixas de leitura. O nome é cuidadoso: nenhum delas é nota, e a última
// existe justamente para dizer que não dá para concluir ainda.
const FAIXAS = [
  { min: 0.80, chave: 'autonomia', rotulo: 'Resolve com autonomia' },
  { min: 0.60, chave: 'consolidacao', rotulo: 'Em consolidação' },
  { min: 0, chave: 'construcao', rotulo: 'Ainda em construção' },
];

const AV = {
  prova: null,           // {questoes, respostas, index, iniciadaEm}
  terminada: false,
};

function el(id) { return document.getElementById(id); }
function tem(fn) { return typeof root[fn] === 'function'; }
function estado() { try { return G; } catch (e) { return null; } }
// numBR é const no script.js: está no escopo global, mas não cola em window.
function br(n) { try { return numBR(n); } catch (e) { return String(n); } }
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function span(classe, texto) {
  const e = document.createElement('span');
  e.className = classe;
  e.textContent = texto;
  return e;
}

// ── 1. SORTEIO DA PROVA ───────────────────────────────────
// A prova cobre o ANO escolhido, subindo do nível Base até o nível em que a
// criança está agora: ela é cobrada pelo conteúdo que lhe foi proposto, não
// por um degrau acima.
function poolDoAno(ano, nvMax) {
  const pares = [];
  for (let nv = 1; nv <= nvMax; nv++) {
    C.chavesDo(ano, nv).forEach((chave) => { if (C.GER[chave]) pares.push({ chave: chave, nv: nv }); });
  }
  return C.embaralhar(pares);
}

function itensDoAno(ano, nvMax) {
  return (window.BANCO_ITENS || []).filter((i) => i.ano === ano && i.nv <= nvMax);
}

// Um item só entra na prova se vier com alternativas limpas: quatro opções,
// resposta correta única e sem "opção 4" de preenchimento.
function presta(item) {
  if (!item || !item.txt || !Array.isArray(item.alt) || item.alt.length !== 4) return false;
  if (!item.o || !item.u) return false;
  const vistos = {};
  for (let i = 0; i < 4; i++) {
    const a = String(item.alt[i]);
    if (!a || /\(opção \d+\)/.test(a) || /[<>]/.test(a)) return false;
    if (vistos[a]) return false;
    vistos[a] = true;
  }
  return true;
}

// Duas fontes, na mesma ordem de preferência: primeiro o banco autoral (texto
// revisado por gente), depois o motor de geração. Se uma unidade não tiver
// item próprio, completamos com qualquer unidade — a prova continua sendo do
// ano escolhido; só deixa de ser evenly dividida, o que é dito no boletim.
function montarProva() {
  const g = estado();
  const ano = g ? g.ano : 5;
  const nvMax = g ? g.nivel : 1;
  const banco = C.embaralhar(itensDoAno(ano, nvMax));
  const pool = poolDoAno(ano, nvMax);
  const enunciados = {};
  const questoes = [];
  let posMotor = 0;

  function doBanquinho(u) {
    for (let k = 0; k < banco.length; k++) {
      const i = banco[k];
      if (!presta(i)) continue;
      if (u && i.u !== u) continue;
      if (enunciados[i.txt]) continue;
      banco.splice(k, 1);
      return { txt: i.txt, o: i.o, u: i.u, bncc: [].concat(i.bncc || [])[0] || '', alt: i.alt.slice() };
    }
    return null;
  }

  function doMotor(u) {
    for (let tentativa = 0; tentativa < 30; tentativa++) {
      const f = pool[(posMotor + tentativa) % pool.length];
      if (!f) return null;
      const item = C.gerarChave(f.chave, ano, f.nv);
      if (!presta(item)) continue;
      if (u && item.u !== u) continue;
      if (enunciados[item.txt]) continue;
      posMotor += tentativa + 1;
      return { txt: item.txt, o: item.o, u: item.u, bncc: item.bncc || '', alt: item.alt.slice() };
    }
    return null;
  }

  function pega(u) { return doBanquinho(u) || doMotor(u); }

  // Round-robin pelas unidades: a prova fala de cinco temas, não de um só.
  for (let i = 0; i < QTD_PROVA; i++) {
    const unidade = ORDEM_UNIDADES[i % ORDEM_UNIDADES.length];
    const item = pega(unidade) || pega(null);
    if (!item) continue;
    enunciados[item.txt] = true;
    questoes.push(item);
  }
  return questoes;
}

// ── 2. A PROVA EM SI ─────────────────────────────────────
function abrirProva() {
  const questoes = montarProva();
  if (questoes.length < 4) {
    // Sem conteúdo suficiente não há prova honesta: avisamos em vez de
    // inventar pergunta de outro ano.
    if (tem('showToast')) root.showToast('Ainda não há conteúdo suficiente neste ano para montar a prova.');
    if (tem('goHub')) root.goHub();
    return;
  }
  AV.prova = {
    questoes: questoes,
    respostas: [],
    index: 0,
    iniciadaEm: Date.now(),
    ano: estado() ? estado().ano : 5,
    nv: estado() ? estado().nivel : 1,
  };
  AV.terminada = false;
  if (tem('showScreen')) root.showScreen('screenProva');
  desenhar();
}

function desenhar() {
  const p = AV.prova;
  if (!p) return;
  const caixa = el('provaPainel');
  const fim = el('provaFim');
  if (fim) fim.hidden = true;
  if (caixa) caixa.hidden = false;

  const prog = el('provaProg');
  if (prog) prog.textContent = (p.index + 1) + '/' + p.questoes.length;

  const q = p.questoes[p.index];
  if (!q) return terminarProva();

  el('provaText').textContent = q.txt;
  el('provaTag').textContent = (C.UNIDADES[q.u] || q.u) + ' · ' + q.o;
  el('provaFeedback').classList.remove('show');

  const caixaRespostas = el('provaRespostas');
  caixaRespostas.innerHTML = '';
  const embaralhadas = C.embaralhar(q.alt.slice());
  embaralhadas.forEach((alt) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-prova';
    b.textContent = alt;
    b.onclick = () => responder(alt, q, b);
    caixaRespostas.appendChild(b);
  });
  const nota = el('provaNota');
  if (nota) nota.textContent = 'Sem pista e sem correção agora. Você marca uma resposta e segue.';
}

// A resposta é registrada e a tela avança. Errado não vermelha de propósito:
// avisar no meio mudaria exatamente o que a prova está medindo.
function responder(escolha, q, botao) {
  const p = AV.prova;
  if (!p || p.index >= p.questoes.length) return;
  if (p.respostas[p.index]) return;

  botao.classList.add('marcada');
  Array.prototype.forEach.call(el('provaRespostas').children, (b) => { b.disabled = true; });
  p.respostas[p.index] = {
    o: q.o, u: q.u, bncc: q.bncc, txt: q.txt,
    certa: q.alt[0], escolha: escolha, acerto: escolha === q.alt[0],
  };
  setTimeout(() => {
    p.index++;
    if (p.index >= p.questoes.length) terminarProva();
    else desenhar();
  }, 420);
}

function terminarProva() {
  const p = AV.prova;
  if (!p || AV.terminada) return;
  AV.terminada = true;

  const feitas = p.respostas.filter(Boolean);
  const acertos = feitas.filter((r) => r.acerto).length;
  const registro = {
    quando: Date.now(),
    duracao: Math.round((Date.now() - p.iniciadaEm) / 1000),
    ano: p.ano, nv: p.nv,
    total: p.questoes.length,
    respondidas: feitas.length,
    acertos: acertos,
    itens: feitas.map((r) => ({ o: r.o, u: r.u, bncc: r.bncc, acerto: r.acerto })),
  };

  const g = estado();
  if (g) {
    g.provas = (g.provas || []).concat([registro]).slice(-MAX_PROVAS_GUARDADAS);
    // A prova fica fora do histórico por conteúdo de propósito: misturar as
    // duas contas apagaria justamente a diferença que o boletim compara
    // (resolver com apoio × resolver sozinha). Ela vive em G.provas e é lida
    // sozinha nas seções 5 e 6.
    if (tem('saveState')) root.saveState();
  }

  el('provaPainel').hidden = true;
  desenharResultado(registro);
  if (tem('showScreen')) root.showScreen('screenProva');
}

function desenharResultado(r) {
  const caixa = el('provaFim');
  if (!caixa) return;
  caixa.hidden = false;
  const taxa = r.total ? r.acertos / r.total : 0;
  const leitura = taxa >= 0.8 ? 'O conteúdo está de pé mesmo sem apoio.'
    : taxa >= 0.6 ? 'A base está lá, com pontas soltas em um ou dois temas.'
      : taxa >= 0.4 ? 'Muito do que foi jogado ainda não virou conhecimento autônomo.'
        : 'Neste momento a prova mostra que é preciso voltar aos jogos com mais tempo e menos pressão.';

  const porUnidade = {};
  r.itens.forEach((i) => {
    const d = porUnidade[i.u] || (porUnidade[i.u] = { feitas: 0, certas: 0 });
    d.feitas++;
    if (i.acerto) d.certas++;
  });

  caixa.innerHTML = '' +
    '<div class="prova-fim-nota"><i class="fa-solid fa-clipboard-check"></i> ' +
      'Prova de aprendizagem registrada — sem estrela e sem mudança de nível, de propósito.</div>' +
    '<h3 class="prova-fim-titulo">' + r.acertos + ' de ' + r.total + '</h3>' +
    '<p class="prova-fim-leitura">' + esc(leitura) + '</p>' +
    '<div class="prova-fim-unidades" id="provaFimUnidades"></div>' +
    '<p class="prova-fim-parcial">Esta é uma amostra de ' + r.total + ' perguntas. ' +
      'Ela mede o que a criança resolve sozinha, hoje, neste aparelho. Não é nota da escola, ' +
      'não substitui a avaliação da professora e muda de uma semana para outra.</p>' +
    '<div class="prova-fim-acoes">' +
      '<button type="button" class="btn-prova-acao btn-prova-acao-primario" id="provaVerBoletim">' +
        '<i class="fa-solid fa-chart-line"></i> Ver o boletim completo</button>' +
      '<button type="button" class="btn-prova-acao" id="provaRecomecar">' +
        '<i class="fa-solid fa-rotate-left"></i> Fazer outra prova</button>' +
      '<button type="button" class="btn-prova-acao" data-acao="goHub">' +
        '<i class="fa-solid fa-arrow-left"></i> Voltar aos jogos</button>' +
    '</div>';

  const unidades = el('provaFimUnidades');
  ORDEM_UNIDADES.forEach((u) => {
    const d = porUnidade[u];
    if (!d) return;
    const linha = document.createElement('div');
    linha.className = 'prova-unidade';
    linha.appendChild(span('prova-unidade-nome', C.UNIDADES[u]));
    linha.appendChild(span('prova-unidade-num', d.certas + '/' + d.feitas));
    unidades.appendChild(linha);
  });

  const ver = el('provaVerBoletim');
  if (ver) ver.onclick = () => { if (tem('openModal')) root.openModal('modalPais'); };
  // O botão de refazer nasce aqui, junto do resultado, então a ligação também
  // acontece aqui — armar() roda uma única vez, quando a página abre.
  const deNovo = el('provaRecomecar');
  if (deNovo) deNovo.onclick = () => { AV.terminada = false; abrirProva(); };
}

// ── 3. LEITURA DOS DADOS ────────────────────────────────
// O histórico por conteúdo vive no script.js; aqui só o lemos e interpretamos.
function metaConteudos() {
  if (tem('metaConteudo')) return root.metaConteudo();
  return {};
}

function entradasDeHist() {
  const g = estado();
  if (!g) return [];
  const meta = metaConteudos();
  return Object.keys(g.hist).map((nome) => ({
    nome: nome,
    feitas: g.hist[nome].feitas,
    certas: g.hist[nome].certas,
    u: (meta[nome] && meta[nome].u) || '',
    cod: (meta[nome] && meta[nome].cod) || '',
  }));
}

function faixaDe(taxa, feitas) {
  if (feitas < MINIMO_PARA_CONCLUSAO) return { chave: 'pouco', rotulo: 'Observação insuficiente' };
  for (const f of FAIXAS) if (taxa >= f.min) return f;
  return FAIXAS[FAIXAS.length - 1];
}

function pct(x) { return Math.round(x * 100) + '%'; }

function datasLegiveis(ts) {
  try {
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) { return ''; }
}

// ── 4. BOLETIM DOS RESPONSÁVEIS ─────────────────────────
// Escrito em linguagem formal porque é um documento para adulto, e declarado
// parcial porque é isso que ele é: uma leitura do que aconteceu aqui, não um
// retrato da criança.
//
// O esqueleto (os títulos numerados e as caixas) está em index.html; aqui cada
// função preenche uma caixa pelo id. Se o id mudar no HTML, a função simplesmente
// não encontra alvo — por isso bloco() devolve o elemento e nada aqui assume
// que ele existe.
function montarBoletim() {
  const g = estado();
  if (!g) return;
  const entradas = entradasDeHist();
  const feitas = entradas.reduce((soma, e) => soma + e.feitas, 0);
  const certas = entradas.reduce((soma, e) => soma + e.certas, 0);
  const provas = (g.provas || []).slice().reverse();
  const ultima = provas[0] || null;

  montarSituacao(g, entradas, feitas, certas, provas);
  montarSentido();
  montarUnidades(entradas, feitas);
  montarLimites();
  montarFoco(entradas);
  montarProvas(provas);
  montarCombinada(entradas, ultima);
  montarRecomendacoes(g, entradas, ultima);
  montarCobertura(g);
  montarCodigos(entradas, ultima);
  montarConta(g);
}

function bloco(id, html) {
  const alvo = el(id);
  if (alvo) { alvo.innerHTML = html; alvo.hidden = false; }
  return alvo;
}

// 1. Situação observada — o retrato de uma linha, com a amostra junto.
function montarSituacao(g, entradas, feitas, certas, provas) {
  const periodo = datasLegiveis(g.desde || Date.now()) + ' até hoje';
  const taxa = feitas ? certas / feitas : 0;
  const faixa = faixaDe(taxa, feitas);
  const situação = 'Criança no ' + g.ano + 'º ano do Ensino Fundamental, nível ' +
    textoNivelAtual(g) + '. Período observado: ' + periodo + '. ' +
    br(feitas) + ' respostas registradas em ' + entradas.length + ' conteúdos, com ' +
    (provas.length ? provas.length + ' prova(s) de aprendizagem aplicada(s).' : ' nenhuma prova aplicada até agora.');
  const cartoes = [
    ['Período observado', periodo],
    ['Respostas registradas', br(feitas)],
    ['Acertos nas respostas', br(certas) + ' (' + pct(taxa) + ')'],
    ['Leitura geral', faixa.rotulo],
    ['Conteúdos tocados', String(entradas.length)],
    ['Provas aplicadas', String(provas.length)],
    ['Duelos jogados', String((g.duelos && g.duelos.jogados) || 0)],
    ['Estrelas conquistadas', br(g.stars)],
  ];
  const alvo = el('bolSituacao');
  if (alvo) {
    alvo.innerHTML = '<p class="bol-situacao-texto">' + esc(situação) + '</p>' +
      '<div class="pai-resumo">' + cartoes.map((c) =>
        '<div class="pai-num"><span class="pai-num-rotulo">' + esc(c[0]) + '</span>' +
        '<span class="pai-num-valor">' + esc(c[1]) + '</span></div>').join('') + '</div>';
    alvo.hidden = false;
  }
}

function textoNivelAtual(g) {
  const nome = C.NIVEIS[g.nivel - 1] || 'Base';
  let descricao = '';
  try { descricao = (DESCRICAO_NIVEL[g.nivel - 1] || '').split('.')[0]; } catch (e) { descricao = ''; }
  return nome + (descricao ? ' — ' + descricao : '');
}

// 2. O que o jogo está medindo — e, com o mesmo cuidado, o que ele não mede.
function montarSentido() {
  bloco('bolSentido',
    '<p class="bol-texto">Este boletim reúne duas fontes de evidência: o desempenho nas ' +
      'rodadas de jogo (em que a criança recebe pista, desenho da situação e uma questão de ' +
      'reforço quando erra) e a <b>prova de aprendizagem</b> (em que nada disso aparece). ' +
      'A primeira mostra como a criança resolve <i>com apoio</i>; a segunda, o que ela resolve ' +
      '<i>sozinha</i>. A distância entre as duas é a informação mais útil deste documento.</p>' +
    '<div class="bol-colunas">' +
      '<div class="bol-coluna bol-coluna-mede">' +
        '<h4><i class="fa-solid fa-check"></i> O que este boletim mede</h4>' +
        '<ul>' +
          '<li>acertos por conteúdo, contados pergunta a pergunta;</li>' +
          '<li>as cinco unidades temáticas da BNCC, cada uma com a amostra declarada;</li>' +
          '<li>se a criança mantém o acerto quando o apoio some;</li>' +
          '<li>quanto do currículo do ano escolhido já apareceu.</li>' +
        '</ul>' +
      '</div>' +
      '<div class="bol-coluna bol-coluna-nao">' +
        '<h4><i class="fa-solid fa-xmark"></i> O que ele não mede</h4>' +
        '<ul>' +
          '<li>atenção, organização do caderno, uso do algoritmo no papel;</li>' +
          '<li>explicação oral, trabalho em grupo, prova com tempo cronometrado;</li>' +
          '<li>habilidades de outros anos nem conteúdo não jogado aqui;</li>' +
          '<li>qualquer coisa parecida com nota — não há escala escolar envolvida.</li>' +
        '</ul>' +
      '</div>' +
    '</div>');
}

// 3. Resultado por unidade temática, com a amostra escrita em cada linha.
function montarUnidades(entradas, feitasTotal) {
  const linhas = ORDEM_UNIDADES.map((u) => {
    const grupo = entradas.filter((e) => e.u === u);
    const fz = grupo.reduce((s, e) => s + e.feitas, 0);
    const cz = grupo.reduce((s, e) => s + e.certas, 0);
    const taxa = fz ? cz / fz : 0;
    const faixa = faixaDe(taxa, fz);
    const largura = fz ? Math.round(taxa * 100) : 0;
    return '<div class="pai-unidade' + (fz ? '' : ' pai-sem-dado') + '">' +
      '<span class="pai-unidade-nome">' + esc(C.UNIDADES[u]) +
        '<em class="bol-u-faixa faixa-' + faixa.chave + '">' + esc(faixa.rotulo) + '</em></span>' +
      '<span class="pai-barra" role="img" aria-label="' +
        esc(C.UNIDADES[u] + ': ' + cz + ' acertos em ' + fz + ' tentativas') + '">' +
        '<span class="pai-barra-fill" style="width:' + largura + '%"></span></span>' +
      '<span class="pai-unidade-num">' + (fz ? cz + '/' + fz : '—') + '</span>' +
      '</div>';
  });
  const alvo = bloco('paiUnidades', linhas.join(''));
  const vazio = el('paiVazio');
  if (alvo && vazio) vazio.hidden = feitasTotal > 0;
}

// O aviso de leitura parcial mora junto das barras, onde o número é lido.
function montarLimites() {
  bloco('bolLimites',
    '<p class="bol-aviso-parcial"><i class="fa-solid fa-scale-unbalanced"></i> ' +
      '<b>Leitura parcial.</b> Com menos de ' + MINIMO_PARA_CONCLUSAO + ' tentativas em um conteúdo, ' +
      'o resultado aparece como "observação insuficiente": um acerto isolado não prova nada e um ' +
      'erro isolado não condena nada. Cada barra acima traz a amostra que a sustenta, e as ' +
      'percentagens consideram apenas o que foi respondido neste aparelho.</p>');
}

// 4. Onde deve focar e onde já se adapta melhor.
function montarFoco(entradas) {
  const suficientes = entradas.filter((e) => e.feitas >= MINIMO_PARA_CONCLUSAO);
  const taxa = (e) => e.certas / e.feitas;
  const foco = suficientes.filter((e) => taxa(e) < 0.6).sort((a, b) => taxa(a) - taxa(b)).slice(0, 5);
  const forte = suficientes.filter((e) => taxa(e) >= 0.8).sort((a, b) => taxa(b) - taxa(a)).slice(0, 5);

  const linha = (e, tipo) =>
    '<li class="rec-item ' + (tipo === 'foco' ? 'ri-revisar' : 'ri-domina') + '">' +
      '<span class="rec-item-situacao">' + esc(tipo === 'foco' ? 'Onde deve focar' : 'Onde se adapta melhor') + '</span>' +
      '<span class="rec-item-texto">' + esc(e.nome) + ' — ' +
        esc(e.certas + ' de ' + e.feitas + ' acertos (' + pct(taxa(e)) + ')') +
        (e.u ? ' · ' + esc(C.UNIDADES[e.u] || e.u) : '') + '</span>' +
    '</li>';

  const itens = foco.map((e) => linha(e, 'foco')).concat(forte.map((e) => linha(e, 'forte')));
  bloco('paiLista', itens.length ? itens.join('')
    : '<li class="rec-item"><span class="rec-item-situacao">Sem leitura ainda</span>' +
      '<span class="rec-item-texto">Ainda não há amostra suficiente para apontar foco: é preciso ' +
      MINIMO_PARA_CONCLUSAO + ' respostas sobre o mesmo conteúdo. Uma rodada de Quiz Doce costuma ' +
      'bastar para os conteúdos que aparecem mais.</span></li>');
}

// 5. Provas aplicadas, com o contexto de cada uma.
function montarProvas(provas) {
  if (!provas.length) {
    bloco('bolProvas',
      '<p class="pai-vazio">Nenhuma prova de aprendizagem aplicada ainda. Faça a prova depois de ' +
        'algumas rodadas: sem histórico jogado, o resultado diz pouco sobre a criança.</p>');
    return;
  }
  const linhas = provas.map((p, i) => {
    const taxa = p.total ? p.acertos / p.total : 0;
    const faixa = faixaDe(taxa, p.respondidas || p.total);
    return '<div class="bol-prova' + (i === 0 ? ' bol-prova-atual' : '') + '">' +
      '<span class="bol-prova-data">' + esc(datasLegiveis(p.quando)) + '</span>' +
      '<span class="bol-prova-nota">' + esc(p.acertos + '/' + p.total) + ' · ' + pct(taxa) + '</span>' +
      '<span class="bol-prova-faixa faixa-' + faixa.chave + '">' + esc(faixa.rotulo) + '</span>' +
      '<span class="bol-prova-ano">' + esc(p.ano + 'º ano · ' + (C.NIVEIS[p.nv - 1] || '')) + '</span>' +
      '</div>';
  });
  bloco('bolProvas', linhas.join('') +
    '<p class="pai-nota">Cada linha é uma prova de ' + QTD_PROVA + ' perguntas. Repetir a prova em ' +
    'dias diferentes vale mais do que fazê-la duas vezes seguidas.</p>');
}

// 6. A comparação que importa: desempenho com apoio × desempenho sem apoio.
function montarCombinada(entradas, ultima) {
  const caixa = el('bolCombinada');
  if (!caixa) return;
  caixa.hidden = false;
  if (!ultima || !entradas.length) {
    caixa.innerHTML = '<p class="pai-vazio">Quando existir jogo e prova suficientes, esta linha ' +
      'mostra a diferença entre resolver com apoio e resolver sozinha.</p>';
    return;
  }
  const taxaProva = ultima.total ? ultima.acertos / ultima.total : 0;
  const feitasJogo = entradas.reduce((s, e) => s + e.feitas, 0);
  const certasJogo = entradas.reduce((s, e) => s + e.certas, 0);
  const taxaJogo = feitasJogo ? certasJogo / feitasJogo : 0;
  const distancia = taxaJogo - taxaProva;

  let leitura;
  if (distancia > 0.2) {
    leitura = 'A criança acerta muito mais com apoio (' + pct(taxaJogo) + ') do que sozinha (' +
      pct(taxaProva) + '). Isso costuma significar que a ideia foi compreendida na hora, com a pista, ' +
      'mas ainda não virou conhecimento autônomo. Vale repetir os temas da prova em rodadas curtas, ' +
      'sem pressa, e voltar à prova depois de uma semana.';
  } else if (distancia < -0.1) {
    leitura = 'O resultado da prova (' + pct(taxaProva) + ') superou o desempenho com apoio (' +
      pct(taxaJogo) + '). Há boas chances de o conteúdo estar mais firme do que as rodadas mostram: ' +
      'o histórico inclui dias de desatenção e conteúdos que ainda estão aparecendo.';
  } else {
    leitura = 'Os dois números andam próximos (' + pct(taxaJogo) + ' com apoio e ' + pct(taxaProva) +
      ' sem apoio). O que a criança faz no jogo é o que ela faz sozinha: o aprendizado está transferido.';
  }

  caixa.innerHTML = '<div class="bol-duas-colunas">' +
    '<div class="bol-mini"><span class="bol-mini-rotulo">Com apoio (rodadas)</span>' +
      '<span class="bol-mini-valor">' + pct(taxaJogo) + '</span>' +
      '<span class="bol-mini-dado">' + br(certasJogo) + ' de ' + br(feitasJogo) + '</span></div>' +
    '<div class="bol-mini"><span class="bol-mini-rotulo">Sem apoio (prova)</span>' +
      '<span class="bol-mini-valor">' + pct(taxaProva) + '</span>' +
      '<span class="bol-mini-dado">' + ultima.acertos + ' de ' + ultima.total + '</span></div>' +
    '</div><p class="bol-texto">' + esc(leitura) + '</p>';
}

// 7. Recomendações: o que fazer com o que foi lido acima.
function montarRecomendacoes(g, entradas, ultima) {
  const feitos = entradas.reduce((s, e) => s + e.feitas, 0);
  const recomenda = [];
  if (feitos < 20) {
    recomenda.push(['Ainda cedo', 'Há poucas respostas registradas (' + feitos + '). Antes de concluir qualquer coisa, ' +
      'deixe a criança jogar de cinco a dez rodadas, em dias diferentes.']);
  }
  const taxa = (e) => e.certas / e.feitas;
  const foco = entradas.filter((e) => e.feitas >= MINIMO_PARA_CONCLUSAO && taxa(e) < 0.6);
  if (foco.length) {
    recomenda.push(['Comece pelo que trava', '<b>' + esc(foco.slice(0, 3).map((e) => e.nome).join('; ')) +
      '</b>. Nesses conteúdos o jogo aceita o erro: a pista vem antes da resposta. Peça para a criança ' +
      'explicar em voz alta como pensou — a explicação costuma revelar se o problema é de cálculo ou de leitura do enunciado.']);
  }
  const forte = entradas.filter((e) => e.feitas >= MINIMO_PARA_CONCLUSAO && taxa(e) >= 0.8);
  if (forte.length) {
    recomenda.push(['Não insista no que já está firme', '<b>' + esc(forte.slice(0, 3).map((e) => e.nome).join('; ')) +
      '</b> pode virar treino curto de vez em quando, para não esfriar. O tempo deste aparelho rende mais onde a criança ainda erra.']);
  }
  if (!ultima) {
    recomenda.push(['Aplique a prova', 'É a única leitura daqui que acontece sem pista, sem desenho e sem reforço — ' +
      'e a que mais se parece com o que a escola espera.']);
  } else if (ultima.total && ultima.acertos / ultima.total < 0.6) {
    recomenda.push(['Refaça em uma semana', 'A última prova ficou em ' + ultima.acertos + ' de ' + ultima.total + '. ' +
      'Volte aos jogos no mesmo ano e nível, com sessões curtas, e compare as duas provas — a comparação é o que mostra progresso.']);
  }
  if (g.nivel <= 1 && feitos > 40) {
    recomenda.push(['Sobre o nível', 'O nível segue em Base apesar de mais de 40 respostas. Se a criança termina as ' +
      'rodadas completas, o próximo degrau vem sozinho; se ela evita o jogo, o nível está alto demais.']);
  }
  recomenda.push(['Ritmo', 'Sessões de 15 a 20 minutos, em dias alternados, produzem leitura mais estável do que ' +
    'uma sessão longa no fim de semana.']);

  bloco('bolRecomendacoes', recomenda.map((r) =>
    '<li class="rec-item ri-dica"><span class="rec-item-situacao">' + esc(r[0]) + '</span>' +
    '<span class="rec-item-texto">' + r[1] + '</span></li>').join(''));
}

// O que ainda não passou pela tela — cobertura, não aproveitamento.
function montarCobertura(g) {
  const alvo = el('paiPendentes');
  if (!alvo) return;
  alvo.hidden = false;
  const insuficientes = entradasDeHist().filter((e) => e.feitas < MINIMO_PARA_CONCLUSAO);
  let texto = '';
  if (tem('conteudosPendentes')) {
    const pendentes = root.conteudosPendentes();
    const total = pendentes.length + Object.keys(g.hist || {}).length;
    const feitos = total ? Math.round((1 - pendentes.length / total) * 100) : 0;
    texto = 'Do conteúdo previsto para <b>' + g.ano + 'º ano · ' + (C.NIVEIS[g.nivel - 1] || '') +
      '</b>, cerca de ' + feitos + '% já apareceu pelo menos uma vez. ' +
      (pendentes.length
        ? 'Ainda não passaram por aqui: ' + esc(pendentes.slice(0, 8).join(', ')) +
          (pendentes.length > 8 ? ' e mais ' + (pendentes.length - 8) + ' conteúdos.' : '.')
        : 'Todos os conteúdos desta combinação já foram apresentados.');
  }
  if (insuficientes.length) {
    texto += ' Com amostra pequena (' + MINIMO_PARA_CONCLUSAO + ' tentativas ou menos), ainda sem leitura: ' +
      esc(insuficientes.slice(0, 6).map((e) => e.nome).join(', ')) +
      (insuficientes.length > 6 ? ' e mais ' + (insuficientes.length - 6) : '') + '.';
  }
  alvo.innerHTML = texto
    ? '<p>' + texto + '</p><p class="pai-nota">Aparição não é domínio: serve para saber se o leque está ' +
      'amplo ou estreito demais, não para medir aproveitamento.</p>'
    : '<p>Todos os conteúdos deste ano e nível já apareceram pelo menos uma vez.</p>';
}

// 9. Só o vocabulário comum com a escola: os códigos, nunca a nota.
function montarCodigos(entradas, ultima) {
  const alvo = el('paiCodigos');
  if (!alvo) return;
  alvo.hidden = false;
  const vistos = {};
  entradas.filter((e) => e.cod).forEach((e) => { vistos[e.cod] = (vistos[e.cod] || 0) + e.feitas; });
  if (ultima) ultima.itens.forEach((i) => { if (i.bncc) vistos[i.bncc] = (vistos[i.bncc] || 0) + 1; });
  const codigos = Object.keys(vistos).sort();
  alvo.innerHTML = codigos.length
    ? codigos.slice(0, 24).map((c) => '<span class="pai-codigo">' + esc(c) + '</span>').join('')
    : '<p class="pai-vazio">Nenhum código foi registrado ainda.</p>';
}

// 10. Onde os dados ficam — e o que a conexão muda nisso.
function montarConta(g) {
  const alvo = el('bolConta');
  if (!alvo) return;
  alvo.hidden = false;
  const nuvem = root.CM_NUVEM;
  const logado = !!(nuvem && nuvem.logado && nuvem.logado());
  const resumo = (nuvem && nuvem.resumo) ? nuvem.resumo() : {};
  // Conta criada é outra coisa: existe, mas ainda não assinou nada. O boletim
  // não pode dizer "não há cadastro" para quem acabou de receber o link.
  const pendente = !logado && !!resumo.pendente;
  // As duas frases não podem se contradizer: com a conexão ligada existe,
  // sim, uma conta de adulto com e-mail. O boletim tem que dizer isso.
  const origem = logado
    ? 'O progresso fica guardado neste navegador, na chave <code>candymath_v3</code>, e sobe para o banco ' +
      'somente o pacote desse mesmo arquivo — estrelas, histórico por conteúdo e provas. A conta é do adulto ' +
      '(e-mail verificado); a criança não tem login nem e-mail: ela entra no vínculo pelo código gerado aqui, ' +
      'e o único nome que viaja é o apelido que você escolher.'
    : pendente
      ? 'O progresso fica guardado neste navegador, na chave <code>candymath_v3</code>. Há uma conta de ' +
        'responsável criada a partir deste aparelho, mas ela ainda não tem valor nenhum: enquanto o link do ' +
        'e-mail não for clicado, nada sobe para o banco e nenhuma informação sai daqui. Feche isso em ' +
        '"Conta e conexão" abaixo.'
      : 'O progresso fica guardado neste navegador, na chave <code>candymath_v3</code>. Não há cadastro, nome, ' +
        'e-mail ou qualquer dado que identifique a criança, e nada é enviado a um servidor enquanto a conexão ' +
        'estiver desligada.';
  alvo.innerHTML =
    '<p class="bol-texto">' + origem + '</p>' +
    '<p class="bol-texto">' + (logado
      ? '<i class="fa-solid fa-cloud"></i> A conexão está <b>ativada</b>: com login confirmado, o ' +
        'mesmo boletim pode ser lido pelo responsável vinculado, e o histórico aparece sincronizado. ' +
        'A vinculação usa um código gerado aqui — nada é público.'
      : pendente
        ? '<i class="fa-solid fa-envelope-circle-check"></i> A conexão está <b>esperando o clique</b>: ' +
          'a conta existe no papel, e só depois de confirmar o e-mail ela passa a ler o boletim em outro ' +
          'aparelho. Até aqui, o jogo é inteiro deste aparelho.'
        : '<i class="fa-solid fa-plug"></i> A conexão está <b>desligada</b>: tudo acontece neste aparelho. ' +
          'Para acompanhar de outro aparelho, abra "Conta e conexão" abaixo e crie um login de responsável ' +
          'com e-mail verificado — o e-mail serve só para confirmar a conta, e nenhuma outra informação ' +
          'sai daqui sem essa conta ativa.') +
    '</p>' +
    // Onde apagar: dito no documento, porque é direito do titular e o boletim
    // é o documento que ele abre.
    '<p class="pai-privacidade"><i class="fa-solid fa-trash-can"></i> Para apagar: <b>Apagar dados</b>, ' +
    'nesta mesma tela, tem duas saídas — apagar <b>deste aparelho</b> e apagar <b>da conta</b>, no banco. ' +
    'Cada uma pede um segundo clique e nenhuma reescreve a outra por cima.</p>' +
    '<p class="pai-privacidade"><i class="fa-solid fa-file-shield"></i> A descrição completa do que é ' +
    'guardado, do que nunca sai do aparelho e de como exercer os direitos sobre os dados está na página ' +
    '<a href="privacidade.html">Como os dados são tratados</a>.</p>';
}


// ── 5. LIGAÇÃO ──────────────────────────────────────────
// Nada a armar no nascimento da página: a prova inteira é desenhada por
// abrirProva() e os botões do resultado nascem ligados dentro de
// desenharResultado(). Esta função existe porque o script.js chama todos os
// módulos na mesma ordem, e um módulo sem ligação apenas concorda em silêncio.
function armar() {}

root.CM_AVALIACAO = {
  abrirProva: abrirProva,
  armar: armar,
  boletim: montarBoletim,
  faixas: FAIXAS,
  minimo: MINIMO_PARA_CONCLUSAO,
  detalhes: function () { return AV; },
};

// Chamada pelo script.js quando o jogo abre pelo hub.
root.iniciarProva = function () { abrirProva(); };
})(typeof window !== 'undefined' ? window : this);
