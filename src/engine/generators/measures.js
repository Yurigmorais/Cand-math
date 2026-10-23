/**
 * Geradores de Grandezas e Medidas: comparação, unidades, conversões,
 * relógio, calendário e temperatura.
 */
import { rnd, pick, chance, fmt, options, ramp } from '../questionUtils.js';

const MEDECORES = [
  { grand: 'comprimento', unidades: ['mm', 'cm', 'm', 'km'], fator: { mm: 1, cm: 10, m: 1000, km: 1000000 } },
  { grand: 'massa', unidades: ['g', 'kg', 't'], fator: { g: 1, kg: 1000, t: 1000000 } },
  { grand: 'capacidade', unidades: ['mL', 'L'], fator: { mL: 1, L: 1000 } },
  { grand: 'tempo', unidades: ['s', 'min', 'h'], fator: { s: 1, min: 60, h: 3600 } },
];

const SITUACOES = [
  { texto: 'a distância entre duas cidades', unidade: 'km' },
  { texto: 'o comprimento de um lápis', unidade: 'cm' },
  { texto: 'a espessura de uma moeda', unidade: 'mm' },
  { texto: 'o peso de um saco de batata', unidade: 'kg' },
  { texto: 'o peso de uma bala de goma', unidade: 'g' },
  { texto: 'o refrigerante de uma garrafa grande', unidade: 'L' },
  { texto: 'uma colher de xarope', unidade: 'mL' },
  { texto: 'a altura de uma criança', unidade: 'cm' },
  { texto: 'o tanto de água de um copo', unidade: 'mL' },
  { texto: 'a massa de um caminhão de doces', unidade: 't' },
];

/* ------------------------------------------------------------------ */
export function measure(skill, grade) {
  const nivel = ramp(skill, grade);
  const modo = skill.cfg.modo;

  if (modo === 'comparar') {
    const alvo = pick([
      { a: 'um lápis', b: 'uma régua de metro', certa: 'b', texto: 'Qual dos dois é mais longo: um lápis ou uma régua de 1 metro?' },
      { a: 'uma bicicleta', b: 'um elefante de brinquedo', certa: 'a', texto: 'Qual pesa mais, uma bicicleta de verdade ou um elefante de brinquedo?' },
      { a: 'um copo de suco', b: 'uma banheira cheia', certa: 'b', texto: 'Qual cabe mais líquido: um copo de suco ou uma banheira cheia?' },
      { a: 'o recreio', b: 'uma aula inteira', certa: 'b', texto: 'Qual dura mais tempo: o recreio ou uma aula inteira?' },
      { a: 'a geladeira', b: 'a caixa de bombom', certa: 'a', texto: 'Qual dos dois ocupa mais espaço: a geladeira ou a caixa de bombom?' },
    ]);
    const value = alvo.certa === 'a' ? alvo.a : alvo.b;
    const outra = alvo.certa === 'a' ? alvo.b : alvo.a;
    return {
      prompt: alvo.texto,
      value,
      opts: options(value, [outra, 'Têm a mesma medida'], v => v),
      explain: `${value.charAt(0).toUpperCase() + value.slice(1)} é a resposta — pense em algo do dia a dia para comparar, sem precisar medir com régua.`,
    };
  }

  if (modo === 'unidade') {
    const s = pick(SITUACOES);
    const distr = ['mm', 'cm', 'm', 'km', 'g', 'kg', 't', 'L', 'mL'].filter(u => u !== s.unidade);
    return {
      prompt: `Qual unidade de medida é mais adequada para medir ${s.texto}?`,
      value: s.unidade,
      opts: options(s.unidade, distr.slice(0, 3), v => v),
      explain: `${s.texto} se mede em ${s.unidade}. A unidade certa depende do tamanho do que estamos medindo.`,
    };
  }

  if (modo === 'converter') {
    const casos = [
      { de: 'km', para: 'm', fator: 1000 },
      { de: 'm', para: 'cm', fator: 100 },
      { de: 'cm', para: 'mm', fator: 10 },
      { de: 'kg', para: 'g', fator: 1000 },
      { de: 'L', para: 'mL', fator: 1000 },
      { de: 'h', para: 'min', fator: 60 },
      { de: 'min', para: 's', fator: 60 },
      { de: 'd', para: 'h', fator: 24 },
    ];
    const c = pick(casos);
    const qtd = rnd(2, nivel < 2 ? 5 : 12);
    const value = qtd * c.fator;
    return {
      prompt: `Quanto é ${qtd} ${c.de} em ${c.para}?`,
      value,
      opts: options(value, [qtd * (c.fator / 2), qtd + c.fator, value / 10, qtd * c.fator * 10]),
      explain: `1 ${c.de} = ${c.fator} ${c.para}, então ${qtd} × ${c.fator} = ${fmt(value)} ${c.para}.`,
      unidade: c.para,
    };
  }

  if (modo === 'relogio') {
    const meiaHora = nivel < 2 || chance(0.4);
    const h = rnd(1, 12);
    const m = meiaHora ? 30 : pick([0, 15, 45]);
    const value = `${h}:${String(m).padStart(2, '0')}`;
    const formatos = {
      0: ['em ponto', '00 minutos'],
      15: ['e um quarto', '15 minutos'],
      30: ['e meia', '30 minutos'],
      45: ['menos um quarto', '45 minutos'],
    };
    return {
      prompt: `O ponteiro pequeno do relógio está no ${h} e o ponteiro grande apontando para o ${m === 0 ? 12 : m === 15 ? 3 : m === 30 ? 6 : 9}. Que horas são?`,
      value,
      opts: options(value, [
        `${h + 1}:${String(m).padStart(2, '0')}`,
        `${h}:${String((m + 15) % 60).padStart(2, '0')}`,
        `${m}:${String(h).padStart(2, '0')}`,
      ].filter(v => v !== value), v => v),
      explain: `Cada número do relógio vale 5 minutinhos: o ponteiro grande no ${m === 0 ? 12 : m === 15 ? 3 : m === 30 ? 6 : 9} marca ${m} minutos, ou seja, ${h} horas ${formatos[m][0]}.`,
      visual: { kind: 'clock', h, m },
    };
  }

  if (modo === 'calendario') {
    const tipo = pick(['semana', 'meses', 'idade']);
    if (tipo === 'semana') {
      const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
      const i = rnd(1, 5);
      const pede = pick(['ontem', 'amanhã']);
      const value = pede === 'ontem' ? dias[i - 1] : dias[i + 1];
      return {
        prompt: `Hoje é ${dias[i]}. Qual dia era ${pede}?`,
        value,
        opts: options(value, [dias[i], dias[(i + 2) % 7], dias[(i + 5) % 7]], v => v),
        explain: `A semana tem 7 dias e anda sempre na mesma ordem: ${dias.join(', ')}.`,
      };
    }
    if (tipo === 'meses') {
      const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      const idx = rnd(0, 10);
      const value = meses[idx + 1];
      return {
        prompt: `O aniversário da Juju é no mês depois de ${meses[idx]}. Em que mês ela faz anos?`,
        value,
        opts: options(value, [meses[idx], meses[Math.max(0, idx - 1)], meses[(idx + 2) % 12]], v => v),
        explain: `O ano começa em janeiro e tem 12 meses em ordem fixa. Depois de ${meses[idx]} vem ${value}.`,
      };
    }
    const anoAtual = new Date().getFullYear();
    const nasc = rnd(anoAtual - 12, anoAtual - 6);
    const idade = anoAtual - nasc;
    const daqui = rnd(2, 10);
    return {
      prompt: `A criança nasceu em ${nasc} e completou ${idade} anos. Quantos anos ela fará em ${anoAtual + daqui}?`,
      value: idade + daqui,
      opts: options(idade + daqui, [idade, idade + daqui - 1, idade + daqui + 1]),
      explain: `Basta somar os anos que passaram: ${idade} + ${daqui} = ${idade + daqui}.`,
    };
  }

  // temperatura
  const manha = rnd(8, 20);
  const variação = rnd(2, 12);
  const sobe = chance(0.6);
  const value = sobe ? manha + variação : manha - variação;
  return {
    prompt: `De manhã a temperatura era ${manha} °C. À tarde ${sobe ? 'subiu' : 'desceu'} ${variação} °C. Qual é a temperatura da tarde?`,
    value,
    opts: options(value, [manha + variação, Math.abs(manha - variação), value + 2], v => String(v)),
    explain: `${sobe ? `${manha} + ${variação} = ${value}` : `${manha} − ${variação} = ${value}`} °C.`,
    unidade: '°C',
    visual: { kind: 'thermo', value, inicio: manha },
  };
}
