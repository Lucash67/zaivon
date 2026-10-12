"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useOmni } from "@/components/omni-v2/store";
import { dayFinance } from "@/lib/omni/finance/day";
import { monthDays, salesDays } from "@/lib/omni/finance/month";
import { ddmm, money, pctFmt } from "@/lib/omni/format";
import { chartAxis, chartTooltip, Kpi, PageHeader, Panel, Pill, Progress } from "@/components/omni-v2/ui";
import { Table, useTrend } from "@/components/omni-v2/trend";


export function Planejamento() {
  const o = useOmni();
  const { ms, t } = useTrend();
  const md = monthDays(o.days, o.plan);
  const rows = salesDays(o.plan).map((d) => {
    const day = md.find((x) => x.date === d);
    return { label: ddmm(d), plano: o.plan.dailyTarget, real: day ? dayFinance(day, o.settlements).profit : null };
  });
  const avg = (k: (d: (typeof md)[number]) => number) => md.reduce((s, d) => s + k(d), 0) / (md.length || 1);
  const ind = o.plan.indicators;
  const indicators = [
    ["Lucro por dia", `≥ ${money(ind.profitPerDay)}`, money(t.monthAvg), t.monthAvg >= ind.profitPerDay],
    ["Unidades por dia", `${ind.unitsPerDay[0]}–${ind.unitsPerDay[1]}`, avg((d) => d.soldUnits).toFixed(1).replace(".", ","), avg((d) => d.soldUnits) >= ind.unitsPerDay[0]],
    ["Capital próprio por dia", `${money(ind.ownCapitalPerDay[0])}–${money(ind.ownCapitalPerDay[1])}`, money(avg((d) => d.ownCost)), avg((d) => d.ownCost) <= ind.ownCapitalPerDay[1]],
    ["Terceiros por dia", `até ${money(ind.thirdPartyMaxPerDay)}`, money(avg((d) => d.thirdPartyCost)), avg((d) => d.thirdPartyCost) <= ind.thirdPartyMaxPerDay],
    ["Perdas por dia", `até ${ind.maxLossesPerDay}`, avg((d) => d.lostUnits).toFixed(1).replace(".", ","), avg((d) => d.lostUnits) <= ind.maxLossesPerDay],
  ] as const;
  const picks = t.scenarios.filter((s) => ["cons", "plan", "amb", "l10"].includes(s.id));
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Planejamento" question={`Vou bater a meta? · ${o.plan.label}`} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
        <Panel>
          <div className="eyebrow">Meta no banco</div>
          <div className="num mt-1 font-display text-4xl font-semibold text-o-ok">{money(ms.bank)} <span className="text-base text-o-muted-foreground">/ {money(o.plan.goal)}</span></div>
          <div className="my-3"><Progress value={ms.pctGoal} tone="ok" /></div>
          <p className="text-xs text-o-muted-foreground">{pctFmt(ms.pctGoal, false)} da meta em {ms.closedDays} de {ms.totalDays} dias de venda (feriado {o.plan.holidays.map(ddmm).join(", ")}).</p>
        </Panel>
        <Kpi label="Alvo diário" value={money(o.plan.dailyTarget)} explain={`Necessário agora: ${money(ms.neededPerDay)}/dia`} formula="(Meta − banco do mês) ÷ dias restantes, arredondado para cima" />
        <Kpi tone="ok" label="Real × plano" value={pctFmt(ms.vsPlanPct)} explain={`${money(ms.diaryProfit)} vs ${money(ms.planToDate)} planejado`} />
      </div>
      <Panel title="Planejado × realizado por dia" subtitle={`R$ de lucro · dias de venda · ${o.plan.label}`} className="mt-4">
        <div className="h-64"><ResponsiveContainer><BarChart data={rows}><CartesianGrid stroke="var(--color-border)" vertical={false} /><XAxis dataKey="label" {...chartAxis} interval={2} /><YAxis {...chartAxis} width={50} tickFormatter={(v) => `R$ ${v}`} /><Tooltip {...chartTooltip} formatter={(v: number) => money(v)} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="plano" name="Plano" fill="var(--color-muted-foreground)" fillOpacity={0.35} /><Bar dataKey="real" name="Realizado" fill="var(--color-ok)" /></BarChart></ResponsiveContainer></div>
      </Panel>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Cenários do plano" subtitle={`${ms.remainingDays} dias restantes`}>
          <Table head={["Cenário", "Por dia", "Lucro no mês", "Banco c/ rend."]} rows={picks.map((s) => [s.label, money(s.perDay), money(s.monthProfit), money(s.bankWithYield)])} />
        </Panel>
        <Panel title="Indicadores do mês" subtitle="Média dos dias fechados">
          <Table head={["Indicador", "Plano", "Real", ""]} rows={indicators.map(([l, p, r, ok]) => [l, p, r, <Pill key="p" tone={ok ? "ok" : "alert"}>{ok ? "ok" : "fora"}</Pill>])} />
        </Panel>
      </div>
    </div>
  );
}
