"use client";

import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface HideMoneyButtonProps {
  hidden: boolean;
  onToggle: () => void;
  className?: string;
  /** Visual do botão: superfície do app legado ou tokens ZAIVON v2. */
  variant?: "app" | "zaivon";
}

export function HideMoneyButton({
  hidden,
  onToggle,
  className,
  variant = "app",
}: HideMoneyButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hidden}
      aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
      title={hidden ? "Mostrar valores" : "Ocultar valores"}
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
