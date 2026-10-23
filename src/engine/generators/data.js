/**
 * Geradores de Probabilidade e Estatística: leitura de gráficos e tabelas,
 * noção de acaso, cálculo de probabilidade, média, moda e mediana.
 */
import { rnd, pick, shuffle, chance, fmt, options, ramp } from '../questionUtils.js';

const SABORES = ['chocolate', 'morango', 'limão', 'baunilha', 'cereja', 'caramelo', 'mentol', 'uva'];

function votação(quantos) {
  const nomes = shuffle(SABORES).slice(0, quantos);
  const valores = {};
  nomes.forEach(n => { valores[n] = rnd(3, 14); });
  return { nomes, valores };
}

/* ------------------------------------------------------------------ */
export function data(skill, grade) {
  const nivel = ramp(skill, grade);
  const modo = skill.cfg.modo;

  if (modo === 'grafico') {
    const { nomes, valores } = votação(nivel < 2 ? 3 : 4);
    const total = Object.values(valores).reduce((a, b) => a + b, 0);
    const maior = nomes.reduce((a, b) => valores[a] >= valores[b] ? a : b);
    const menor = nomes.reduce((a, b) => valores[a] <= valores[b] ? a : b);
    const tipo = pick(['maior', 'menor', 'total']);
    const value = tipo === 'total' ? total : tipo === 'maior' ? maior : menor;
    const texto = tipo === 'total'
      ? `Somando todas as colunas, quantas crianças participaram da pesquisa?`
      : `Qual foi o ${tipo === 'maior' ? 'sabor mais' : 'sabor menos'} escolhido na pesquisa de doces preferidos?`;
    const distr = tipo === 'total'
      ? [total - valores[maior], total + 2, Math.max(...Object.values(valores))]
      : nomes.filter(n => n !== value).concat([` ${valores[menor]} votos`]);
    return {
      prompt: texto,
      value,
      opts: options(value, distr, v => String(v)),
      explain: `No gráfico de colunas, a altura de cada coluna mostra quantos votos o sabor recebeu: ${nomes.map(n => `${n} = ${valores[n]}`).join(', ')}.`,
      visual: { kind: 'bars', titulo: 'Doce preferido da turma', valores, nomes },
    };
  }

  if (modo === 'tabela') {
    const linhas = shuffle(SABORES).slice(0, 3);
    const colunas = ['Vendeu pela manhã', 'Vendeu à tarde'];
    const c1 = {}, c2 = {};
    linhas.forEach(l => { c1[l] = rnd(2, 20); c2[l] = rnd(2, 20); });
    const linha = pick(linhas);
    const value = c1[linha] + c2[linha];
    return {
      prompt: `A tabela mostra as vendas do dia. Quantos doces de ${linha} a loja vendeu no total (manhã e tarde)?`,
      value,
      opts: options(value, [Math.abs(c1[linha] - c2[linha]), c1[linha], value + 3]),
      explain: `Some a linha do ${linha}: ${c1[linha]} (manhã) + ${c2[linha]} (tarde) = ${value} doces.`,
      visual: { kind: 'table', titulo: 'Vendas do dia', linhas, colunas: [{ nome: 'Manhã', valores: c1 }, { nome: 'Tarde', valores: c2 }] },
    };
  }

  if (modo === 'chance') {
    const total = rnd(6, 14);
    const casos = pick([
      { titulo: 'Sair um doce de chocolate de um saco só com chocolate', resposta: 'certamente' },
      { titulo: 'Sair uma bala de limão de um saco com apenas balas de morango', resposta: 'impossível' },
      { titulo: 'Sair um pirulito de um saco com 3 pirulitos e 9 balas', resposta: 'talvez' },
      { titulo: 'Sair um doce vermelho de um saco com doces vermelhos e verdes', resposta: 'talvez' },
    ]);
    return {
      prompt: `${casos.titulo}. Classifique esse evento:`,
      value: casos.resposta,
      opts: options(casos.resposta, ['certamente', 'talvez', 'impossível', 'bem provável'], v => v),
      explain: casos.resposta === 'certamente'
        ? 'Como só existe esse tipo de doce, o evento sempre acontece: é certo.'
        : casos.resposta === 'impossível'
          ? 'Não há nenhum doce assim no saco, então nunca vai acontecer.'
          : 'Existem alguns, mas não são todos: pode acontecer ou não, é o "talvez".',
    };
  }

  if (modo === 'probabilidade') {
    const favor = rnd(1, 6);
    const outro = rnd(2, 8);
    const total = favor + outro;
    const pedida = pick(['frac', 'pct']);
    if (pedida === 'frac') {
      const value = `${favor}/${total}`;
      return {
        prompt: `Um saco tem ${favor} balões vermelhos e ${outro} azuis. Tirando um de olhos fechados, qual a probabilidade de sair vermelho?`,
        value,
        opts: options(value, [`${outro}/${total}`, `${favor}/${outro}`, `1/${total}`, `${total}/${favor}`], v => v),
        explain: `São ${favor} casos favoráveis em ${total} possíveis, então a chance é ${favor}/${total}.`,
        visual: { kind: 'balls', favor, outro },
      };
    }
    const pct = Math.round(favor / total * 100);
    const value = `${pct}%`;
    return {
      prompt: `Na roleta dos doces, ${favor} de ${total} espaços dão um brinde. Qual é a chance de ganhar, em porcentagem?`,
      value,
      opts: options(value, [`${Math.round(outro / total * 100)}%`, `${favor * 10}%`, `${pct + 10}%`, '100%'], v => v),
      explain: `Probabilidade = casos favoráveis ÷ casos possíveis = ${favor} ÷ ${total} ≈ ${pct}%.`,
      visual: { kind: 'balls', favor, outro },
    };
  }

  // média / moda / mediana
  const n = pick([4, 5]);
  const valores = [];
  for (let i = 0; i < n; i++) valores.push(rnd(2, 20));
  const soma = valores.reduce((a, b) => a + b, 0);
  const pede = pick(['media', 'moda', 'mediana']);
  const ordenado = valores.slice().sort((a, b) => a - b);

  if (pede === 'moda') {
    // garante que exista uma moda clara
    const repetido = valores[0];
    valores[Math.floor(valores.length / 2)] = repetido;
    const value = repetido;
    return {
      prompt: `A lista mostra quantos doces cada criança comeu: ${valores.join(', ')}. Qual é a moda (o valor que mais se repete)?`,
      value,
      opts: options(value, valores.filter(v => v !== value).concat([Math.round(soma / valores.length)])),
      explain: `Moda é o valor que aparece mais vezes. Aqui o ${value} aparece 2 vezes e os outros só uma.`,
      visual: { kind: 'list', valores },
    };
  }

  if (pede === 'mediana') {
    if (valores.length % 2 !== 0) {
      const value = ordenado[Math.floor(ordenado.length / 2)];
      return {
        prompt: `Com os dados em ordem — ${ordenado.join(', ')} — qual é a mediana (o número do meio)?`,
        value,
        opts: options(value, [ordenado[0], ordenado[ordenado.length - 1], Math.round(soma / ordenado.length), value + 1]),
        explain: `Mediana é o valor central depois de ordenar. Na lista ${ordenado.join(', ')}, o meio é ${value}.`,
        visual: { kind: 'list', valores: ordenado },
      };
    }
    const a = ordenado[ordenado.length / 2 - 1];
    const b = ordenado[ordenado.length / 2];
    const value = (a + b) / 2;
    return {
      prompt: `Com os dados em ordem — ${ordenado.join(', ')} — qual é a mediana?`,
      value,
      opts: options(value, [a, b, Math.round(soma / ordenado.length), value + 1]),
      explain: `Como são ${ordenado.length} valores, a mediana é a média dos dois do meio: (${a} + ${b}) ÷ 2 = ${value}.`,
      visual: { kind: 'list', valores: ordenado },
    };
  }

  const value = Math.round(soma / valores.length * 100) / 100;
  return {
    prompt: `Uma turma anotou quantos doces comeu na semana: ${valores.join(', ')}. Qual é a média? (pode arredondar para 1 casa decimal)`,
    value,
    opts: options(value, [ordenado[0], Math.max(valores), Math.round(soma / (valores.length + 1) * 100) / 100, value + 1]),
    explain: `Some tudo e divida pela quantidade de crianças: ${valores.join(' + ')} = ${soma}, e ${soma} ÷ ${valores.length} = ${value}.`,
    visual: { kind: 'list', valores },
  };
}
