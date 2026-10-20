"use client";
import { useFormatMoney } from "@/hooks/use-hide-money";

import { motion } from "framer-motion";
import { Check, TrendingUp } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { formatNumber } from "@/lib/utils";
import type { ForecastScenario, ForecastScenarioKey } from "@/lib/month-close-view";

interface ScenarioCardProps {
  scenario: ForecastScenario;
  selected: boolean;
  recommended: boolean;
  onSelect: (key: ForecastScenarioKey) => void;
  delay?: number;
}

const ACCENT: Record<ForecastScenarioKey, string> = {
  conservador: "text-z-info",
  realista: "text-z-emerald",
  ambicioso: "text-z-primary",
};

export function ScenarioCard({
  scenario,
  selected,
  recommended,
  onSelect,
  delay = 0,
}: ScenarioCardProps) {
  const money = useFormatMoney();
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(scenario.key)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      aria-pressed={selected}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border bg-surface-card p-5 text-left shadow-card transition-all duration-300",
        selected
          ? "border-z-primary/60 shadow-[0_0_28px_rgb(var(--z-primary-rgb)/0.18)]"
          : "border-surface-border hover:border-z-primary/25",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className={cn("text-sm font-semibold", ACCENT[scenario.key])}>{scenario.label}</p>
            {recommended && (
              <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-green">
                sugerido
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-text-muted">
            {scenario.daysOperated} dias úteis · {money(scenario.dailyRevenue)}/dia
          </p>
        </div>
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected
              ? "border-transparent bg-brand-gradient text-brand-on"
              : "border-surface-border text-transparent",
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs text-text-muted">Lucro previsto</p>
          <p className="text-2xl font-bold tracking-tight text-brand-green">
            {money(scenario.profit)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-brand-green">
            <TrendingUp className="h-3 w-3" />
            {scenario.changeVsReference.profit > 0 ? "+" : ""}
            {scenario.changeVsReference.profit.toFixed(0)}% vs mês fechado
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-surface-border pt-3 text-xs">
          <div>
            <p className="text-text-muted">Faturamento</p>
            <p className="font-semibold text-text-primary">{money(scenario.revenue)}</p>
          </div>
          <div>
            <p className="text-text-muted">Unidades</p>
            <p className="font-semibold text-text-primary">{formatNumber(scenario.units)}</p>
          </div>
          <div>
            <p className="text-text-muted">Margem</p>
            <p className="font-semibold text-text-primary">{scenario.margin.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-text-muted">Seu capital</p>
            <p className="font-semibold text-text-primary">
              {money(scenario.ownCapitalNeeded)}
            </p>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-text-muted">{scenario.premise}</p>
      </div>
    </motion.button>
  );
}
