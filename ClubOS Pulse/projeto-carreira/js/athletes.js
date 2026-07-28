/**
 * Lógica de atletas: criação, seleção, efeitos e elenco de exemplo.
 */
var Athletes = (() => {
  function criar({ nome, posicao, idade }) {
    const idadeNum =
      idade === "" || idade == null || Number.isNaN(Number(idade))
        ? null
        : Utils.clamp(Number(idade), 15, 45);

    return {
      id: Utils.uid("atl"),
      nome: String(nome).trim(),
      posicao: String(posicao).trim().toUpperCase(),
      idade: idadeNum,
      personalidade: Utils.pickRandom(Utils.PERSONALIDADES),
      moral: 100,
      fadiga: 0,
      status: "disponivel",
    };
  }

  function elencoExemplo() {
    const base = [
      { nome: "Carlos Mendes", posicao: "GOL", idade: 31 },
      { nome: "Rafael Costa", posicao: "ZAG", idade: 28 },
      { nome: "Bruno Silva", posicao: "ZAG", idade: 24 },
      { nome: "Diego Alves", posicao: "LE", idade: 22 },
      { nome: "Lucas Ferreira", posicao: "LD", idade: 26 },
      { nome: "André Souza", posicao: "VOL", idade: 29 },
      { nome: "Pedro Nunes", posicao: "MC", idade: 21 },
      { nome: "Thiago Rocha", posicao: "ME", idade: 20 },
      { nome: "Felipe Santos", posicao: "MD", idade: 25 },
      { nome: "Gabriel Lima", posicao: "PE", idade: 19 },
      { nome: "Matheus Oliveira", posicao: "PD", idade: 23 },
      { nome: "João Pedro", posicao: "ATA", idade: 27 },
      { nome: "Igor Martins", posicao: "ATA", idade: 18 },
      { nome: "Henrique Dias", posicao: "VOL", idade: 33 },
      { nome: "Caio Barbosa", posicao: "MC", idade: 30 },
    ];
    return base.map((a) => criar(a));
  }

  function getById(athletes, id) {
    return (athletes || []).find((a) => a.id === id) || null;
  }

  function eventoCombinaTags(evento, atleta) {
    const tags = evento.tags || {};
    if (tags.status && tags.status.length && !tags.status.includes(atleta.status)) {
      return false;
    }
    if (tags.posicoes && tags.posicoes.length && !tags.posicoes.includes(atleta.posicao)) {
      return false;
    }
    if (tags.personalidades && tags.personalidades.length) {
      if (!tags.personalidades.includes(atleta.personalidade)) return false;
    }
    if (tags.idades && tags.idades.length) {
      const band = Utils.ageBand(atleta.idade);
      if (band === "qualquer" || !tags.idades.includes(band)) return false;
    }
    return true;
  }

  function candidatosParaEvento(athletes, evento) {
    const tags = evento.tags || {};
    if (tags.precisaAtleta === false) return [];
    return (athletes || []).filter((a) => eventoCombinaTags(evento, a));
  }

  function selecionarAtleta(athletes, evento) {
    const tags = evento.tags || {};
    if (tags.precisaAtleta === false) return null;

    let pool = candidatosParaEvento(athletes, evento);
    if (pool.length === 0) {
      // fallback: qualquer atleta se o evento precisa de alguém
      if (tags.precisaAtleta) {
        pool = (athletes || []).slice();
        if (tags.status && tags.status.length) {
          const filtered = pool.filter((a) => tags.status.includes(a.status));
          if (filtered.length) pool = filtered;
        }
      }
    }
    if (pool.length === 0) return null;

    return Utils.pickWeighted(pool, (a) => {
      let w = 1;
      // moral baixa aumenta chance em eventos negativos implícitos
      w += (100 - (a.moral || 100)) / 100;
      w += (a.fadiga || 0) / 200;
      return Math.max(0.1, w);
    });
  }

  function aplicarEfeitos(atleta, efeitos) {
    if (!atleta || !efeitos) return atleta;
    const next = { ...atleta };
    if (typeof efeitos.moral === "number") {
      next.moral = Utils.clamp((next.moral || 100) + efeitos.moral, 0, 100);
    }
    if (typeof efeitos.fadiga === "number") {
      next.fadiga = Utils.clamp((next.fadiga || 0) + efeitos.fadiga, 0, 100);
    }
    if (efeitos.status) {
      next.status = efeitos.status;
    }
    return next;
  }

  function varsTemplate(club, atleta) {
    return {
      clube: club && club.nome ? club.nome : "clube",
      atleta: atleta ? atleta.nome : "um atleta",
      posicao: atleta ? atleta.posicao : "",
    };
  }

  return {
    criar,
    elencoExemplo,
    getById,
    eventoCombinaTags,
    candidatosParaEvento,
    selecionarAtleta,
    aplicarEfeitos,
    varsTemplate,
  };
})();
