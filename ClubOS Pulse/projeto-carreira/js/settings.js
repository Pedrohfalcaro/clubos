/**
 * Configurações do usuário.
 */
var Settings = (() => {
  function atualizar(state, patch) {
    const settings = { ...state.settings, ...patch };
    settings.chanceEvento = Utils.clamp(Number(settings.chanceEvento) || 0.28, 0.1, 0.6);
    settings.cooldownEventos = Utils.clamp(Number(settings.cooldownEventos) || 20, 5, 50);
    settings.animacoes = !!settings.animacoes;
    return { ...state, settings };
  }

  function avancarTemporada(state) {
    if (!state.club) return state;
    const club = {
      ...state.club,
      temporadaAtual: (Number(state.club.temporadaAtual) || 1) + 1,
    };
    return { ...state, club };
  }

  function definirTemporada(state, temporada) {
    if (!state.club) return state;
    const t = Utils.clamp(Number(temporada) || 1, 1, 99);
    return { ...state, club: { ...state.club, temporadaAtual: t } };
  }

  return {
    atualizar,
    avancarTemporada,
    definirTemporada,
  };
})();
