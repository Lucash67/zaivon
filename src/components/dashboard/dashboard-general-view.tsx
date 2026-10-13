"use client";

import { motion } from "framer-motion";
import { DollarSign, Package, Target, TrendingUp, Users } from "lucide-react";
import { PulseMetric } from "@/components/dashboard/pulse-metric";
import { WeekUnitsTableCard } from "@/components/dashboard/week-units-table-card";
import { TopClientsCard, ChartCard } from "@/components/charts/chart-card";
import { formatCurrency } from "@/lib/utils";
import type { WeekUnitsPanel } from "@/lib/dashboard-view";

export interface DashboardScopeCopy {
  heroEyebrow: string;
  revenueLabel: string;
  profitLabel: string;
  goalLabel: string;
  unitsGoalLabel: string;
  buyersSubtext: string;
  chartsSubtitle: string;
  profitPhrase: string;
  /** Subtítulo do ranking de clientes (ex.: compras na semana). */
  topClientsSubtitle?: string;
  topClientsValueSuffix?: string;
}

interface DashboardGeneralViewProps {
  revenue: number;
  profit: number;
  goalProgress: number;
  unitsGoalProgress?: number;
  unitsGoalTarget?: number;
  itemsSold: number;
  uniqueBuyers: number;
  profitUnitsInsight?: string | null;
  topClients: Array<{ label: string; value: number }>;
  payments: Array<{ label: string; value: number }>;
  weekUnits: WeekUnitsPanel;
  copy?: DashboardScopeCopy;
}

const DEFAULT_COPY: DashboardScopeCopy = {
  heroEyebrow: "Visão executiva · histórico completo",
  revenueLabel: "Receita total",
  profitLabel: "Lucro total",
  goalLabel: "Meta lucro geral",
  unitsGoalLabel: "Meta un. geral",
  buyersSubtext: "un. no histórico",
  chartsSubtitle: "Histórico completo",
  profitPhrase: "Lucro acumulado",
};

export function DashboardGeneralView({
  revenue,
  profit,
  goalProgress,
  unitsGoalProgress = 0,
  unitsGoalTarget = 0,
  itemsSold,
  uniqueBuyers,
  profitUnitsInsight = null,
  topClients,
  payments,
  weekUnits,
  copy = DEFAULT_COPY,
}: DashboardGeneralViewProps) {
  const showUnitsGoal = unitsGoalTarget > 0;
  const clientsSubtitle = copy.topClientsSubtitle ?? copy.chartsSubtitle;
  const clientsSuffix = copy.topClientsValueSuffix ?? "compras";

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-z-primary/25 bg-gradient-to-br from-z-primary/12 via-surface-card to-z-emerald/10 p-4 sm:p-8"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-z-primary/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-z-emerald/15 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <p className="mb-1 text-sm text-text-secondary">{copy.heroEyebrow}</p>
          <p className="text-[2rem] font-black tracking-tight text-brand-gradient sm:text-4xl lg:text-5xl">
            {formatCurrency(revenue)}
          </p>
          <p className="mt-2 text-sm text-text-secondary sm:text-base">
            {copy.profitPhrase}{" "}
            <span className="font-bold text-brand-green">{formatCurrency(profit)}</span>
            {" · "}
            {itemsSold} unidades · {uniqueBuyers} compradores
          </p>
        </div>
      </motion.div>

      {profitUnitsInsight && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-brand-yellow/25 bg-brand-yellow/[0.07] px-4 py-3 text-sm text-text-secondary"
        >
          <span className="font-semibold text-brand-yellow">Lucro × volume · </span>
          {profitUnitsInsight}
        </motion.p>
      )}

      <div
        className={
          showUnitsGoal
            ? "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
            : "grid grid-cols-2 gap-3 xl:grid-cols-4"
        }
      >
        <PulseMetric label={copy.revenueLabel} value={revenue} icon={DollarSign} variant="revenue" delay={0} />
        <PulseMetric
          label={copy.profitLabel}
          value={profit}
          icon={TrendingUp}
          variant="gain"
          delay={1}
        />
        <PulseMetric
          label={copy.goalLabel}
          value={goalProgress}
          format="percent"
          icon={Target}
          variant="meta"
          delay={2}
        />
        {showUnitsGoal && (
          <PulseMetric
            label={copy.unitsGoalLabel}
            value={unitsGoalProgress}
            format="percent"
            icon={Package}
            variant="info"
            subtext={`${itemsSold} / ${unitsGoalTarget} un.`}
            delay={3}
          />
        )}
        <PulseMetric
          label="Compradores"
          value={uniqueBuyers}
          format="number"
          icon={Users}
          variant={showUnitsGoal ? "neutral" : "info"}
          subtext={`${itemsSold} ${copy.buyersSubtext}`}
          delay={showUnitsGoal ? 4 : 3}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TopClientsCard
          clients={topClients}
          subtitle={clientsSubtitle}
          valueSuffix={clientsSuffix}
        />
        <WeekUnitsTableCard panel={weekUnits} />
      </div>

      <div className="max-w-md">
        <ChartCard
          data={payments.filter((p) => p.value > 0)}
          title="Como pagaram"
          subtitle={copy.chartsSubtitle}
          type="pie"
          height={140}
          compact
        />
      </div>
    </div>
  );
}
