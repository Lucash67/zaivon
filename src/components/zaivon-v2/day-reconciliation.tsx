"use client";

import type { DayClosingFinance } from "@/lib/finance/day-closing";
import { FINANCE_LABELS, PROVISIONAL_HINT } from "@/lib/finance/labels";
import type { DayFinance } from "@/lib/zaivon/finance/day";
import { compareSnapshotToLive, dayLayerFacts } from "@/lib/zaivon/finance/snapshot-vs-live";
import type { Debt, OperationDay, Settlement, VaultSnapshot } from "@/lib/zaivon/types";
import { Panel, Pill } from "@/components/zaivon-v2/ui";
import { useScreenHideMoney } from "@/components/zaivon-v2/hide-money";

type Props = {
  date?: string;
  finance: DayFinance;
  dayClosing?: DayClosingFinance | null;
  cofrinhoEnd: number | null;
  informedBalance?: number | null;
  responsiblePayment?: number | null;
  snapshotPending?: number;
  liveOpen?: number;
  settledLater?: number;
  unlinkedUnits?: number;
  dayGap?: number | null;
};

export function reconciliationExtras(day: OperationDay, debts: Debt[], settlements: Settlement[], vault: VaultSnapshot) {
  const moves = vault.movements.filter((movement) => movement.date === day.date);
  const layers = dayLayerFacts({ date: day.date, debts, settlements });
  return {
    date: day.date,
    informedBalance: [...moves].reverse().find((movement) => movement.informedBalance != null)?.informedBalance ?? null,
    responsiblePayment: [...moves].reverse().find((movement) => movement.responsiblePayment != null)?.responsiblePayment ?? null,
    snapshotPending: day.snapshotPending,
    liveOpen: layers.liveOpen,
    settledLater: layers.settledLater,
    unlinkedUnits: day.unlinkedUnits,
    dayGap: vault.gapParts.find((part) => part.date === day.date)?.amount ?? null,
  };
}

/**
 * Explica por que faturamento, caixa, lucros e depósito/cofrinho diferem —
 * sem forçar os indicadores a coincidir.
 */
export function DayReconciliationPanel({
  date,
  finance,
  dayClosing,
  cofrinhoEnd,
  informedBalance = null,
  responsiblePayment = null,
  snapshotPending,
  liveOpen,
  settledLater,
  unlinkedUnits,
  dayGap = null,
}: Props) {
  const { money } = useScreenHideMoney();
  const dc = dayClosing;
  const provisional = finance.competenceStatus === "provisional" || dc?.competenceStatus === "provisional";
  const deposit = dc?.piggyBank.deposit;
  const gapFatCash = dc?.reconciliation.competenceMinusCash ?? finance.competenceRevenue - finance.cashIn;
  const gapCompCash = dc?.reconciliation.competenceProfitMinusCashResult ?? finance.competenceProfit - finance.operationalProfit;
  const depositGap =
    deposit != null ? dc!.reconciliation.depositMinusCashResult : null;

  const informedGap = informedBalance != null && cofrinhoEnd != null ? Math.round((informedBalance - cofrinhoEnd) * 100) / 100 : null;
  const rows: Array<{ label: string; value: string; note: string }> = [
    {
      label: FINANCE_LABELS.competenceRevenue.short,
      value: money(finance.competenceRevenue),
      note: provisional ? "Provisório enquanto houver diferença entre o diário e as vendas." : "Vendas do dia, inclusive fiados.",
    },
    {
      label: "Recebido das vendas do dia",
      value: money(finance.received),
      note: "Só o que as vendas deste dia receberam.",
    },
    {
      label: "Quitações antigas",
      value: money(finance.settlements),
      note: "Dinheiro de vendas de dias anteriores. Não entra de novo na competência.",
    },
    {
      label: FINANCE_LABELS.cashIn.short,
      value: money(finance.cashIn),
      note: "Recebido do dia + quitações antigas + outras entradas.",
    },
    {
      label: "Fiados novos",
      value: money(finance.newCredit),
      note: "Competência ainda não recebida.",
    },
    {
      label: "Custos",
      value: money(finance.ownCost),
      note: finance.thirdPartyCost > 0 ? `Custo próprio. Terceiros: ${money(finance.thirdPartyCost)}.` : "Custo próprio.",
    },
    {
      label: FINANCE_LABELS.cashManagementResult.short,
      value: money(finance.operationalProfit),
      note: "Caixa operacional − custo próprio.",
    },
    {
      label: FINANCE_LABELS.competenceProfit.short,
      value: money(finance.competenceProfit),
      note: provisional ? "Resultado por competência provisório." : "Faturamento − custo próprio.",
    },
    {
      label: "Pagamento definido",
      value: responsiblePayment != null ? money(responsiblePayment) : "—",
      note: "Definido pelo responsável. Não é custo, lucro nem depósito.",
    },
    {
      label: FINANCE_LABELS.piggyDeposit.short,
      value: deposit != null ? money(deposit) : "—",
      note: "Depósito registrado no razão.",
    },
    {
      label: "Saldo do razão",
      value: cofrinhoEnd != null ? money(cofrinhoEnd) : "—",
      note: "Fechamento contábil do dia.",
    },
    {
      label: "Saldo informado",
      value: informedBalance != null ? money(informedBalance) : "—",
      note: "Valor observado. A origem da diferença não está identificada.",
    },
    {
      label: "Diferença não conciliada",
      value: informedGap != null ? money(informedGap) : "—",
      note: dayGap != null
        ? `Acumulada até este fechamento. Neste dia entrou ${money(dayGap)}, origem não identificada. Não é rendimento.`
        : "Acumulada até este fechamento. Não é rendimento.",
    },
  ];

  return (
    <Panel
      title="Conciliação do dia"
      subtitle="Por que faturamento, caixa, lucros e depósito podem diferir — sem forçar igualdade."
      action={provisional ? <Pill tone="pending">Provisório</Pill> : undefined}
    >
      {provisional && <p className="mb-3 text-xs text-o-pending">{PROVISIONAL_HINT}</p>}

      <div className="min-w-0 max-w-full overflow-x-auto">
        <table className="num w-full min-w-[480px] text-sm">
          <thead className="text-left text-xs text-o-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Indicador</th>
              <th className="py-2 pr-3">Valor</th>
              <th className="py-2">Origem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-o-border/60">
                <td className="py-2 pr-3 font-medium">{r.label}</td>
                <td className="py-2 pr-3">{r.value}</td>
                <td className="py-2 text-xs text-o-muted-foreground">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {snapshotPending != null && liveOpen != null && settledLater != null && (
        <p className="mt-3 text-xs text-o-muted-foreground">
          {compareSnapshotToLive({ snapshotPending, liveOpen, settledLater })}
        </p>
      )}
      {unlinkedUnits != null && unlinkedUnits > 0 && (
        <p className="mt-2 text-xs text-o-muted-foreground">
          Saídas sem vínculo: {unlinkedUnits} unidades, fora da competência e sem classificação de perda.
          {date === "2026-10-28" && unlinkedUnits === 5
            ? " No fechamento, são R$ 25. A taxa registrada é 5/35 = 14,29%: Acal 5/18 e Unifor 0/17."
            : ""}
        </p>
      )}
      <ul className="mt-3 grid gap-1.5 text-xs text-o-muted-foreground">
        <li>
          Faturamento − caixa = {money(gapFatCash)}
          {dc
            ? ` (fiados novos ${money(dc.newCredit)} − quitações ${money(dc.cash.priorSettlements)}${dc.cash.otherInflows ? ` − outras ${money(dc.cash.otherInflows)}` : ""})`
            : ""}
          .
        </li>
        <li>
          Lucro competência − resultado caixa = {money(gapCompCash)}
          {finance.bonus ? ` · bônus do dia ${money(finance.bonus)} no lucro final` : ""}.
        </li>
        {depositGap != null && (
          <li>
            Depósito − resultado caixa = {money(depositGap)}
            {Math.abs(depositGap) < 0.01
              ? " (depósito alinhado ao gerencial de caixa)."
              : " (depósito diferente do gerencial — conferir extrato)."}
          </li>
        )}
      </ul>

      {dc?.provisionalCompetence && (
        <div className="mt-3 rounded-xl bg-o-pending/10 p-3 text-xs">
          <p className="font-medium text-o-pending">Competência — duas leituras (não confirmadas como iguais)</p>
          <p className="mt-1 text-o-muted-foreground">
            Diário: fat {money(dc.provisionalCompetence.fromDiary.revenue)} → lucro{" "}
            {money(dc.provisionalCompetence.fromDiary.profit)} · {dc.provisionalCompetence.fromDiary.formula}
          </p>
          <p className="mt-1 text-o-muted-foreground">
            Sales: fat {money(dc.provisionalCompetence.fromIdentifiedSales.revenue)} → lucro{" "}
            {money(dc.provisionalCompetence.fromIdentifiedSales.profit)} ·{" "}
            {dc.provisionalCompetence.fromIdentifiedSales.formula}
          </p>
          <p className="mt-1 font-medium text-o-pending">Δ R$ {dc.provisionalCompetence.gap.toFixed(0)} PENDENTE</p>
        </div>
      )}

      {dc?.cashAtClose && (
        <div className="mt-3 rounded-xl bg-o-surface p-3 text-xs text-o-muted-foreground">
          <p className="font-medium text-o-foreground">Caixa na data do fechamento (não usar status atuais)</p>
          <p className="mt-1">
            Diário {money(dc.cashAtClose.diaryCash)} · day paid at close {money(dc.cashAtClose.daySalesPaidAtClose)} +
            quitações {money(dc.cashAtClose.priorSettlements)} = reconstruído {money(dc.cashAtClose.reconstructedCash)} ·
            snapshot atual paid {money(dc.cashAtClose.currentPaidSnapshot)} (enganoso se houver quitações posteriores).
          </p>
        </div>
      )}

      {dc?.reconciliation.notes?.length ? (
        <details className="mt-3 text-xs text-o-muted-foreground">
          <summary className="cursor-pointer">Notas de conciliação</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {dc.reconciliation.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </Panel>
  );
}
