"use client";

import { usePathname } from "next/navigation";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  INITIAL_MONEY_VISIBILITY,
  MONEY_MASK,
  allMoneyHidden,
  hideAllMoney,
  isLegacyVisibilityKey,
  isMoneyHidden,
  toggleGlobalMoney,
  toggleScreenMoney,
  type MoneyVisibility,
} from "@/lib/privacy/money-visibility";

export { MONEY_MASK };

/** Telas com olhinho próprio. O estado vive só na memória desta aba. */
export type HideMoneyScreen =
  | "dashboard"
  | "v2-hoje"
  | "v2-aurora"
  | "v2-dinheiro"
  | "v2-desempenho"
  | "v2-planejamento"
  | "v2-pendencias"
  | "v2-registrar"
  | "banco-lucro"
  | "financeiro"
  | "desempenho"
  | "planejamento"
  | "vendas"
  | "clientes"
  | "fechamento"
  | "projecoes"
  | "relatorios"
  | "rankings"
  | "calendario"
  | "metas"
  | "diario"
  | "registro-dia"
  | "produtos"
  | "visao-geral"
  | "estoque"
  | "fidelidade"
  | "insights"
  | "retrato"
  | "notas"
  | "galeria"
  | "configuracoes"
  | "other";

export const HIDE_MONEY_SCREENS: HideMoneyScreen[] = [
  "dashboard",
  "v2-hoje",
  "v2-aurora",
  "v2-dinheiro",
  "v2-desempenho",
  "v2-planejamento",
  "v2-pendencias",
  "v2-registrar",
  "banco-lucro",
  "financeiro",
  "desempenho",
  "planejamento",
  "vendas",
  "clientes",
  "fechamento",
  "projecoes",
  "relatorios",
  "rankings",
  "calendario",
  "metas",
  "diario",
  "registro-dia",
  "produtos",
  "visao-geral",
  "estoque",
  "fidelidade",
  "insights",
  "retrato",
  "notas",
  "galeria",
  "configuracoes",
  "other",
];

export function hideMoneyScreenFromPath(pathname: string): HideMoneyScreen {
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/v2")) {
    if (pathname === "/v2" || pathname === "/v2/") return "v2-hoje";
    if (pathname.startsWith("/v2/aurora")) return "v2-aurora";
    if (pathname.startsWith("/v2/dinheiro")) return "v2-dinheiro";
    if (pathname.startsWith("/v2/desempenho")) return "v2-desempenho";
    if (pathname.startsWith("/v2/planejamento")) return "v2-planejamento";
    if (pathname.startsWith("/v2/pendencias")) return "v2-pendencias";
    if (pathname.startsWith("/v2/registrar")) return "v2-registrar";
    return "v2-hoje";
  }
  if (pathname.startsWith("/banco-lucro")) return "banco-lucro";
  if (pathname.startsWith("/financeiro")) return "financeiro";
  if (pathname.startsWith("/desempenho")) return "desempenho";
  if (pathname.startsWith("/planejamento")) return "planejamento";
  if (pathname.startsWith("/vendas")) return "vendas";
  if (pathname.startsWith("/clientes")) return "clientes";
  if (pathname.startsWith("/fechamento")) return "fechamento";
  if (pathname.startsWith("/projecoes")) return "projecoes";
  if (pathname.startsWith("/relatorios")) return "relatorios";
  if (pathname.startsWith("/rankings")) return "rankings";
  if (pathname.startsWith("/calendario")) return "calendario";
  if (pathname.startsWith("/metas")) return "metas";
  if (pathname.startsWith("/diario")) return "diario";
  if (pathname.startsWith("/registro-dia")) return "registro-dia";
  if (pathname.startsWith("/produtos")) return "produtos";
  if (pathname.startsWith("/visao-geral")) return "visao-geral";
  if (pathname.startsWith("/estoque")) return "estoque";
  if (pathname.startsWith("/fidelidade")) return "fidelidade";
  if (pathname.startsWith("/insights")) return "insights";
  if (pathname.startsWith("/retrato")) return "retrato";
  if (pathname.startsWith("/notas")) return "notas";
  if (pathname.startsWith("/galeria")) return "galeria";
  if (pathname.startsWith("/configuracoes")) return "configuracoes";
  return "other";
}

const CHANGE_EVENT = "zaivon-hide-money-change";
let version = 0;
let visibility: MoneyVisibility = INITIAL_MONEY_VISIBILITY;
const listeners = new Set<() => void>();

function purgeLegacyVisibility() {
  if (typeof window === "undefined") return;
  try {
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && isLegacyVisibilityKey(key)) drop.push(key);
    }
    for (const key of drop) localStorage.removeItem(key);
  } catch {
    /* storage indisponível */
  }
}

purgeLegacyVisibility();

function emitChange() {
  version += 1;
  listeners.forEach((l) => l());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  if (typeof window !== "undefined") {
    window.addEventListener(CHANGE_EVENT, onStoreChange);
    window.addEventListener("storage", onStoreChange);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (typeof window !== "undefined") {
      window.removeEventListener(CHANGE_EVENT, onStoreChange);
      window.removeEventListener("storage", onStoreChange);
    }
  };
}

function getVersion() {
  return version;
}

function readEffectiveHidden(screenId?: HideMoneyScreen | null): boolean {
  return isMoneyHidden(visibility, screenId);
}

/** Liga/desliga todas as telas nesta aba. Não grava a escolha. */
export function setAllHideMoney(hidden: boolean) {
  visibility = hidden ? hideAllMoney() : { globalRevealed: true, revealedScreens: [] };
  emitChange();
}

/**
 * Olhinho por tela: esconder/mostrar valores.
 * Respeita também o olhinho geral do header.
 */
export function useHideMoney(screenId: HideMoneyScreen) {
  const snap = useSyncExternalStore(subscribe, getVersion, () => 0);
  const hidden = useMemo(() => {
    void snap;
    return readEffectiveHidden(screenId);
  }, [snap, screenId]);

  const toggle = useCallback(() => {
    visibility = toggleScreenMoney(visibility, screenId, HIDE_MONEY_SCREENS);
    emitChange();
  }, [screenId]);

  const maskMoney = useCallback(
    (format: (n: number) => string) => (n: number) => (hidden ? MONEY_MASK : format(n)),
    [hidden],
  );

  const axisTick = useCallback(
    (n: number) => (hidden ? "••" : `R$ ${Math.round(n)}`),
    [hidden],
  );

  return { hidden, toggle, maskMoney, axisTick, mask: MONEY_MASK };
}

/**
 * Formatação de dinheiro que respeita o olhinho (geral ou da rota atual).
 * Use em qualquer tela/módulo no lugar de formatCurrency na UI.
 */
export function useFormatMoney(screenId?: HideMoneyScreen | null) {
  const snap = useSyncExternalStore(subscribe, getVersion, () => 0);
  const pathname = usePathname() ?? "/";
  const resolved = screenId ?? hideMoneyScreenFromPath(pathname);
  const hidden = useMemo(() => {
    void snap;
    return readEffectiveHidden(resolved);
  }, [snap, resolved]);

  return useCallback(
    (n: number) => (hidden ? MONEY_MASK : formatCurrency(n)),
    [hidden],
  );
}

/** Snapshot reativo: valores ocultos agora? */
export function useMoneyHidden(screenId?: HideMoneyScreen | null) {
  const snap = useSyncExternalStore(subscribe, getVersion, () => 0);
  const pathname = usePathname() ?? "/";
  const resolved = screenId ?? hideMoneyScreenFromPath(pathname);
  return useMemo(() => {
    void snap;
    return readEffectiveHidden(resolved);
  }, [snap, resolved]);
}

/**
 * Olhinho geral: se alguma tela ainda mostra valores → oculta todas;
 * se todas estão ocultas → mostra todas.
 */
export function useGlobalHideMoney() {
  const snap = useSyncExternalStore(subscribe, getVersion, () => 0);
  const allHidden = useMemo(() => {
    void snap;
    return allMoneyHidden(visibility);
  }, [snap]);

  const toggle = useCallback(() => {
    visibility = toggleGlobalMoney(visibility);
    emitChange();
  }, []);

  return { allHidden, toggle };
}
