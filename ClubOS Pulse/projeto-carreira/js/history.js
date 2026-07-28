/**
 * Histórico: listagem e filtros.
 */
var History = (() => {
  function listar(state, filtros = {}) {
    let list = (state.history || []).slice();

    if (filtros.temporada) {
      const t = String(filtros.temporada);
      list = list.filter((h) => String(h.temporada) === t);
    }
    if (filtros.categoria) {
      list = list.filter((h) => h.categoria === filtros.categoria);
    }
    if (filtros.atletaId) {
      list = list.filter((h) => h.atletaId === filtros.atletaId);
    }
    if (filtros.somenteEventos) {
      list = list.filter((h) => h.categoria !== "nenhum");
    }

    return list;
  }

  function ultimoEvento(state) {
    const list = (state.history || []).filter((h) => h.categoria !== "nenhum");
    return list[0] || (state.history || [])[0] || null;
  }

  function temporadas(state) {
    const set = new Set();
    (state.history || []).forEach((h) => {
      if (h.temporada != null) set.add(String(h.temporada));
    });
    if (state.club && state.club.temporadaAtual != null) {
      set.add(String(state.club.temporadaAtual));
    }
    return Array.from(set).sort();
  }

  return {
    listar,
    ultimoEvento,
    temporadas,
  };
})();
