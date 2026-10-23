/**
 * Carimbo de rodada.
 *
 * Todo minigame agenda o próximo passo dentro de um setTimeout (1,5s para
 * mostrar a comemoração, 4,2s para a tela de foco depois do erro). Se a criança
 * voltar para o hub ou trocar de jogo nesse intervalo, o agendamento velho
 * continuaria vivo: geraria pergunta nova, registraria tentativa que ela nunca
 * viu e abriria a tela de "Rodada completa" por cima de outro jogo.
 *
 * A solução é simples: cada rodada tem um número. Quem agenda guarda o número
 * da vez e só continua se ele ainda for o atual. Sair do jogo (ou começar
 * outro) bumpa o número e invalida tudo que estava agendado.
 */
let ciclo = 0;

/** abre uma rodada nova e devolve o carimbo dela */
export function novoCiclo() {
  ciclo++;
  return ciclo;
}

export function cicloAtual() {
  return ciclo;
}

/**
 * Agenda `fn` para depois de `ms`, mas desiste se a rodada tiver sido
 * cancelada (a criança saiu ou trocou de jogo).
 */
export function depoisDaRodada(ms, fn) {
  const meu = ciclo;
  setTimeout(() => {
    if (meu === ciclo) fn();
  }, ms);
}

/** a rodada ainda é a mesma em que entramos? */
export function cicloVivo(meu) {
  return meu === ciclo;
}
