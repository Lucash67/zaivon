"use client";
import { useFormatMoney } from "@/hooks/use-hide-money";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CalendarDays, Target, TrendingUp, Wallet } from "lucide-react";
import { ModuleShell } from "@/components/layout/module-shell";
import { ChartCard } from "@/components/charts/chart-card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SectionPanel } from "@/components/executive/section-panel";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/loading";
import { EmptyModuleState } from "@/components/ui/empty-module-state";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { fetchJson } from "@/lib/api/safe-json";
import { cn } from "@/lib/utils";
import type { AppliedGoalsResult } from "@/lib/month-close-service";
import type { ForecastScenarioKey, MonthCloseView } from "@/lib/month-close-view";

const CONFIDENCE_STYLE: Record<string, string> = {
  alta: "border-brand-green/25 bg-brand-green/5 text-brand-green",
  média: "border-z-warning/30 bg-z-warning/10 text-z-warning",
  baixa: "border-brand-red/25 bg-brand-red/5 text-brand-red",
};

type MonthClosePayload = MonthCloseView | { empty: true; message?: string };

function isEmptyMonthClose(data: MonthClosePayload | undefined): data is { empty: true; message?: string } {
  return Boolean(data && "empty" in data && data.empty);
}

export default function FechamentoPage() {
  const money = useFormatMoney();
  const { activeBusinessId, canWrite, withQuery, goalsBlockedMessage } = useBusinessScope();
  const queryClient = useQueryClient();
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [scenarioKey, setScenarioKey] = useState<ForecastScenarioKey | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<MonthClosePayload>({
    queryKey: ["month-close", activeBusinessId, monthKey],
    queryFn: async () =>
      (await fetchJson(
        withQuery(`/api/month-close${monthKey ? `?month=${monthKey}` : ""}`),
      )) as MonthClosePayload,
    staleTime: 120_000,
    retry: 1,
  });

  const applyGoals = useMutation<AppliedGoalsResult, Error, ForecastScenarioKey>({
    mutationFn: async (scenario) => {
      if (!data || isEmptyMonthClose(data)) {
        throw new Error("Registre alguns dias antes de aplicar metas.");
      }
      const response = await fetch(withQuery("/api/month-close"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, month: data.reference.monthKey }),
      });
      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error ?? "Não foi possível aplicar as metas.");
      }
      return json as AppliedGoalsResult;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
      void queryClient.invalidateQueries({ queryKey: ["smart-goals"] });
      void queryClient.invalidateQueries({ queryKey: ["period-projections"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-view"] });
    },
  });

  const view = data && !isEmptyMonthClose(data) ? data : null;
  const selected = scenarioKey ?? view?.recommended ?? "realista";
  const scenario = view?.scenarios.find((s) => s.key === selected) ?? view?.scenarios[1];
  const derivedGoals = view?.derivedGoalsByScenario[selected] ?? view?.derivedGoals ?? [];

  const historyChart = useMemo(() => {
    if (!view || !scenario) return [];
    return [
      ...view.history.map((row) => ({
        label: row.label,
        value: row.revenue,
        revenue: row.revenue,
        profit: row.profit,
      })),
      {
        label: `${view.nextMonth.shortLabel} (prev.)`,
        value: scenario.revenue,
        revenue: scenario.revenue,
        profit: scenario.profit,
      },
    ];
  }, [view, scenario]);

  if (isError) {
    return (
      <ModuleShell title="Mês" temporalFilter={false}>
        <EmptyModuleState
          icon={CalendarDays}
          title="Não foi possível carregar o fechamento"
          description={
            error instanceof Error ? error.message : "Não foi possível carregar o fechamento do mês."
          }
          onRetry={() => void refetch()}
        />
      </ModuleShell>
    );
  }

  if (isLoading) {
    return (
      <ModuleShell title="Mês" temporalFilter={false}>
        <PageLoader />
      </ModuleShell>
    );
  }

  if (!view || isEmptyMonthClose(data) || !scenario) {
    return (
      <ModuleShell title="Mês" temporalFilter={false}>
        <EmptyModuleState
          icon={CalendarDays}
          title="Ainda sem mês para fechar"
          description={
            (data && isEmptyMonthClose(data) && data.message) ||
            "Registre alguns dias operacionais. Quando houver histórico, o fechamento e as metas do próximo mês aparecem aqui."
          }
          actionHref="/registro-dia"
          actionLabel="Registrar dia"
        />
      </ModuleShell>
    );
  }

  const { reference, nextMonth, confidence } = view;

  return (
    <ModuleShell
      title="Mês"
      subtitle={`${reference.label} · previsão para ${nextMonth.label}`}
      temporalFilter={false}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {view.availableMonths.map((month) => (
              <button
                key={month.monthKey}
                type="button"
                onClick={() => setMonthKey(month.monthKey)}
                className={cn(
                  "min-h-[36px] rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-all sm:min-h-0 sm:py-1.5",
                  month.monthKey === reference.monthKey
                    ? "border-transparent bg-brand-gradient text-brand-on shadow-[0_4px_16px_rgb(var(--z-primary-rgb)/0.3)]"
                    : "border-surface-border text-text-secondary hover:border-z-primary/30 hover:text-text-primary",
                )}
              >
                {month.label}
              </button>
            ))}
          </div>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              CONFIDENCE_STYLE[confidence.level] ?? CONFIDENCE_STYLE["média"],
            )}
          >
            Confiança {confidence.level}
          </span>
        </div>

        <div className="rounded-2xl border border-z-primary/25 bg-gradient-to-br from-z-primary/10 via-surface-card to-z-emerald/5 px-4 py-3 text-sm leading-relaxed text-text-secondary">
          <span className="font-medium text-text-primary">Leitura do fechamento: </span>
          {view.narrative}
        </div>

        <SectionPanel
          theme="finance"
          title={`Como ${reference.label} fechou`}
          subtitle={`${reference.daysOperated} dias operados de ${reference.daysAvailableSinceStart} possíveis · presença ${(reference.attendanceRate * 100).toFixed(0)}%`}
        >
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <KpiCard
              title="Faturamento"
              value={reference.revenue}
              icon={Wallet}
              subtitle={`${money(reference.avgDailyRevenue)}/dia útil`}
              delay={0}
            />
            <KpiCard
              title="Lucro"
              value={reference.profit}
              icon={TrendingUp}
              variant="profit"
              subtitle={`${money(reference.avgDailyProfit)}/dia · margem ${reference.margin.toFixed(1)}%`}
              delay={1}
            />
            <KpiCard
              title="Unidades"
              value={reference.units}
              icon={CalendarDays}
              format="number"
              subtitle={`${reference.avgDailyUnits.toFixed(1)} un./dia · ${money(reference.avgUnitPrice)} por unidade`}
              delay={2}
            />
            <KpiCard
              title="Melhor dia"
              value={reference.bestDay?.profit ?? 0}
              icon={BadgeCheck}
              subtitle={
                reference.bestDay
                  ? `${reference.bestDay.label} · pior foi ${reference.worstDay?.label} com ${money(reference.worstDay?.profit ?? 0)}`
                  : "—"
              }
              delay={3}
            />
          </div>
        </SectionPanel>

        <SectionPanel
          theme="goals"
          title={`Próximo mês · ${nextMonth.label}`}
          subtitle="Escolha um cenário e aplique como meta (opcional)"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {view.scenarios.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => setScenarioKey(row.key)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-all",
                  row.key === selected
                    ? "border-z-primary/50 bg-gradient-to-br from-z-primary/15 to-z-emerald/5 shadow-[0_0_24px_rgb(var(--z-primary-rgb)/0.12)]"
                    : "border-surface-border hover:border-z-primary/30",
                )}
              >
                <p className="text-xs font-semibold capitalize text-text-primary">{row.label}</p>
                <p className="mt-1 text-sm font-bold text-text-primary">
                  {money(row.revenue)}
                </p>
                <p className="text-xs text-brand-green">{money(row.profit)} lucro</p>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              disabled={!canWrite || applyGoals.isPending}
              onClick={() => applyGoals.mutate(selected)}
            >
              <Target className="h-4 w-4" />
              {applyGoals.isPending ? "Aplicando..." : `Aplicar metas · ${nextMonth.shortLabel}`}
            </Button>
            {!canWrite && <p className="text-xs text-text-muted">{goalsBlockedMessage}</p>}
            {applyGoals.isSuccess && (
              <p className="text-xs text-brand-green">Metas aplicadas.</p>
            )}
            {applyGoals.isError && (
              <p className="text-xs text-brand-red">{applyGoals.error.message}</p>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {derivedGoals.map((goal) => (
              <div
                key={goal.type}
                className="rounded-lg border border-z-primary/15 bg-surface-elevated/40 px-3 py-2"
              >
                <p className="text-[10px] uppercase text-text-muted">{goal.label}</p>
                <p className="text-sm font-bold">{money(goal.targetRevenue)}</p>
              </div>
            ))}
          </div>
        </SectionPanel>

        <ChartCard
          data={historyChart}
          title="Histórico recente"
          subtitle="Faturamento por mês (+ previsão do próximo)"
          type="area"
          height={240}
          showLegend
        />
      </div>
    </ModuleShell>
  );
}
