"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useZaivon } from "@/components/zaivon-v2/store";
import { dayFinance } from "@/lib/zaivon/finance/day";
import { weekStart, weekSummary } from "@/lib/zaivon/finance/month";
import { dayLabel, ddmm, pctFmt } from "@/lib/zaivon/format";
import { chartAxis, chartTooltip, Kpi, PageHeader, Panel, Pill } from "@/components/zaivon-v2/ui";
import { Table, useTrend } from "@/components/zaivon-v2/trend";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/zaivon-v2/primitives";
import { Button } from "@/components/zaivon-v2/primitives";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HideMoneyScope, ScreenHideMoneyButton, useScreenHideMoney } from "@/components/zaivon-v2/hide-money";


export function Desempenho() {
  return (
    <HideMoneyScope screenId="v2-desempenho">
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Desempenho" question="Estou melhorando?" right={<ScreenHideMoneyButton />} />
        <Tabs defaultValue="semana">
          <TabsList><TabsTrigger value="semana">Semana</TabsTrigger><TabsTrigger value="mes">Mês</TabsTrigger><TabsTrigger value="tendencia">Tendência & Projeções</TabsTrigger></TabsList>
          <TabsContent value="semana" className="mt-4"><Semana /></TabsContent>
          <TabsContent value="mes" className="mt-4"><Mes /></TabsContent>
          <TabsContent value="tendencia" className="mt-4"><Tendencia /></TabsContent>
        </Tabs>
      </div>
    </HideMoneyScope>
  );
}

function Semana() {
  const o = useZaivon();
  const { money, axisTick } = useScreenHideMoney();
  const starts = Array.from(new Set(o.days.map((d) => weekStart(d.date)))).sort();
  const [i, setI] = useState(Math.max(0, starts.indexOf(weekStart(o.selectedDate))));
  const start = starts[i] ?? starts[0]!;
  const w = weekSummary(start, o.days, o.settlements, o.plan);
  const { t } = useTrend();
  const prevW = [...t.weeks].reverse().find((x) => x.start < (w.dates[0] ?? start));
  const rows = w.dates.map((d) => ({ date: dayLabel(d), lucro: dayFinance(o.days.find((x) => x.date === d)!, o.settlements).profit }));
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Semana anterior"><ChevronLeft className="size-4" /></Button>
        <span className="text-sm font-semibold">{ddmm(w.dates[0] ?? start)} – {ddmm(w.dates.at(-1)!)}</span>
        <Button variant="outline" size="icon" disabled={i >= starts.length - 1} onClick={() => setI(i + 1)} aria-label="Próxima semana"><ChevronRight className="size-4" /></Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Kpi tone="ok" label="Lucro da semana" value={money(w.profit)} formula="Soma do lucro final dos dias da semana" explain={`${w.dates.length} dias fechados`} />
        <Kpi label="Média por dia" value={money(w.avg)} explain={prevW ? `${pctFmt(w.avg / prevW.avg - 1)} vs semana anterior (${money(prevW.avg)})` : undefined} />
        <Kpi label="Rendimentos" value={money(w.yields)} formula="Soma do rendimento implícito de cada dia" />
        <Kpi tone="info" label="Cofrinho na semana" value={w.cofrinhoDelta != null ? `+${money(w.cofrinhoDelta)}` : "—"} formula="Lucro + rendimentos" />
      </div>
      <Panel title="Lucro por dia" subtitle={`R$ · semana de ${ddmm(w.dates[0] ?? start)}`}>
        <div className="h-56"><ResponsiveContainer><BarChart data={rows}><CartesianGrid stroke="var(--color-border)" vertical={false} /><XAxis dataKey="date" {...chartAxis} /><YAxis {...chartAxis} width={50} tickFormatter={axisTick} /><Tooltip {...chartTooltip} formatter={(v: number) => money(v)} /><ReferenceLine y={o.plan.dailyTarget} stroke="var(--color-pending)" strokeDasharray="4 4" label={{ value: "alvo", fill: "var(--color-pending)", fontSize: 12 }} /><Bar dataKey="lucro" name="Lucro" fill="var(--color-ok)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </Panel>
    </div>
  );
}

function Mes() {
  const o = useZaivon();
  const { money } = useScreenHideMoney();
  const { ms, t } = useTrend();
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Kpi big tone="ok" label="Banco do mês" value={money(ms.bank)} formula="Cofrinho atual − início do mês" explain={`${pctFmt(ms.pctGoal, false)} da meta de ${money(o.plan.goal)}`} />
        <Kpi label="Lucro no diário" value={money(ms.diaryProfit)} explain={`${ms.closedDays} dias · ${money(ms.avgProfit)}/dia`} />
        <Kpi label="Vs. mês anterior" value={pctFmt(t.monthVsPrev)} explain={`${money(t.monthAvg)} vs ${money(t.prevMonthAvg)}/dia`} />
        <Kpi tone="pending" label="Projeção do mês" value={money(t.projectedProfit)} explain="Base: últimos 10 dias" />
      </div>
      <Panel title="Caixa e capital próprio" subtitle={`Médias por dia · ${o.plan.label} vs ${o.previousMonth.label}`}>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-o-surface p-3">Caixa médio: <span className="num font-semibold">{money(ms.cashIn / ms.closedDays)}</span> <span className="text-o-muted-foreground">vs {money(o.previousMonth.avgCashPerDay)}</span></div>
          <div className="rounded-xl bg-o-surface p-3">Capital próprio: <span className="num font-semibold">{money(ms.ownCost / ms.closedDays)}</span> <span className="text-o-muted-foreground">vs {money(o.previousMonth.avgOwnCostPerDay)}</span></div>
          <div className="rounded-xl bg-o-surface p-3">ROI: <span className="num font-semibold">{pctFmt(ms.diaryProfit / ms.ownCost, false)}</span> <span className="text-o-muted-foreground">lucro ÷ meu custo</span></div>
        </div>
      </Panel>
    </div>
  );
}

function Tendencia() {
  const o = useZaivon();
  const { money, axisTick } = useScreenHideMoney();
  const { ms, t } = useTrend();
  const read = [
    `A média do mês é ${money(t.monthAvg)}/dia, ${pctFmt(t.monthVsPrev)} sobre ${o.previousMonth.label} (${money(t.prevMonthAvg)}).`,
    `A última semana fez ${money(t.weekAvg)}/dia, ${pctFmt(t.weekVsPrev)} sobre a anterior.`,
    t.bestDay ? `Melhor dia: ${dayLabel(t.bestDay.date)} com ${money(t.bestDay.profit)}.` : "",
    `Sem bônus, a média do mês seria ${money(t.monthAvgNoBonus)}/dia (${money(ms.bonus)} de bônus no mês).`,
    `Caixa médio de ${money(ms.cashIn / ms.closedDays)}/dia vs ${money(o.previousMonth.avgCashPerDay)} em ${o.previousMonth.label} (${pctFmt(ms.cashIn / ms.closedDays / o.previousMonth.avgCashPerDay - 1)}).`,
    `Capital próprio médio de ${money(ms.ownCost / ms.closedDays)}/dia, ROI ${pctFmt(ms.diaryProfit / ms.ownCost, false)}.`,
    `Para bater a meta bastam ${money(ms.neededPerDay)}/dia nos ${ms.remainingDays} dias restantes.`,
    `Pior cenário semanal (${money(Math.min(...t.weeks.map((w) => w.avg)))}/dia nas últimas 6 semanas) ainda supera o necessário.`,
    `Meta revisada sugerida: ${money(t.revisedGoal[0])} a ${money(t.revisedGoal[1])}.`,
  ].filter(Boolean);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi tone="ok" label="Média do mês" value={money(t.monthAvg)} explain={`${pctFmt(t.monthVsPrev)} vs ${o.previousMonth.label}`} formula="Lucro final ÷ dias fechados" />
        <Kpi label="Média última semana" value={money(t.weekAvg)} explain={`${pctFmt(t.weekVsPrev)} vs semana anterior`} />
        <Kpi tone="info" label="Últimos 10 dias úteis" value={money(t.last10)} explain="Régua oficial de projeção" />
        <Kpi tone="pending" label="Mês projetado" value={money(t.projectedProfit)} explain={`Banco ≈ ${money(t.projectedBank)} (${pctFmt(t.projectedVsGoal)} vs meta)`} formula="Lucro atual + média 10 dias × dias restantes" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Média por semana" subtitle="R$/dia · últimas 6 semanas · linha = alvo diário">
          <div className="h-60"><ResponsiveContainer><BarChart data={t.weeks.map((w) => ({ ...w, label: ddmm(w.start) }))}><CartesianGrid stroke="var(--color-border)" vertical={false} /><XAxis dataKey="label" {...chartAxis} /><YAxis {...chartAxis} width={50} tickFormatter={axisTick} /><Tooltip {...chartTooltip} formatter={(v: number) => money(v)} /><ReferenceLine y={o.plan.dailyTarget} stroke="var(--color-pending)" strokeDasharray="4 4" /><Bar dataKey="avg" name="Média/dia" fill="var(--color-info)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Curva acumulada do mês" subtitle="R$ de lucro acumulado · plano × realizado × projeções">
          <div className="h-60"><ResponsiveContainer><LineChart data={t.curve.map((c) => ({ ...c, label: ddmm(c.date) }))}><CartesianGrid stroke="var(--color-border)" vertical={false} /><XAxis dataKey="label" {...chartAxis} interval={3} /><YAxis {...chartAxis} width={60} tickFormatter={axisTick} /><Tooltip {...chartTooltip} formatter={(v: number) => money(v)} /><Legend wrapperStyle={{ fontSize: 12 }} /><ReferenceLine y={o.plan.goal} stroke="var(--color-alert)" strokeDasharray="4 4" label={{ value: "meta", fill: "var(--color-alert)", fontSize: 12 }} /><Line dataKey="plan" name="Plano" stroke="var(--color-muted-foreground)" dot={false} strokeDasharray="3 3" /><Line dataKey="real" name="Realizado" stroke="var(--color-ok)" strokeWidth={2.5} /><Line dataKey="prevPace" name="Volta ao mês anterior" stroke="var(--color-third)" dot={false} /><Line dataKey="last10" name="10 dias" stroke="var(--color-info)" dot={false} /><Line dataKey="monthPace" name="Ritmo do mês" stroke="var(--color-pending)" dot={false} /></LineChart></ResponsiveContainer></div>
        </Panel>
      </div>

      <Panel title="Quanto a média aumentou">
        <Table head={["Comparação", "De", "Para", "Variação"]} rows={t.increases.map((r) => [r.label, money(r.from), money(r.to), <Pill key="p" tone={r.change >= 0 ? "ok" : "alert"}>{pctFmt(r.change)}</Pill>])} />
      </Panel>

      <Panel title="Cenários" subtitle={`${ms.remainingDays} dias restantes · banco com rendimento de ${money(ms.avgYieldPerDay)}/dia`}>
        <Table head={["Cenário", "Por dia", "Lucro no mês", "% vs meta", "% vs plano", "Banco c/ rendimentos"]}
          rows={t.scenarios.map((s) => [<span key="l" className={s.base ? "font-semibold text-o-info" : ""}>{s.label}</span>, money(s.perDay), money(s.monthProfit), pctFmt(s.vsGoal), pctFmt(s.vsPlan), money(s.bankWithYield)])} />
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Contra o planejado">
          <Table head={["", "Plano", "Real", "%"]} rows={[
            ["Lucro até hoje", money(ms.planToDate), money(ms.diaryProfit), pctFmt(ms.vsPlanPct)],
            ["Lucro por dia", money(o.plan.dailyTarget), money(t.monthAvg), pctFmt(t.monthAvg / o.plan.dailyTarget - 1)],
            ["Lucro do mês projetado", money(o.plan.dailyTarget * ms.totalDays), money(t.projectedProfit), pctFmt(t.projectedProfit / (o.plan.dailyTarget * ms.totalDays) - 1)],
            ["Banco projetado", money(o.plan.goal), money(t.projectedBank), pctFmt(t.projectedVsGoal)],
          ]} />
        </Panel>
        <Panel title="Quanto a média pode cair" subtitle={`Necessário: ${money(ms.neededPerDay)}/dia`}>
          <Table head={["Média", "Valor", "Pode cair"]} rows={t.drops.map((d) => [d.label, money(d.avg), <Pill key="p" tone={d.canDrop > 0 ? "ok" : "alert"}>{pctFmt(d.canDrop, false)}</Pill>])} />
        </Panel>
      </div>

      <Panel title="Leitura automática">
        <ul className="grid gap-1.5 text-sm">{read.map((r) => <li key={r} className="rounded-lg bg-o-surface px-3 py-2">{r}</li>)}</ul>
      </Panel>
    </div>
  );
}

