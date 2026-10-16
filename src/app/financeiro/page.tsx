"use client";
import { useFormatMoney } from "@/hooks/use-hide-money";

import { useQuery } from "@tanstack/react-query";
import { ModuleShell } from "@/components/layout/module-shell";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartCard } from "@/components/charts/chart-card";
import { PageLoader } from "@/components/ui/loading";
import { Card, CardContent } from "@/components/ui/card";
import { ExecutiveSummary } from "@/components/executive/executive-summary";
import { SectionPanel } from "@/components/executive/section-panel";
import { HeroMetric } from "@/components/executive/hero-metric";
import { DollarSign, TrendingUp, Wallet, PiggyBank, ArrowDownUp, Banknote, UserCircle } from "lucide-react";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { useTemporalViewContext } from "@/stores/temporal-context-store";
import { temporalQueryParams } from "@/lib/temporal-filter";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FinancialData {
  grossRevenue: number;
  netRevenue: number;
  operationalProfit: number;
  personalProfit: number;
  workingCapital: number;
  initialInvestment: number;
  investmentsSummary: string;
  investments: Array<{
    id: string;
    description: string;
    amount: number;
    type: string;
    date: string;
    sourceType: string | null;
    sourceName: string | null;
  }>;
  operatorFinance: {
    operation: {
      revenue: number;
      investment: number;
      operationalProfit: number;
      margin: number;
      roi: number;
    };
    operator: {
      ownInvestment: number;
      thirdPartyInvestment: number;
      cashIn: number;
      cashOut: number;
      operatorNetGain: number;
      investmentSources: Array<{ label: string; amount: number }>;
    };
    reconciliation: {
      gap: number;
      hasGap: boolean;
      narrative: string | null;
    };
  };
  cashFlow: { income: number; expenses: number; balance: number };
  monthlyChart: Array<{ label: string; value: number; profit?: number; revenue?: number }>;
  scope?: {
    mode: "general" | "day" | "range";
    date?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export default function FinanceiroPage() {
  const money = useFormatMoney();
  const { activeBusinessId, withQuery } = useBusinessScope();
  const context = useTemporalViewContext();
  const scopeParams = temporalQueryParams(context);
  const financialUrl =
    Object.keys(scopeParams).length === 0
      ? withQuery("/api/financial")
      : withQuery(`/api/financial?${new URLSearchParams(scopeParams)}`);

  const { data, isLoading, isError, error } = useQuery<FinancialData>({
    queryKey: [
      "financial",
      activeBusinessId,
      context.mode,
      context.viewDate,
      context.dateFrom,
      context.dateTo,
    ],
    queryFn: async () => {
      const r = await fetch(financialUrl);
      const json = await r.json();
      if (!r.ok || json.error) {
        throw new Error(json.error || "Não foi possível carregar o financeiro.");
      }
      return json;
    },
    staleTime: 120_000,
  });

  const scopeMatches =
    !data?.scope ||
    (context.mode === "general" && data.scope.mode === "general") ||
    (context.mode === "day" &&
      data.scope.mode === "day" &&
      (!data.scope.date || data.scope.date === context.viewDate)) ||
    (context.mode === "range" &&
      data.scope.mode === "range" &&
      data.scope.dateFrom === context.dateFrom &&
      data.scope.dateTo === context.dateTo);

  if (isError) {
    return (
      <ModuleShell title="Financeiro" subtitle="Visão executiva das finanças">
        <p className="text-text-muted">
          {error instanceof Error ? error.message : "Não foi possível carregar o financeiro."}
        </p>
      </ModuleShell>
    );
  }

  if (isLoading || !data || !scopeMatches) {
    return (
      <ModuleShell title="Financeiro" subtitle="Visão executiva das finanças">
        <PageLoader />
      </ModuleShell>
    );
  }

  const { operation, operator, reconciliation } = data.operatorFinance;
  const isScoped = data.scope?.mode === "day" || data.scope?.mode === "range";
  const scopeLabel =
    data.scope?.mode === "range" && data.scope.dateFrom && data.scope.dateTo
      ? `Período ${format(parseISO(data.scope.dateFrom), "dd/MM/yyyy", { locale: ptBR })} – ${format(parseISO(data.scope.dateTo), "dd/MM/yyyy", { locale: ptBR })}`
      : data.scope?.mode === "day"
        ? `Acumulado até ${format(parseISO(context.viewDate), "dd/MM/yyyy", { locale: ptBR })}`
        : "Histórico completo";
  const resultPositive = data.operationalProfit >= 0;
  const operatorPositive = operator.operatorNetGain >= 0;
  const conclusion = resultPositive
    ? `Resultado operacional positivo de ${money(data.operationalProfit)}. Saldo de caixa: ${money(data.cashFlow.balance)}.`
    : `Resultado operacional negativo. Revise despesas — saldo atual: ${money(data.cashFlow.balance)}.`;
  const operatorConclusion =
    reconciliation.narrative ??
    (operatorPositive
      ? `Ganho líquido do operador: ${money(operator.operatorNetGain)}.`
      : `Posição do operador negativa: ${money(operator.operatorNetGain)}.`);

  return (
    <ModuleShell title="Financeiro" subtitle={scopeLabel}>
      <div className="space-y-5">
        <ExecutiveSummary
          theme="finance"
          title={isScoped ? "Resumo acumulado" : "Resumo Financeiro"}
          conclusion={conclusion}
          items={[
            { label: "Entradas", value: money(data.cashFlow.income), highlight: true },
            { label: "Saídas", value: money(data.cashFlow.expenses) },
            { label: "Saldo", value: money(data.cashFlow.balance), highlight: true },
            {
              label: "Resultado",
              value: money(data.operationalProfit),
              highlight: resultPositive,
            },
          ]}
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HeroMetric
            label="Faturamento (competência)"
            value={data.grossRevenue}
            icon={DollarSign}
            theme="finance"
            subtext="Legado ≈ receita bruta do período"
          />
          <HeroMetric
            label="Lucro operacional (legado)"
            value={data.operationalProfit}
            icon={TrendingUp}
            theme="finance"
            subtext={`Não confundir com resultado gerencial de caixa · líquida ${money(data.netRevenue)}`}
          />
          <HeroMetric
            label="Entrada no caixa"
            value={operator.cashIn}
            icon={ArrowDownUp}
            theme="finance"
            subtext="Recebimentos efetivos no período"
          />
          <HeroMetric
            label="Ganho do operador"
            value={operator.operatorNetGain}
            icon={UserCircle}
            theme="finance"
            subtext={`Próximo do resultado de caixa · próprio ${money(operator.ownInvestment)}`}
            valueTone={operatorPositive ? "success" : "warning"}
          />
        </div>
        <p className="rounded-xl border border-border/60 bg-surface-2/40 px-3 py-2 text-xs text-text-muted">
          Módulo legado · Método ZAIVON v2 (5 dimensões): faturamento por competência, entrada no caixa, lucro por
          competência, resultado gerencial de caixa e saldo/depósito do cofrinho são separados — o lucro calculado não
          deposita sozinho no cofrinho. Preferir <span className="text-text-primary">/v2</span> para o dia a dia.
        </p>

        <SectionPanel theme="finance" title="Indicadores operacionais" subtitle="Desempenho do negócio">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard title="Receita Líquida" value={data.netRevenue} icon={DollarSign} delay={0} />
            <KpiCard
              title="Investimento Operacional"
              value={operation.investment}
              icon={Banknote}
              delay={1}
              subtitle={`Margem ${operation.margin.toFixed(0)}% · ROI ${operation.roi.toFixed(0)}%`}
            />
            <KpiCard title="Capital de Giro" value={data.workingCapital} icon={Wallet} delay={2} />
            <KpiCard
              title="Investimentos (total)"
              value={data.initialInvestment}
              icon={Banknote}
              delay={3}
              subtitle={data.investmentsSummary}
            />
          </div>
        </SectionPanel>

        <SectionPanel theme="finance" title="Posição do operador" subtitle="Situação financeira pessoal">
          <ExecutiveSummary
            theme="finance"
            title="Operador"
            conclusion={operatorConclusion}
            items={[
              { label: "Entrada caixa", value: money(operator.cashIn), highlight: true },
              { label: "Saída caixa", value: money(operator.cashOut) },
              {
                label: "Ganho líquido",
                value: money(operator.operatorNetGain),
                highlight: operatorPositive,
              },
              { label: "Invest. próprio", value: money(operator.ownInvestment) },
            ]}
          />
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard
              title="Ganho Líquido do Operador"
              value={operator.operatorNetGain}
              icon={UserCircle}
              variant="profit"
              delay={0}
            />
            <KpiCard
              title="Invest. Terceiros"
              value={operator.thirdPartyInvestment}
              icon={PiggyBank}
              delay={1}
              subtitle={
                operator.investmentSources.length > 0
                  ? operator.investmentSources.map((s) => s.label).join(" · ")
                  : "Sem fonte registrada"
              }
            />
            <KpiCard title="Lucro Operacional" value={data.operationalProfit} icon={TrendingUp} delay={2} />
          </div>
          {reconciliation.hasGap && reconciliation.narrative && (
            <p className="mt-4 rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-4 py-3 text-sm leading-relaxed text-text-secondary">
              {reconciliation.narrative}
            </p>
          )}
        </SectionPanel>

        <Card className="border-brand-green/20">
          <CardContent className="pt-5">
            <div className="mb-3 flex items-center gap-2">
              <ArrowDownUp className="h-4 w-4 text-brand-green" />
              <h3 className="text-sm font-semibold text-brand-green">Fluxo de Caixa</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-brand-green/10 p-3 text-center transition-transform hover:scale-[1.02] sm:p-4">
                <p className="label-upper mb-1">Entradas</p>
                <p className="text-xl font-bold text-brand-green sm:text-2xl">
                  {money(data.cashFlow.income)}
                </p>
              </div>
              <div className="rounded-xl bg-brand-red/10 p-3 text-center transition-transform hover:scale-[1.02] sm:p-4">
                <p className="label-upper mb-1">Saídas</p>
                <p className="text-xl font-bold text-brand-red sm:text-2xl">
                  {money(data.cashFlow.expenses)}
                </p>
              </div>
              <div className="col-span-2 rounded-xl bg-brand-orange/10 p-3 text-center transition-transform hover:scale-[1.02] sm:col-span-1 sm:p-4">
                <p className="label-upper mb-1">Saldo</p>
                <p className="text-xl font-bold text-brand-orange sm:text-2xl">
                  {money(data.cashFlow.balance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <SectionPanel theme="finance" title="Tendencia" subtitle={isScoped ? "Ultimos 30 dias ate a data selecionada" : "Faturamento mensal"}>
          <ChartCard data={data.monthlyChart} title={isScoped ? "Faturamento diario" : "Faturamento Mensal"} type="area" height={320} />
        </SectionPanel>
      </div>
    </ModuleShell>
  );
}
