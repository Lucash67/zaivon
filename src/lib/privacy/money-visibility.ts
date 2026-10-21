/**
 * Visibilidade de valores financeiros.
 * Toda carga começa oculta. Revelar vale só na memória desta aba;
 * recarregar zera. Não há leitura de localStorage, sessionStorage ou cookie.
 */

export const MONEY_MASK = "R$ ••••";

export type MoneyVisibility = {
  /** Olhinho geral revelou todas as telas nesta aba. */
  globalRevealed: boolean;
  /** Telas reveladas individualmente enquanto o geral está oculto. */
  revealedScreens: string[];
};

export const INITIAL_MONEY_VISIBILITY: MoneyVisibility = {
  globalRevealed: false,
  revealedScreens: [],
};

export function isMoneyHidden(state: MoneyVisibility, screenId?: string | null): boolean {
  if (state.globalRevealed) return false;
  if (screenId && state.revealedScreens.includes(screenId)) return false;
  return true;
}

export function allMoneyHidden(state: MoneyVisibility): boolean {
  return !state.globalRevealed && state.revealedScreens.length === 0;
}

export function revealAllMoney(): MoneyVisibility {
  return { globalRevealed: true, revealedScreens: [] };
}

export function hideAllMoney(): MoneyVisibility {
  return INITIAL_MONEY_VISIBILITY;
}

/** Alterna uma tela. Se o geral está revelado, ocultar uma tela deixa as outras reveladas. */
export function toggleScreenMoney(state: MoneyVisibility, screenId: string, allScreens: string[]): MoneyVisibility {
  const hidden = isMoneyHidden(state, screenId);
  if (hidden) {
    return {
      globalRevealed: false,
      revealedScreens: state.globalRevealed
        ? allScreens.filter((id) => id !== screenId)
        : Array.from(new Set([...state.revealedScreens, screenId])),
    };
  }
  if (state.globalRevealed) {
    return {
      globalRevealed: false,
      revealedScreens: allScreens.filter((id) => id !== screenId),
    };
  }
  return {
    globalRevealed: false,
    revealedScreens: state.revealedScreens.filter((id) => id !== screenId),
  };
}

export function toggleGlobalMoney(state: MoneyVisibility): MoneyVisibility {
  return allMoneyHidden(state) ? revealAllMoney() : hideAllMoney();
}

/** Chaves antigas que gravavam “visível”. Devem ser apagadas, nunca lidas como preferência. */
export function isLegacyVisibilityKey(key: string): boolean {
  return key === "lbo-hide-money" || key.startsWith("zaivon-hide-money:");
}

const PATRIMONY =
  /saldo informado|saldo observado|saldo final|abertura|DIVERGENTE cofrinho|Observado MP|patrim[oô]nio|Saldo\s+[\d.]{4,}|\d\.\d{3},\d{2}/i;

/** Tira saldo e abertura do cofrinho de um texto mostrado fora do módulo Cofrinho. */
export function redactPatrimonyText(text: string): string {
  const chunks = text
    .split(/\s+—\s+|(?<=\.)\s+/)
    .map((c) => c.trim())
    .filter(Boolean);
  const kept = chunks.filter((c) => !PATRIMONY.test(c));
  if (kept.length === 0) return "A conciliação do cofrinho fica no módulo Cofrinho, sem saldo nesta tela.";
  return kept.join(". ").replace(/\.\./g, ".");
}

/** Mascara valores monetários dentro de frases, tooltips e notas. */
export function maskSensitiveText(text: string, hidden: boolean): string {
  if (!hidden) return text;
  return text
    .replace(/R\$\s*[\d.]+(?:[.,]\d{2})?/g, MONEY_MASK)
    .replace(/(?<![\d/])\d{1,3}(?:\.\d{3})*,\d{2}(?![\d])/g, "••••");
}
