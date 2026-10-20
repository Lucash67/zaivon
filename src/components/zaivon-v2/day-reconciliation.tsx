"use client";

import type { DayClosingFinance } from "@/lib/finance/day-closing";
import { FINANCE_LABELS, PROVISIONAL_HINT } from "@/lib/finance/labels";
import type { DayFinance } from "@/lib/zaivon/finance/day";
import { Panel, Pill } from "@/components/zaivon-v2/ui";
import { useScreenHideMoney } from "@/components/zaivon-v2/hide-money";

type Props = {
  finance: DayFinance;
  dayClosing?: DayClosingFinance | null;
  cofrinhoEnd: number | null;
};

/**
 * Explica por que faturamento, caixa, lucros e depósito/cofrinho diferem —
 * sem forçar os indicadores a coincidir.
 */
export function DayReconciliationPanel({ finance, dayClosing, cofrinhoEnd }: Props) {
  const { money } = useScreenHideMoney();
  const dc = dayClosing;
  const provisional = finance.competenceStatus === "provisional" || dc?.competenceStatus === "provisional";
  const deposit = dc?.piggyBank.deposit;
  const gapFatCash = dc?.reconciliation.competenceMinusCash ?? finance.competenceRevenue - finance.cashIn;
  const gapCompCash = dc?.reconciliation.competenceProfitMinusCashResult ?? finance.competenceProfit - finance.operationalProfit;
  const depositGap =
    deposit != null ? dc!.reconciliation.depositMinusCashResult : null;

  const rows: Array<{ label: string; value: string; note: string }> = [
    {
      label: FINANCE_LABELS.competenceRevenue.short,
      value: money(finance.competenceRevenue),
      note: provisional
        ? "Working figure (provisório se houver Δ diário×sales)."
        : "Inclui fiados do dia.",
    },
    {
      label: FINANCE_LABELS.cashIn.short,
      value: money(finance.cashIn),
      note:
        finance.otherInflows > 0
          ? `${money(finance.received)} vendas do dia + ${money(finance.settlements)} quitações + ${money(finance.otherInflows)} outras (ex.: crédito sem origem).`
          : `${money(finance.received)} vendas do dia + ${money(finance.settlements)} quitações.`,
    },
    {
      label: FINANCE_LABELS.competenceProfit.short,
      value: money(finance.competenceProfit),
      note: provisional ? "PROVISÓRIO — ver par diário/sales abaixo." : "Faturamento − meu custo.",
    },
    {
      label: FINANCE_LABELS.cashManagementResult.short,
      value: money(finance.operationalProfit),
      note: "Caixa − meu custo (sem bônus neste card).",
    },
    {
      label: FINANCE_LABELS.piggyDeposit.short,
      value: deposit != null ? money(deposit) : "—",
      note: deposit != null ? "Transferência efetiva registrada no dayClosing." : "Sem depósito explícito neste snapshot.",
    },
    {
      label: FINANCE_LABELS.piggyBalance.short,
      value: cofrinhoEnd != null ? money(cofrinhoEnd) : "—",
      note: "Saldo informado no Mercado Pago.",
    },
  ];

  return (
    <Panel
      title="Conciliação do dia"
      subtitle="Por que faturamento, caixa, lucros e depósito podem diferir — sem forçar igualdade."
      action={provisional ? <Pill tone="pending">Provisório</Pill> : undefined}
    >
      {provisional && <p className="mb-3 text-xs text-o-pending">{PROVISIONAL_HINT}</p>}

      <div className="overflow-x-auto">
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
