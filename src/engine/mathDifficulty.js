/**
 * Ritmo do jogo de acordo com a idade.
 *
 * Princípio pedagógico: criança menor precisa de mais tempo de leitura e de
 * menos pressão na tela. O ano escolar (vindo do perfil) define a velocidade
 * base da Chuva de Doces, o tamanho da janela do Corrida e o tempo que a
 * tela de "memorize" fica aberta.
 */

export function perfilPorAno(grade) {
  const g = Math.max(1, Math.min(9, Number(grade) || 3));
  if (g <= 2) return { queda: 0.55, janela: 5200, estudo: 5000, letras: 'grande', perguntas: 4 };
  if (g <= 4) return { queda: 0.8, janela: 4600, estudo: 4200, letras: 'grande', perguntas: 5 };
  if (g <= 6) return { queda: 1.1, janela: 3800, estudo: 3500, letras: 'media', perguntas: 5 };
  if (g <= 8) return { queda: 1.4, janela: 3200, estudo: 3200, letras: 'media', perguntas: 6 };
  return { queda: 1.7, janela: 2800, estudo: 3000, letras: 'normal', perguntas: 6 };
}

export function getFallingSpeed(grade) {
  const base = perfilPorAno(grade).queda;
  return base + Math.random() * base * 0.5;
}

export function getStudyMs(grade) {
  return perfilPorAno(grade).estudo;
}

export function getRoundSize(grade) {
  return perfilPorAno(grade).perguntas;
}
