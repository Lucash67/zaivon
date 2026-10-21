"use client";

import { usePathname } from "next/navigation";
import { hideMoneyScreenFromPath, useHideMoney, MONEY_MASK } from "@/hooks/use-hide-money";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** O mesmo olhinho do cabeçalho e da faixa de dias. Não há um segundo estado. */
export function useAuroraPrivacy() {
  const pathname = usePathname() ?? "/v2";
  return useHideMoney(hideMoneyScreenFromPath(pathname));
}

/** Valor mascarado no servidor e na primeira pintura. Não grava a revelação. */
export function Money({ value, className }: { value: number; className?: string }) {
  const { hidden } = useAuroraPrivacy();
  return <span className={className}>{hidden ? MONEY_MASK : brl.format(value)}</span>;
}
