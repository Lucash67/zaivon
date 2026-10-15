"use client";

import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGlobalHideMoney } from "@/hooks/use-hide-money";

interface HideMoneyButtonProps {
  hidden: boolean;
  onToggle: () => void;
  className?: string;
  /** Visual do botão: superfície do app legado ou tokens ZAIVON v2. */
  variant?: "app" | "zaivon";
  /** Texto do aria/title (padrão: valores desta tela). */
  labelShow?: string;
  labelHide?: string;
}

export function HideMoneyButton({
  hidden,
  onToggle,
  className,
  variant = "app",
  labelShow = "Mostrar valores",
  labelHide = "Ocultar valores",
}: HideMoneyButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hidden}
      aria-label={hidden ? labelShow : labelHide}
      title={hidden ? labelShow : labelHide}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
        variant === "zaivon"
          ? "border-o-border bg-o-surface text-o-muted-foreground hover:text-o-foreground"
          : "border-surface-border/80 bg-surface-base/80 text-text-secondary backdrop-blur-sm hover:text-brand-yellow",
        className,
      )}
    >
      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

/** Olhinho geral do header: liga/desliga todas as telas. */
export function GlobalHideMoneyButton({ className }: { className?: string }) {
  const { allHidden, toggle } = useGlobalHideMoney();
  return (
    <HideMoneyButton
      hidden={allHidden}
      onToggle={toggle}
      className={cn(
        "h-10 w-10 border-surface-border bg-surface-card text-text-secondary hover:border-brand-yellow/40 hover:text-brand-yellow",
        className,
      )}
      labelHide="Ocultar valores em todas as telas"
      labelShow="Mostrar valores em todas as telas"
    />
  );
}
