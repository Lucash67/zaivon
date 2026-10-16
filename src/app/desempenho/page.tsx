"use client";
import { useFormatMoney } from "@/hooks/use-hide-money";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ShoppingCart, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { ModuleShell } from "@/components/layout/module-shell";
import { PageLoader } from "@/components/ui/loading";
import { EmptyModuleState } from "@/components/ui/empty-module-state";
import { ChartCard } from "@/components/charts/chart-card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { formatPercent, cn } from "@/lib/utils";
import type { PerformanceView } from "@/lib/performance-service";

export default function DesempenhoPage() {
  const money = useFormatMoney();
  const { activeBusinessId, withQuery } = useBusinessScope();
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError, error, refetch } = useQuery<PerformanceView>({
    queryKey: ["performance", activeBusinessId, "weekly", offset],
    queryFn: async () => {
      const r = await fetch(withQuery(`/api/performance?period=weekly&offset=${offset}`));
      const json = await r.json();
      if (!r.ok || json.error) {
        throw new Error(json.error || "Não foi possível carregar a semana.");
      }
      return json;
    },
    staleTime: 120_000,
  });

  if (isError) {
    return (
      <ModuleShell title="Semana" subtitle="Lucro e faturamento da semana">
        <EmptyModuleState
          title="Não foi possível carregar a semana"
          description={error instanceof Error ? error.message : "Tente novamente em instantes."}
          onRetry={() => void refetch()}
        />
      </ModuleShell>
    );
  }

  if (isLoading || !data) {
    return (
      <ModuleShell title="Semana" subtitle="Lucro e faturamento da semana">
        <PageLoader />
      </ModuleShell>
    );
  }

  const growthIcon = (value: number) =>
    value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;

  const ProfitGrowthIcon = growthIcon(data.comparison.profitGrowth);
  const RevenueGrowthIcon = growthIcon(data.comparison.revenueGrowth);
  const isEmptyPeriod = data.metrics.revenue === 0 && data.metrics.salesCount === 0;

  return (
    <ModuleShell title="Semana" subtitle="Comparativo · módulo legado">
      <div className="space-y-6">
        <p className="rounded-xl border border-border/60 bg-surface-2/40 px-3 py-2 text-xs text-text-muted">
          Aqui &quot;Lucro&quot; e &quot;Faturamento&quot; vêm do serviço de performance legado (não das 5 dimensões
          canônicas). Preferir <span className="text-text-primary">/v2/desempenho</span> para resultado gerencial de
          caixa e <span className="text-text-primary">/v2/hoje</span> para conciliação do dia.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="shrink-0" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-0 flex-1 text-center text-sm font-medium text-text-primary">
            {data.periodLabel}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setOffset((o) => o + 1)}
            disabled={offset >= 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {isEmptyPeriod ? (
          <EmptyModuleState
            title="Semana sem movimento"
            description="Quando houver vendas neste intervalo, os números aparecem aqui."
            actionHref="/registro-dia"
            actionLabel="Registrar dia"
            compact
          />
        ) : (
          <p className="text-sm text-text-secondary">
            vs {data.comparison.previousLabel}: lucro{" "}
            <span
              className={cn(
                "font-semibold",
                data.comparison.profitGrowth > 0
                  ? "text-brand-green"
                  : data.comparison.profitGrowth < 0
                    ? "text-brand-red"
                    : "text-text-primary",
              )}
            >
              {formatPercent(data.comparison.profitGrowth)}
            </span>
            {" · "}
            fat {formatPercent(data.comparison.revenueGrowth)}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard
            title="Lucro"
            value={data.metrics.profit}
            icon={ProfitGrowthIcon}
            trend={data.comparison.profitGrowth}
            variant="profit"
          />
          <KpiCard
            title="Faturamento"
            value={data.metrics.revenue}
            icon={RevenueGrowthIcon}
            trend={data.comparison.revenueGrowth}
          />
          <KpiCard
            title="Unidades"
            value={data.metrics.itemsSold}
            icon={ShoppingCart}
            subtitle={`${data.metrics.salesCount} vendas`}
            format="number"
          />
        </div>

        {data.goals.profitTarget > 0 && !isEmptyPeriod && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-z-primary/20 bg-gradient-to-br from-z-primary/10 to-surface-card px-4 py-3">
              <p className="text-xs text-text-muted">Meta lucro da semana</p>
              <p className="text-lg font-bold text-z-primary">
                {Math.round(data.goals.profitProgress)}%
              </p>
              <p className="text-xs text-text-secondary">
                {money(data.metrics.profit)} / {money(data.goals.profitTarget)}
              </p>
            </div>
            <div className="rounded-xl border border-z-emerald/20 bg-gradient-to-br from-z-emerald/10 to-surface-card px-4 py-3">
              <p className="text-xs text-text-muted">Meta unidades da semana</p>
              <p className="text-lg font-bold text-z-emerald">
                {Math.round(data.goals.unitsProgress)}%
              </p>
              <p className="text-xs text-text-secondary">
                {data.metrics.itemsSold} / {data.goals.unitsTarget} un.
              </p>
            </div>
            {data.goals.insight && (
              <p className="rounded-xl border border-brand-yellow/25 bg-brand-yellow/[0.07] px-4 py-3 text-sm text-text-secondary sm:col-span-2">
                <span className="font-semibold text-brand-yellow">Lucro × volume · </span>
                {data.goals.insight}
              </p>
            )}
          </div>
        )}

        {!isEmptyPeriod && (
          <ChartCard
            title="Dia a dia"
            subtitle="Receita e lucro na semana"
            data={data.dailyChart}
            type="area"
            height={240}
            showLegend
          />
        )}

        {!isEmptyPeriod && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-z-primary/15 bg-gradient-to-br from-z-primary/8 to-surface-card px-4 py-3">
              <p className="text-xs text-text-muted">Lucro semana anterior</p>
              <p className="font-bold text-brand-green">
                {money(data.comparison.previousProfit)}
              </p>
            </div>
            <div className="rounded-xl border border-z-emerald/15 bg-gradient-to-br from-z-emerald/8 to-surface-card px-4 py-3">
              <p className="text-xs text-text-muted">Fat. semana anterior</p>
              <p className="font-bold">{money(data.comparison.previousRevenue)}</p>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
