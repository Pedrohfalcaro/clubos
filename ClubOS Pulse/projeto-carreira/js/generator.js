/**
 * Motor de geração de eventos: roll, categoria, anti-repetição, cadeias, efeitos.
 */
var Generator = (() => {
  function recentEventIds(history, n) {
    return (history || [])
      .filter((h) => h.eventoId)
      .slice(0, n)
      .map((h) => h.eventoId);
  }

  function recentCategories(history, n) {
    return (history || [])
      .filter((h) => h.categoria && h.categoria !== "nenhum")
      .slice(0, n)
      .map((h) => h.categoria)
      .reverse();
  }

  function eventoEmCooldown(state, evento) {
    const last = state.cooldowns && state.cooldowns[evento.id];
    if (last == null) return false;
    const cooldown = evento.cooldown || state.settings.cooldownEventos || 20;
    const usados = (state.history || []).filter((h) => h.eventoId).length;
    return usados - last < cooldown;
  }

  function elegiveis(state, categoria, raridade) {
    const recent = recentEventIds(state.history, state.settings.cooldownEventos || 20);
    let list = Events.filtrarPorCategoria(categoria).filter((e) => {
      if (e.raridade !== raridade) return false;
      if (recent.includes(e.id)) return false;
      if (eventoEmCooldown(state, e)) return false;
      const tags = e.tags || {};
      if (tags.precisaAtleta !== false) {
        const cands = Athletes.candidatosParaEvento(state.athletes, e);
        // se tags estritas e ninguém serve, ainda permite fallback depois
        if (tags.status || tags.posicoes || tags.idades || tags.personalidades) {
          if (cands.length === 0 && state.athletes.length === 0) return false;
        }
      }
      return true;
    });

    if (list.length === 0) {
      list = Events.filtrarPorCategoria(categoria).filter((e) => !recent.includes(e.id));
    }
    if (list.length === 0) {
      list = Events.filtrarPorCategoria(categoria);
    }
    return list;
  }

  function tentarCadeia(state) {
    const active = (state.chains && state.chains.active) || [];
    if (!active.length) return null;

    // prioriza a mais antiga
    const pending = active[0];
    const evento = Events.getById(pending.nextId);
    if (!evento) {
      return { consume: true, pending, result: null };
    }

    let atleta = pending.atletaId
      ? Athletes.getById(state.athletes, pending.atletaId)
      : null;

    if ((evento.tags || {}).precisaAtleta !== false) {
      if (!atleta || !Athletes.eventoCombinaTags(evento, atleta)) {
        atleta = Athletes.selecionarAtleta(state.athletes, evento);
      }
    } else {
      atleta = null;
    }

    return { consume: true, pending, evento, atleta };
  }

  function registrarCadeia(state, evento, atleta) {
    if (!evento.cadeia || !evento.cadeia.nextId) return state;
    const chance = evento.cadeia.chance == null ? 0.3 : evento.cadeia.chance;
    if (Math.random() > chance) return state;

    const chains = {
      active: [
        ...((state.chains && state.chains.active) || []),
        {
          nextId: evento.cadeia.nextId,
          atletaId: atleta ? atleta.id : null,
          fromId: evento.id,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    return { ...state, chains };
  }

  function montarResultado(state, evento, atleta, opts = {}) {
    const vars = Athletes.varsTemplate(state.club, atleta);
    const titulo = Utils.template(evento.titulo, vars);
    const descricao = Utils.template(evento.descricao, vars);
    const impactos = Events.resolverImpactos(evento, vars);

    return {
      tipo: "evento",
      eventoId: evento.id,
      categoria: evento.categoria,
      raridade: evento.raridade,
      titulo,
      descricao,
      impactos,
      atletaId: atleta ? atleta.id : null,
      atletaNome: atleta ? atleta.nome : null,
      cadeiaId: opts.cadeiaId || null,
      temporada: state.club.temporadaAtual,
    };
  }

  function aplicarAoEstado(state, resultado, evento, atleta) {
    let next = { ...state };
    next.athletes = (state.athletes || []).map((a) => ({ ...a }));
    next.history = (state.history || []).slice();
    next.cooldowns = { ...(state.cooldowns || {}) };
    next.chains = {
      active: [...((state.chains && state.chains.active) || [])],
    };
    next.club = { ...state.club };

    next.club.partidasGeradas = (next.club.partidasGeradas || 0) + 1;

    if (resultado.tipo === "evento" && evento) {
      const usados = next.history.filter((h) => h.eventoId).length;
      next.cooldowns[evento.id] = usados;

      if (atleta && evento.efeitos) {
        const idx = next.athletes.findIndex((a) => a.id === atleta.id);
        if (idx >= 0) {
          next.athletes[idx] = Athletes.aplicarEfeitos(next.athletes[idx], evento.efeitos);
        }
      }

      next = registrarCadeia(next, evento, atleta);

      const entry = {
        id: Utils.uid("hist"),
        data: new Date().toISOString(),
        temporada: resultado.temporada,
        categoria: resultado.categoria,
        raridade: resultado.raridade,
        titulo: resultado.titulo,
        descricao: resultado.descricao,
        impactos: resultado.impactos || [],
        atletaId: resultado.atletaId,
        atletaNome: resultado.atletaNome,
        eventoId: resultado.eventoId,
        cadeiaId: resultado.cadeiaId,
      };
      next.history.unshift(entry);
    } else {
      const entry = {
        id: Utils.uid("hist"),
        data: new Date().toISOString(),
        temporada: next.club.temporadaAtual,
        categoria: "nenhum",
        raridade: null,
        titulo: "Nada aconteceu",
        descricao: "Nada aconteceu antes desta partida.",
        impactos: ["Sem mudanças no elenco ou no clima do clube"],
        atletaId: null,
        atletaNome: null,
        eventoId: null,
        cadeiaId: null,
      };
      next.history.unshift(entry);
    }

    if (resultado.tipo === "nada") {
      resultado = {
        ...resultado,
        categoria: "nenhum",
        titulo: "Nada aconteceu",
        descricao: "Nada aconteceu antes desta partida.",
        impactos: ["Sem mudanças no elenco ou no clima do clube"],
      };
    }

    return { state: next, resultado };
  }

  /**
   * Gera um evento (síncrono). Loading fica a cargo da UI.
   */
  function gerarEvento(state) {
    if (!state.club) {
      return { state, resultado: { tipo: "erro", mensagem: "Clube não configurado." } };
    }

    // 1) Cadeias ativas têm prioridade
    const chainTry = tentarCadeia(state);
    if (chainTry && chainTry.consume) {
      let nextState = {
        ...state,
        chains: {
          active: ((state.chains && state.chains.active) || []).slice(1),
        },
      };

      if (chainTry.evento) {
        const resultado = montarResultado(nextState, chainTry.evento, chainTry.atleta, {
          cadeiaId: chainTry.pending.fromId,
        });
        return aplicarAoEstado(nextState, resultado, chainTry.evento, chainTry.atleta);
      }
      // cadeia inválida: segue fluxo normal
      state = nextState;
    }

    // 2) Roll nada vs evento
    const chance = Utils.clamp(state.settings.chanceEvento ?? 0.28, 0.1, 0.6);
    if (Math.random() > chance) {
      return aplicarAoEstado(state, { tipo: "nada" }, null, null);
    }

    // 3) Categoria + raridade + evento
    const catsRecent = recentCategories(state.history, 5);
    const categoria = Probabilities.escolherCategoria(state.athletes, catsRecent);
    let raridade = Probabilities.escolherRaridade();
    let pool = elegiveis(state, categoria, raridade);

    if (pool.length === 0) {
      const order = ["comum", "incomum", "raro", "muito-raro"];
      for (const r of order) {
        pool = elegiveis(state, categoria, r);
        if (pool.length) {
          raridade = r;
          break;
        }
      }
    }

    if (pool.length === 0) {
      return aplicarAoEstado(state, { tipo: "nada" }, null, null);
    }

    const evento = Utils.pickRandom(pool);
    const atleta = Athletes.selecionarAtleta(state.athletes, evento);
    const resultado = montarResultado(state, evento, atleta);
    return aplicarAoEstado(state, resultado, evento, atleta);
  }

  return {
    gerarEvento,
    recentEventIds,
    recentCategories,
  };
})();
