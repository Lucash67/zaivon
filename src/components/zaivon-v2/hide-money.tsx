"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  useHideMoney,
  hideMoneyScreenFromPath,
  type HideMoneyScreen,
  MONEY_MASK,
} from "@/hooks/use-hide-money";
import { HideMoneyButton } from "@/components/ui/hide-money-button";
import { money as formatMoney } from "@/lib/zaivon/format";

type HideMoneyApi = {
  hidden: boolean;
  toggle: () => void;
  /** Formata valor; se oculto, devolve a máscara. */
  money: (n: number) => string;
  axisTick: (n: number) => string;
  mask: string;
};

const HideMoneyCtx = createContext<HideMoneyApi | null>(null);

export function HideMoneyScope({
  screenId,
  children,
}: {
  screenId: HideMoneyScreen;
  children: ReactNode;
}) {
  const { hidden, toggle, maskMoney, axisTick, mask } = useHideMoney(screenId);
  const money = maskMoney(formatMoney);
  return (
    <HideMoneyCtx.Provider value={{ hidden, toggle, money, axisTick, mask }}>
      {children}
    </HideMoneyCtx.Provider>
  );
}

export function useScreenHideMoney(): HideMoneyApi {
  const ctx = useContext(HideMoneyCtx);
  const pathname = usePathname() ?? "/";
  const fallback = useHideMoney(hideMoneyScreenFromPath(pathname));
  if (!ctx) {
    return {
      hidden: fallback.hidden,
      toggle: fallback.toggle,
      money: fallback.maskMoney(formatMoney),
      axisTick: fallback.axisTick,
      mask: MONEY_MASK,
    };
  }
  return ctx;
}

export function ScreenHideMoneyButton({ className }: { className?: string }) {
  const { hidden, toggle } = useScreenHideMoney();
  return (
    <HideMoneyButton
      hidden={hidden}
      onToggle={toggle}
      variant="zaivon"
      className={className}
    />
  );
}
