/**
 * Boot da aplicação — Gerador de Eventos Modo Carreira
 */
(function boot() {
  const state = Storage.carregar();
  UI.init(state, () => {
    // hook para debug futuro
  });
})();
