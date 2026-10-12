"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useOmni } from "@/components/omni-v2/store";
import { COFRINHO_TOLERANCE, dayFinance, impliedYield } from "@/lib/omni/finance/day";
import { monthDays, monthSummary } from "@/lib/omni/finance/month";
import { ddmm, money } from "@/lib/omni/format";
import { chartAxis, chartTooltip, Kpi, PageHeader, Panel, Pill } from "@/components/omni-v2/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/omni-v2/primitives";


export function Dinheiro() {
  const o = useOmni();
  const ms = monthSummary(o.days, o.settlements, o.plan);
  const md = monthDays(o.days, o.plan);
  const rows = md.map((d) => {
    const f = dayFinance(d, o.settlements);
    const y = impliedYield(d, o.days, o.settlements, o.plan);
    return { date: ddmm(d.date), ...f, cofrinho: d.cofrinhoEnd, yield: y, ok: y == null ? null : y >= -0.5 && y <= COFRINHO_TOLERANCE };
  });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Dinheiro" question={`Onde está meu dinheiro? · ${o.plan.label}`} />
      <Tabs defaultValue="cofrinho">
        <TabsList><TabsTrigger value="cofrinho">Cofrinho</TabsTrigger><TabsTrigger value="fluxo">Fluxo de caixa</TabsTrigger><TabsTrigger value="custos">Custos & lucro</TabsTrigger></TabsList>

        <TabsContent value="cofrinho" className="mt-4 grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi big tone="info" label="Cofrinho hoje" value={money(ms.lastCofrinho)} formula="Saldo real no Mercado Pago (fonte da verdade)" explain={`Início do mês: ${money(o.plan.practicalAtStart)}`} />
            <Kpi tone="ok" label="Banco do mês" value={money(ms.bank)} formula="Cofrinho atual − cofrinho no início do mês" explain={`${money(ms.diaryProfit)} de lucro + ${money(ms.yields)} rendimentos`} />
            <Kpi label="Rendimentos" value={money(ms.yields)} formula="Banco do mês − lucro do diário. Entra no banco, mas não é lucro." explain={`≈ ${money(ms.avgYieldPerDay)} por dia`} />
          </div>
          <Panel title="Evolução do cofrinho" subtitle={`R$ no fim de cada dia · ${o.plan.label}`}>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={rows} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" {...chartAxis} />
                  <YAxis {...chartAxis} domain={["dataMin - 100", "dataMax + 50"]} tickFormatter={(v) => `R$ ${Math.round(v)}`} width={70} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => money(v)} />
                  <Line type="monotone" dataKey="cofrinho" name="Cofrinho" stroke="var(--color-info)" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Batimento diário" subtitle="Variação do cofrinho ≈ lucro + rendimento (tolerância R$ 5)">
            <div className="overflow-x-auto">
              <table className="num w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs text-o-muted-foreground"><tr><th className="py-2">Dia</th><th>Lucro</th><th>Rendimento</th><th>Cofrinho</th><th>Status</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.date} className="border-t"><td className="py-2">{r.date}</td><td>{money(r.profit)}</td><td>{r.yield != null ? money(r.yield) : "—"}</td><td>{r.cofrinho != null ? money(r.cofrinho) : "—"}</td><td>{r.ok == null ? <Pill tone="neutral">sem dado</Pill> : r.ok ? <Pill tone="ok">OK</Pill> : <Pill tone="alert">revisar</Pill>}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="fluxo" className="mt-4 grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi big label="Entrada no mês" value={money(ms.cashIn)} formula="Soma de (recebido do dia + quitações)" />
            <Kpi tone="ok" label="Vendas do próprio dia" value={money(rows.reduce((s, r) => s + r.received, 0))} />
            <Kpi tone="ok" label="Quitações" value={money(rows.reduce((s, r) => s + r.settlements, 0))} explain="Contam no dia em que entram" />
          </div>
          <Panel title="Entrada no caixa por dia" subtitle={`R$ · vendas do dia × quitações · ${o.plan.label}`}>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={rows}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" {...chartAxis} />
                  <YAxis {...chartAxis} tickFormatter={(v) => `R$ ${v}`} width={60} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => money(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="received" name="Vendas do dia" stackId="a" fill="var(--color-ok)" />
                  <Bar dataKey="settlements" name="Quitações" stackId="a" fill="var(--color-pending)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="custos" className="mt-4 grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Kpi big tone="ok" label="Lucro do mês" value={money(ms.diaryProfit)} explain={`${money(ms.cashIn)} + ${money(ms.bonus)} bônus − ${money(ms.ownCost)}`} />
            <Kpi tone="third" label="Meu custo" value={money(ms.ownCost)} />
            <Kpi tone="third" label="Terceiros" value={money(ms.thirdPartyCost)} explain="Não entra no meu lucro" />
            <Kpi label="Custo econômico" value={money(ms.ownCost + ms.thirdPartyCost)} formula="Meu custo + terceiros" />
          </div>
          <Panel title="Meu custo × terceiros × lucro" subtitle={`R$ por dia · ${o.plan.label}`}>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={rows}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="date" {...chartAxis} />
                  <YAxis {...chartAxis} tickFormatter={(v) => `R$ ${v}`} width={60} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => money(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="ownCost" name="Meu custo" fill="var(--color-third)" />
                  <Bar dataKey="thirdPartyCost" name="Terceiros" fill="var(--color-muted-foreground)" />
                  <Bar dataKey="profit" name="Lucro" fill="var(--color-ok)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
