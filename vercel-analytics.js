/* ===================================================
   CANDY MATH — vercel-analytics.js
   Inicialização do Vercel Web Analytics
   =================================================== */

// Inicializa a fila de comandos do Vercel Analytics antes do script principal
// carregar. O script remoto (_vercel/insights/script.js) processa a fila assim
// que chega.
window.va = window.va || function () { 
  (window.vaq = window.vaq || []).push(arguments); 
};
