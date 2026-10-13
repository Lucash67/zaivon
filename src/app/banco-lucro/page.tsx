"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownToLine, Banknote, PiggyBank, Target, Wallet } from "lucide-react";
import { ModuleShell } from "@/components/layout/module-shell";
import { PageLoader } from "@/components/ui/loading";
import { ChartCard } from "@/components/charts/chart-card";
import { EmptyModuleState } from "@/components/ui/empty-module-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { formatCurrency } from "@/lib/utils";
import type { ProfitBankView } from "@/lib/profit-bank-service";
import { SALGADO_UNIT_PRICE } from "@/lib/day-registration/pricing";
import { filterUpToDate } from "@/lib/temporal-filter";
import { isViewingGeneral, useTemporalViewContext } from "@/stores/temporal-context-store";

export default function BancoLucroPage() {
  const { activeBusinessId, withQuery } = useBusinessScope();
  const context = useTemporalViewContext();
  const queryClient = useQueryClient();
  const [editingPractical, setEditingPractical] = useState(false);
  const [practicalDraft, setPracticalDraft] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery<ProfitBankView>({
    queryKey: ["profit-bank", activeBusinessId],
    queryFn: async () => {
      const r = await fetch(withQuery("/api/profit-bank"));
      const json = await r.json();
      if (!r.ok || json.error) throw new Error(json.error || "Não foi possível carregar o cofrinho.");
      return json;
    },
    staleTime: 60_000,
  });

  const savePractical = useMutation({
    mutationFn: async (amount: number) => {
      const r = await fetch(withQuery("/api/profit-bank"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practicalBalance: amount }),
      });
      const json = await r.json();
      if (!r.ok || json.error) throw new Error(json.error || "Não foi possível salvar o saldo.");
      return json as ProfitBankView;
    },
    onSuccess: (json) => {
      queryClient.setQueryData(["profit-bank", activeBusinessId], json);
      setEditingPractical(false);
    },
  });

  const scopedHistory = useMemo(() => {
    if (!data) return [];
    return isViewingGeneral(context) ? data.history : filterUpToDate(data.history, context);
  }, [data, context]);

  const scopedBalance = scopedHistory.length ? scopedHistory[scopedHistory.length - 1]!.balance : 0;
  const scopedProfit = scopedHistory.reduce((s, d) => s + d.profit, 0);
  const scopedDays = scopedHistory.length;
  const scopedPending = scopedHistory.reduce((s, d) => s + d.pending, 0);
  const scopedLossUnits = scopedHistory.reduce((s, d) => s + d.lossesUnits, 0);
  const scopedLossImpact = scopedHistory.reduce((s, d) => s + d.lossesImpact, 0);
  const scopedCashFlow = useMemo(() => {
    const empty = {
      pixOwnSameDay: 0,
      cashSpecies: 0,
      otherChannels: 0,
      fiadoSettledLater: 0,
      quitsReceived: 0,
      estimatedPixExtrato: 0,
    };
    if (!scopedHistory.length) return empty;
    const pixOwnSameDay = scopedHistory.reduce((s, d) => s + (d.cashFlow?.pixOwnSameDay ?? 0), 0);
    const cashSpecies = scopedHistory.reduce((s, d) => s + (d.cashFlow?.cashSpecies ?? 0), 0);
    const otherChannels = scopedHistory.reduce((s, d) => s + (d.cashFlow?.otherChannels ?? 0), 0);
    const fiadoSettledLater = scopedHistory.reduce(
      (s, d) => s + (d.cashFlow?.fiadoSettledLater ?? 0),
      0,
    );
    const quitsReceived = scopedHistory.reduce(
      (s, d) => s + (d.cashFlow?.quitsReceivedToday ?? 0),
      0,
    );
    return {
      pixOwnSameDay,
      cashSpecies,
      otherChannels,
      fiadoSettledLater,
      quitsReceived,
      estimatedPixExtrato: pixOwnSameDay + quitsReceived,
    };
  }, [scopedHistory]);

  if (isError) {
    return (
      <ModuleShell title="Cofrinho" subtitle="Lucro acumulado">
        <p className="mb-3 text-text-muted">
          {error instanceof Error ? error.message : "Não foi possível carregar o cofrinho."}
        </p>
        <button type="button" className="text-sm text-brand-orange underline" onClick={() => void refetch()}>
          Tentar novamente
        </button>
      </ModuleShell>
    );
  }

  if (isLoading || !data) {
    return (
      <ModuleShell title="Cofrinho" subtitle="Lucro acumulado">
        <PageLoader />
      </ModuleShell>
    );
  }

  const historyChart = scopedHistory.map((d) => ({
    label: d.label,
    value: d.balance,
    profit: d.profit,
    revenue: d.revenue,
  }));

  const general = isViewingGeneral(context);
  const systemBalance = general ? data.currentBalance : scopedBalance;
  const profit = general ? data.totalProfit : scopedProfit;
  const openPendings = general ? data.openPendings : scopedPending;
  const lossesUnits = general ? data.lossesUnits : scopedLossUnits;
  const lossesImpact = general ? data.lossesImpact : scopedLossImpact;
  const theoreticalBalance = systemBalance + openPendings + lossesImpact;
  const frictionGap = openPendings + lossesImpact;
  const practicalBalance = general ? data.practicalBalance : scopedBalance;
  const cashFlow = general ? data.cashFlow : scopedCashFlow;
  const ledgerAdjustment = general ? (data.ledgerAdjustment ?? 0) : 0;

  return (
    <ModuleShell title="Cofrinho" subtitle="Lucro acumulado da operação">
      <div className="space-y-6">
        {scopedDays === 0 ? (
          <EmptyModuleState
            icon={PiggyBank}
            title="Cofrinho zerado"
            description="O saldo aparece depois do primeiro dia com lucro registrado."
            actionHref="/registro-dia"
            actionLabel="Registrar dia"
            compact
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl border border-brand-green/25 bg-gradient-to-br from-brand-green/10 via-surface-card to-z-primary/5 p-5">
            <div className="mb-1 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-brand-green" />
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Saldo prático
              </p>
            </div>
            {editingPractical && general ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={practicalDraft}
                  onChange={(e) => setPracticalDraft(e.target.value)}
                  className="max-w-[160px]"
                  autoFocus
                />
                <Button
                  size="sm"
                  disabled={savePractical.isPending}
                  onClick={() => {
                    const n = Number(practicalDraft.replace(",", "."));
                    if (Number.isFinite(n)) savePractical.mutate(n);
                  }}
                >
                  Salvar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingPractical(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <>
                <p className="mt-1 text-3xl font-black text-brand-green">
                  {formatCurrency(practicalBalance)}
                </p>
                <p className="mt-1 text-xs text-text-muted">Extrato / banco (com rendimento)</p>
                {general && (
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-z-emerald hover:underline"
                    onClick={() => {
                      setPracticalDraft(String(data.practicalBalance));
                      setEditingPractical(true);
                    }}
                  >
                    Atualizar saldo
                  </button>
                )}
              </>
            )}
            {savePractical.isError && (
              <p className="mt-2 text-xs text-brand-red">
                {savePractical.error instanceof Error
                  ? savePractical.error.message
                  : "Erro ao salvar"}
              </p>
            )}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-z-primary/20 bg-gradient-to-br from-z-primary/8 via-surface-card to-surface-card p-5">
            <div className="mb-1 flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-z-primary" />
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Saldo operacional
              </p>
            </div>
            <p className="mt-1 text-3xl font-black text-brand-gradient">{formatCurrency(systemBalance)}</p>
            <p className="mt-1 text-xs text-text-muted">
              Lucro dos diários · {general ? data.operationalDays : scopedDays} dias
              {general && Math.abs(ledgerAdjustment) > 0.001
                ? ` · ajuste ${formatCurrency(ledgerAdjustment)}`
                : ""}
              {general ? " · seg–sex" : ""}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-z-emerald/30 bg-gradient-to-br from-z-emerald/10 via-surface-card to-z-primary/5 p-5 sm:col-span-2 xl:col-span-1">
            <div className="mb-1 flex items-center gap-2">
              <Target className="h-4 w-4 text-z-emerald" />
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Saldo teórico pleno
              </p>
            </div>
            <p className="mt-1 text-3xl font-black text-z-emerald">{formatCurrency(theoreticalBalance)}</p>
            <p className="mt-1 text-xs text-text-muted">
              Se pendências quitassem e não houvesse perdas
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-z-primary/20 bg-surface-card/80 p-4 sm:p-5">
          <div className="mb-3 flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-z-emerald" />
            <div>
              <p className="text-sm font-semibold text-text-primary">Atrito da operação</p>
              <p className="text-xs text-text-muted">
                Quanto as pendências (ainda cobráveis) e as perdas (já perdidas) tiram do cofre pleno.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-surface-border bg-surface-base/40 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Pendências abertas
              </p>
              <p className="mt-1 text-xl font-bold text-z-emerald">{formatCurrency(openPendings)}</p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {general ? data.pendingCount : "no período"} fiado(s) esperados
              </p>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface-base/40 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Perdas
              </p>
              <p className="mt-1 text-xl font-bold text-brand-red">{formatCurrency(lossesImpact)}</p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {lossesUnits} un. × {formatCurrency(SALGADO_UNIT_PRICE)}
              </p>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface-base/40 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Gap total
              </p>
              <p className="mt-1 text-xl font-bold text-text-primary">{formatCurrency(frictionGap)}</p>
              <p className="mt-0.5 text-[11px] text-text-muted">teórico − operacional</p>
            </div>
          </div>

          {general && data.pendingItems.length > 0 && (
            <div className="mt-4 space-y-1.5 border-t border-surface-border pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Fiados em aberto
              </p>
              {data.pendingItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-text-secondary"
                >
                  <span>
                    <span className="font-medium text-text-primary">{item.clientName}</span>
                    <span className="text-text-muted"> · {item.date}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-z-emerald">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-brand-green/20 bg-surface-card/80 p-4 sm:p-5">
          <div className="mb-3 flex items-start gap-2">
            <ArrowDownToLine className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
            <div>
              <p className="text-sm font-semibold text-text-primary">Entradas vs extrato</p>
              <p className="text-xs text-text-muted">
                Onde o dinheiro das vendas pagas caiu — PIX no dia, espécie, outros canais e quits.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-brand-green/25 bg-brand-green/5 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                PIX no dia
              </p>
              <p className="mt-1 text-xl font-bold text-brand-green">
                {formatCurrency(cashFlow.pixOwnSameDay)}
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">seu extrato no dia da venda</p>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface-base/40 px-3 py-3">
              <div className="flex items-center gap-1.5">
                <Banknote className="h-3.5 w-3.5 text-text-muted" />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Espécie
                </p>
              </div>
              <p className="mt-1 text-xl font-bold text-text-primary">
                {formatCurrency(cashFlow.cashSpecies)}
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">ainda pode estar fora do banco</p>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface-base/40 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Outros canais
              </p>
              <p className="mt-1 text-xl font-bold text-text-primary">
                {formatCurrency(cashFlow.otherChannels)}
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">Henrique / colegas — não é seu PIX</p>
            </div>
            <div className="rounded-xl border border-z-emerald/25 bg-z-emerald/5 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Quits recebidos
              </p>
              <p className="mt-1 text-xl font-bold text-z-emerald">
                {formatCurrency(cashFlow.quitsReceived)}
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">fiados de dias anteriores</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-surface-border bg-surface-base/30 px-3 py-2.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Estimativa PIX no extrato
              </p>
              <p className="text-[11px] text-text-muted">PIX no dia + quits (sem espécie / sem Henrique)</p>
            </div>
            <p className="text-lg font-bold tabular-nums text-brand-green">
              {formatCurrency(cashFlow.estimatedPixExtrato)}
            </p>
          </div>
          {cashFlow.fiadoSettledLater > 0 && (
            <p className="mt-2 text-[11px] text-text-muted">
              Neste recorte, {formatCurrency(cashFlow.fiadoSettledLater)} em fiado do próprio dia
              foi quitado depois (entra em “Quits” no dia do recebimento).
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-surface-border bg-surface-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Lucro total</p>
            <p className="mt-1 text-2xl font-black text-brand-gradient">{formatCurrency(profit)}</p>
          </div>
          <div className="rounded-2xl border border-surface-border bg-surface-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Prático vs operacional
            </p>
            <p className="mt-1 text-2xl font-black text-text-primary">
              {formatCurrency(practicalBalance - systemBalance)}
            </p>
            <p className="mt-0.5 text-[11px] text-text-muted">diferença (rendimento / ajustes)</p>
          </div>
        </div>

        {scopedDays > 0 && (
          <ChartCard
            title="Evolução"
            subtitle="Saldo operacional acumulado dia a dia"
            data={historyChart}
            type="area"
            height={260}
          />
        )}

        {data.bestDay && (
          <p className="text-sm text-text-secondary">
            Melhor dia: <strong>{data.bestDay.date}</strong> ·{" "}
            <strong>{formatCurrency(data.bestDay.profit)}</strong>
          </p>
        )}
      </div>
    </ModuleShell>
  );
}
