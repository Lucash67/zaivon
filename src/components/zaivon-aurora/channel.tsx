"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Building2, Store } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChannelFilter = "all" | "unifor" | "acal";

const ChannelContext = createContext<{
  channel: ChannelFilter;
  setChannel: (channel: ChannelFilter) => void;
}>({ channel: "all", setChannel: () => {} });

export function ChannelProvider({ children }: { children: ReactNode }) {
  const [channel, setChannel] = useState<ChannelFilter>("all");
  return <ChannelContext.Provider value={{ channel, setChannel }}>{children}</ChannelContext.Provider>;
}

export function useChannel() {
  return useContext(ChannelContext);
}

const OPTIONS: { value: ChannelFilter; label: string; short: string; icon?: typeof Store }[] = [
  { value: "all", label: "Operação toda", short: "Toda" },
  { value: "unifor", label: "Unifor", short: "Unifor", icon: Building2 },
  { value: "acal", label: "Acal", short: "Acal", icon: Store },
];

export function ChannelSwitch({ className }: { className?: string }) {
  const { channel, setChannel } = useChannel();
  return (
    <div role="group" aria-label="Filtrar por canal de venda" className={cn("glass inline-flex items-center gap-0.5 rounded-full p-1", className)}>
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = channel === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setChannel(opt.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-300",
              active
                ? opt.value === "unifor"
                  ? "bg-aur-lime/15 text-aur-lime shadow-[0_0_14px_-6px_oklch(var(--aur-lime))]"
                  : opt.value === "acal"
                    ? "bg-aur-cyan/15 text-aur-cyan"
                    : "bg-aur-panel3 text-aur-fg"
                : "text-aur-muted hover:text-aur-fg",
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            <span className="hidden md:inline">{opt.label}</span>
            <span className="md:hidden">{opt.short}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ChannelScopeNote() {
  const { channel } = useChannel();
  if (channel === "all") return null;
  const label = channel === "unifor" ? "Unifor" : "Acal";
  return (
    <p className="mt-4 rounded-2xl border border-aur-cyan/30 bg-aur-cyan/10 px-4 py-3 text-xs leading-relaxed text-aur-cyan">
      Canal <strong>{label}</strong> ativo. Os indicadores financeiros do topo continuam do dia ou período inteiro.
      Operação detalhada, linha do tempo e fiados novos é que respeitam o canal. Eventos sem canal não recebem origem presumida.
    </p>
  );
}
