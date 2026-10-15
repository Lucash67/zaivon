"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ClipboardPaste,
  NotebookPen,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HideMoneyButton } from "@/components/ui/hide-money-button";
import { useHideMoney } from "@/hooks/use-hide-money";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import type {
  DayExecutiveSummary,
  OperationResult,
} from "@/lib/dashboard-view";

interface DashboardDayViewProps {
  viewDate: string;
  viewingToday: boolean;
  revenue: number;
  profit: number;
  profitTrend?: number;
  trendLabel: string;
  goalProgress: number;
  goalUnits: number | null;
  soldUnits: number;
  bonusIncome?: number;
  operationResult: OperationResult;
  daySummary: DayExecutiveSummary;
  hasOperations: boolean;
  nonOperational?: boolean;
}

export function DashboardDayView({
  viewDate,
  viewingToday,
  revenue,
  profit,
  profitTrend,
  trendLabel,
  goalProgress,
  goalUnits,
  soldUnits,
  bonusIncome,
  operationResult,
  daySummary,
  hasOperations,
  nonOperational = false,
}: DashboardDayViewProps) {
  const { hidden: hideMoney, toggle: toggleHideMoney, maskMoney } = useHideMoney("dashboard");
  const money = maskMoney(formatCurrency);
  const idleDay = nonOperational && revenue === 0 && profit === 0;
  const profitPositive = profit >= 0;
  const pendingLoss = daySummary.pendingCount + daySummary.losses;
  const dateLabel = format(parseISO(viewDate), "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={cn(
          "relative overflow-hidden rounded-3xl border p-4 sm:p-6",
          idleDay
            ? "border-surface-border bg-surface-card"
            : profitPositive
              ? "border-brand-green/25 bg-gradient-to-br from-brand-green/10 via-surface-card to-z-primary/5"
              : "border-brand-red/25 bg-gradient-to-br from-brand-red/10 via-surface-card to-surface-card",
        )}
      >
        <HideMoneyButton
          hidden={hideMoney}
          onToggle={toggleHideMoney}
          className="absolute right-3 top-3 z-10 h-10 w-10 sm:right-4 sm:top-4"
        />

        <div className="relative space-y-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info" className="capitalize">
              {dateLabel}
            </Badge>
            {idleDay ? (
              <span className="text-[11px] font-medium text-text-muted">Dia sem operação</span>
            ) : (
              operationResult.tone === "success" && (
                <Badge variant="success">{operationResult.headline}</Badge>
              )
            )}
          </div>

          <div>
            <p className="mb-1 text-sm text-text-secondary">Lucro do dia</p>
            <p
              className={cn(
                "text-[2rem] font-black tracking-tight sm:text-4xl",
                idleDay ? "text-text-secondary" : profitPositive ? "text-brand-green" : "text-brand-red",
              )}
            >
              {money(profit)}
            </p>
            {bonusIncome != null && bonusIncome > 0 && (
              <p className="mt-1 text-sm font-medium text-text-muted">
                incl. {money(bonusIncome)} bonificação
              </p>
            )}
            {profitTrend !== undefined && !hideMoney && (
              <p
                className={cn(
                  "mt-2 inline-flex items-center gap-1 text-xs font-semibold",
                  profitTrend >= 0 ? "text-brand-green" : "text-brand-red",
                )}
              >
                {profitTrend >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {profitTrend >= 0 ? "+" : ""}
                {formatPercent(profitTrend)} {trendLabel}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiMini label="Faturamento" value={money(revenue)} />
            <KpiMini label="Unidades" value={`${soldUnits} un.`} />
            <KpiMini
              label="Meta do dia"
              value={
                idleDay
                  ? "—"
                  : goalUnits != null
                    ? `${soldUnits}/${goalUnits}`
                    : `${Math.round(goalProgress)}%`
              }
              icon={<Target className="h-3.5 w-3.5 text-brand-yellow" />}
            />
            <KpiMini
              label="Fiados / perdas"
              value={String(pendingLoss)}
              subtext={
                pendingLoss > 0
                  ? `${daySummary.pendingCount} fiado · ${daySummary.losses} perda`
                  : "Dia limpo"
              }
              warn={pendingLoss > 0}
            />
          </div>
        </div>
      </motion.div>

      {pendingLoss > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-z-primary/30 bg-z-primary/10 px-4 py-3 text-sm text-[#F5F6FA]/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-z-emerald" />
          <p>
            {daySummary.pendingCount > 0 && (
              <span>
                {daySummary.pendingCount} fiado(s) pendente(s)
                {daySummary.losses > 0 ? " · " : "."}
              </span>
            )}
            {daySummary.losses > 0 && <span>{daySummary.losses} perda(s) no dia.</span>}
          </p>
        </div>
      )}

      {!hasOperations && !idleDay && (
        <p className="text-sm text-text-muted">Nenhuma operação registrada nesta data.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {viewingToday && (
          <Link href="/registro-dia">
            <Button size="sm">
              <ClipboardPaste className="h-4 w-4" />
              Registrar o dia
            </Button>
          </Link>
        )}
        <Link href="/notas">
          <Button size="sm" variant="outline">
            <NotebookPen className="h-4 w-4" />
            Notas
          </Button>
        </Link>
      </div>
    </div>
  );
}

function KpiMini({
  label,
  value,
  subtext,
  icon,
  warn,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon?: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2.5",
        warn ? "border-z-primary/30 bg-z-primary/8" : "border-surface-border bg-surface-base/40",
      )}
    >
      <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
        {icon}
        {label}
      </p>
      <p className={cn("text-base font-bold tabular-nums sm:text-lg", warn && "text-z-emerald")}>
        {value}
      </p>
      {subtext && <p className="mt-0.5 text-[10px] text-text-muted">{subtext}</p>}
    </div>
  );
}
