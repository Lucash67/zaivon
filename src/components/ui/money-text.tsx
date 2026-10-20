"use client";

import { useFormatMoney, type HideMoneyScreen } from "@/hooks/use-hide-money";

/** Exibe valor em R$; respeita o olhinho geral/por tela. */
export function MoneyText({
  value,
  screenId,
}: {
  value: number;
  screenId?: HideMoneyScreen;
}) {
  const money = useFormatMoney(screenId);
  return <>{money(value)}</>;
}
