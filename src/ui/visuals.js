/**
 * Desenhos das perguntas. Cada trilha tem um jeito próprio de aparecer na tela,
 * sempre em CSS puro (nada de imagem externa), para o jogo continuar leve
 * e com a mesma cara de doces recortados.
 */
import { CANDY_ICONS } from '../engine/questionUtils.js';

const CORES = ['#FF6B9D', '#FFD93D', '#4ECDC4', '#9B5DE5', '#FF9A3C', '#3DBBFF', '#6BCB77'];

function doces(n, icon) {
  const ic = icon || CANDY_ICONS[Math.floor(Math.random() * CANDY_ICONS.length)];
  let html = '';
  for (let i = 0; i < n; i++) {
    html += `<span class="dv" style="color:${CORES[i % CORES.length]}"><i class="fa-solid ${ic}"></i></span>`;
  }
  return html;
}

function bandeja(itens, icon) {
  return `<div class="dv-tray">${itens}</div>`;
}

export function renderVisual(v) {
  if (!v) return '';
  const tipo = v.kind;

  if (tipo === 'trays') {
    const grupos = (v.groups || []).slice(0, 4);
    return `<div class="dv dv-bandejas">${grupos.map(g => bandeja(doces(Math.min(g, 20), v.icon), v.icon)).join('')}</div>`;
  }

  if (tipo === 'array') {
    const linhas = Math.min(v.rows, 8);
    const cols = Math.min(v.cols, 10);
    let html = `<div class="dv dv-array" style="grid-template-columns:repeat(${cols},1fr)">`;
    for (let i = 0; i < linhas * cols; i++) {
      html += `<span style="color:${CORES[i % CORES.length]}"><i class="fa-solid ${v.icon}"></i></span>`;
    }
    html += `</div><div class="dv-legenda">${v.rows} linhas × ${v.cols} colunas</div>`;
    return html;
  }

  if (tipo === 'sharing') {
    const grupos = Math.min(v.grupos, 6);
    const por = Math.floor(v.total / grupos);
    let html = '<div class="dv dv-grupos">';
    for (let g = 0; g < grupos; g++) {
      html += `<div class="dv-grupo"><div class="dv-grupo-topo">${g + 1}</div>${doces(Math.min(por, 12), v.icon)}</div>`;
    }
    html += '</div>';
    return html;
  }

  if (tipo === 'pairs') {
    return `<div class="dv dv-pares">
      <div class="dv-numo"><strong>${fmtNum(v.a)}</strong><span>primeiro</span></div>
      <div class="dv-vs">?</div>
      <div class="dv-numo"><strong>${fmtNum(v.b)}</strong><span>segundo</span></div>
    </div>`;
  }

  if (tipo === 'line') {
    const marcas = (v.serie || []).map((n, i) =>
      `<li class="${i === v.marca ? 'marcada' : ''}"><span class="dv-rponto"></span><b>${fmtNum(n)}</b></li>`).join('');
    return `<ul class="dv dv-reta">${marcas}</ul>`;
  }

  if (tipo === 'scatter') {
    const n = Math.min(v.total, 60);
    let html = '<div class="dv dv-pote">';
    for (let i = 0; i < n; i++) {
      const x = (i * 37) % 90 + 3;
      const y = (i * 53) % 78 + 4;
      html += `<i class="fa-solid ${CANDY_ICONS[i % CANDY_ICONS.length]}" style="left:${x}%;top:${y}%;color:${CORES[i % CORES.length]}"></i>`;
    }
    html += '</div>';
    return html;
  }

  if (tipo === 'combo') {
    return `<div class="dv dv-combo">
      <div>${rótulo(v.a, 'opção de casquinha')}</div><span class="dv-vezes">×</span><div>${rótulo(v.b, 'sabores')}</div>
    </div>`;
  }

  if (tipo === 'fraction') {
    return `<div class="dv dv-bolo">${fatias(v.parts, v.shaded)}</div>
      <div class="dv-legenda">${v.shaded} de ${v.parts} partes</div>`;
  }

  if (tipo === 'pairFrac') {
    return `<div class="dv dv-fracoes-par">
      <div class="dv-fracao"><span>${v.a[0] ?? '?'}</span><hr><span>${v.a[1]}</span></div>
      <b>=</b>
      <div class="dv-fracao"><span class="dv-vazio">${v.b[0] ?? '?'}</span><hr><span>${v.b[1]}</span></div>
    </div>`;
  }

  if (tipo === 'compareFrac') {
    return `<div class="dv dv-comparar">
      ${barraFrac(v.a)}<span class="dv-vs">ou</span>${barraFrac(v.b)}
    </div>`;
  }

  if (tipo === 'addFrac') {
    return `<div class="dv dv-comparar">${barraFrac([v.a, v.d])}<span class="dv-vezes">+</span>${barraFrac([v.b, v.d2 || v.d])}</div>`;
  }

  if (tipo === 'decimalBar') {
    let html = '<div class="dv dv-decimal">';
    const inteiros = Math.min(v.inteiros, 4);
    for (let i = 0; i < inteiros; i++) html += `<div class="dv-inteiro cheio"></div>`;
    const déc = Math.round(v.dec * 10);
    html += `<div class="dv-inteiro dv-pedacos">${Array.from({ length: 10 }, (_, k) => `<i class="${k < déc ? 'on' : ''}"></i>`).join('')}</div>`;
    html += '</div>';
    return html;
  }

  if (tipo === 'money') {
    let html = '<div class="dv dv-notas">';
    v.itens.forEach(valor => {
      const cor = valor >= 100 ? '#8e5a3a' : valor >= 50 ? '#a4713f' : valor >= 20 ? '#5f9e5f' : valor >= 10 ? '#7a5fa8' : '#c9a227';
      html += `<div class="dv-nota" style="background:${cor}">${fmtNum(valor)}</div>`;
    });
    html += '</div>';
    return html;
  }

  if (tipo === 'receipt') {
    return `<div class="dv dv-recibo">
      <div class="dv-recibo-item"><span>Produto</span><b>${fmtNum(v.preco)}</b></div>
      <div class="dv-recibo-item"><span>Pago</span><b>${fmtNum(v.pago)}</b></div>
      <div class="dv-recibo-item troco"><span>Troco</span><b>?</b></div>
    </div>`;
  }

  if (tipo === 'tag') {
    return `<div class="dv dv-etiqueta ${v.alta ? 'sobe' : 'desce'}">
      <s>${fmtNum(v.preco)}</s>
      <strong>${v.alta ? '+' : '−'}${v.pct}%</strong>
    </div>`;
  }

  if (tipo === 'percentGrid') {
    const cheios = Math.round(10 * v.pct / 100);
    let html = '<div class="dv dv-percent">';
    for (let i = 0; i < 10; i++) html += `<span class="${i < cheios ? 'cheio' : ''}"></span>`;
    html += `</div><div class="dv-legenda">${v.pct}% de 10 quadradinhos</div>`;
    return html;
  }

  if (tipo === 'sequence') {
    let html = '<div class="dv dv-sequencia">';
    v.termos.forEach(t => { html += `<div class="dv-termo">${t}</div>`; });
    html += '<div class="dv-termo vazio">?</div></div>';
    return html;
  }

  if (tipo === 'balance') {
    const esquerda = Math.min(v.esquerda, 12);
    const direita = v.direita ? Math.min(v.direita, 12) : null;
    return `<div class="dv dv-balancinha">
      <div class="dv-base"></div>
      <div class="dv-braco"></div>
      <div class="dv-prato prato-esq">${doces(esquerda, 'fa-candy-cane')}${v.saco ? '<span class="dv-saco">?</span>' : ''}${v.sub ? `<span class="dv-saco menos">−${v.sub}</span>` : ''}</div>
      <div class="dv-prato prato-dir">${direita ? doces(direita, 'fa-candy-cane') : `<span class="dv-saco">${v.sub ? v.esquerda + ' − ' + v.sub : '?'}</span>`}</div>
    </div>`;
  }

  if (tipo === 'formula') {
    return `<div class="dv dv-formula">${v.expr}${v.x != null ? `<small>já que x = ${v.x}</small>` : ''}</div>`;
  }

  if (tipo === 'queue') {
    let html = '<div class="dv dv-fila">';
    v.pessoas.forEach((p, i) => {
      html += `<div class="dv-fila-item ${i === v.destaque ? 'destaque' : ''}"><i class="fa-solid fa-user"></i><span>${p}</span></div>`;
    });
    html += '<div class="dv-fila-seta"><i class="fa-solid fa-arrow-right"></i></div></div>';
    return html;
  }

  if (tipo === 'cartesian') {
    const max = 10;
    let html = `<div class="dv dv-plano" style="--max:${max}">`;
    html += `<div class="dv-ponto" style="--x:${v.x};--y:${v.y}"></div>`;
    for (let i = 1; i <= max; i++) {
      html += `<span class="gx" style="left:${i / max * 100}%">${i}</span>`;
      html += `<span class="gy" style="bottom:${i / max * 100}%">${i}</span>`;
    }
    html += '</div>';
    return html;
  }

  if (tipo === 'grid') {
    const w = Math.min(v.w, 12);
    const h = Math.min(v.h, 10);
    let html = `<div class="dv dv-malha" style="grid-template-columns:repeat(${w},1fr);grid-template-rows:repeat(${h},1fr)">`;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const borda = r === 0 || r === h - 1 || c === 0 || c === w - 1;
        const cls = v.modo === 'perimetro' ? (borda ? 'borda' : '') : 'dentro';
        html += `<i class="${cls}"></i>`;
      }
    }
    html += `</div><div class="dv-legenda">${v.w} × ${v.h}</div>`;
    return html;
  }

  if (tipo === 'cube') {
    const n = Math.min(v.aresta, 5);
    let html = '<div class="dv dv-cubo">';
    for (let i = 0; i < n * n; i++) html += '<span></span>';
    html += `</div><div class="dv-legenda">${v.aresta} × ${v.aresta} × ${v.aresta}</div>`;
    return html;
  }

  if (tipo === 'clock') {
    const grausMin = v.m * 6;
    const grausHora = (v.h % 12) * 30 + v.m * 0.5;
    return `<div class="dv dv-relogio">
      <div class="dv-agulha hora" style="transform:rotate(${grausHora}deg)"></div>
      <div class="dv-agulha minuto" style="transform:rotate(${grausMin}deg)"></div>
      <span class="dv-pino"></span>
      ${[12, 3, 6, 9].map(n => `<b class="n${n}">${n}</b>`).join('')}
    </div>`;
  }

  if (tipo === 'thermo') {
    return `<div class="dv dv-termometro"><div class="dv-mercurio" style="height:${Math.min(90, Math.max(8, (v.value + 5) * 4))}%"></div><b>${v.value}°C</b></div>`;
  }

  if (tipo === 'bars') {
    const valores = v.nomes.map(n => v.valores[n]);
    const max = Math.max(...valores);
    let html = `<div class="dv dv-grafico"><div class="dv-colunas">`;
    v.nomes.forEach((n, i) => {
      html += `<div class="dv-col" style="height:${(v.valores[n] / max) * 100}%"><b>${v.valores[n]}</b><span>${n}</span></div>`;
    });
    html += '</div></div>';
    return html;
  }

  if (tipo === 'table') {
    let html = `<table class="dv dv-tabela"><thead><tr><th></th>${v.colunas.map(c => `<th>${c.nome}</th>`).join('')}</tr></thead><tbody>`;
    v.linhas.forEach(l => {
      html += `<tr><th>${l}</th>${v.colunas.map(c => `<td>${c.valores[l]}</td>`).join('')}</tr>`;
    });
    html += '</tbody></table>';
    return html;
  }

  if (tipo === 'balls') {
    const vermelhas = Array.from({ length: Math.min(v.favor, 12) }, () => '<i class="fa-solid fa-circle vermelho"></i>').join('');
    const azuis = Array.from({ length: Math.min(v.outro, 12) }, () => '<i class="fa-solid fa-circle azul"></i>').join('');
    return `<div class="dv dv-bolinhas">
      <div class="dv-fileira">${vermelhas}</div><span class="dv-rotulo">${v.favor} vermelhas</span>
      <div class="dv-fileira">${azuis}</div><span class="dv-rotulo">${v.outro} azuis</span>
    </div>`;
  }

  if (tipo === 'list') {
    return `<div class="dv dv-lista">${v.valores.map(n => `<span>${n}</span>`).join('')}</div>`;
  }

  if (tipo === 'angle') {
    const g = Math.min(Math.max(v.graus || 0, 5), 150);
    return `<div class="dv dv-angulo">
      <span class="dv-abertura" style="--abre:${g}deg"></span>
      <span class="dv-lado"></span>
      <span class="dv-lado dv-lado-b" style="transform:rotate(${-g}deg)"></span>
      <span class="dv-vertice"></span>
      <b class="dv-graus">${g}°</b>
    </div><div class="dv-legenda">${g < 90 ? 'agudo (menor que 90°)' : g === 90 ? 'reto (90°)' : 'obtuso (maior que 90°)'}</div>`;
  }

  if (tipo === 'shape' || tipo === 'solid') {
    return `<div class="dv dv-forma">${figura(v.forma || v.nome, v.simetria)}</div>`;
  }

  return '';
}

function rótulo(n, texto) {
  let html = '<div class="dv-itens">';
  for (let i = 0; i < Math.min(n, 6); i++) html += `<i class="fa-solid fa-${i % 2 ? 'ice-cream' : 'candy-cane'}"></i>`;
  return html + `</div><small>${n} ${texto}</small>`;
}

function fatias(total, pintadas) {
  const t = Math.min(total, 12);
  let html = '';
  for (let i = 0; i < t; i++) {
    const deg = 360 / t;
    html += `<span class="fatia ${i < pintadas ? 'on' : ''}" style="--a:${i * deg}deg;--b:${deg}deg"></span>`;
  }
  return html;
}

function barraFrac([n, d]) {
  const partes = Math.min(d, 12);
  let html = '<div class="dv-barra">';
  for (let i = 0; i < partes; i++) html += `<i class="${i < n ? 'on' : ''}"></i>`;
  return html + `</div><small>${n}/${d}</small>`;
}

function figura(nome, simetria) {
  const map = {
    quadrado: '<span class="fg fg-quadrado"></span>',
    retângulo: '<span class="fg fg-retangulo"></span>',
    retangulo: '<span class="fg fg-retangulo"></span>',
    triângulo: '<span class="fg fg-triangulo"></span>',
    triangulo: '<span class="fg fg-triangulo"></span>',
    círculo: '<span class="fg fg-circulo"></span>',
    circulo: '<span class="fg fg-circulo"></span>',
    pentágono: '<span class="fg fg-pentagono"></span>',
    hexágono: '<span class="fg fg-hexagono"></span>',
    octógono: '<span class="fg fg-octogono"></span>',
    cubo: '<span class="fg fg-cubo"></span>',
    esfera: '<span class="fg fg-esfera"></span>',
    cilindro: '<span class="fg fg-cilindro"></span>',
    cone: '<span class="fg fg-cone"></span>',
    pirâmide: '<span class="fg fg-piramide"></span>',
    prisma: '<span class="fg fg-prisma"></span>',
  };
  const f = map[nome] || map[String(nome).toLowerCase()] || '<span class="fg fg-circulo"></span>';
  return `${f}${simetria ? '<span class="fg-eixo"></span>' : ''}<small>${nome}</small>`;
}

function fmtNum(n) {
  if (typeof n === 'number') {
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }
  if (typeof n === 'string' && /^[\d.,]+$/.test(n)) return n;
  return n;
}
