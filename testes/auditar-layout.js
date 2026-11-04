#!/usr/bin/env node
/* ============================================================
   AUDITORIA DE LAYOUT — testes/auditar-layout.js
   Abre o Edge/Chromium em modo headless, liga o DevTools em
   127.0.0.1 e mede cada tela do jogo em vários tamanhos de janela.
   O que ele procura:
     1. corteVertical    - texto/botão abaixo da área visível, sem nada rolando
     2. foraDaTela       - caixa que passa da largura da janela
     3. rolaHorizontal   - contêiner que virou trilho de rolagem lateral
     4. textoCortado     - elemento com overflow:hidden e texto que não cabe
     5. alvoPequeno      - botão/input com menos de 40 px de altura
     6. colapsado        - alvo clicável que virou 0x0 e sumiu da tela
     7. documentoPreso   - página de texto mais alta que a janela sem rolagem
   Também mede as páginas fora do jogo (PAGINAS) e grava capturas em
   testes/capturas/ para conferência visual.
   Uso: suba um servidor de arquivos na porta 8765 e rode
        node testes/auditar-layout.js            (mede e captura)
        node testes/auditar-layout.js --sem-foto (só mede)
        node testes/auditar-layout.js --prova    (confere que o medidor não está cego)
        node testes/auditar-layout.js --rolagem  (rola de verdade e confere a barra de topo)
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORTA = 9333;
const BASE = 'http://127.0.0.1:8765/index.html';
const PAGINAS = [
  ['privacidade', 'http://127.0.0.1:8765/privacidade.html',
    [[320, 640], [390, 844], [768, 1024], [1440, 900]]],
];
const MEDIDAS = [
  [320, 640], [360, 800], [390, 844], [480, 900],
  [700, 1000], [800, 420], [740, 360], [768, 1024], [1024, 768], [1440, 900],
];
const TELAS = ['splash', 'hub', 'quiz', 'catch', 'puzzle', 'truefalse', 'memory', 'operator',
  'balloon', 'fishing', 'sort', 'whack', 'sequence', 'balance', 'roulette',
  'shop', 'records', 'pais', 'apagar', 'levelup'];
const FOTOS = {
  'hub-1440x900': 1, 'quiz-390x844': 1, 'puzzle-320x640': 1, 'pais-360x800': 1, 'shop-320x640': 1,
  'splash-800x420': 1, 'splash-390x844': 1, 'whack-740x360': 1,
  'hub-320x640': 1, 'hub-390x844': 1, 'hub-768x1024': 1, 'hub-1024x768': 1,
  'quiz-768x1024': 1, 'quiz-1440x900': 1, 'shop-1440x900': 1, 'records-768x1024': 1,
  /* Conforto visual das telas de jogo: sem captura delas o auditor mede geometria
     e não vê a cor. Uma foto por jogo, na janela de celular de referência. */
  'catch-390x844': 1, 'truefalse-390x844': 1, 'memory-390x844': 1, 'operator-390x844': 1,
  'balloon-390x844': 1, 'fishing-390x844': 1, 'sort-390x844': 1, 'sequence-390x844': 1,
  'balance-390x844': 1, 'roulette-390x844': 1, 'levelup-390x844': 1,
  /* O diálogo de apagamento e a página de privacidade são texto e botões de
     consequência: sem foto ninguém vê se o aviso coube ou se a tabela estourou. */
  'apagar-390x844': 1, 'privacidade-390x844': 1, 'privacidade-1440x900': 1,
};

const BINARIOS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];

function navegador() {
  for (const b of BINARIOS) if (fs.existsSync(b)) return b;
  const env = process.env.PROGRAMFILES || 'C:/Program Files';
  const procura = fs.readdirSync(env).filter(d => /google|microsoft/i.test(d));
  for (const d of procura) {
    const p = env + '/' + d + '/Application/msedge.exe';
    if (fs.existsSync(p)) return p;
  }
  throw new Error('nenhum Chromium/Edge encontrado; instale um ou ajuste BINARIOS');
}

const perfil = path.join(require('os').tmpdir(), 'candymath-auditoria-' + process.pid);
const proc = spawn(navegador(), [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--allow-insecure-localhost',
  '--remote-debugging-port=' + PORTA,
  '--user-data-dir=' + perfil,
  'about:blank',
], { stdio: 'ignore' });

const espera = ms => new Promise(r => setTimeout(r, ms));

async function alvoDoDebugger() {
  for (let i = 0; i < 60; i++) {
    try {
      const lista = await fetch('http://127.0.0.1:' + PORTA + '/json/list').then(r => r.json());
      const p = lista.find(t => t.type === 'page' && /about:blank|index\.html/.test(t.url));
      if (p) return p;
    } catch (e) { /* o navegador ainda está subindo */ }
    await espera(250);
  }
  throw new Error('DevTools não respondeu na porta ' + PORTA);
}

function conectar(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pendentes = new Map();
  const eventos = [];
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.id && pendentes.has(msg.id)) {
      const { resolve, reject } = pendentes.get(msg.id);
      pendentes.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      eventos.push(msg);
    }
  });
  return new Promise(resolve => {
    ws.addEventListener('open', () => resolve({
      chamar(method, params) {
        return new Promise((res, rej) => {
          const meu = ++id;
          pendentes.set(meu, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id: meu, method, params: params || {} }));
        });
      },
      fechar() { try { ws.close(); } catch (e) {} },
    }));
  });
}

async function avaliar(c, expression, esperarPromise) {
  const r = await c.chamar('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: !!esperarPromise,
  });
  if (r.exceptionDetails) throw new Error('avaliação falhou: ' + (r.exceptionDetails.exception || {}).description);
  return r.result.value;
}

/* O medidor roda dentro da página. Usa getBoundingClientRect (já inclui
   translate(-50%) e scale dos modais) e só marca corte quando o conteúdo é
   realmente inalcansável: se existe um ancestor rolável no caminho, a pessoa
   chega lá com o dedo, então não é quebra. Os palcos de jogo (doces caindo,
   balões, toupeiras) recortam de propósito e ficam fora dessa conta. */
const medidor = `(function(){
  var de=document.documentElement;
  var VW=window.innerWidth, VH=window.innerHeight;
  var tela=document.querySelector('.screen.active');
  var modal=document.querySelector('.modal[style*="block"]');
  var r={tela:tela?tela.id:'nenhuma', docOver:de.scrollWidth-VW,
         corteVertical:[], textoCortado:[], rolaHorizontal:[], foraDaTela:[], alvoPequeno:[], colapsado:[]};
  var PALCOS=['splash-bg','catch-stage','bal-area','fish-area','mole-hole','mode-card','pai-barra'];
  function clipe(v){ return v==='hidden'||v==='clip'; }
  var estiloDe=getComputedStyle(de), estiloBody=getComputedStyle(document.body);
  /* Altura real do conteúdo: quando é o body que prende (html,body com
     overflow:hidden e height:100%, como em style.css), o scrollHeight do
     documentElement para de contar no próprio body e devolve a janela. O que
     passou da dobra só aparece medindo os dois. */
  function alturaDoConteudo(){ var b=document.body?document.body.scrollHeight:0; return Math.max(de.scrollHeight,b); }
  /* O documento rola neste eixo? Só se ninguém prendeu. style.css trava o jogo
     na janela com html,body{overflow:hidden}, e uma página de texto que herda
     esse bloqueio fica com o resto do texto fora de qualquer alcance. */
  var docRola={
    y: !clipe(estiloDe.overflowY) && !clipe(estiloBody.overflowY) && alturaDoConteudo()-de.clientHeight>3,
    x: !clipe(estiloDe.overflowX) && !clipe(estiloBody.overflowX) && Math.max(de.scrollWidth,document.body?document.body.scrollWidth:0)-de.clientWidth>3
  };
  var docPresoY=clipe(estiloDe.overflowY)||clipe(estiloBody.overflowY);
  function palco(el){
    var cls=String(el.className||'').split(/\\s+/);
    for(var i=0;i<cls.length;i++) if(PALCOS.indexOf(cls[i])>=0) return true;
    return false;
  }
  function nome(el){ return el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+'.'+String(el.className||'').trim().split(/\\s+/).join('.'); }
  function eixo(p,xy){
    var s=getComputedStyle(p), v=xy==='y'?s.overflowY:s.overflowX, outro=xy==='y'?s.overflowX:s.overflowY;
    /* 'visible' com o outro eixo rolável vira 'auto' no navegador. */
    if(v==='visible'&&(outro==='auto'||outro==='scroll')) v='auto';
    return v;
  }
  function caminho(el,xy){
    var p=el.parentElement, rola=false;
    while(p&&p!==de){
      var v=eixo(p,xy);
      if(v==='auto'||v==='scroll') rola=true;
      else if(v==='hidden'||v==='clip') return {recorta:p, rola:rola};
      p=p.parentElement;
    }
    /* Ninguém recortou no caminho: o último rolável possível é o próprio
       documento. Numa página de texto (privacidade.html) o que passa da dobra
       se alcança rolando a janela, e chamar isso de corte acusaria uma quebra
       que não existe. Nas telas do jogo o body é overflow:hidden, então o laço
       acima já devolveu o recorte e este ramo nunca chega a valer. */
    if(!rola && docRola[xy]) rola=true;
    return {recorta:null, rola:rola};
  }
  function temTexto(el){
    for(var n=el.firstChild;n;n=n.nextSibling)
      if(n.nodeType===3&&n.textContent.trim().length) return true;
    return false;
  }
  function vivo(el){
    var s=getComputedStyle(el);
    return s.display!=='none'&&s.visibility!=='hidden'&&s.visibility!=='collapse'&&parseFloat(s.opacity)>0.04;
  }
  var raiz=modal||tela||document.body;
  var todos=[raiz].concat(Array.prototype.slice.call(raiz.querySelectorAll('*')));
  todos.forEach(function(el){
    if(el.classList.contains('sr-only')) return;
    var tag=el.tagName;
    if(tag==='SCRIPT'||tag==='STYLE'||tag==='LINK'||tag==='META') return;
    if(!vivo(el)) return;
    var s=getComputedStyle(el);
    var texto=temTexto(el), inter=/^(BUTTON|INPUT|SELECT|A)$/.test(tag)||el.getAttribute('role')==='button';
    var clicavel=inter||el.classList.contains('mode-card')||typeof el.onclick==='function'||el.hasAttribute('data-acao');
    var ca=el.getBoundingClientRect();
    /* 0) caixa que desapareceu: botão sem tamanho não é 'nada a ver', é jogo
       injogável. Antes o medidor saía daqui calado e o Memory inteiro passou
       limpo com as cartas em 0x0. */
    if(!ca.width||!ca.height){
      if(clicavel) r.colapsado.push(nome(el)+' '+Math.round(ca.width)+'x'+Math.round(ca.height)+' "'+el.textContent.trim().slice(0,20)+'"');
      return;
    }
    /* 1) texto espremido dentro da própria caixa */
    if((s.overflowX==='hidden'||s.overflow==='hidden'||s.overflowX==='clip')&&el.clientWidth>0&&el.scrollWidth>el.clientWidth+2&&texto){
      r.textoCortado.push(nome(el)+' cabe'+el.clientWidth+'/precisa'+el.scrollWidth+' "'+el.textContent.trim().slice(0,26)+'"');
    }
    /* 2) caixa que virou trilho de rolagem horizontal: quebra de layout */
    if((eixo(el,'x')==='auto'||eixo(el,'x')==='scroll')&&el.clientWidth>0&&el.scrollWidth>el.clientWidth+2){
      r.rolaHorizontal.push(nome(el)+' cabendo'+el.clientWidth+'/precisa'+el.scrollWidth);
    }
    /* 3) corte vertical de conteúdo que a pessoa não alcança rolando */
    if(texto||inter){
      var cv=caminho(el,'y');
      var base=cv.recorta?cv.recorta.getBoundingClientRect():{bottom:VH,top:0};
      if(!cv.rola && !(cv.recorta&&palco(cv.recorta))){
        var passa=ca.bottom-base.bottom, falta=base.top-ca.top;
        if(passa>3||falta>3) r.corteVertical.push(nome(el)+' '+(passa>0?'passa'+Math.round(passa):'falta'+Math.round(falta))+'px de '+(cv.recorta?nome(cv.recorta):'janela'));
      }
      /* 4) saiu pela lateral e nada rola até lá */
      var ch=caminho(el,'x');
      if(!ch.rola&&!(ch.recorta&&palco(ch.recorta))&&(ca.right>VW+2||ca.left<-2)){
        r.foraDaTela.push(nome(el)+' '+(ca.right>VW?'direita'+Math.round(ca.right-VW):'esquerda'+Math.round(-ca.left))+'px "'+el.textContent.trim().slice(0,20)+'"');
      }
    }
    /* 5) alvo de toque */
    if(clicavel){
      if(el.offsetHeight<40||el.offsetWidth<32) r.alvoPequeno.push(nome(el)+' '+el.offsetWidth+'x'+el.offsetHeight);
    }
  });
  /* Documento preso: passado da dobra e nenhum eixo vertical para rolar. Vale
     para página de texto, onde o corpo é a raiz; nas telas do jogo quem rola é
     a própria tela e o body é escondido de propósito. */
  r.docPreso=docPresoY;
  r.docPassa=alturaDoConteudo()-window.innerHeight;
  return r;
})()`;

/* Termina transições e animações antes de medir: popIn/modalPop duram 0,35–0,7 s
   e medir no meio delas devolve geometria de escala errada. As seções do hub só
   entram na vista quando aparecem na tela; aqui elas são reveladas à força, senão
   o vivo() do medidor ignora opacity:0 e a auditoria fica cega para a lista toda. */
const assentar = `(function(){
  try{ document.getAnimations().forEach(function(a){ try{ a.finish(); }catch(e){} }); }catch(e){}
  document.querySelectorAll('.antes-de-revelar').forEach(function(e){
    e.classList.remove('antes-de-revelar'); e.classList.add('revelada');
  });
  try{ document.getAnimations().forEach(function(a){ try{ a.finish(); }catch(e){} }); }catch(e){}
  document.body.offsetHeight;
})()`;

/* como-jogar.js põe a explicação na frente da primeira partida de cada jogo.
   Para o medidor isso é um impostor: a geometria lida seria a do diálogo e a
   tela de jogo passaria sem medida. O clique é no botão que a criança aperta
   (#tutoJogar), então o tutorial se marca como visto pelo caminho de verdade,
   fecha e o jogo abre. */
const passarTutorial = "(function(){var m=document.getElementById('modalTuto');" +
  "if(!m||getComputedStyle(m).display!=='block')return '';var b=document.getElementById('tutoJogar');" +
  "if(b)b.click();return 'tutorial';})()";

/* O que deve estar na frente do medidor quando a entrada termina. É a trava
   contra a auditoria verde que não mede o que diz medir: se um diálogo se
   interpuser, a linha sai marcada 'telaErrada' em vez de 'ok'. */
const FRENTE = {
  splash: { tela: 'screenSplash' }, hub: { tela: 'screenHub' },
  shop: { tela: 'screenHub', modal: 'modalShop' },
  records: { tela: 'screenHub', modal: 'modalRecords' },
  pais: { tela: 'screenHub', modal: 'modalPais' },
  apagar: { tela: 'screenHub', modal: 'modalApagar' },
  levelup: { tela: 'screenHub', modal: 'modalLevelUp' },
};
function conferirFrente(tela) {
  const q = FRENTE[tela];
  const esperado = q
    ? "{tela:'" + q.tela + "',modal:'" + (q.modal || '') + "'}"
    : "{tela:TELA_DO_JOGO['" + tela + "'],modal:''}";
  return "(function(){var q=" + esperado + ";" +
    "var t=document.querySelector('.screen.active');" +
    "var mo=document.querySelector('.modal[style*=\"block\"]');" +
    "var visto={tela:t?t.id:'nenhuma',modal:mo?mo.id:''};" +
    "return {ok:visto.tela===q.tela&&visto.modal===q.modal,visto:visto,espera:q};})()";
}

/* Sonda de rolagem: rola de verdade, um passo por vez, e devolve o que a barra
   fez em cada passo. Ler o transform no CSS não provaria nada — aqui a conta é
   retângulo na tela + altura útil de quem rola. O passo 'amornar' de 24 px é o
   primeiro rolamento real: semeia a direção e prova que perto do começo a barra
   ainda fica no lugar. */
function sondaRolagem(roladorSel, barraSel) {
  return `(async function(){
    var rola=document.querySelector('${roladorSel}');
    var barra=document.querySelector('${barraSel}');
    if(!rola||!barra) return {erro:'faltou ${roladorSel} ou ${barraSel} no DOM'};
    function passo(){ return new Promise(function(r){
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ setTimeout(r, 430); }); });
    }); }
    var passos=[], VH=window.innerHeight;
    async function p(rotulo, topo){
      rola.scrollTop=topo; await passo();
      var ca=barra.getBoundingClientRect(), cb=rola.getBoundingClientRect();
      passos.push({rotulo:rotulo, topo:Math.round(rola.scrollTop),
        subiu:barra.classList.contains('barra-subindo'),
        recolhe:barra.classList.contains('barra-recolhe-espaco'),
        rect:[Math.round(ca.top), Math.round(ca.bottom)],
        banda:[Math.round(cb.top), Math.round(cb.bottom)],
        barraAlto:Math.round(barra.offsetHeight), cabeca:Math.round(rola.clientHeight),
        passaEmBaixo:Math.round(cb.bottom-VH)});
    }
    var alcance=rola.scrollHeight-rola.clientHeight;
    /* Abaixo de 100 px não dá para montar uma descida e uma subida que sejam
       direções distintas e ainda fiquem fora do topo protegido: devolve 'curto'
       para a outra altura ser tentada em vez de acusar a barra à toa. */
    if (alcance < ${ROLAGEM_MINIMA}) return {curto:true, alcance:alcance, VH:VH, passos:[]};
    var descida=Math.min(alcance, Math.max(140, Math.round(alcance*0.55)));
    await p('topo', 0);
    await p('amornar', 24);
    await p('descida', descida);
    await p('subida', Math.max(70, descida-70));
    await p('volta', descida);
    await p('fim', 0);
    return {alcance:alcance, VH:VH, passos:passos};
  })()`;
}

/* Confere uma sonda contra o que a barra deveria fazer. recolheEsperado diz o
   ramo: true para barra FORA de quem rola (devolve o próprio espaço; o recorte
   dela é a janela), false para barra grudada dentro (só sai de cena, e aí o
   recorte é a caixa que rola — num diálogo isso fica bem abaixo do topo da tela,
   então comparar retângulo com 0 daria falso negativo). */
const ROLAGEM_MINIMA = 100;   // px de rolagem que precisam existir para valer
function conferirRolagem(r, recolheEsperado) {
  if (r.erro) return { erros: [r.erro], cobriu: false };
  if (r.curto) return { erros: [], cobriu: false, alcance: r.alcance };
  const [topo, amornar, descida, subida, volta, fim] = r.passos;
  const ref = x => recolheEsperado ? [0, r.VH] : x.banda;
  const sumiu = x => x.rect[1] <= ref(x)[0] + 1;
  const noLugar = x => x.rect[0] >= ref(x)[0] - 1 && x.rect[1] <= ref(x)[1] + 1;
  const erros = [];
  if (topo.subiu || !noLugar(topo)) erros.push('já começa fora do recorte ' + topo.rect + ' vs ' + ref(topo));
  if (amornar.subiu) erros.push('recolheu com só ' + amornar.topo + ' px rolados: o topo protegido não segurou');
  if (descida.recolhe !== recolheEsperado) {
    erros.push('usou ' + (descida.recolhe ? 'recolhimento de espaço' : 'só transform') +
               ', esperava ' + (recolheEsperado ? 'recolher o espaço' : 'só transform'));
  }
  if (!descida.subiu) erros.push('não recolheu descendo para ' + descida.topo + ' px');
  else if (!sumiu(descida)) erros.push('marcou a classe mas o retângulo continua em ' + descida.rect + ', recorte ' + ref(descida));
  if (subida.topo <= 56) erros.push('a subida parou em ' + subida.topo + ' px, dentro do topo protegido: não prova a volta');
  if (subida.subiu || !noLugar(subida)) erros.push('não voltou subindo para ' + subida.topo + ' px (rect ' + subida.rect + ' vs ' + ref(subida) + ')');
  if (!volta.subiu) erros.push('esqueceu de recolher na segunda descida');
  if (fim.subiu || !noLugar(fim)) erros.push('não voltou no fim (rect ' + fim.rect + ' vs ' + ref(fim) + ')');
  const ganho = descida.cabeca - topo.cabeca;
  if (recolheEsperado) {
    if (ganho < descida.barraAlto - 2) erros.push('devolveu ' + ganho + ' px dos ' + descida.barraAlto + ' px da barra');
    if (descida.passaEmBaixo > 1) erros.push('a lista passou ' + descida.passaEmBaixo + ' px da borda de baixo');
  } else if (Math.abs(ganho) > 1) {
    erros.push('fechou ' + ganho + ' px de espaço que não eram seus');
  }
  return { erros, cobriu: r.alcance >= ROLAGEM_MINIMA, alcance: r.alcance };
}

// Não usar assentar(): ele revela os alvos à força e esconderia falhas de rolagem.
async function provaRevelacao(c, rolaSel, reduzido = false) {
  const r = await avaliar(c, `(async function(){
    var alvos=Array.from(document.querySelectorAll('.hub-title, .hub-cat-hdr, .mode-card'));
    var fita=function(){ return alvos.map(function(a){
      return a.classList.contains('antes-de-revelar')?'0':(a.classList.contains('revelada')?'1':'?'); }).join(''); };
    var pausa=function(ms){ return new Promise(function(res){ setTimeout(res,ms); }); };
    var antes=fita();
    var corpo=document.querySelector('${rolaSel}');
    var card=document.querySelector('.mode-card.antes-de-revelar');
    if (!card) return {erro:'nenhum cartão aguardando a rolagem'};
    var independente=!!card.closest('.hub-cat').querySelector('.hub-cat-hdr.revelada');
    var oculto=getComputedStyle(card).opacity==='0' && getComputedStyle(card).pointerEvents==='none';
    corpo.scrollTop+=card.getBoundingClientRect().top-Math.max(0,corpo.getBoundingClientRect().top)-corpo.clientHeight*0.3;
    var meio=await new Promise(function(res){
      var limite=performance.now()+1500;
      function medir(){
        var cs=getComputedStyle(card), op=Number(cs.opacity);
        var anim=card.getAnimations().find(function(a){ return a.animationName==='revelarAoRolar'||a.animationName==='fadeIn'; });
        if ((op>0&&op<1&&anim)||performance.now()>limite) {
          res({opacidade:op, translate:cs.translate, nome:anim&&anim.animationName,
            desloca:anim&&anim.effect.getKeyframes().some(function(k){ return !!k.translate; })});
        } else requestAnimationFrame(medir);
      }
      requestAnimationFrame(medir);
    });
    await pausa(800);
    var finalVisivel=getComputedStyle(card).opacity==='1';
    corpo.scrollTop=corpo.scrollHeight;
    await pausa(850);
    var depois=fita();
    corpo.scrollTop=0;
    await pausa(850);
    var volta=fita();
    var repetiu=alvos.some(function(a){ return a.getAnimations().length>0; });
    /* Quantidade conferida contra o catálogo do próprio jogo, não contra um
       número gravado aqui: um cartão de jogo que sumisse do hub passava limpo
       pela contagem chumbada. */
    var cartoes=alvos.filter(function(a){ return a.classList.contains('mode-card'); }).length;
    return {antes:antes,depois:depois,volta:volta,total:alvos.length,independente:independente,
      cartoes:cartoes,titulos:alvos.length-cartoes,
      jogos:Object.keys(typeof TELA_DO_JOGO!=='undefined'?TELA_DO_JOGO:{}).length,
      oculto:oculto,meio:meio,finalVisivel:finalVisivel,repetiu:repetiu,
      reduz:matchMedia('(prefers-reduced-motion: reduce)').matches};
  })()`, true);
  const erros = [];
  if (r.erro) return { erros: [r.erro], texto: r.erro };
  if (r.cartoes !== r.jogos) erros.push('o hub revela ' + r.cartoes + ' cartões para ' + r.jogos + ' jogos do catálogo');
  if (!r.titulos) erros.push('nenhum título no caminho da revelação: o seletor encolheu');
  if (r.reduz !== reduzido) erros.push('a preferência de movimento não corresponde ao caso');
  if (!r.independente) erros.push('não provou um cartão aguardando dentro de uma seção já visível');
  if (!r.oculto) erros.push('cartão abaixo da dobra já estava visível ou clicável');
  if (!(r.meio.opacidade > 0 && r.meio.opacidade < 1)) erros.push('não houve opacidade intermediária: ' + JSON.stringify(r.meio));
  if (r.meio.nome !== (reduzido ? 'fadeIn' : 'revelarAoRolar')) erros.push('animação inesperada: ' + r.meio.nome);
  if (!!r.meio.desloca === reduzido) erros.push('deslocamento incompatível com a preferência de movimento');
  if (!r.finalVisivel) erros.push('cartão não ficou totalmente visível ao terminar');
  if (/[^1]/.test(r.depois)) erros.push('salto até o fim deixou elementos ocultos: ' + r.depois);
  if (r.volta !== r.depois || r.repetiu) erros.push('voltar ao topo reiniciou ou escondeu cartões');
  return { erros, texto: r.cartoes + ' cartões e ' + r.titulos + ' títulos: ' + r.antes + ' → ' + r.depois +
    '; ' + r.meio.nome + ', opacidade intermediária ' + r.meio.opacidade.toFixed(3) + '; sem repetição ao voltar' };
}

async function provaMovimentoReduzido(c) {
  await abrirPagina(c, 390, 844, 'reduce');
  await avaliar(c, "clearAllGameIntervals&&clearAllGameIntervals();" + semente +
    "showScreen('screenHub');updateHubUI();");
  await espera(800);
  return provaRevelacao(c, '.hub-body', true);
}

/* Tecla de verdade pelo DevTools: sem o evento real o navegador não troca o
   foco, e um teste que chama .focus() na mão não prova nada sobre o Tab. */
async function tecla(c, nome, codigo) {
  const teclas = { Tab: 9, Escape: 27 };
  const base = { key: nome, code: codigo, windowsVirtualKeyCode: teclas[nome], nativeVirtualKeyCode: teclas[nome] };
  await c.chamar('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown' }, base));
  await c.chamar('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
}

/* Foco dos diálogos: o que se procura é justamente o que estava solto antes —
   o Tab varrendo a tela que ficou atrás da cortina, o diálogo aberto sem foco
   e a pessoa sem lugar para voltar quando ele fecha. */
const FOCOS = 'a[href],button:not([disabled]),input:not([disabled]),' +
  'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
async function provaFoco(c) {
  const erros = [];
  const quem = "(function(){var a=document.activeElement;return a?String(a.tagName).toLowerCase()+" +
    "(a.id?'#'+a.id:'')+(a.className?'.'+String(a.className).split(' ')[0]:''):'nada';})()";
  await avaliar(c, "showScreen('screenHub');updateHubUI();");
  await espera(220);

  await avaliar(c, "openModal('modalPais');");
  await espera(240);
  const noPais = await avaliar(c, "({dentro:document.querySelector('#modalPais').contains(document.activeElement),quem:" + quem + "})");
  if (!noPais.dentro) erros.push('o boletim abriu e o foco continuou em ' + noPais.quem);

  // Diálogo sobre diálogo: o segundo não pode anotar o primeiro como 'de onde vim'.
  await avaliar(c, "document.querySelector('#modalPais [data-args*=\"modalApagar\"]').click();");
  await espera(240);
  const noApagar = await avaliar(c, "({dentro:document.querySelector('#modalApagar').contains(document.activeElement),quem:" + quem + "})");
  if (!noApagar.dentro) erros.push('apagar dados abriu sem foco dentro (ficou em ' + noApagar.quem + ')');

  /* Marca os alvos do diálogo da frente com um número: depois de cada Tab a
     leitura diz onde o foco caiu, e a volta pelo fim da lista aparece como o
     número 0 de novo — sem depender de ordem nem de rótulo. */
  const inventario = await avaliar(c, "(function(){" +
    "var m=document.querySelectorAll('.modal[style*=\"display: block\"], .modal[style*=\"display:block\"]');" +
    "var caixa=m[m.length-1]; if(!caixa) return {erro:'nenhum diálogo aberto'};" +
    "var alvos=Array.prototype.filter.call(caixa.querySelectorAll('" + FOCOS + "')," +
    "function(el){return !!(el.offsetWidth||el.offsetHeight||el.getClientRects().length);});" +
    "alvos.forEach(function(el,i){el.setAttribute('data-anel',i);});" +
    "return {total:alvos.length, naFrente:caixa.id};})()");
  if (inventario.erro) return { erros: [inventario.erro], texto: inventario.erro };
  const visados = new Set();
  const fora = [];
  for (let i = 0; i < inventario.total + 3; i++) {
    await tecla(c, 'Tab', 'Tab');
    await espera(60);
    const l = await avaliar(c, "(function(){var a=document.activeElement;" +
      "var m=document.querySelectorAll('.modal[style*=\"display: block\"], .modal[style*=\"display:block\"]');" +
      "var topo=m[m.length-1];" +
      "return {anel:a&&a.getAttribute?a.getAttribute('data-anel'):null," +
      "dentro:!!(topo&&topo.contains(a)),quem:" + quem + "};})()");
    if (!l.dentro) fora.push(l.quem);
    if (l.anel !== null) visados.add(l.anel);
  }
  if (fora.length) erros.push(fora.length + ' das Tabulações saíram do diálogo: ' + [...new Set(fora)].join(', '));
  if (visados.size < inventario.total) {
    erros.push('o anel percorreu ' + visados.size + ' dos ' + inventario.total + ' alvos de ' + inventario.naFrente);
  }

  await tecla(c, 'Escape', 'Escape');
  await espera(260);
  const solto = await avaliar(c, "({abertos:document.querySelectorAll('.modal[style*=\"display: block\"], .modal[style*=\"display:block\"]').length," +
    "voltou:document.querySelector('#screenHub').contains(document.activeElement),quem:" + quem + "})");
  if (solto.abertos) erros.push('Esc fechou mas deixou ' + solto.abertos + ' diálogo(s) na tela');
  if (!solto.voltou) erros.push('fechou e o foco não voltou para a tela: está em ' + solto.quem);

  /* A prova precisa ter dentes: desliga a entrada de foco e exige que o vazamento
     apareça. Se com o gancho desligado o foco continuar dentro do diálogo, a
     medição acima não estava medindo nada. */
  const dentes = await avaliar(c, "(function(){var real=window.entrarNoDialogo;" +
    "window.entrarNoDialogo=function(){}; closeAllModals(); openModal('modalRecords');" +
    "var dentro=document.querySelector('#modalRecords').contains(document.activeElement);" +
    "window.entrarNoDialogo=real; closeAllModals(); return dentro?'ficou':'vazou';})()");
  if (dentes !== 'vazou') erros.push('prova sem dentes: sem entrarNoDialogo o foco ainda está dentro (' + dentes + ')');
  return {
    erros,
    texto: 'foco entrou em cada diálogo, ' + inventario.total + ' alvos percorridos sem vazar para a tela de trás' +
      (solto.voltou ? ' e devolvido ao hub ao fechar' : ' (devolução falhou)') +
      '; desligando a entrada, o vazamento aparece (' + dentes + ')',
  };
}

/* Retorno de toque: aperta de verdade pelo DevTools e lê o transform com o dedo
   ainda em cima. O chip é escolhido justamente porque tem levantada no hover:
   :hover com :not() pesa mais que :active sozinho, e foi assim que o
   afundamento do toque desapareceu nos chips sem seleção. */
/* Acessibilidade: ícone de enfeite escondido do leitor de tela, ícone que é o
   único nome do controle continuando visível, e aviso falado por uma região
   que já existia antes do texto mudar. Os três têm dentes: o segundo botão é
   criado sem texto nenhum de propósito, e se a regra de esconder for burra ele
   fica mudo — o que seria um conserto virando um defeito novo. */
async function provaAcessibilidade(c) {
  const falhas = [];
  const SEL = 'i.fa-solid,i.fa-regular,i.fa-brands,.qf-onca';
  const boot = await avaliar(c, "(function(){var SEL='" + SEL + "';" +
    "function nome(el){var d=el.closest('button,a[href],[role=\"button\"],[data-acao],.game-feedback,.quiz-feedback')||el.parentElement;" +
    "return d?(d.textContent||'').trim():'';}" +
    "var todos=Array.prototype.filter.call(document.querySelectorAll(SEL)," +
    "function(e){return !!(e.offsetWidth||e.offsetHeight||e.getClientRects().length);});" +
    "var sem=0, mudo=0;" +
    "todos.forEach(function(e){var oculto=e.getAttribute('aria-hidden')==='true', temNome=!!nome(e);" +
    "if(temNome&&!oculto) sem++; if(!temNome&&oculto) mudo++;});" +
    "return {total:todos.length, sem:sem, mudo:mudo};})()");
  if (!boot || !boot.total) falhas.push('nenhum ícone visível na tela: nada foi conferido');
  if (boot && boot.sem) falhas.push(boot.sem + ' de ' + boot.total + ' ícones visíveis ainda são lidos como ruído');
  if (boot && boot.mudo) falhas.push(boot.mudo + ' ícone(s) sem texto ao redor foram escondidos: controle ficaria mudo');

  const dinamico = await avaliar(c, "(async function(){var b=document.createElement('button');" +
    "b.innerHTML='<i class=\"fa-solid fa-star\"></i> Guardar prova';document.body.appendChild(b);" +
    "var m=document.createElement('button');m.innerHTML='<i class=\"fa-solid fa-bomb\"></i>';document.body.appendChild(m);" +
    "await new Promise(function(r){setTimeout(r,180);});" +
    "var sim=b.querySelector('i').getAttribute('aria-hidden')==='true';" +
    "var calou=m.querySelector('i').getAttribute('aria-hidden')==='true';" +
    "b.remove();m.remove();return {escondeu:sim, calou:calou};})()", true);
  if (!dinamico.escondeu) falhas.push('ícone criado depois do boot seguiu visível: o observador não pega o conteúdo montado mais tarde');
  if (dinamico.calou) falhas.push('a regra escondeu o ícone que é o único nome do botão');

  const aviso = await avaliar(c, "(async function(){window.showToast('prova de aviso falado');" +
    "await new Promise(function(r){setTimeout(r,220);});" +
    "var vivo=Array.prototype.filter.call(document.querySelectorAll('[role=\"status\"],[aria-live]')," +
    "function(e){return (e.textContent||'').indexOf('prova de aviso falado')>=0;});" +
    "var balao=document.querySelector('.toast');" +
    "return {falado:vivo.length, balao:!!balao, oculto:balao?balao.getAttribute('aria-hidden')==='true':false};})()", true);
  if (!aviso.falado) falhas.push('o aviso não chegou a nenhuma região viva: quem usa leitor de tela não ouve nada');
  if (!aviso.balao) falhas.push('showToast não desenhou o balão');
  if (aviso.balao && !aviso.oculto) falhas.push('o balão continua sendo lido junto com a região viva: o mesmo aviso duas vezes');
  return falhas;
}

async function provaToque(c, sel, rotulo) {
  const alvo = await avaliar(c, "(function(){var e=document.querySelector('" + sel + "');" +
    "if(!e) return null; var r=e.getBoundingClientRect();" +
    "return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2), antes:getComputedStyle(e).transform};})()");
  if (!alvo) return { erros: [rotulo + ': ' + sel + ' não está na tela'] };
  await c.chamar('Input.dispatchMouseEvent', { type: 'mousePressed', x: alvo.x, y: alvo.y, button: 'left', clickCount: 1, buttons: 1 });
  await espera(90);
  const durante = await avaliar(c, "getComputedStyle(document.querySelector('" + sel + "')).transform");
  await c.chamar('Input.dispatchMouseEvent', { type: 'mouseReleased', x: alvo.x, y: alvo.y, button: 'left', clickCount: 1, buttons: 0 });
  await espera(120);
  const depois = await avaliar(c, "getComputedStyle(document.querySelector('" + sel + "')).transform");
  /* 'Afundou' = o eixo Y do transform desceu em relação ao estado de descanso
     (ou a escala apertou). Ler os números da matriz em vez de casar texto: a
     curva com mola passa por valores intermediários conforme o instante da
     leitura, e um regex fixo acusaria cegueira quando a leitura é só mais cedo. */
  function matri(txt) {
    const n = /matrix\(([^)]+)\)/.exec(txt || '');
    if (!n) return { e: 1, f: 0 };
    const p = n[1].split(',').map(Number);
    return { e: p[0], f: p[5] };
  }
  const noDescanso = matri(alvo.antes), comDedo = matri(durante);
  const afundou = comDedo.f > noDescanso.f + 1 || comDedo.e < noDescanso.e - 0.002;
  return {
    erros: afundou ? [] : [rotulo + ' não afundou no toque: transform ' + durante],
    texto: rotulo + ': ' + alvo.antes + ' → ' + durante + ' → solta: ' + depois,
  };
}

const dirigir = {
  splash: '',
  hub: "showScreen('screenHub');updateHubUI();",
  shop: "showScreen('screenHub');openShop();renderShop('hat');",
  records: "showScreen('screenHub');openModal('modalRecords');",
  pais: "showScreen('screenHub');openModal('modalPais');",
  apagar: "showScreen('screenHub');openModal('modalApagar');",
  levelup: "showScreen('screenHub');G.trabalhados=['Adição com números grandes','Frações equivalentes','Porcentagem no dia a dia'];openModal('modalLevelUp');",
};

const semente = "G.stars=12480;G.totalCorrect=337;G.bestStreak=21;G.nivel=4;G.ano=9;" +
  "G.aprendidas=['Adição','Frações','Área','Porcentagem','Equações','Ângulos'];" +
  "G.owned=['hat_crown','glass_star','out_apron','acc_cookie'];" +
  "G.hist={'Adição com números até 1 000':{feitas:4,certas:1},'Frações equivalentes e comparação':{feitas:6,certas:5}," +
  "'Perímetro e área de retângulos':{feitas:8,certas:4},'Equação do primeiro grau com uma incógnita':{feitas:9,certas:2}," +
  "'Ângulos e triângulos':{feitas:7,certas:6}};";

async function abrirPagina(c, largura, altura, movimento, endereco) {
  await c.chamar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: true });
  /* O headless vem com prefers-reduced-motion: reduce, o que deixa toda a
     animação desligada sem ninguém perceber. Emula explicitamente o aparelho
     padrão; a prova de rolagem confere o ramo reduzido à parte. */
  await c.chamar('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: movimento || 'no-preference' }],
  });
  await c.chamar('Page.navigate', { url: (endereco || BASE) + '?a=' + Date.now() });
  // readyState 'complete' sozinho engana: ainda vale para o about:blank anterior,
  // e aí a leitura de localStorage cai com SecurityError. Espera o documento ser
  // o do servidor.
  for (let i = 0; i < 120; i++) {
    const pronto = await avaliar(c, "(document.readyState==='complete'&&location.hostname==='127.0.0.1')||''");
    if (pronto) break;
    await espera(100);
  }
  const dominio = await avaliar(c, 'location.hostname');
  if (dominio !== '127.0.0.1') {
    throw new Error('a página não carregou em 12 s (host: ' + (dominio || 'about:blank') +
      ') — o servidor de arquivos da porta 8765 está de pé?');
  }
  // privacidade.html é página estática: não tem script.js, logo não há G para
  // semear. O try deixa a semente passar nos documentos do jogo.
  await avaliar(c, 'localStorage.clear();try{' + semente + '}catch(e){}');
  await espera(120);
}

async function fotografar(c, arquivo) {
  const r = await c.chamar('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(arquivo, Buffer.from(r.data, 'base64'));
}

(async function principal() {
  const semFoto = process.argv.includes('--sem-foto');
  const pastaFotos = path.join(__dirname, 'capturas');
  if (!semFoto && !fs.existsSync(pastaFotos)) fs.mkdirSync(pastaFotos);
  const alvo = await alvoDoDebugger();
  const c = await conectar(alvo.webSocketDebuggerUrl);
  await c.chamar('Page.enable');
  await c.chamar('Runtime.enable');

  let problemas = 0, feitas = 0;
  const relatorio = [];

  /* --prova: injeta quebras de propósito e confere se o medidor enxerga cada
     uma. Sem isso, um relatório limpo pode significar apenas detector cego.
     Quatro na tela Caça-Toupeira (recorte e sem rolagem interna, então o corte
     empurrado para baixo é realmente inalcançável) e uma no documento de texto. */
  if (process.argv.includes('--prova')) {
    await abrirPagina(c, 390, 844);
    await avaliar(c, "clearAllGameIntervals&&clearAllGameIntervals();" + semente + "startMode('whack');");
    await espera(300); await avaliar(c, passarTutorial); await espera(200);
    await avaliar(c, assentar);
    const antes = await avaliar(c, medidor);
    await avaliar(c, "(function(){var s=document.createElement('style');" +
      "s.textContent='#screenWhack .game-top-bar{margin-bottom:95vh}" +
      "#screenWhack .whack-question{width:1400px;max-width:none}" +
      "#screenWhack .btn-back{min-height:18px;height:18px;padding:2px 6px}';" +
      "document.head.appendChild(s);" +
      /* quarto caso: botão esmagado a 0x0, o tipo de bug que passava limpo. */
      "var b=document.createElement('button');b.className='btn-prova-colapsado';" +
      "b.textContent='prova';b.style.width='0';b.style.height='0';b.style.padding='0';b.style.border='0';" +
      "document.querySelector('#screenWhack').appendChild(b);})()");
    await espera(220); await avaliar(c, assentar);
    const m = await avaliar(c, medidor);
    const esperado = {
      corteVertical: 'pergunta empurrada para baixo da janela',
      foraDaTela: 'caixa de pergunta de 1400 px numa janela de 390 px',
      alvoPequeno: 'botão Voltar de 18 px de altura',
      colapsado: 'botão de prova esmagado em 0x0',
    };
    let cegas = 0;
    if (process.env.PROVA_CRUA) console.log('CRUA antes=' + JSON.stringify(antes) + '\nCRUA m=' + JSON.stringify(m).slice(0, 900));
    console.log('--- prova do medidor: quatro quebras na tela de jogo ---');
    for (const k in esperado) {
      const viu = (m[k] || []).length > (antes[k] || []).length;
      if (!viu) cegas++;
      console.log((viu ? 'ok   ' : 'CEGO ') + k + ' (' + esperado[k] + ')' + (viu ? ': ' + m[k][m[k].length - 1] : ''));
    }
    console.log(cegas ? 'detector com ' + cegas + ' categoria(s) cega(s)' : 'medidor confiável');

    const a11y = await provaAcessibilidade(c);
    console.log('--- acessibilidade: ícone de enfeite e aviso falado ---');
    a11y.forEach((e) => console.log('CEGO ' + e));
    if (!a11y.length) console.log('ok   ícones escondidos, botão sem texto preservado e aviso em região viva');

    /* Quinta prova, e desta vez numa página de texto: o medidor perdoa "passa da
       dobra" quando o documento rola. Foi assim que style.css (html,body com
       overflow:hidden e height:100%), herdado por privacidade.html, deixou
       metade do texto fora de alcance sem acusar nada. Aqui o defeito é
       injetado de novo, para conferir que o perdão só vale com rolagem real. */
    await abrirPagina(c, 390, 844, null, PAGINAS[0][1]);
    const limpa = await avaliar(c, medidor);
    await avaliar(c, "(function(){var s=document.createElement('style');" +
      "s.textContent='html,body{height:100%;overflow:hidden}';" +
      "document.head.appendChild(s);})()");
    const presa = await avaliar(c, medidor);
    const errosDoc = [];
    if (limpa.tela !== 'nenhuma') errosDoc.push('a página de texto não foi lida como documento (tela ' + limpa.tela + ')');
    if (limpa.docPreso) errosDoc.push('documento preso de verdade: ' + limpa.docPassa + ' px abaixo da dobra sem rolagem');
    if (!(presa.docPreso && presa.docPassa > 3)) errosDoc.push('medidor CEGO para documento preso: não notou o overflow:hidden injetado');
    console.log('--- documento de texto ---');
    errosDoc.forEach(e => console.log('CEGO ' + e));
    if (!errosDoc.length) console.log('ok   leitura limpa (' + limpa.docPassa + ' px roláveis) e o bloqueio injetado foi notado (' + presa.docPassa + ' px presos)');
    c.fechar(); proc.kill();
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) {}
    process.exit(cegas + errosDoc.length + a11y.length ? 1 : 0);
  }

  /* --rolagem: rola de verdade cada área rolável e confere, passo a passo, o que
     a barra de topo fez: some descendo, volta subindo (longe do começo, para não
     ser o topo protegido a fazer o favor), e devolve ou não o próprio espaço
     conforme estava fora ou dentro de quem rola. Uma leitura estática do CSS não
     prova nada disso. */
  /* --doces: a chuva do splash tem de cair de verdade (duas leituras dos doces
     em movimento), nos dois ramos de movimento — com movimento reduzido ela
     também gira e cai, igual às versões antigas. Guarda dois quadros de cada
     ramo em capturas/ para inspeção visual. */
  if (process.argv.includes('--doces')) {
    const falhas = [];
    const foto = async (nome) => { if (!semFoto) await fotografar(c, path.join(pastaFotos, nome)); };
    await abrirPagina(c, 390, 844);
    await espera(1400);
    const tops = "([...document.querySelectorAll('.candy-float')].map(function(x){ return Math.round(x.getBoundingClientRect().top); }))";
    const a = await avaliar(c, tops);
    await foto('splash-doces-a.png');
    await espera(500);
    const b = await avaliar(c, tops);
    await foto('splash-doces-b.png');
    const naTela = a.filter(t => t > -50 && t < 844).length;
    const moveram = a.filter((t, i) => Math.abs(t - b[i]) > 6).length;
    if (naTela < 3) falhas.push('só ' + naTela + ' doces dentro da tela no segundo 1,4 da chuva');
    if (moveram < 3) falhas.push('só ' + moveram + ' doces se moveram entre as duas leituras: a chuva está parada');
    console.log((falhas.length ? '! ' : '. ') + 'chuva (movimento liberado) — ' +
      naTela + ' doces na tela, ' + moveram + ' moveram entre leituras');

    await abrirPagina(c, 390, 844, 'reduce');
    await espera(1600);
    const ra = await avaliar(c, tops);
    await foto('splash-reduzido-a.png');
    await espera(1200);
    const rb = await avaliar(c, tops);
    await foto('splash-reduzido-b.png');
    const reduzOk = await avaliar(c, "window.matchMedia('(prefers-reduced-motion: reduce)').matches");
    const rna = ra.filter(t => t > -50 && t < 844).length;
    const rmov = ra.filter((t, i) => Math.abs(t - rb[i]) > 6).length;
    const fr = [];
    if (!reduzOk) fr.push('a emulação de movimento reduzido não pegou');
    if (rna < 3) fr.push('só ' + rna + ' doces na tela com movimento reduzido');
    if (rmov < 3) fr.push('com movimento reduzido a chuva ficou parada: ' + rmov + ' doces moveram');
    console.log((fr.length ? '! ' : '. ') + 'doces (movimento reduzido) — ' + rna + ' na tela, ' +
      rmov + ' moveram entre leituras (chuva igual à das versões antigas)');
    falhas.push(...fr);

    console.log('\n=== doces ===');
    console.log(falhas.length ? falhas.length + ' pendência(s):\n' + falhas.join('\n')
      : 'a chuva de doces cai girando nos dois ramos de movimento, como nas versões antigas');
    if (!semFoto) console.log('quadros em ' + pastaFotos + ': splash-doces-a/b.png, splash-reduzido-a/b.png');
    c.fechar(); proc.kill();
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) {}
    process.exit(falhas.length ? 1 : 0);
  }

  if (process.argv.includes('--rolagem')) {
    /* [nome, largura, alturas para tentar, quem rola, a barra, como chegar, ramo,
       conferir a entrada das seções]
       Tenta alturas menores até sobrar rolagem: em janela alta muita tela cabe
       inteira e ali não há o que provar. */
    const casos = [
      ['hub corpo (janela alta)', 390, [844], '.hub-body', '#screenHub > .hub-header',
        "showScreen('screenHub');updateHubUI();", true, true],
      ['responsáveis (diálogo)', 390, [844, 700, 560], '#modalPais', '#modalPais .modal-hdr',
        "showScreen('screenHub');openModal('modalPais');", false, false],
      ['apagar dados (diálogo)', 390, [844, 700, 560, 470], '#modalApagar', '#modalApagar .modal-hdr',
        "showScreen('screenHub');openModal('modalApagar');", false, false],
      ['hub (janela baixa)', 740, [360], '#screenHub', '#screenHub > .hub-header',
        "showScreen('screenHub');updateHubUI();", false, false],
      ['quiz (barra da tela)', 320, [640, 540, 470, 400], '#screenQuiz', '#screenQuiz > .game-top-bar',
        "startMode('quiz');", false, false],
    ];
    const falhas = [];
    const ramosVistos = { comEspaco: 0, grudada: 0 };
    for (const [nome, lar, alturas, rolaSel, barraSel, navega, recolhe, revela] of casos) {
      let r = null, altUsada = alturas[0];
      for (const alt of alturas) {
        altUsada = alt;
        await abrirPagina(c, lar, alt);
        await avaliar(c, "clearAllGameIntervals&&clearAllGameIntervals();" + semente + navega);
        await espera(320);
        await avaliar(c, passarTutorial);
        await espera(160);
        if (revela) {
          const rv = await provaRevelacao(c, rolaSel);
          console.log((rv.erros.length ? '! ' : '. ') + nome + ' — entrada das seções: ' + (rv.texto || ''));
          rv.erros.forEach(e => console.log('       => ' + e));
          rv.erros.forEach(e => falhas.push('revelação do hub: ' + e));
        }
        await avaliar(c, assentar);
        r = await avaliar(c, sondaRolagem(rolaSel, barraSel), true);
        if (r.erro || !r.curto) break;
      }
      const visto = conferirRolagem(r, recolhe);
      const faixa = a => '[' + a[0] + ',' + a[1] + ']';
      const detalhe = (r.passos || []).map(x => '       ' + x.rotulo.padEnd(8) +
        String(x.topo).padStart(5) + ' px  rect ' + faixa(x.rect).padEnd(10) +
        ' recorte ' + faixa(x.banda).padEnd(11) +
        (x.subiu ? (x.recolhe ? 'recolhida + espaço' : 'recolhida         ') : 'no lugar          ') +
        ' útil ' + x.cabeca + ' px').join('\n');
      console.log((visto.erros.length ? '! ' : '. ') + nome + ' (' + lar + 'x' + altUsada +
        (r.alcance === undefined ? ', sem área rolável' : ', ' + r.alcance + ' px roláveis') + ')');
      console.log(detalhe);
      visto.erros.forEach(e => console.log('       => ' + e));
      if (visto.erros.length) falhas.push(nome + ': ' + visto.erros.join('; '));
      else if (visto.cobriu) ramosVistos[recolhe ? 'comEspaco' : 'grudada']++;
      else console.log('       (pulada: só ' + r.alcance + ' px para rolar em ' + lar + 'x' + altUsada + ')');
      // Uma imagem do estado recolhido: a tabela diz os números, a foto mostra se
      // ficou buraco na tela.
      if (recolhe && !semFoto && visto.cobriu) {
        if (!fs.existsSync(pastaFotos)) fs.mkdirSync(pastaFotos);
        await avaliar(c, "(function(){var r=document.querySelector('" + rolaSel +
          "'); if(r) r.scrollTop=" + r.passos[2].topo + ';})()');
        await espera(420);
        await fotografar(c, path.join(pastaFotos, 'barra-recolhida-' + lar + 'x' + altUsada + '.png'));
      }
    }
    const rm = await provaMovimentoReduzido(c);
    console.log((rm.erros.length ? '! ' : '. ') + 'hub (movimento reduzido) — ' + rm.texto);
    rm.erros.forEach(e => console.log('       => ' + e));
    rm.erros.forEach(e => falhas.push('movimento reduzido: ' + e));

    const tq = await provaToque(c, '#chipsAno .stab', 'chip de ano');
    console.log((tq.erros.length ? '! ' : '. ') + 'retorno de toque — ' + tq.texto);
    tq.erros.forEach(e => console.log('       => ' + e));
    tq.erros.forEach(e => falhas.push('toque: ' + e));

    const fc = await provaFoco(c);
    console.log((fc.erros.length ? '! ' : '. ') + 'foco dos diálogos — ' + fc.texto);
    fc.erros.forEach(e => console.log('       => ' + e));
    fc.erros.forEach(e => falhas.push('foco: ' + e));

    console.log('\n=== rolagem ===');
    if (!ramosVistos.comEspaco) falhas.push('nenhum caso rolável com a barra fora de quem rola: o ramo que devolve espaço ficou sem prova');
    if (!ramosVistos.grudada) falhas.push('nenhum caso rolável com a barra grudada em quem rola: o ramo sticky ficou sem prova');
    console.log(falhas.length ? falhas.length + ' pendência(s):\n' + falhas.join('\n')
      : 'barras sobem e voltam como prometido (' + ramosVistos.comEspaco + ' devolvendo espaço, ' +
        ramosVistos.grudada + ' grudadas)');
    c.fechar(); proc.kill();
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) {}
    process.exit(falhas.length ? 1 : 0);
  }

  const ruins = ['corteVertical', 'textoCortado', 'rolaHorizontal', 'foraDaTela', 'alvoPequeno', 'colapsado'];
  function achadosDe(m) {
    let achados = '';
    ruins.forEach(k => { if (m[k] && m[k].length) achados += '\n     ' + k + ': ' + m[k].slice(0, 4).join(' ; '); });
    if (m.docOver > 1) achados += '\n     docOver: ' + m.docOver;
    // 'nenhuma' = nem tela ativa nem diálogo: o corpo do documento é a leitura.
    if (m.tela === 'nenhuma' && m.docPreso && m.docPassa > 3) {
      achados += '\n     documentoPreso: ' + m.docPassa + ' px abaixo da dobra sem barra de rolagem';
    }
    return achados;
  }
  async function fotografarChave(chave, largura, altura) {
    if (semFoto || !FOTOS[chave]) return;
    await c.chamar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 2, mobile: true });
    await espera(120);
    await fotografar(c, path.join(pastaFotos, chave + '.png'));
    await c.chamar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: true });
  }

  for (const [largura, altura] of MEDIDAS) {
    await abrirPagina(c, largura, altura);
    for (const tela of TELAS) {
      await avaliar(c, "clearAllGameIntervals&&clearAllGameIntervals();closeAllModals&&closeAllModals();" + semente + "G.hist=G.hist||{};");
      // 'splash' tem código vazio de propósito: é a tela que já vem ativa.
      const codigo = Object.prototype.hasOwnProperty.call(dirigir, tela)
        ? dirigir[tela]
        : "startMode('" + tela + "');";
      await avaliar(c, codigo);
      await espera(tela === 'levelup' ? 320 : 260);
      await avaliar(c, passarTutorial);
      await espera(160);
      await avaliar(c, assentar);
      await espera(60);
      const frente = await avaliar(c, conferirFrente(tela));
      const m = await avaliar(c, medidor);
      feitas++;
      const marca = largura + 'x' + altura + ' ' + tela;
      const achados = achadosDe(m) + (frente.ok ? '' :
        '\n     telaErrada: na frente ' + (frente.visto.modal || frente.visto.tela) +
        ', esperava ' + (frente.espera.modal || frente.espera.tela));
      if (achados) { problemas++; relatorio.push('   ! ' + marca + achados); console.log('! ' + marca + achados); }
      else console.log('. ' + marca + '  ok  (' + m.tela + ')');
      await fotografarChave(tela + '-' + largura + 'x' + altura, largura, altura);
    }
  }

  /* Páginas que não são jogo: privacidade.html não carrega script.js, então não
     há .screen ativa e o medidor usa o body como raiz. Mede a mesma geometria
     que um diálogo — tabela que estoura a 320 px é a quebra que ninguém vê. */
  for (const [nome, endereco, medidas] of PAGINAS) {
    for (const [largura, altura] of medidas) {
      await abrirPagina(c, largura, altura, null, endereco);
      await avaliar(c, assentar);
      await espera(60);
      const m = await avaliar(c, medidor);
      feitas++;
      const marca = largura + 'x' + altura + ' ' + nome;
      const achados = achadosDe(m);
      if (achados) { problemas++; relatorio.push('   ! ' + marca + achados); console.log('! ' + marca + achados); }
      else console.log('. ' + marca + '  ok  (documento)');
      await fotografarChave(nome + '-' + largura + 'x' + altura, largura, altura);
    }
  }

  console.log('\n=== resultado ===');
  console.log('telas medidas: ' + feitas + ' | com achado: ' + problemas);
  if (problemas) console.log(relatorio.join('\n'));
  if (!semFoto) console.log('capturas em: ' + pastaFotos);
  c.fechar();
  proc.kill();
  try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) {}
  process.exit(problemas ? 1 : 0);
})().catch(e => {
  console.error('erro na auditoria:', e.message);
  try { proc.kill(); } catch (_) {}
  process.exit(2);
});
