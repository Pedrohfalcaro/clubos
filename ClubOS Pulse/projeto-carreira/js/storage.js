/**
 * Persistência via LocalStorage + export/import JSON.
 */
var Storage = (() => {
  const KEY = "gerador_carreira_v1";
  const VERSION = 1;

  function defaultState() {
    return {
      version: VERSION,
      club: null,
      athletes: [],
      settings: {
        chanceEvento: 0.28,
        cooldownEventos: 20,
        animacoes: true,
      },
      history: [],
      cooldowns: {},
      chains: { active: [] },
    };
  }

  function carregar() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return migrar(parsed);
    } catch (e) {
      console.warn("Falha ao carregar save:", e);
      return defaultState();
    }
  }

  function migrar(data) {
    const base = defaultState();
    if (!data || typeof data !== "object") return base;

    const state = {
      version: VERSION,
      club: data.club || null,
      athletes: Array.isArray(data.athletes) ? data.athletes : [],
      settings: { ...base.settings, ...(data.settings || {}) },
      history: Array.isArray(data.history) ? data.history : [],
      cooldowns: data.cooldowns && typeof data.cooldowns === "object" ? data.cooldowns : {},
      chains: data.chains && Array.isArray(data.chains.active)
        ? data.chains
        : { active: [] },
    };

    state.settings.chanceEvento = Utils.clamp(Number(state.settings.chanceEvento) || 0.28, 0.1, 0.6);
    state.settings.cooldownEventos = Utils.clamp(Number(state.settings.cooldownEventos) || 20, 5, 50);
    state.settings.animacoes = state.settings.animacoes !== false;

    return state;
  }

  function salvar(state) {
    const toSave = { ...state, version: VERSION };
    localStorage.setItem(KEY, JSON.stringify(toSave));
    return toSave;
  }

  function resetar() {
    localStorage.removeItem(KEY);
    return defaultState();
  }

  function exportarJSON(state) {
    const payload = {
      version: VERSION,
      exportedAt: new Date().toISOString(),
      club: state.club,
      athletes: state.athletes,
      settings: state.settings,
      history: state.history,
      cooldowns: state.cooldowns,
      chains: state.chains,
    };
    return JSON.stringify(payload, null, 2);
  }

  function validarImport(data) {
    if (!data || typeof data !== "object") {
      return { ok: false, erro: "Arquivo inválido." };
    }
    if (data.club != null) {
      if (typeof data.club !== "object" || !data.club.nome) {
        return { ok: false, erro: "Clube inválido no arquivo." };
      }
    }
    if (data.athletes != null && !Array.isArray(data.athletes)) {
      return { ok: false, erro: "Elenco inválido no arquivo." };
    }
    if (data.history != null && !Array.isArray(data.history)) {
      return { ok: false, erro: "Histórico inválido no arquivo." };
    }
    if (data.settings != null && typeof data.settings !== "object") {
      return { ok: false, erro: "Configurações inválidas no arquivo." };
    }
    return { ok: true };
  }

  function importarJSON(jsonString) {
    let data;
    try {
      data = typeof jsonString === "string" ? JSON.parse(jsonString) : jsonString;
    } catch {
      return { ok: false, erro: "JSON malformado." };
    }
    const check = validarImport(data);
    if (!check.ok) return check;
    const state = migrar(data);
    salvar(state);
    return { ok: true, state };
  }

  function temClube(state) {
    return !!(state && state.club && state.club.nome);
  }

  return {
    KEY,
    VERSION,
    defaultState,
    carregar,
    salvar,
    resetar,
    exportarJSON,
    importarJSON,
    validarImport,
    temClube,
  };
})();
