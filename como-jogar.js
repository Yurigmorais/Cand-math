/* =========================================================
   CANDY MATH — como-jogar.js
   Explicação de regras antes da primeira partida de cada jogo.

   Regra de ouro: nenhuma criança entra num jogo sem saber o que tem
   que fazer. O texto diz quatro coisas, nesta ordem:
     1. o que se treina aqui;
     2. o que você faz com as mãos (passos curtos);
     3. o que acontece quando erra (ninguém é punido por tentar);
     4. quanto vale cada acerto.

   O texto aparece uma vez por jogo. Depois, um botão "Como jogar" em
   cada cartão do hub abre a mesma explicação, quantas vezes quiserem.
   ========================================================= */
(function (root) {
'use strict';

const TUTORIAIS = {
  quiz: {
    nome: 'Quiz Doce', icone: 'fa-candy-cane',
    treina: 'ler o enunciado com calma e escolher a conta certa para resolver.',
    passos: [
      'Aparece uma conta ou um problema do ano que você escolheu.',
      'Toque no alto-falante do cartão se quiser ouvir a pergunta.',
      'Resolva na cabeça ou no papel e toque em uma das quatro respostas.',
      'São cinco perguntas na rodada. No fim aparece o resumo do que você fez.',
    ],
    erro: 'Errar não fecha o jogo. Na primeira vez aparece uma pista para reler o enunciado. Na segunda, o desenho da situação com doces. Na terceira, a resposta certa vem junto de uma pergunta parecida para a ideia firmar.',
    estrelas: '+10 por acerto, e bônus de 25 se você fechar a rodada inteira.',
  },
  truefalse: {
    nome: 'Verdadeiro ou Falso', icone: 'fa-scale-balanced',
    treina: 'julgar uma frase matemática sem se apressar — e saber explicar o porquê.',
    passos: [
      'Aparece uma frase sobre números, formas, medidas ou gráficos.',
      'Leia a frase inteira antes de decidir.',
      'Toque em Verdadeiro ou em Falso.',
      'São cinco frases na rodada.',
    ],
    erro: 'Toda resposta devolve o motivo. Quando você erra, a explicação diz exatamente onde a frase mentia — e isso vale mais que o acerto.',
    estrelas: '+10 por acerto.',
  },
  operator: {
    nome: 'Qual o Sinal?', icone: 'fa-plus-minus',
    treina: 'reconhecer a operação que faz a sentença fechar, em vez de só calcular.',
    passos: [
      'Aparece uma sentença com um buraco no meio: 5 ? 3 = 8.',
      'Pense: somar, tirar, multiplicar ou dividir?',
      'Toque em um dos quatro sinais.',
      'Os números são sempre fáceis de conferir de cabeça.',
    ],
    erro: 'A sentença mostra o sinal que você escolheu em vermelho e o jogo diz por que ele não fecha. Na próxima você já sabe testar cada lado.',
    estrelas: '+10 por acerto.',
  },
  balance: {
    nome: 'Balança da Igualdade', icone: 'fa-weight-hanging',
    treina: 'entender que o sinal de igual significa os dois lados com o mesmo peso.',
    passos: [
      'A balança tem um lado completo e outro com um número escondido.',
      'Descubra o número que deixa os dois lados iguais.',
      'Toque na resposta da lista de baixo.',
      'São cinco balanças na rodada.',
    ],
    erro: 'A balança pende para o lado errado e o jogo diz qual número equilibrava. Errar aqui é ver o desequilíbrio, não perder ponto.',
    estrelas: '+20 por acerto.',
  },
  roulette: {
    nome: 'Roleta da Sorte', icone: 'fa-dharmachakra',
    treina: 'responder sob um tempo curto, com prêmio que muda a cada giro.',
    passos: [
      'Toque em Girar. A roleta para em um setor: 10, 15, 20, 25, 30 ou 40 estrelas.',
      'Aquele é o prêmio do giro — mas ele só é seu se você acertar a pergunta.',
      'Responda a pergunta que aparece depois da parada.',
      'Cada rodada tem cinco giros.',
    ],
    erro: 'No primeiro erro do giro aparece uma pista e você tenta de novo. No segundo, a resposta certa é revelada e aquele giro não leva prêmio. O giro seguinte vem limpo.',
    estrelas: 'De 10 a 40 por giro acertado.',
  },
  puzzle: {
    nome: 'Cruzadinha Numérica', icone: 'fa-puzzle-piece',
    treina: 'manter a cabeça em várias somas ao mesmo tempo e conferir o que já colocou.',
    passos: [
      'A grade tem números prontos e casas com interrogação.',
      'A soma escrita na borda diz quanto aquela linha ou coluna deve dar.',
      'Toque em uma casa vazia e escolha o número.',
      'Toque em Verificar quando completar. São três grades na rodada.',
    ],
    erro: 'A verificação aponta a casa que quebrou a soma, e o botão Dica abre uma casa de cada vez. Qualquer preenchimento que faça todas as somas bater está certo — não existe só uma resposta decorada.',
    estrelas: '+30 por grade completa.',
  },
  sequence: {
    nome: 'Sequência Lógica', icone: 'fa-arrow-right-long',
    treina: 'descobrir o padrão antes de calcular — a regra que faz a fila crescer.',
    passos: [
      'Aparece uma fila de números com um buraco no fim ou no meio.',
      'Descubra o que acontece de um número para o outro.',
      'Toque na opção que completa a fila.',
      'São cinco sequências na rodada.',
    ],
    erro: 'O jogo diz qual era a regra da fila. Assim o erro vira a parte mais útil da rodada.',
    estrelas: '+15 por acerto.',
  },
  sort: {
    nome: 'Ordene os Números', icone: 'fa-arrow-down-1-9',
    treina: 'comparar valores, inclusive os que parecem maiores por causa do tamanho do numeral.',
    passos: [
      'As peças de doce aparecem fora de ordem.',
      'Toque em uma peça e depois em outra para trocar as duas de lugar.',
      'Monte do menor para o maior, ou do maior para o menor, como a rodada pedir.',
      'Toque em Verificar. São cinco fileiras na rodada.',
    ],
    erro: 'A verificação diz a posição que está fora de lugar, e você continua mexendo sem perder a rodada.',
    estrelas: '+20 por acerto.',
  },
  memory: {
    nome: 'Memória Doce', icone: 'fa-clone',
    treina: 'guardar na cabeça a conta que viu e reconhecer o resultado dela em outra carta.',
    passos: [
      'A mesa tem cartas viradas para baixo.',
      'Toque em duas cartas por vez.',
      'Uma traz a conta, a outra traz o resultado. Formou o par, as duas ficam abertas.',
      'Feche a mesa inteira. São três mesas na rodada.',
    ],
    erro: 'Par que não bate fecha de novo e nada é perdido: memória se avalia pela mesa inteira, não por uma cartada.',
    estrelas: '+20 por mesa fechada.',
  },
  catch: {
    nome: 'Chuva Numérica', icone: 'fa-cloud-showers-heavy',
    treina: 'segurar a resposta na cabeça enquanto escolhe entre várias que descem.',
    passos: [
      'A pergunta aparece no alto da tela.',
      'Os números caem como gotas de chuva.',
      'Arraste a cesta (ou use as setas do teclado) para debaixo do número certo.',
      'São cinco nuvens na rodada.',
    ],
    erro: 'Se a cesta pegar o número errado, o jogo avisa que a resposta certa ainda está caindo. Você continua até pegar.',
    estrelas: '+20 por acerto.',
  },
  balloon: {
    nome: 'Balões Doces', icone: 'fa-meteor',
    treina: 'decidir rápido com números que você já domina.',
    passos: [
      'A conta aparece no alto.',
      'Balões com possíveis respostas sobem pela tela.',
      'Toque no balão com a resposta certa antes dele escapar.',
      'São cinco ondas de balões na rodada.',
    ],
    erro: 'Balão errado estoura e avisa: a resposta certa ainda está subindo. Nada de punição, só nova tentativa.',
    estrelas: '+15 por acerto.',
  },
  fishing: {
    nome: 'Pescaria', icone: 'fa-fish',
    treina: 'comparar respostas parecidas enquanto elas se mexem.',
    passos: [
      'A pergunta fica no alto e os peixes nadam com números na barriga.',
      'Mova o anzol arrastando o dedo (ou o mouse) sobre a água.',
      'Toque em Pescar para descer o anzol.',
      'São cinco mergulhos na rodada.',
    ],
    erro: 'Anzol vazio ou peixe errado: o jogo diz que a resposta certa ainda nada por ali. O erro não tira estrela de outra pergunta.',
    estrelas: '+15 por acerto.',
  },
  whack: {
    nome: 'Caça-Toupeira', icone: 'fa-hammer',
    treina: 'reconhecer a resposta certa em uma fração de segundo.',
    passos: [
      'A conta aparece no alto.',
      'Toupeiras sobem dos buracos com números.',
      'Toque na toupeira com a resposta certa antes que ela desça.',
      'São cinco levas na rodada.',
    ],
    erro: 'Toupeira errada desce e outra sobe com a resposta certa ainda no jogo. Você continua até achar.',
    estrelas: '+20 por acerto.',
  },
  duelo: {
    nome: 'Caça ao Número (1 x 1)', icone: 'fa-crosshairs',
    treina: 'calcular e, ao mesmo tempo, procurar um número no meio de muitos — atenção dividida, como na vida real da sala de aula.',
    passos: [
      'Escolha quantos números vão encher a tela: 20, 40, 60 ou 80. Cada número é a resposta de uma conta que ainda está na fila.',
      'A partida é em turnos. Quando a vez chegar, aparece um portão com "Estou pronto": o relógio só começa depois que você toca nele.',
      'Resolva a conta e toque no número que é a resposta, no meio de todos os outros. Seu relógio corre; o do adversário fica parado.',
      'Acertou: aquele número sai da tela e a vez passa. Errou: nada muda, a conta continua sua, e é o seu tempo quem cobra.',
      'O tempo de cada vez acaba e a vez passa com a mesma conta na fila. Se ninguém achar a resposta em três passadas, o número certo começa a brilhar — e vale para quem tocar primeiro.',
      'A partida termina quando não sobrar nenhum número na tela. Ganhou quem achou mais; em caso de empate, quem gastou menos tempo.',
    ],
    erro: 'Número errado não elimina você: só custa tempo, e o tempo é o que decide o empate. Por isso vale conferir a conta antes de sair tocando.',
    estrelas: 'Cada número achado vale 1 estrela, e quem fecha a partida na frente leva um bônus de 15.',
    extra: 'Dá para jogar com dois jogadores no mesmo aparelho, cada um com seu relógio, ou com um código de sala em aparelhos diferentes — e há uma opção que dobra o tempo de cada vez para quem quer pensar mais.',
  },
  prova: {
    nome: 'Prova de Aprendizagem', icone: 'fa-file-lines',
    treina: 'mostrar o que já ficou, sem ajuda — é o que alimenta o boletim de quem acompanha.',
    passos: [
      'A prova tem 12 perguntas do ano escolhido, uma de cada vez.',
      'Não aparece pista, nem desenho de doces, nem resposta no fim: você resolve sozinho.',
      'Não há tempo marcado por pergunta. Responda no seu ritmo.',
      'No fim, o resultado é lido por unidade da BNCC e vira o boletim para os responsáveis.',
    ],
    erro: 'A prova não corrige na hora de propósito: dizer "errou" no meio da verificação mudaria o que ela mede. Você só fica sabendo depois, junto de quem acompanha você.',
    estrelas: 'A prova não dá estrela. Ela mede — quem dá estrela é o jogo.',
    extra: 'Faça a prova depois de algumas rodadas de jogo, nunca na primeira sessão: sem ter jogado, o resultado diz pouco.',
  },
};

// ── estado do tutorial ────────────────────────────────────
// `G`, `saveState`, `startMode` e companhia vivem no script.js, que é
// carregado depois deste arquivo. Tudo aqui só é chamado em tempo de
// jogo, quando eles já existem — mas o acesso passa por um teste, para
// a explicação não quebrar se alguém carregar esta folha sozinha.
function porId(id) { return document.getElementById(id); }
function estado() { try { return G; } catch (e) { return null; } }
function existe(fn) { return typeof fn === 'function'; }

function visto() {
  const e = estado();
  if (!e) return null;
  return e.comoJogarVisto || (e.comoJogarVisto = {});
}

function precisaMostrar(mode) {
  const v = visto();
  return v ? !v[mode] : true;
}

function marcarVisto(mode) {
  const v = visto();
  if (v) v[mode] = true;
  if (estado() && existe(saveState)) saveState();
}

function montarCorpo(mode) {
  const t = TUTORIAIS[mode];
  if (!t) return '';
  const passos = t.passos.map((p, i) =>
    '<li class="tuto-passo"><span class="tuto-passo-num">' + (i + 1) + '</span>' +
    '<span class="tuto-passo-texto">' + p + '</span></li>').join('');
  return '' +
    '<div class="tuto-cabeca">' +
      '<span class="tuto-icone"><i class="fa-solid ' + t.icone + '"></i></span>' +
      '<div class="tuto-cabeca-texto">' +
        '<h3 class="tuto-nome">' + t.nome + '</h3>' +
        '<p class="tuto-treina"><i class="fa-solid fa-brain"></i> Este jogo treina: ' + t.treina + '</p>' +
      '</div>' +
    '</div>' +
    '<ol class="tuto-passos">' + passos + '</ol>' +
    '<div class="tuto-faixa tuto-faixa-erro"><i class="fa-solid fa-hand-holding-heart"></i> ' +
      '<span><b>Se errar:</b> ' + t.erro + '</span></div>' +
    '<div class="tuto-faixa tuto-faixa-estrela"><i class="fa-solid fa-star"></i> ' +
      '<span><b>Pontuação:</b> ' + t.estrelas + '</span></div>' +
    (t.extra ? '<div class="tuto-faixa tuto-faixa-extra"><i class="fa-solid fa-circle-info"></i> ' +
      '<span>' + t.extra + '</span></div>' : '');
}

// A demonstração do duelo é a única parte que não dá para explicar
// só com texto: a criança precisa ver um número sumindo da tela.
function montarDemoDuelo() {
  const alvo = 7 + Math.floor(Math.random() * 8);
  const soma = Math.max(1, alvo - (2 + Math.floor(Math.random() * 5)));
  const parcela = alvo - soma;
  const opcoes = [alvo];
  while (opcoes.length < 6) {
    const distractor = alvo + (Math.floor(Math.random() * 9) - 4);
    if (distractor > 0 && opcoes.indexOf(distractor) < 0) opcoes.push(distractor);
  }
  const ordem = opcoes.slice().sort(() => Math.random() - 0.5);
  const pecas = ordem.map((n) =>
    '<button type="button" class="tuto-demo-num" data-n="' + n + '">' + n + '</button>').join('');
  return '<div class="tuto-demo" data-alvo="' + alvo + '">' +
      '<p class="tuto-demo-conta">Experimente: ' + soma + ' + ' + parcela + ' = ?</p>' +
      '<div class="tuto-demo-area">' + pecas + '</div>' +
      '<p class="tuto-demo-fala" id="tutoDemoFala">Toque no número que é a resposta.</p>' +
    '</div>';
}

function ligarDemoDuelo(mode) {
  if (mode !== 'duelo') return;
  const caixa = document.querySelector('.tuto-demo');
  const area = document.querySelector('.tuto-demo-area');
  const fala = porId('tutoDemoFala');
  if (!caixa || !area || !fala) return;
  const alvo = parseInt(caixa.dataset.alvo, 10);
  area.querySelectorAll('.tuto-demo-num').forEach((b) => {
    b.onclick = () => {
      if (parseInt(b.dataset.n, 10) === alvo) {
        b.classList.add('acerto');
        fala.textContent = 'Isso! Esse número saiu da tela e a vez passou para o outro jogador.';
        if (existe(playSound)) playSound('correct');
      } else {
        b.classList.add('erro');
        fala.textContent = 'Não é esse — e o seu relógio continuou correndo. Tente outro.';
        if (existe(playSound)) playSound('wrong');
      }
    };
  });
}

let modoAberto = null;

function abrir(mode, opts) {
  const t = TUTORIAIS[mode];
  const o = opts || {};
  if (!t) return;
  modoAberto = mode;
  const corpo = porId('tutoCorpo');
  corpo.innerHTML = montarCorpo(mode) + (mode === 'duelo' ? montarDemoDuelo() : '');
  corpo.setAttribute('aria-live', 'polite');

  const acoes = porId('tutoAcoes');
  acoes.innerHTML =
    '<button type="button" class="btn-tuto btn-tuto-primario" id="tutoJogar">' +
      '<i class="fa-solid fa-play"></i> ' + (o.rotuloAcao || 'Começar a jogar') + '</button>' +
    '<button type="button" class="btn-tuto btn-tuto-secundario" id="tutoFechar">' +
      '<i class="fa-solid fa-arrow-left"></i> Voltar aos jogos</button>';
  porId('tutoTituloText').textContent = 'Como se joga — ' + t.nome;
  acoes.querySelector('#tutoJogar').onclick = () => {
    marcarVisto(mode);
    closeModal('modalTuto');
    if (o.aoJogar) o.aoJogar();
    else if (existe(startMode)) startMode(mode);
  };
  acoes.querySelector('#tutoFechar').onclick = () => {
    marcarVisto(mode);
    closeModal('modalTuto');
  };
  if (existe(openModal)) openModal('modalTuto');
  ligarDemoDuelo(mode);
}

// Botão "?" em cada cartão do hub. Sem ele, a explicação só apareceria
// uma vez na vida — e criança pequena esquece em dois dias.
function armarBotoesDeAjuda() {
  document.querySelectorAll('.mode-card').forEach((card) => {
    // O cartão diz o que faz em data-acao/data-args (não existe script inline
    // neste projeto); é de lá que se tira o modo, não de um texto de onclick.
    if ((card.getAttribute('data-acao') || '') !== 'startMode') return;
    let modo = '';
    try { modo = JSON.parse(card.getAttribute('data-args') || '[]')[0] || ''; } catch (e) { modo = ''; }
    if (typeof modo !== 'string' || !modo || card.querySelector('.mc-info')) return;
    if (!TUTORIAIS[modo]) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mc-info';
    b.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
    b.setAttribute('aria-label', 'Ver como se joga ' + (TUTORIAIS[modo].nome || modo));
    b.title = 'Como se joga';
    b.onclick = (ev) => {
      ev.stopPropagation();
      abrir(modo, { rotuloAcao: 'Jogar agora', aoJogar: () => startMode(modo) });
    };
    card.appendChild(b);
  });
}

root.CM_TUTORIAL = {
  textos: TUTORIAIS,
  abrir: abrir,
  precisaMostrar: precisaMostrar,
  marcarVisto: marcarVisto,
  armarBotoesDeAjuda: armarBotoesDeAjuda,
};
})(typeof window !== 'undefined' ? window : this);
