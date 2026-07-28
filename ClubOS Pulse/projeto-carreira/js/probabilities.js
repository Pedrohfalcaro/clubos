/**
 * Pesos de categoria, raridade e modificadores de personalidade/idade.
 */
var Probabilities = (() => {
  const CATEGORIA_PESOS = {
    atleta: 30,
    diretoria: 15,
    torcida: 15,
    imprensa: 12,
    lesao: 10,
    financeiro: 6,
    familia: 5,
    transferencia: 4,
    patrocinio: 2,
    escandalo: 1,
  };

  const RARIDADE_PESOS = {
    comum: 55,
    incomum: 28,
    raro: 13,
    "muito-raro": 4,
  };

  /** Preferências de categoria por personalidade (multiplicadores). */
  const PERSONALIDADE_MODS = {
    Líder: { atleta: 1.2, diretoria: 1.15, torcida: 1.1 },
    Veterano: { familia: 1.3, lesao: 1.2, atleta: 1.1 },
    Promessa: { transferencia: 1.35, imprensa: 1.2, atleta: 1.15 },
    Temperamental: { escandalo: 1.5, imprensa: 1.25, torcida: 1.15 },
    Vaidoso: { imprensa: 1.4, patrocinio: 1.3, escandalo: 1.2 },
    Ambicioso: { transferencia: 1.4, financeiro: 1.2, diretoria: 1.1 },
    Reservado: { familia: 1.2, atleta: 1.1, escandalo: 0.6 },
    Disciplinado: { atleta: 1.2, lesao: 0.85, escandalo: 0.5 },
  };

  /** Preferências por faixa etária. */
  const IDADE_MODS = {
    jovem: { transferencia: 1.25, atleta: 1.15, familia: 0.8, lesao: 0.9 },
    pico: { transferencia: 1.15, diretoria: 1.1, imprensa: 1.1 },
    veterano: { familia: 1.35, lesao: 1.3, transferencia: 0.7, atleta: 1.1 },
  };

  function pesoCategoria(categoria, atletasContexto) {
    let base = CATEGORIA_PESOS[categoria] || 1;
    if (!atletasContexto || atletasContexto.length === 0) return base;

    let modSum = 0;
    atletasContexto.forEach((a) => {
      const pMods = PERSONALIDADE_MODS[a.personalidade] || {};
      const band = Utils.ageBand(a.idade);
      const iMods = IDADE_MODS[band] || {};
      const m = (pMods[categoria] || 1) * (iMods[categoria] || 1);
      modSum += m;
    });
    const avg = modSum / atletasContexto.length;
    return base * avg;
  }

  function escolherCategoria(atletasContexto, recentCategories) {
    const cats = Object.keys(CATEGORIA_PESOS);
    const last3 = (recentCategories || []).slice(-3);
    const sameStreak =
      last3.length === 3 && last3.every((c) => c === last3[0]) ? last3[0] : null;

    return Utils.pickWeighted(cats, (cat) => {
      let w = pesoCategoria(cat, atletasContexto);
      if (sameStreak && cat === sameStreak) w *= 0.15;
      if (last3[last3.length - 1] === cat) w *= 0.55;
      return w;
    });
  }

  function escolherRaridade() {
    const keys = Object.keys(RARIDADE_PESOS);
    return Utils.pickWeighted(keys, (k) => RARIDADE_PESOS[k]);
  }

  return {
    CATEGORIA_PESOS,
    RARIDADE_PESOS,
    PERSONALIDADE_MODS,
    IDADE_MODS,
    pesoCategoria,
    escolherCategoria,
    escolherRaridade,
  };
})();
