import { G } from '../state/gameState.js';
import { $ } from '../utils/dom.js';
import { showScreen, goHub } from './screenManager.js';
import { saveState } from '../storage/persistence.js';
import { clearGuestData } from '../storage/persistence.js';
import { resetGameState } from '../state/gameState.js';
import { UNITS, UNIT_ORDER, GRADES, SKILLS_BY_ID, TRACKS_BY_ID } from '../data/curriculum.js';
import { skillStat, masteryDe, domineiu } from './progressUtils.js';

/**
 * Área dos Pais.
 *
 * Não é painel de "IA": é o caderno da professora. Mostra o que a criança
 * já firma, o que ainda escorre, quanto tempo ela leva para responder e
 * o que fazer em casa nesta semana. Tudo que está aqui veio das
 * tentativas reais registradas em G.skillStats / G.attempts.
 */

let destravado = false;
let tentativa = 0;

/* ------------------------------------------------------------------ */
/* Entrada                                                            */
/* ------------------------------------------------------------------ */

export function openParents() {
  showScreen('screenParents');
  const gate = $('parentPinGate');
  const dash = $('parentDash');
  const temPin = !!(G.profile && G.profile.parentPin);

  $('pinTemConta').style.display = temPin ? 'inline' : 'none';
  gate.style.display = 'flex';
  dash.style.display = 'none';
  destravado = false;
  $('parentPinErro').textContent = temPin ? '' : 'Este perfil é de visitante: crie um PIN agora para proteger os dados.';
  $('parentPinInput').value = '';
  $('parentPinInput').focus();
}

export function sairDosPais() {
  goHub();
}

export function conferirPin() {
  const digitado = ($('parentPinInput').value || '').trim();
  const erro = $('parentPinErro');

  // visitante / perfil antigo sem PIN: o primeiro PIN digitado passa a valer
  if (!G.profile || !G.profile.parentPin) {
    if (!/^\d{4}$/.test(digitado)) {
      erro.textContent = 'Escolha um PIN de 4 números para proteger esta área.';
      return;
    }
    G.profile = G.profile || {};
    G.profile.parentPin = digitado;
    saveState();
    liberar();
    return;
  }

  if (digitado !== String(G.profile.parentPin)) {
    tentativa++;
    erro.textContent = tentativa >= 3
      ? 'PIN incorreto. Use "Esqueci o PIN" para cadastrar outro.'
      : 'PIN incorreto, tenta de novo.';
    $('parentPinInput').value = '';
    return;
  }

  tentativa = 0;
  liberar();
}

function liberar() {
  destravado = true;
  $('parentPinGate').style.display = 'none';
  $('parentDash').style.display = 'block';
  montarRelatorio();
}

export function recuperarPin() {
  const email = (G.profile && G.profile.guardianEmail) || '';
  const digitado = window.prompt(
    email ? 'Confirme o e-mail do responsável para criar um novo PIN:\n(salvo: ' + email + ')'
          : 'Crie um novo PIN de 4 números para a Área dos Pais:'
  );
  if (digitado == null) return;

  if (email && digitado.trim().toLowerCase() !== email.trim().toLowerCase()) {
    $('parentPinErro').textContent = 'O e-mail não confere com o do cadastro.';
    return;
  }

  const novo = window.prompt('Agora digite o novo PIN (4 números):');
  if (!novo || !/^\d{4}$/.test(novo.trim())) {
    $('parentPinErro').textContent = 'PIN não criado: precisa de 4 números.';
    return;
  }
  G.profile = G.profile || {};
  G.profile.parentPin = novo.trim();
  saveState();
  $('parentPinErro').textContent = 'PIN atualizado. Bem-vindo(a)!';
  liberar();
}

/* ------------------------------------------------------------------ */
/* Relatório                                                          */
/* ------------------------------------------------------------------ */

export function montarRelatorio() {
  if (!destravado) return;

  const grade = Number(G.grade || 3);
  const perfil = GRADES.find(g => g.id === grade) || GRADES[2];
  $('parentsAnoLabel').textContent = perfil.label;

  montarCabecalhoChild(perfil);
  montarUnidades();
  montarListas();
  montarTempos();
  montarSessoes();
  montarPlano(grade);
  montarSelectAno(grade);

  const notas = $('parentFootnote');
  notas.innerHTML = `Base curricular: BNCC — Matemática, Ensino Fundamental. `
    + `Cada linha abaixo traz o código oficial da habilidade, para conferir com o plano de ensino da escola. `
    + `Registros desta máquina: ${G.attempts.length} respostas (as últimas ${G.attempts.length} ficam guardadas) em ${G.sessions.length} dia(s) de jogo.`;
}

function montarCabecalhoChild(perfil) {
  const box = $('parentChildCard');
  const acertos = G.totalCorrect;
  const total = G.totalAttempts || 1;
  const pct = Math.round((acertos / total) * 100);
  const dias = G.sessions.length;
  const nome = (G.profile && G.profile.childName) || 'Visitante';

  box.innerHTML = `
    <div class="pdc-avatar"><img src="/assets/images/jaguar.jpg" alt="Juju" style="mix-blend-mode:multiply;"></div>
    <div class="pdc-txt">
      <h3>${esc(nome)}</h3>
      <p>${perfil.label} · ${perfil.band}</p>
    </div>
    <div class="pdc-num">
      <div><strong>${pct}%</strong><span>de acerto</span></div>
      <div><strong>${G.totalAttempts}</strong><span>respostas</span></div>
      <div><strong>${dias}</strong><span>dia(s) de jogo</span></div>
      <div><strong>${G.stars}</strong><span>estrelas</span></div>
    </div>`;
}

function montarUnidades() {
  const box = $('parentUnits');
  box.innerHTML = UNIT_ORDER.map(id => {
    const u = UNITS[id];
    const st = G.unitStats[id] || { c: 0, w: 0 };
    const n = st.c + st.w;
    const pct = n ? Math.round((st.c / n) * 100) : 0;
    const estado = n === 0 ? 'sem' : pct >= 80 ? 'ok' : pct >= 55 ? 'quase' : 'fraco';
    return `
      <div class="pu-row ${estado}" style="--cor:${u.color}">
        <div class="pu-head">
          <span class="pu-icon"><i class="fa-solid ${u.icon}"></i></span>
          <strong>${u.label}</strong>
          <em>${n ? `${pct}%` : 'ainda não jogou'}</em>
        </div>
        <div class="pu-bar"><i style="width:${n ? pct : 3}%"></i></div>
        <div class="pu-foot">${n ? `${st.c} acertos · ${st.w} erros · ${u.desc}` : `Treine nos jogos: ${u.desc}`}</div>
      </div>`;
  }).join('');
}

/** lista de habilidades ordenada por domínio */
function ranking() {
  return Object.keys(G.skillStats)
    .map(id => ({ id, st: G.skillStats[id], sk: SKILLS_BY_ID[id] }))
    .filter(x => x.sk)
    .map(x => ({ ...x, n: x.st.c + x.st.w, m: masteryDe(x.st) }))
    .filter(x => x.n > 0);
}

function linhaHabilidade(x) {
  const codigos = (x.sk.codes || []).join(', ');
  return `
    <div class="pl-row" style="--cor:${corDaTrilha(x.sk.trilhaId)}">
      <div class="pl-main">
        <strong>${esc(x.sk.nome)}</strong>
        <span>${esc(x.sk.trilhaNome)} · ${x.n} resposta(s) · ${codigos}</span>
      </div>
      <div class="pl-meter"><i style="width:${Math.round(x.m * 100)}%"></i></div>
      <div class="pl-pct">${Math.round(x.m * 100)}%</div>
    </div>`;
}

function montarListas() {
  const r = ranking();
  const fraco = r.filter(x => x.m < 0.7).sort((a, b) => a.m - b.m).slice(0, 6);
  const forte = r.filter(x => domineiu(x)).sort((a, b) => b.m - a.m).slice(0, 6);

  $('parentWeak').innerHTML = fraco.length
    ? fraco.map(linhaHabilidade).join('')
    : '<p class="pl-vazio">Nenhum ponto fraco apareceu ainda — continue jogando para o relatório engordar.</p>';

  $('parentStrong').innerHTML = forte.length
    ? forte.map(linhaHabilidade).join('')
    : '<p class="pl-vazio">Ainda não há habilidade firmada. Firmeza = acertar 4 ou mais vezes seguidas.</p>';
}

function montarTempos() {
  const r = ranking().filter(x => x.st.avgMs > 0);
  const box = $('parentTiming');
  if (!r.length) {
    box.innerHTML = '<p class="pl-vazio">Sem medição de tempo ainda.</p>';
    return;
  }

  const maisLento = r.slice().sort((a, b) => b.st.avgMs - a.st.avgMs)[0];
  const maisRapido = r.slice().sort((a, b) => a.st.avgMs - b.st.avgMs)[0];
  const mediana = medianaDe(r.map(x => x.st.avgMs));

  box.innerHTML = `
    <div class="pt-cards">
      <div class="pt-card">
        <span class="pt-label">Ritmo típico</span>
        <strong>${seg(mediana)}</strong>
        <p>mediana entre todas as habilidades</p>
      </div>
      <div class="pt-card pt-lento">
        <span class="pt-label">Trava em</span>
        <strong>${esc(maisLento.sk.nome)}</strong>
        <p>${seg(maisLento.st.avgMs)} por resposta — costuma ser conteúdo novo, não distração.</p>
      </div>
      <div class="pt-card pt-rapido">
        <span class="pt-label">Você voa em</span>
        <strong>${esc(maisRapido.sk.nome)}</strong>
        <p>${seg(maisRapido.st.avgMs)} por resposta.</p>
      </div>
    </div>
    <p class="pt-note">Tempo é leitura, não nota: se a criança responde devagar <em>certo</em>, ela está pensando. Se responde rápido <em>errado</em>, está chutando — nesse caso vale voltar na trilha com o modo Quiz Doce, que dá tempo para pensar.</p>`;
}

function montarSessoes() {
  const box = $('parentSessions');
  const lista = G.sessions.slice(0, 14);
  if (!lista.length) {
    box.innerHTML = '<p class="pl-vazio">A criança ainda não terminou uma sessão registrada.</p>';
    return;
  }
  box.innerHTML = `
    <table class="ps-table">
      <thead><tr><th>Dia</th><th>Respostas</th><th>Acertos</th><th>Aproveitamento</th></tr></thead>
      <tbody>
        ${lista.map(s => {
          const pct = s.attempts ? Math.round((s.correct / s.attempts) * 100) : 0;
          return `<tr>
            <td>${diaBonito(s.date)}</td>
            <td>${s.attempts}</td>
            <td>${s.correct}</td>
            <td><span class="ps-chip ${pct >= 80 ? 'bom' : pct >= 55 ? 'meio' : 'baixo'}">${pct}%</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function montarPlano(grade) {
  const box = $('parentAdvice');
  const r = ranking();
  const alvos = r.filter(x => x.m < 0.7).sort((a, b) => a.m - b.m).slice(0, 3);
  const naoVistas = habilidadesDoAnoSemTentar(grade).slice(0, 2);

  if (!alvos.length && !naoVistas.length) {
    box.innerHTML = '<p class="pl-vazio">Tudo em ordem por enquanto. Deixe a criança avançar nas trilhas do próprio ano.</p>';
    return;
  }

  const blocos = [];

  alvos.forEach((x, i) => {
    const modo = modoSugerido(x.sk);
    blocos.push(`
      <div class="pa-item">
        <span class="pa-num">${i + 1}</span>
        <div>
          <strong>${esc(x.sk.nome)}</strong>
          <p>${Math.round(x.m * 100)}% de domínio (${x.st.c} acertos, ${x.st.w} erros). Códigos BNCC: ${(x.sk.codes || []).join(', ') || '—'}.</p>
          <p class="pa-faca">O que fazer em casa: <b>${modo}</b>, escolhendo a trilha <b>${esc(x.sk.trilhaNome)}</b>. Duas rodadas curtas valem mais que uma longa.</p>
        </div>
      </div>`);
  });

  naoVistas.forEach(x => {
    blocos.push(`
      <div class="pa-item pa-novo">
        <span class="pa-num"><i class="fa-solid fa-seedling"></i></span>
        <div>
          <strong>${esc(x.nome)}</strong>
          <p>É conteúdo do ${grade}º ano que ela ainda não encarou. Vale uma rodada de <b>Fatia de Bolo</b> ou <b>Quiz Doce</b> na trilha <b>${esc(x.trilhaNome)}</b> só para quebrar o gelo.</p>
        </div>
      </div>`);
  });

  box.innerHTML = blocos.join('');
}

function montarSelectAno(grade) {
  const sel = $('parentGradeSelect');
  if (!sel) return;
  sel.innerHTML = GRADES.map(g =>
    `<option value="${g.id}" ${g.id === grade ? 'selected' : ''}>${g.label}</option>`).join('');
}

/* ------------------------------------------------------------------ */
/* Ações                                                              */
/* ------------------------------------------------------------------ */

export function mudarAnoEscolar(valor) {
  const g = Number(valor);
  if (!g) return;
  G.grade = g;
  if (G.profile) G.profile.grade = g;
  saveState();
  montarRelatorio();
}

export function salvarAjustesPais() {
  const novo = ($('parentNewPin').value || '').trim();
  if (novo && !/^\d{4}$/.test(novo)) {
    $('parentFootnote').textContent = 'O PIN novo precisa ter exatamente 4 números.';
    return;
  }
  if (novo) {
    G.profile = G.profile || {};
    G.profile.parentPin = novo;
    $('parentNewPin').value = '';
  }
  const sel = $('parentGradeSelect');
  if (sel && sel.value) mudarAnoEscolar(sel.value);
  saveState();
  $('parentFootnote').textContent = 'Ajustes salvos neste aparelho.';
  montarRelatorio();
}

export function exportarRelatorioPais() {
  const linhas = ['habilidade;trilha;unidade;acertos;erros;dominio_pct;tempo_medio_s;codigos_bncc'];
  Object.keys(G.skillStats).forEach(id => {
    const st = G.skillStats[id];
    const sk = SKILLS_BY_ID[id];
    if (!sk) return;
    linhas.push([
      sk.nome, sk.trilhaNome, (UNITS[sk.unidade] || {}).label || sk.unidade,
      st.c, st.w, Math.round(masteryDe(st) * 100),
      st.avgMs ? (st.avgMs / 1000).toFixed(1) : '',
      (sk.codes || []).join(' '),
    ].join(';'));
  });

  linhas.push('');
  linhas.push('dia;respostas;acertos;aproveitamento_pct');
  G.sessions.forEach(s => {
    linhas.push(`${s.date};${s.attempts};${s.correct};${s.attempts ? Math.round(s.correct / s.attempts * 100) : 0}`);
  });

  const nome = (G.profile && G.profile.childName) || 'crianca';
  baixar(`candy-math-${nome}.csv`, linhas.join('\n'), 'text/csv;charset=utf-8');
}

export function imprimirRelatorio() {
  window.print();
}

export function sairDaConta() {
  if (!window.confirm('Apagar todo o progresso e voltar para a tela de entrada?')) return;
  resetGameState();
  saveState().then(() => clearGuestData());
  sessionStorage.removeItem('guest');
  window.location.href = '/login.html';
}

/* ------------------------------------------------------------------ */
/* ajudantes                                                          */
/* ------------------------------------------------------------------ */

function modoSugerido(sk) {
  const t = sk.trilhaId;
  if (t === 'fracoes' || t === 'decimais') return 'Fatia de Bolo';
  if (t === 'padroes' || t === 'equacoes') return 'Balança da Juju';
  if (t === 'medidas' || (sk.gen || '').startsWith('measures')) return 'Mercadinho';
  if (sk.gen === 'data') return 'Quiz Doce';
  if (t === 'geometria' || t === 'localizacao') return 'V ou F';
  return 'Chuva de Doces';
}

function corDaTrilha(id) {
  return (TRACKS_BY_ID[id] || {}).cor || '#FF6B9D';
}

function habilidadesDoAnoSemTentar(grade) {
  const out = [];
  Object.keys(SKILLS_BY_ID).forEach(id => {
    const sk = SKILLS_BY_ID[id];
    if (grade < sk.grades[0] || grade > sk.grades[1]) return;
    if (skillStat(id)) return;
    out.push(sk);
  });
  return out;
}

function medianaDe(v) {
  const a = v.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

function seg(ms) {
  if (!ms) return '—';
  return `${(ms / 1000).toFixed(1)} s`;
}

function diaBonito(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function baixar(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
