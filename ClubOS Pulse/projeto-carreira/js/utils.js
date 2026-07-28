/**
 * Utilitários gerais do Gerador de Eventos.
 */
var Utils = (() => {
  function uid(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pickWeighted(items, weightFn) {
    if (!items || items.length === 0) return null;
    let total = 0;
    const weights = items.map((item) => {
      const w = Math.max(0, weightFn(item));
      total += w;
      return w;
    });
    if (total <= 0) return items[Math.floor(Math.random() * items.length)];
    let roll = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function pickRandom(items) {
    if (!items || items.length === 0) return null;
    return items[Math.floor(Math.random() * items.length)];
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  /** Substitui {{chave}} no texto. */
  function template(str, vars) {
    if (!str) return "";
    return String(str).replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return vars[key] != null ? String(vars[key]) : "";
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function ageBand(idade) {
    if (idade == null || idade === "") return "qualquer";
    const n = Number(idade);
    if (n <= 21) return "jovem";
    if (n <= 29) return "pico";
    return "veterano";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const POSICOES = ["GOL", "ZAG", "LE", "LD", "VOL", "MC", "ME", "MD", "PE", "PD", "ATA"];

  const PERSONALIDADES = [
    "Líder",
    "Veterano",
    "Promessa",
    "Temperamental",
    "Vaidoso",
    "Ambicioso",
    "Reservado",
    "Disciplinado",
  ];

  const STATUS_LABELS = {
    disponivel: "Disponível",
    lesionado: "Lesionado",
    indisponivel: "Indisponível",
  };

  const CATEGORIA_LABELS = {
    atleta: "Atleta",
    diretoria: "Diretoria",
    torcida: "Torcida",
    imprensa: "Imprensa",
    lesao: "Lesão",
    familia: "Família",
    financeiro: "Financeiro",
    transferencia: "Transferência",
    patrocinio: "Patrocínio",
    escandalo: "Escândalo",
  };

  const RARIDADE_LABELS = {
    comum: "Comum",
    incomum: "Incomum",
    raro: "Raro",
    "muito-raro": "Muito raro",
  };

  return {
    uid,
    clamp,
    pickWeighted,
    pickRandom,
    formatDate,
    template,
    sleep,
    ageBand,
    escapeHtml,
    POSICOES,
    PERSONALIDADES,
    STATUS_LABELS,
    CATEGORIA_LABELS,
    RARIDADE_LABELS,
  };
})();
