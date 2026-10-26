"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useZaivon } from "@/components/zaivon-v2/store";
import { COFRINHO_TOLERANCE, dayFinance, impliedYield } from "@/lib/zaivon/finance/day";
import { monthDays, monthSummary } from "@/lib/zaivon/finance/month";
import { ddmm } from "@/lib/zaivon/format";
import { chartAxis, chartTooltip, Kpi, PageHeader, Panel, Pill } from "@/components/zaivon-v2/ui";
import { DayReconciliationPanel } from "@/components/zaivon-v2/day-reconciliation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/zaivon-v2/primitives";
import { HideMoneyScope, ScreenHideMoneyButton, useScreenHideMoney } from "@/components/zaivon-v2/hide-money";
import { FINANCE_LABELS } from "@/lib/finance/labels";

export function Dinheiro() {
  return (
    <HideMoneyScope screenId="v2-dinheiro">
      <DinheiroBody />
    </HideMoneyScope>
  );
}

function DinheiroBody() {
  const o = useZaivon();
  const { money, axisTick } = useScreenHideMoney();
  const ms = monthSummary(o.days, o.settlements, o.plan);
  const md = monthDays(o.days, o.plan);
  const rows = md.map((d) => {
    const f = dayFinance(d, o.settlements);
    const y = impliedYield(d, o.days, o.settlements, o.plan);
    return {
      date: ddmm(d.date),
      fullDate: d.date,
      provisional: f.competenceStatus === "provisional",
      ...f,
      cofrinho: d.cofrinhoEnd,
      yield: y,
      ok: y == null ? null : y >= -0.5 && y <= COFRINHO_TOLERANCE,
    };
  });
  const selected = o.selectedDay;
  const selectedFinance = dayFinance(selected, o.settlements);
  const vaultPoints = o.vault.movements
    .filter((movement) => !rows.some((row) => row.fullDate === movement.date))
    .map((movement) => ({
      date: ddmm(movement.date),
      fullDate: movement.date,
      provisional: false,
      cofrinho: movement.balanceAfter,
    }));
  const chartRows = [...rows, ...vaultPoints].sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Dinheiro" question={`Onde está meu dinheiro? · ${o.plan.label} · 5 dimensões`} right={<ScreenHideMoneyButton />} />
      <Tabs defaultValue="cofrinho">
        <TabsList className="flex w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="cofrinho">Cofrinho</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de caixa</TabsTrigger>
          <TabsTrigger value="custos">Custos & lucro</TabsTrigger>
          <TabsTrigger value="conciliacao">Conciliação do dia</TabsTrigger>
        </TabsList>

        <TabsContent value="cofrinho" className="mt-4 grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi
              big
              tone="info"
              label="Saldo atual"
              value={money(o.vault.balance)}
              formula="Saldo do razão: saldo confirmado mais as movimentações posteriores. Depósito não é lucro."
              explain={o.vault.asOf ? `Atualizado em ${ddmm(o.vault.asOf)}. O fechamento de cada dia permanece o saldo daquela data.` : "Nenhuma movimentação no razão."}
            />
            <Kpi
              tone="ok"
              label={FINANCE_LABELS.bankOfMonth.short}
              value={money(ms.bank)}
              formula={FINANCE_LABELS.bankOfMonth.formula}
              explain={`${money(ms.diaryProfit)} de ${FINANCE_LABELS.cashManagementResult.short.toLowerCase()} + ${money(ms.yields)} rendimentos. O último fechamento diário é ${money(ms.lastCofrinho)}.`}
            />
            <Kpi label="Rendimentos" value={money(ms.yields)} formula="Banco do mês − resultados de caixa do diário. Entra no banco, mas não é lucro." explain={`≈ ${money(ms.avgYieldPerDay)} por dia`} />
          </div>
          <Panel title="Evolução do cofrinho" subtitle={`Saldo no fim de cada dia · ${o.plan.label}`}>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={chartRows} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" {...chartAxis} />
                  <YAxis {...chartAxis} domain={["dataMin - 100", "dataMax + 50"]} tickFormatter={axisTick} width={70} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => money(v)} />
                  <Line type="monotone" dataKey="cofrinho" name="Cofrinho" stroke="var(--color-info)" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Movimentações do cofrinho" subtitle="Independentes do dia operacional. Uma transferência não é receita.">
            <div className="overflow-x-auto">
              <table className="num w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs text-o-muted-foreground">
                  <tr>
                    <th className="py-2">Data</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Saldo após</th>
                  </tr>
                </thead>
                <tbody>
                  {o.vault.movements.map((movement) => (
                    <tr key={movement.id} className="border-t">
                      <td className="py-2">{ddmm(movement.date)}</td>
                      <td>{movement.type === "opening_balance" ? "Saldo confirmado" : movement.type === "deposit" ? "Depósito" : movement.type === "withdrawal" ? "Retirada" : movement.type === "transfer" ? "Transferência" : movement.type === "yield" ? "Rendimento" : movement.type === "reversal" ? "Estorno" : movement.type === "reclassification" ? "Reclassificação" : "Ajuste"}</td>
                      <td>{movement.effect === "credit" ? money(movement.amount) : `−${money(movement.amount)}`}</td>
                      <td>{money(movement.balanceAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {o.vault.movements.length === 0 ? <p className="text-sm text-o-muted-foreground">Nenhuma movimentação persistida.</p> : null}
          </Panel>
          <Panel
            title="Batimento diário"
            subtitle="Batimento: saldo − (abertura + depósito − retirada + rendimento). Não comparar com resultado de caixa (tol. R$ 5)"
          >
            <div className="overflow-x-auto">
              <table className="num w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs text-o-muted-foreground">
                  <tr>
                    <th className="py-2">Dia</th>
                    <th>Resultado caixa</th>
                    <th>Rendimento</th>
                    <th>Saldo cofrinho</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.date} className="border-t">
                      <td className="py-2">
                        <span className="inline-flex items-center gap-1.5">
                          {r.date}
                          {r.provisional ? <Pill tone="pending">P</Pill> : null}
                        </span>
                      </td>
                      <td>{money(r.profit)}</td>
                      <td>{r.yield != null ? money(r.yield) : "—"}</td>
                      <td>{r.cofrinho != null ? money(r.cofrinho) : "—"}</td>
                      <td>
                        {r.ok == null ? (
                          <Pill tone="neutral">sem dado</Pill>
                        ) : r.ok ? (
                          <Pill tone="ok">OK</Pill>
                        ) : (
                          <Pill tone="alert">revisar</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="fluxo" className="mt-4 grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              big
              label="Entrada no mês"
              value={money(ms.cashIn)}
              formula="Soma de (vendas do dia + quitações + outras entradas)"
            />
            <Kpi tone="ok" label="Vendas do próprio dia" value={money(rows.reduce((s, r) => s + r.received, 0))} />
            <Kpi tone="ok" label="Quitações" value={money(rows.reduce((s, r) => s + r.settlements, 0))} explain="Contam no dia em que entram" />
            <Kpi
              tone="pending"
              label="Outras entradas"
              value={money(rows.reduce((s, r) => s + r.otherInflows, 0))}
              explain="Crédito sem origem / demais — já no caixa, sem venda inventada"
            />
          </div>
          <Panel title="Entrada no caixa por dia" subtitle={`R$ · vendas × quitações × outras · ${o.plan.label}`}>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={rows}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" {...chartAxis} />
                  <YAxis {...chartAxis} tickFormatter={axisTick} width={60} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => money(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="received" name="Vendas do dia" stackId="a" fill="var(--color-ok)" />
                  <Bar dataKey="settlements" name="Quitações" stackId="a" fill="var(--color-pending)" />
                  <Bar dataKey="otherInflows" name="Outras" stackId="a" fill="var(--color-info)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="custos" className="mt-4 grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              big
              tone="ok"
              label={`${FINANCE_LABELS.cashManagementResult.short} (mês)`}
              value={money(ms.diaryProfit)}
              formula={FINANCE_LABELS.cashManagementResult.formula}
              explain={`${money(ms.cashIn)} + ${money(ms.bonus)} bônus − ${money(ms.ownCost)}`}
            />
            <Kpi
              label={`${FINANCE_LABELS.competenceProfit.short} (mês)`}
              value={money(rows.filter((r) => r.competenceStatus !== "provisional").reduce((s, r) => s + r.competenceProfit, 0))}
              formula="Σ dias com competência confirmada (exclui provisórios)"
              explain={`Provisórios excluídos: ${rows.filter((r) => r.competenceStatus === "provisional").length} dia(s). Não é depósito automático no cofrinho.`}
            />
            <Kpi tone="third" label="Meu custo" value={money(ms.ownCost)} />
            <Kpi tone="third" label="Terceiros" value={money(ms.thirdPartyCost)} explain="Não entra no meu lucro" />
          </div>
          <Panel title="Competência × caixa × custo" subtitle={`Método ZAIVON · 5 dimensões · ${o.plan.label}`}>
            <div className="h-64 min-h-[16rem]">
              <ResponsiveContainer>
                <BarChart data={rows}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" {...chartAxis} />
                  <YAxis {...chartAxis} tickFormatter={axisTick} width={60} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => money(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="competenceRevenue" name={FINANCE_LABELS.competenceRevenue.short} fill="var(--color-info)" />
                  <Bar dataKey="cashIn" name={FINANCE_LABELS.cashIn.short} fill="var(--color-pending)" />
                  <Bar dataKey="ownCost" name="Meu custo" fill="var(--color-third)" />
                  <Bar dataKey="competenceProfit" name={FINANCE_LABELS.competenceProfit.short} fill="var(--color-muted-foreground)" />
                  <Bar dataKey="profit" name={FINANCE_LABELS.cashManagementResult.short} fill="var(--color-ok)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="conciliacao" className="mt-4 grid gap-4">
          <p className="text-sm text-o-muted-foreground">
            Dia selecionado na faixa superior: <strong className="text-o-foreground">{selected.date}</strong>
            {selectedFinance.competenceStatus === "provisional" ? " · provisório" : ""}.
          </p>
          <DayReconciliationPanel
            finance={selectedFinance}
            dayClosing={selected.dayClosing}
            cofrinhoEnd={selected.cofrinhoEnd}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
