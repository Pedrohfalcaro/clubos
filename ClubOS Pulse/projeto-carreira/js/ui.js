/**
 * Renderização e interação das telas.
 */
var UI = (() => {
  let state = null;
  let onChange = null;
  let toastTimer = null;
  let setupDraft = [];

  function init(initialState, changeCb) {
    state = initialState;
    onChange = changeCb;
    bindGlobal();
    route();
  }

  function setState(next, persist = true) {
    state = next;
    if (persist) Storage.salvar(state);
    if (onChange) onChange(state);
  }

  function getState() {
    return state;
  }

  function toast(msg, type = "info") {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = `toast toast--${type} toast--show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove("toast--show");
    }, 2800);
  }

  function showScreen(id) {
    document.querySelectorAll("[data-screen]").forEach((s) => {
      s.hidden = s.getAttribute("data-screen") !== id;
    });
    document.querySelectorAll(".nav__btn").forEach((btn) => {
      const target = btn.getAttribute("data-nav");
      btn.classList.toggle("is-active", target === id);
      btn.setAttribute("aria-current", target === id ? "page" : "false");
    });
    const nav = document.getElementById("main-nav");
    if (nav) nav.hidden = id === "setup";
  }

  function route() {
    if (!Storage.temClube(state)) {
      showScreen("setup");
      renderSetup();
      return;
    }
    showScreen("home");
    renderHome();
  }

  function bindGlobal() {
    document.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-nav");
        if (!Storage.temClube(state) && id !== "setup") {
          toast("Configure o clube primeiro.", "warn");
          return;
        }
        showScreen(id);
        if (id === "home") renderHome();
        if (id === "elenco") renderElenco();
        if (id === "historico") renderHistorico();
        if (id === "config") renderConfig();
      });
    });

    const gerarBtn = document.getElementById("btn-gerar");
    if (gerarBtn) gerarBtn.addEventListener("click", onGerar);

    document.getElementById("btn-setup-add")?.addEventListener("click", () => {
      addSetupRow();
    });
    document.getElementById("btn-setup-exemplo")?.addEventListener("click", () => {
      setupDraft = Athletes.elencoExemplo().map((a) => ({
        nome: a.nome,
        posicao: a.posicao,
        idade: a.idade,
      }));
      renderSetupRows();
      toast("Elenco de exemplo carregado.", "ok");
    });
    document.getElementById("form-setup")?.addEventListener("submit", onSetupSubmit);

    document.getElementById("btn-elenco-add")?.addEventListener("click", () => openElencoForm());
    document.getElementById("btn-elenco-cancel")?.addEventListener("click", closeElencoForm);
    document.getElementById("form-elenco")?.addEventListener("submit", onElencoSubmit);
    document.getElementById("elenco-lista")?.addEventListener("click", onElencoClick);

    document.getElementById("historico-lista")?.addEventListener("click", (e) => {
      const item = e.target.closest("[data-hist-id]");
      if (!item) return;
      const entry = (state.history || []).find((h) => h.id === item.getAttribute("data-hist-id"));
      if (entry) openEventModal(entry);
    });
    document.getElementById("historico-lista")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const item = e.target.closest("[data-hist-id]");
      if (!item) return;
      e.preventDefault();
      const entry = (state.history || []).find((h) => h.id === item.getAttribute("data-hist-id"));
      if (entry) openEventModal(entry);
    });

    document.getElementById("hist-filtro-temporada")?.addEventListener("change", renderHistorico);
    document.getElementById("hist-filtro-categoria")?.addEventListener("change", renderHistorico);
    document.getElementById("hist-filtro-atleta")?.addEventListener("change", renderHistorico);

    document.getElementById("form-config")?.addEventListener("submit", onConfigSave);
    document.getElementById("btn-avancar-temporada")?.addEventListener("click", () => {
      setState(Settings.avancarTemporada(state));
      renderConfig();
      toast(`Temporada ${state.club.temporadaAtual} iniciada.`, "ok");
    });
    document.getElementById("btn-export")?.addEventListener("click", onExport);
    document.getElementById("btn-import")?.addEventListener("click", () => {
      document.getElementById("input-import")?.click();
    });
    document.getElementById("input-import")?.addEventListener("change", onImport);
    document.getElementById("btn-reset")?.addEventListener("click", onReset);

    document.getElementById("chance-range")?.addEventListener("input", (e) => {
      const label = document.getElementById("chance-label");
      if (label) label.textContent = `${Math.round(Number(e.target.value))}%`;
    });

    document.getElementById("home-ultimo")?.addEventListener("click", onUltimoClick);
    document.getElementById("home-ultimo")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onUltimoClick();
      }
    });

    const modal = document.getElementById("event-modal");
    modal?.querySelectorAll("[data-modal-close]").forEach((el) => {
      el.addEventListener("click", closeEventModal);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeEventModal();
    });
  }

  function impactosDeEntrada(entry) {
    if (!entry) return [];
    if (Array.isArray(entry.impactos) && entry.impactos.length) return entry.impactos;
    if (entry.eventoId) {
      const ev = Events.getById(entry.eventoId);
      if (ev) {
        let atleta = entry.atletaId
          ? Athletes.getById(state.athletes, entry.atletaId)
          : null;
        if (!atleta && entry.atletaNome) {
          atleta = { nome: entry.atletaNome, posicao: "" };
        }
        const vars = Athletes.varsTemplate(state.club, atleta);
        return Events.resolverImpactos(ev, vars);
      }
    }
    if (entry.categoria === "nenhum") {
      return ["Sem mudanças no elenco ou no clima do clube"];
    }
    return [];
  }

  function htmlImpactos(impactos) {
    if (!impactos || !impactos.length) return "";
    return `
      <div class="impactos">
        <p class="impactos__label">O que isso impacta</p>
        <ul class="impactos__list">
          ${impactos
            .map((i) => `<li>${Utils.escapeHtml(i)}</li>`)
            .join("")}
        </ul>
      </div>`;
  }

  function htmlDetalheEvento(entry) {
    if (!entry) return "";
    const impactos = impactosDeEntrada(entry);

    if (entry.categoria === "nenhum") {
      return `
        <p class="eyebrow">Pré-partida</p>
        <h2 id="modal-title" class="result-card__title">Nada aconteceu</h2>
        <p class="result-card__desc">${Utils.escapeHtml(entry.descricao)}</p>
        ${htmlImpactos(impactos)}
        <p class="muted">${Utils.escapeHtml(Utils.formatDate(entry.data))} · Temporada ${Utils.escapeHtml(String(entry.temporada))}</p>`;
    }

    const cat = Utils.CATEGORIA_LABELS[entry.categoria] || entry.categoria;
    const rar = entry.raridade
      ? Utils.RARIDADE_LABELS[entry.raridade] || entry.raridade
      : null;
    const atleta =
      entry.atletaNome ||
      (entry.atletaId ? Athletes.getById(state.athletes, entry.atletaId)?.nome : null);
    const chain = entry.cadeiaId
      ? `<p class="result-card__chain">Continuidade de uma história anterior</p>`
      : "";

    return `
      <div class="result-card__meta">
        <span class="badge">${Utils.escapeHtml(cat)}</span>
        ${rar ? `<span class="badge badge--muted">${Utils.escapeHtml(rar)}</span>` : ""}
      </div>
      ${chain}
      <h2 id="modal-title" class="result-card__title">${Utils.escapeHtml(entry.titulo)}</h2>
      <p class="result-card__desc">${Utils.escapeHtml(entry.descricao)}</p>
      ${htmlImpactos(impactos)}
      ${
        atleta
          ? `<p class="result-card__athlete">Envolvido: <strong>${Utils.escapeHtml(atleta)}</strong></p>`
          : ""
      }
      <p class="muted">${Utils.escapeHtml(Utils.formatDate(entry.data))} · Temporada ${Utils.escapeHtml(String(entry.temporada))}</p>`;
  }

  function openEventModal(entry) {
    const modal = document.getElementById("event-modal");
    const content = document.getElementById("modal-content");
    if (!modal || !content || !entry) return;
    content.innerHTML = htmlDetalheEvento(entry);
    modal.hidden = false;
    document.body.classList.add("modal-open");
    modal.querySelector(".modal__close")?.focus();
  }

  function closeEventModal() {
    const modal = document.getElementById("event-modal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function onUltimoClick() {
    const last = (state.history || [])[0];
    if (!last) return;
    openEventModal(last);
  }

  // ——— SETUP ———
  function renderSetup() {
    if (setupDraft.length === 0) {
      setupDraft = [{ nome: "", posicao: "MC", idade: "" }];
    }
    renderSetupRows();
  }

  function addSetupRow() {
    setupDraft.push({ nome: "", posicao: "MC", idade: "" });
    renderSetupRows();
  }

  function renderSetupRows() {
    const box = document.getElementById("setup-atletas");
    if (!box) return;
    box.innerHTML = setupDraft
      .map(
        (row, i) => `
      <div class="athlete-row" data-setup-index="${i}">
        <input type="text" name="nome" placeholder="Nome" value="${Utils.escapeHtml(row.nome || "")}" required maxlength="40" aria-label="Nome do atleta" />
        <select name="posicao" aria-label="Posição">
          ${Utils.POSICOES.map(
            (p) => `<option value="${p}" ${row.posicao === p ? "selected" : ""}>${p}</option>`
          ).join("")}
        </select>
        <input type="number" name="idade" placeholder="Idade" min="15" max="45" value="${row.idade ?? ""}" aria-label="Idade" />
        <button type="button" class="btn btn--ghost btn--icon" data-setup-remove="${i}" aria-label="Remover atleta">×</button>
      </div>`
      )
      .join("");

    box.querySelectorAll("[data-setup-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-setup-remove"));
        if (setupDraft.length <= 1) {
          toast("Mantenha ao menos um atleta.", "warn");
          return;
        }
        setupDraft.splice(idx, 1);
        syncSetupDraftFromDom();
        renderSetupRows();
      });
    });

    box.querySelectorAll("input, select").forEach((el) => {
      el.addEventListener("change", syncSetupDraftFromDom);
      el.addEventListener("input", syncSetupDraftFromDom);
    });
  }

  function syncSetupDraftFromDom() {
    const rows = document.querySelectorAll("#setup-atletas .athlete-row");
    setupDraft = Array.from(rows).map((row) => ({
      nome: row.querySelector('[name="nome"]').value,
      posicao: row.querySelector('[name="posicao"]').value,
      idade: row.querySelector('[name="idade"]').value,
    }));
  }

  function onSetupSubmit(e) {
    e.preventDefault();
    syncSetupDraftFromDom();
    const nomeClube = document.getElementById("setup-clube").value.trim();
    if (!nomeClube) {
      toast("Informe o nome do clube.", "warn");
      return;
    }
    const athletes = [];
    for (const row of setupDraft) {
      if (!row.nome.trim() || !row.posicao) {
        toast("Preencha nome e posição de todos os atletas.", "warn");
        return;
      }
      athletes.push(Athletes.criar(row));
    }
    if (athletes.length === 0) {
      toast("Cadastre ao menos um atleta.", "warn");
      return;
    }

    const next = {
      ...Storage.defaultState(),
      club: {
        nome: nomeClube,
        temporadaAtual: 1,
        partidasGeradas: 0,
      },
      athletes,
      settings: state.settings || Storage.defaultState().settings,
    };
    setState(next);
    toast("Clube salvo. Boa temporada!", "ok");
    showScreen("home");
    renderHome();
  }

  // ——— HOME ———
  function renderHome() {
    const club = state.club;
    document.getElementById("home-clube").textContent = club.nome;
    document.getElementById("home-meta").textContent =
      `Temporada ${club.temporadaAtual} · ${state.athletes.length} atletas · ${club.partidasGeradas || 0} partidas`;

    const last = (state.history || [])[0] || null;
    const lastBox = document.getElementById("home-ultimo");
    if (!last) {
      lastBox.classList.remove("last-box--clickable");
      lastBox.removeAttribute("role");
      lastBox.removeAttribute("tabindex");
      lastBox.removeAttribute("aria-label");
      lastBox.innerHTML = `<p class="muted">Nenhum evento ainda. Gere o primeiro antes da partida.</p>`;
    } else if (last.categoria === "nenhum") {
      lastBox.classList.add("last-box--clickable");
      lastBox.setAttribute("role", "button");
      lastBox.setAttribute("tabindex", "0");
      lastBox.setAttribute("aria-label", "Abrir detalhes do último resultado");
      lastBox.innerHTML = `
        <p class="eyebrow">Último resultado · toque para detalhes</p>
        <p class="last-title">Nada aconteceu</p>
        <p class="muted">${Utils.escapeHtml(Utils.formatDate(last.data))}</p>`;
    } else {
      lastBox.classList.add("last-box--clickable");
      lastBox.setAttribute("role", "button");
      lastBox.setAttribute("tabindex", "0");
      lastBox.setAttribute("aria-label", `Abrir detalhes: ${last.titulo}`);
      const previewImpact = impactosDeEntrada(last)[0];
      lastBox.innerHTML = `
        <p class="eyebrow">Último evento · ${Utils.escapeHtml(Utils.CATEGORIA_LABELS[last.categoria] || last.categoria)} · toque para detalhes</p>
        <p class="last-title">${Utils.escapeHtml(last.titulo)}</p>
        ${previewImpact ? `<p class="last-impact">${Utils.escapeHtml(previewImpact)}</p>` : ""}
        <p class="muted">${Utils.escapeHtml(Utils.formatDate(last.data))}</p>`;
    }

    const result = document.getElementById("resultado");
    if (result && !result.dataset.keep) {
      result.hidden = true;
      result.innerHTML = "";
    }
  }

  async function onGerar() {
    const btn = document.getElementById("btn-gerar");
    const result = document.getElementById("resultado");
    const loading = document.getElementById("loading");
    if (!btn || !result) return;

    btn.disabled = true;
    result.hidden = true;
    result.dataset.keep = "";
    if (loading) {
      loading.hidden = false;
      loading.classList.toggle("is-animated", !!state.settings.animacoes);
    }

    const delay = state.settings.animacoes ? 1000 + Math.random() * 1000 : 200;
    await Utils.sleep(delay);

    const { state: next, resultado } = Generator.gerarEvento(state);
    setState(next);

    if (loading) loading.hidden = true;
    renderResultado(resultado);
    renderHome();
    result.dataset.keep = "1";
    btn.disabled = false;
    btn.focus();
  }

  function renderResultado(resultado) {
    const el = document.getElementById("resultado");
    if (!el) return;
    el.hidden = false;

    if (resultado.tipo === "nada" || resultado.categoria === "nenhum") {
      el.className = "result-card result-card--nada";
      el.innerHTML = `
        <p class="eyebrow">Pré-partida</p>
        <h2 class="result-card__title">Nada aconteceu</h2>
        <p class="result-card__desc">Nada aconteceu antes desta partida.</p>
        ${htmlImpactos(resultado.impactos || ["Sem mudanças no elenco ou no clima do clube"])}`;
      return;
    }

    const cat = Utils.CATEGORIA_LABELS[resultado.categoria] || resultado.categoria;
    const rar = Utils.RARIDADE_LABELS[resultado.raridade] || resultado.raridade;
    const chain = resultado.cadeiaId
      ? `<p class="result-card__chain">Continuidade de uma história anterior</p>`
      : "";

    el.className = `result-card result-card--${resultado.raridade || "comum"}`;
    el.innerHTML = `
      <div class="result-card__meta">
        <span class="badge">${Utils.escapeHtml(cat)}</span>
        <span class="badge badge--muted">${Utils.escapeHtml(rar)}</span>
      </div>
      ${chain}
      <h2 class="result-card__title">${Utils.escapeHtml(resultado.titulo)}</h2>
      <p class="result-card__desc">${Utils.escapeHtml(resultado.descricao)}</p>
      ${htmlImpactos(resultado.impactos)}
      ${
        resultado.atletaNome
          ? `<p class="result-card__athlete">Envolvido: <strong>${Utils.escapeHtml(resultado.atletaNome)}</strong></p>`
          : ""
      }`;
  }

  // ——— ELENCO ———
  function fillPosicaoSelect(selected) {
    const sel = document.getElementById("elenco-posicao");
    if (!sel) return;
    sel.innerHTML = Utils.POSICOES.map(
      (p) => `<option value="${p}" ${selected === p ? "selected" : ""}>${p}</option>`
    ).join("");
  }

  function openElencoForm(athlete) {
    const form = document.getElementById("form-elenco");
    if (!form) return;
    form.hidden = false;
    document.getElementById("elenco-form-title").textContent = athlete
      ? "Editar atleta"
      : "Novo atleta";
    document.getElementById("elenco-edit-id").value = athlete ? athlete.id : "";
    document.getElementById("elenco-nome").value = athlete ? athlete.nome : "";
    fillPosicaoSelect(athlete ? athlete.posicao : "MC");
    document.getElementById("elenco-idade").value =
      athlete && athlete.idade != null ? athlete.idade : "";
    document.getElementById("elenco-status").value = athlete
      ? athlete.status
      : "disponivel";
    document.getElementById("elenco-status").disabled = !athlete;
    document.getElementById("elenco-nome").focus();
  }

  function closeElencoForm() {
    const form = document.getElementById("form-elenco");
    if (form) form.hidden = true;
  }

  function renderElenco() {
    document.getElementById("elenco-clube").textContent = state.club.nome;
    const list = document.getElementById("elenco-lista");
    if (!list) return;

    if (!state.athletes.length) {
      list.innerHTML = `<p class="muted">Nenhum atleta cadastrado.</p>`;
      return;
    }

    list.innerHTML = state.athletes
      .map((a) => {
        const st = Utils.STATUS_LABELS[a.status] || a.status;
        return `
        <article class="athlete-card" data-id="${a.id}">
          <div class="athlete-card__main">
            <h3>${Utils.escapeHtml(a.nome)}</h3>
            <p class="muted">${Utils.escapeHtml(a.posicao)}${a.idade != null ? ` · ${a.idade} anos` : ""}</p>
            <div class="athlete-card__stats">
              <span class="badge badge--status badge--${a.status}">${Utils.escapeHtml(st)}</span>
              <span class="stat">Moral ${a.moral}</span>
              <span class="stat">Fadiga ${a.fadiga}</span>
            </div>
          </div>
          <div class="athlete-card__actions">
            <button type="button" class="btn btn--ghost" data-edit="${a.id}">Editar</button>
            <button type="button" class="btn btn--ghost btn--danger" data-remove="${a.id}">Remover</button>
          </div>
        </article>`;
      })
      .join("");
  }

  function onElencoSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("elenco-edit-id").value;
    const nome = document.getElementById("elenco-nome").value.trim();
    const posicao = document.getElementById("elenco-posicao").value;
    const idadeRaw = document.getElementById("elenco-idade").value;
    const status = document.getElementById("elenco-status").value;

    if (!nome || !posicao) {
      toast("Preencha nome e posição.", "warn");
      return;
    }

    if (id) {
      const nextAthletes = state.athletes.map((x) => {
        if (x.id !== id) return x;
        return {
          ...x,
          nome,
          posicao,
          idade: idadeRaw === "" ? null : Utils.clamp(Number(idadeRaw), 15, 45),
          status,
        };
      });
      setState({ ...state, athletes: nextAthletes });
      toast("Atleta atualizado.", "ok");
    } else {
      const athlete = Athletes.criar({ nome, posicao, idade: idadeRaw });
      setState({ ...state, athletes: [...state.athletes, athlete] });
      toast("Atleta adicionado.", "ok");
    }
    closeElencoForm();
    renderElenco();
  }

  function onElencoClick(e) {
    const removeId = e.target.getAttribute("data-remove");
    const editId = e.target.getAttribute("data-edit");

    if (removeId) {
      if (state.athletes.length <= 1) {
        toast("Mantenha ao menos um atleta.", "warn");
        return;
      }
      if (!confirm("Remover este atleta?")) return;
      setState({
        ...state,
        athletes: state.athletes.filter((a) => a.id !== removeId),
      });
      renderElenco();
      toast("Atleta removido.", "ok");
      return;
    }

    if (editId) {
      const a = Athletes.getById(state.athletes, editId);
      if (a) openElencoForm(a);
    }
  }

  // ——— HISTÓRICO ———
  function renderHistorico() {
    const tempSel = document.getElementById("hist-filtro-temporada");
    const catSel = document.getElementById("hist-filtro-categoria");
    const atlSel = document.getElementById("hist-filtro-atleta");

    const temps = History.temporadas(state);
    const curTemp = tempSel.value;
    tempSel.innerHTML =
      `<option value="">Todas as temporadas</option>` +
      temps.map((t) => `<option value="${t}">Temporada ${t}</option>`).join("");
    if ([...tempSel.options].some((o) => o.value === curTemp)) tempSel.value = curTemp;

    const curCat = catSel.value;
    catSel.innerHTML =
      `<option value="">Todas as categorias</option>` +
      Object.entries(Utils.CATEGORIA_LABELS)
        .map(([k, v]) => `<option value="${k}">${v}</option>`)
        .join("") +
      `<option value="nenhum">Nada aconteceu</option>`;
    if ([...catSel.options].some((o) => o.value === curCat)) catSel.value = curCat;

    const curAtl = atlSel.value;
    atlSel.innerHTML =
      `<option value="">Todos os atletas</option>` +
      state.athletes
        .map((a) => `<option value="${a.id}">${Utils.escapeHtml(a.nome)}</option>`)
        .join("");
    if ([...atlSel.options].some((o) => o.value === curAtl)) atlSel.value = curAtl;

    const filtros = {
      temporada: tempSel.value || null,
      categoria: catSel.value || null,
      atletaId: atlSel.value || null,
    };
    const list = History.listar(state, filtros);
    const box = document.getElementById("historico-lista");

    if (!list.length) {
      box.innerHTML = `<p class="muted">Nenhum registro encontrado.</p>`;
      return;
    }

    box.innerHTML = list
      .map((h) => {
        const cat =
          h.categoria === "nenhum"
            ? "Pré-partida"
            : Utils.CATEGORIA_LABELS[h.categoria] || h.categoria;
        const atleta =
          h.atletaNome ||
          (h.atletaId ? Athletes.getById(state.athletes, h.atletaId)?.nome : null);
        const impact = impactosDeEntrada(h)[0];
        return `
        <article class="hist-item hist-item--clickable" data-hist-id="${h.id}" role="button" tabindex="0" aria-label="Abrir detalhes: ${Utils.escapeHtml(h.titulo)}">
          <div class="hist-item__top">
            <span class="badge">${Utils.escapeHtml(cat)}</span>
            <time datetime="${h.data}">${Utils.escapeHtml(Utils.formatDate(h.data))}</time>
          </div>
          <h3>${Utils.escapeHtml(h.titulo)}</h3>
          <p>${Utils.escapeHtml(h.descricao)}</p>
          ${impact ? `<p class="last-impact">${Utils.escapeHtml(impact)}</p>` : ""}
          <p class="muted">Temporada ${Utils.escapeHtml(String(h.temporada))}${
            atleta ? ` · ${Utils.escapeHtml(atleta)}` : ""
          } · toque para detalhes</p>
        </article>`;
      })
      .join("");
  }

  // ——— CONFIG ———
  function renderConfig() {
    const chance = Math.round((state.settings.chanceEvento || 0.28) * 100);
    const range = document.getElementById("chance-range");
    const label = document.getElementById("chance-label");
    if (range) range.value = chance;
    if (label) label.textContent = `${chance}%`;
    document.getElementById("cfg-animacoes").checked = !!state.settings.animacoes;
    document.getElementById("cfg-temporada").value = state.club.temporadaAtual;
    document.getElementById("cfg-info").textContent =
      `${state.club.nome} · ${state.athletes.length} atletas · ${Events.contagem().total} eventos no banco`;
  }

  function onConfigSave(e) {
    e.preventDefault();
    const chance = Number(document.getElementById("chance-range").value) / 100;
    const animacoes = document.getElementById("cfg-animacoes").checked;
    const temporada = Number(document.getElementById("cfg-temporada").value);
    let next = Settings.atualizar(state, { chanceEvento: chance, animacoes });
    next = Settings.definirTemporada(next, temporada);
    setState(next);
    toast("Configurações salvas.", "ok");
    renderConfig();
  }

  function onExport() {
    const json = Storage.exportarJSON(state);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carreira_${(state.club && state.club.nome) || "save"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Save exportado.", "ok");
  }

  function onImport(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = Storage.importarJSON(String(reader.result));
      if (!result.ok) {
        toast(result.erro || "Falha ao importar.", "warn");
        return;
      }
      setState(result.state, false);
      Storage.salvar(state);
      toast("Save importado com sucesso.", "ok");
      route();
    };
    reader.onerror = () => toast("Não foi possível ler o arquivo.", "warn");
    reader.readAsText(file);
  }

  function onReset() {
    if (!confirm("Isso apaga clube, elenco e histórico. Continuar?")) return;
    if (!confirm("Confirma o reset completo?")) return;
    state = Storage.resetar();
    setupDraft = [];
    toast("Dados resetados.", "ok");
    showScreen("setup");
    renderSetup();
  }

  return {
    init,
    getState,
    setState,
    toast,
    route,
    renderHome,
    renderElenco,
    renderHistorico,
    renderConfig,
  };
})();
