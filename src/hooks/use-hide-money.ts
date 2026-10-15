"use client";

import { useCallback, useEffect, useState } from "react";

export const MONEY_MASK = "R$ ••••";
const KEY_PREFIX = "zaivon-hide-money:";

/** Telas v2 — cada uma tem olhinho próprio (localStorage isolado). */
export type HideMoneyScreen =
  | "dashboard"
  | "v2-hoje"
  | "v2-dinheiro"
  | "v2-desempenho"
  | "v2-planejamento"
  | "v2-pendencias"
  | "v2-registrar";

export function hideMoneyScreenFromPath(pathname: string): HideMoneyScreen | null {
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "dashboard";
  if (!pathname.startsWith("/v2")) return null;
  if (pathname === "/v2" || pathname === "/v2/") return "v2-hoje";
  if (pathname.startsWith("/v2/dinheiro")) return "v2-dinheiro";
  if (pathname.startsWith("/v2/desempenho")) return "v2-desempenho";
  if (pathname.startsWith("/v2/planejamento")) return "v2-planejamento";
  if (pathname.startsWith("/v2/pendencias")) return "v2-pendencias";
  if (pathname.startsWith("/v2/registrar")) return "v2-registrar";
  return "v2-hoje";
}

function storageKey(screenId: string) {
  return `${KEY_PREFIX}${screenId}`;
}

const CHANGE_EVENT = "zaivon-hide-money-change";

function readHidden(screenId: HideMoneyScreen): boolean {
  try {
    let raw = localStorage.getItem(storageKey(screenId));
    // Dashboard legado usava uma chave global.
    if (raw == null && screenId === "dashboard") {
      raw = localStorage.getItem("lbo-hide-money");
    }
    return raw === "1";
  } catch {
    return false;
  }
}

/**
 * Olhinho por tela: esconder/mostrar valores de lucro e faturamento.
 * Cada `screenId` guarda o estado sozinho — não aciona outras telas.
 * Várias instâncias da mesma tela (ex.: barra do dia + conteúdo) sincronizam via evento.
 */
export function useHideMoney(screenId: HideMoneyScreen) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(readHidden(screenId));
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ screenId: string; hidden: boolean }>).detail;
      if (detail?.screenId === screenId) setHidden(detail.hidden);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, [screenId]);

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey(screenId), next ? "1" : "0");
      } catch {
        /* ignore */
      }
      window.dispatchEvent(
        new CustomEvent(CHANGE_EVENT, { detail: { screenId, hidden: next } }),
      );
      return next;
    });
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
