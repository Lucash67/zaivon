"use client";
import { useFormatMoney } from "@/hooks/use-hide-money";

import { cn } from "@/components/ui/utils";
import type { SmartGoalsView } from "@/lib/smart-goals-view";
import { Check, CircleAlert, Scale } from "lucide-react";
import { motion } from "framer-motion";

interface MixDisciplineCardProps {
  day: NonNullable<SmartGoalsView["mixDiscipline"]>;
  week: NonNullable<SmartGoalsView["mixDisciplineWeek"]>;
}

function HitBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        ok ? "bg-brand-green/10 text-brand-green" : "bg-brand-orange/10 text-brand-orange",
      )}
    >
      {ok ? <Check className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
      {label}
    </span>
  );
}

function Row({
  label,
  current,
  target,
  ok,
  format = "units",
}: {
  label: string;
  current: number;
  target: number;
  ok: boolean;
  format?: "units" | "currency";
}) {
  const money = useFormatMoney();
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const display =
    format === "currency"
      ? `${money(current)} / ${money(target)}`
      : `${current} / ${target} un.`;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className={cn("font-semibold", ok ? "text-brand-green" : "text-text-primary")}>
          {display}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={cn("h-full rounded-full", ok ? "bg-brand-green" : "bg-purple-400")}
        />
      </div>
    </div>
  );
}

export function MixDisciplineCard({ day, week }: MixDisciplineCardProps) {
  const thirdOkWeek = week.thirdPartyCost <= week.thirdPartyMaxWeek;
  const totalOkWeek = week.totalUnits >= week.targetTotal;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="rounded-2xl border border-purple-500/20 bg-surface-card p-4 shadow-card sm:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10">
            <Scale className="h-4 w-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-purple-400">Disciplina de mix</h3>
            <p className="text-xs text-text-muted">
              ≥17 Acal+Unifor · ≥5 Henrique · teto terceiros R$27/dia
            </p>
          </div>
        </div>
        <HitBadge ok={day.allOk} label={day.allOk ? "Dia ok" : "Ajustar"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-medium text-text-muted">Hoje</p>
          <Row
            label="Acal + Unifor"
            current={day.acalUniforUnits}
            target={day.targets.acalUnifor}
            ok={day.hitAcalUnifor}
          />
          <Row
            label="Henrique (trabalho)"
            current={day.henriqueUnits}
            target={day.targets.henrique}
            ok={day.hitHenrique}
          />
          <Row
            label="Total do dia"
            current={day.totalUnits}
            target={day.targets.total}
            ok={day.hitTotal}
          />
          <Row
            label="Custo de terceiros"
            current={day.thirdPartyCost}
            target={day.targets.thirdPartyMax}
            ok={day.thirdPartyOk}
            format="currency"
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-text-muted">Semana (até agora)</p>
          <Row
            label="Volume semanal"
            current={week.totalUnits}
            target={week.targetTotal}
            ok={totalOkWeek}
          />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-purple-500/15 bg-surface-elevated/40 px-3 py-2">
              <p className="text-text-muted">Acal+Unifor</p>
              <p className="font-semibold text-text-primary">{week.acalUniforUnits} un.</p>
            </div>
            <div className="rounded-xl border border-purple-500/15 bg-surface-elevated/40 px-3 py-2">
              <p className="text-text-muted">Henrique</p>
              <p className="font-semibold text-text-primary">{week.henriqueUnits} un.</p>
            </div>
          </div>
          <Row
            label="Terceiros na semana"
            current={week.thirdPartyCost}
            target={week.thirdPartyMaxWeek}
            ok={thirdOkWeek}
            format="currency"
          />
          <p className="text-[11px] text-text-muted">
            Meta semanal: {week.targetTotal} un. · teto terceiros proporcional aos dias operados.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
