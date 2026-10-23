import { G } from './state/gameState.js';
import { loadState, saveState, clearGuestData } from './storage/persistence.js';
import { showToast } from './ui/toastManager.js';
import { $ } from './utils/dom.js';

document.addEventListener('DOMContentLoaded', () => {
  const btnEntrar = $('btnEntrar');
  const btnCriar = $('btnCriar');
  const btnVisitante = $('btnVisitante');
  const btnVoltar = $('btnVoltar');
  const viewMenu = $('viewMenu');
  const viewForm = $('viewForm');
  const loginForm = $('loginForm');

  // Ação: Entrar (Carregar Perfil Existente)
  btnEntrar.addEventListener('click', async () => {
    sessionStorage.removeItem('guest'); // garante que lê o perfil real
    await loadState(); // Tenta ler do IndexedDB
    if (G.profile && G.profile.childName) {
      // Perfil encontrado!
      window.location.href = '/index.html';
    } else {
      showToast('Nenhum perfil encontrado! Crie uma conta primeiro.');
    }
  });

  // Ação: Jogar Sem Conta (Visitante) - progresso temporário e separado do perfil
  btnVisitante.addEventListener('click', async () => {
    await clearGuestData();
    sessionStorage.setItem('guest', 'true');
    window.location.href = '/index.html';
  });

  // Ação: Mostrar Formulário de Criação
  btnCriar.addEventListener('click', () => {
    viewMenu.style.display = 'none';
    viewForm.style.display = 'block';
  });

  // Ação: Voltar para o Menu
  btnVoltar.addEventListener('click', () => {
    viewForm.style.display = 'none';
    viewMenu.style.display = 'flex';
  });

  // Ação: Salvar Formulário
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const childName = $('childName').value.trim();
    const childAge = parseInt($('childAge').value);
    const grade = parseInt($('childGrade').value);
    const guardianName = $('guardianName').value.trim();
    const guardianEmail = $('guardianEmail').value.trim();
    const parentPin = ($('parentPin').value || '').trim();

    if (!childName || !childAge || !grade || !guardianName || !guardianEmail) {
      showToast('Por favor, preencha todos os campos!');
      return;
    }
    if (!/^\d{4}$/.test(parentPin)) {
      showToast('O PIN dos pais precisa ter 4 números.');
      return;
    }

    G.profile = { childName, childAge, grade, guardianName, guardianEmail, parentPin };
    G.grade = grade;

    // O saveState() abaixo já chama a camada remota (src/services/dataService.js).
    // Sem as variáveis do Supabase no ambiente, nada sobe: o perfil fica só no aparelho.

    sessionStorage.removeItem('guest'); // salvar na chave do perfil real
    await saveState(); // Salva no IndexedDB
    
    showToast('Perfil criado! Carregando o jogo...');
    setTimeout(() => {
      window.location.href = '/index.html';
    }, 1000);
  });
});
