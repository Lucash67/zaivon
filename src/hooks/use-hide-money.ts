"use client";

import { usePathname } from "next/navigation";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { formatCurrency } from "@/lib/utils";

export const MONEY_MASK = "R$ ••••";

const MONEY_IN_TEXT = /R\$\s?-?[\d.]+,\d{2}/g;

/** Troca valores escritos dentro de uma frase quando o olho está fechado. */
export function maskMoneyInText(text: string, hidden: boolean): string {
  if (!hidden) return text;
  return text.replace(MONEY_IN_TEXT, MONEY_MASK);
}
const KEY_PREFIX = "zaivon-hide-money:";
const GLOBAL_KEY = `${KEY_PREFIX}global`;

/** Telas com olhinho próprio (localStorage isolado). */
export type HideMoneyScreen =
  | "dashboard"
  | "v2-hoje"
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
  | "finance"
  | "other";

export const HIDE_MONEY_SCREENS: HideMoneyScreen[] = [
  "dashboard",
  "v2-hoje",
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
  "finance",
  "other",
];

export function hideMoneyScreenFromPath(pathname: string): HideMoneyScreen {
  if (pathname === "/finance" || pathname.startsWith("/finance/")) return "finance";
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/v2")) {
    if (pathname === "/v2" || pathname === "/v2/") return "v2-hoje";
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

function storageKey(screenId: string) {
  return `${KEY_PREFIX}${screenId}`;
}

const CHANGE_EVENT = "zaivon-hide-money-change";
let version = 0;
const listeners = new Set<() => void>();

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

function readRaw(key: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeRaw(key: string, hidden: boolean) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, hidden ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function readGlobalHidden(): boolean {
  return readRaw(GLOBAL_KEY);
}

function readHidden(screenId: HideMoneyScreen): boolean {
  if (readRaw(storageKey(screenId))) return true;
  // Dashboard legado usava uma chave global.
  if (screenId === "dashboard" && readRaw("lbo-hide-money")) return true;
  return false;
}

function writeHidden(screenId: HideMoneyScreen, hidden: boolean) {
  writeRaw(storageKey(screenId), hidden);
}

function readEffectiveHidden(screenId?: HideMoneyScreen | null): boolean {
  if (readGlobalHidden()) return true;
  if (screenId) return readHidden(screenId);
  return false;
}

function readAllHidden(): boolean {
  if (readGlobalHidden()) return true;
  return HIDE_MONEY_SCREENS.every((id) => readHidden(id));
}

/** Liga/desliga todas as telas de uma vez (olhinho geral). */
export function setAllHideMoney(hidden: boolean) {
  writeRaw(GLOBAL_KEY, hidden);
  for (const id of HIDE_MONEY_SCREENS) writeHidden(id, hidden);
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
    const next = !readEffectiveHidden(screenId);
    // Se o geral está ligado, o toggle da tela desliga o geral e a tela.
    if (readGlobalHidden() && !next) {
      writeRaw(GLOBAL_KEY, false);
      for (const id of HIDE_MONEY_SCREENS) writeHidden(id, false);
    } else {
      writeHidden(screenId, next);
    }
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
    return readAllHidden();
  }, [snap]);

  const toggle = useCallback(() => {
    setAllHideMoney(!readAllHidden());
  }, []);

  return { allHidden, toggle };
}
