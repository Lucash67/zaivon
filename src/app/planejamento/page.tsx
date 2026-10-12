"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModuleShell } from "@/components/layout/module-shell";
import { PageLoader } from "@/components/ui/loading";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { cn, formatCurrency } from "@/lib/utils";
import type { PlanningDay, PlanningTrend, PlanningView, TrendCurveSeries } from "@/lib/planning/planning-service";

function signed(n: number): string {
  if (n === 0) return "—";
  return `${n > 0 ? "+" : "−"}${formatCurrency(Math.abs(n))}`;
}

function pct(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded >= 0 ? "+" : "−"}${Math.abs(rounded).toLocaleString("pt-BR")}%`;
}

const CURVE_COLORS: Record<TrendCurveSeries["tone"], string> = {
  plan: "var(--text-muted)",
  warn: "var(--brand-orange)",
  base: "var(--brand-secondary)",
  good: "var(--brand-green)",
};

function WeeklyAverageChart({ trend, target }: { trend: PlanningTrend; target: number }) {
  const max = Math.max(target, ...trend.weeks.map((w) => w.average), 1) * 1.1;
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card p-4">
      <div className="relative flex h-48 items-end gap-3">
        <div
          className="absolute inset-x-0 border-t border-dashed border-text-muted"
          style={{ bottom: `${(target / max) * 100}%` }}
        >
          <span className="absolute -top-5 right-0 text-[10px] text-text-muted">alvo {formatCurrency(target)}</span>
        </div>
        {trend.weeks.map((w, i) => (
          <div key={w.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-semibold text-text-primary">{formatCurrency(w.average)}</span>
            <div
              className={cn(
                "w-full rounded-t-lg",
                i === trend.weeks.length - 1 ? "bg-brand-green" : w.average >= target ? "bg-brand-green/50" : "bg-brand-orange/60",
              )}
              style={{ height: `${(w.average / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3">
        {trend.weeks.map((w) => (
          <span key={w.label} className="flex-1 text-center text-[11px] text-text-muted">
            {w.label}
            <br />
            {w.days} dia{w.days === 1 ? "" : "s"}
          </span>
        ))}
      </div>
    </div>
  );
}

function CumulativeCurve({ trend, goal }: { trend: PlanningTrend; goal: number }) {
  const W = 640;
  const H = 240;
  const pad = { l: 48, r: 12, t: 12, b: 24 };
  const values = trend.curve.series.flatMap((s) => s.data.filter((v): v is number => v != null));
  const max = Math.max(goal, ...values) * 1.05;
  const n = trend.curve.labels.length;
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((max * f) / 100) * 100);
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--surface-border)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--text-muted)">
              {t.toLocaleString("pt-BR")}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(goal)} y2={y(goal)} stroke="var(--text-primary)" strokeDasharray="4 4" strokeWidth={1} />
        <text x={W - pad.r} y={y(goal) - 4} textAnchor="end" fontSize={10} fill="var(--text-primary)">
          meta {formatCurrency(goal)}
        </text>
        {trend.curve.series.map((s) => (
          <polyline
            key={s.label}
            fill="none"
            stroke={CURVE_COLORS[s.tone]}
            strokeWidth={s.tone === "plan" ? 1.5 : 2.5}
            strokeDasharray={s.tone === "plan" ? "3 3" : undefined}
            points={s.data
              .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
              .filter(Boolean)
              .join(" ")}
          />
        ))}
        {trend.curve.labels.map((l, i) => (
          <text key={`${l}-${i}`} x={x(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
            {l}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {trend.curve.series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="inline-block h-0.5 w-4" style={{ background: CURVE_COLORS[s.tone] }} />
            {s.label}
          </span>
        ))}
      </div>
      <p className="mt-1 text-xs text-text-muted">
        Eixo X: dia de venda · Eixo Y: lucro acumulado no mês (R$). Até o último fechamento as linhas seguem o realizado.
      </p>
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
  tones,
}: {
  headers: string[];
  rows: string[][];
  tones?: Array<"good" | "warn" | "base" | null | undefined>;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
            {headers.map((h, i) => (
              <th key={h} className={cn("px-4 py-2", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr
              key={row[0]}
              className={cn(
                "border-t border-surface-border",
                tones?.[r] === "base" && "bg-surface-elevated font-semibold",
              )}
            >
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-4 py-2",
                    i === 0 ? "text-text-secondary" : "text-right text-text-primary",
                    i > 0 && tones?.[r] === "good" && "text-brand-green",
                    i > 0 && tones?.[r] === "warn" && "text-brand-orange",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendSection({ data, trend }: { data: PlanningView; trend: PlanningTrend }) {
  const growthVsPrev =
    trend.previousAverage != null ? ((trend.monthAverage - trend.previousAverage) / trend.previousAverage) * 100 : null;
  const weekGrowth =
    trend.weekAverage != null && trend.previousWeekAverage
      ? ((trend.weekAverage - trend.previousWeekAverage) / trend.previousWeekAverage) * 100
      : null;
  const base = trend.scenarios.find((s) => s.id === "recent");
  return (
    <div className="space-y-8">
      <Section
        title="Tendência do lucro"
        subtitle="Recalculada a cada fechamento de dia · lucro final = operacional + bônus"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label={growthVsPrev != null ? `Média do mês (${pct(growthVsPrev)} vs ${trend.previousLabel})` : "Média do mês"}
            value={formatCurrency(trend.monthAverage)}
            tone={trend.monthAverage >= data.dailyTarget ? "good" : "warn"}
          />
          {trend.weekAverage != null && (
            <Kpi
              label={weekGrowth != null ? `Última semana (${pct(weekGrowth)} vs anterior)` : "Última semana"}
              value={formatCurrency(trend.weekAverage)}
              tone={trend.weekAverage >= data.dailyTarget ? "good" : "warn"}
            />
          )}
          <Kpi label="Média dos últimos 10 dias" value={formatCurrency(trend.recentAverage)} />
          {base && data.remainingDays > 0 && (
            <Kpi
              label={`Mês projetado (${pct(base.vsGoalPct)} vs meta)`}
              value={formatCurrency(base.bank ?? base.profit)}
              tone={base.vsGoalPct >= 0 ? "good" : "warn"}
            />
          )}
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Média por semana" subtitle="Lucro médio por dia útil nas últimas semanas">
          <WeeklyAverageChart trend={trend} target={data.dailyTarget} />
        </Section>
        <Section title="Quanto a média aumentou" subtitle="Variação percentual entre períodos">
          <SimpleTable
            headers={["Comparação", "De", "Para", "Variação"]}
            rows={trend.comparisons.map((c) => [c.label, formatCurrency(c.from), formatCurrency(c.to), pct(c.change)])}
            tones={trend.comparisons.map((c) => (c.change >= 0 ? "good" : "warn"))}
          />
        </Section>
      </div>

      {data.remainingDays > 0 && (
        <Section title="Projeção para o fim do mês" subtitle={`Realizado + média × ${data.remainingDays} dias de venda restantes`}>
          <CumulativeCurve trend={trend} goal={data.goal} />
          <SimpleTable
            headers={["Cenário", "Por dia", "Lucro no mês", "vs meta", "vs plano", "Banco c/ rendimentos"]}
            rows={trend.scenarios.map((s) => [
              s.label,
              formatCurrency(s.perDay),
              formatCurrency(s.profit),
              pct(s.vsGoalPct),
              pct(s.vsPlanPct),
              s.bank != null ? formatCurrency(s.bank) : "—",
            ])}
            tones={trend.scenarios.map((s) => s.tone)}
          />
          <p className="text-xs text-text-muted">
            Meta = {formatCurrency(data.goal)} no banco · plano = {formatCurrency(data.dailyTarget)} × {data.sellingDays} dias ={" "}
            {formatCurrency(trend.planTotal)} de lucro.
            {trend.rendimento != null &&
              ` Rendimentos do cofrinho no mês: ${formatCurrency(trend.rendimento)} (≈ ${formatCurrency(trend.rendimentoPerDay)} por dia de venda).`}
          </p>
        </Section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Contra o planejado" subtitle="Plano do mês × realizado e projeção-base">
          <SimpleTable
            headers={["Item", "Plano", "Real / projetado", "Diferença"]}
            rows={trend.planComparison.map((p) => [p.label, formatCurrency(p.plan), formatCurrency(p.actual), pct(p.change)])}
            tones={trend.planComparison.map((p) => (p.change >= 0 ? "good" : "warn"))}
          />
        </Section>
        {trend.headroom.length > 0 && data.neededPerRemainingDay != null && (
          <Section
            title="Quanto a média pode cair"
            subtitle={`E ainda bater a meta com ${formatCurrency(data.neededPerRemainingDay)} por dia`}
          >
            <SimpleTable
              headers={["A partir de", "Média", "Pode cair"]}
              rows={trend.headroom.map((h) => [h.label, formatCurrency(h.from), pct(h.change)])}
            />
          </Section>
        )}
      </div>

      <Section title="Leitura da tendência" subtitle="Gerada a partir do diário e do cofrinho">
        <ul className="space-y-2 rounded-2xl border border-surface-border bg-surface-card p-4">
          {trend.insights.map((line) => (
            <li key={line} className="flex gap-2 text-sm text-text-primary">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green" />
              {line}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function roi(day: PlanningDay): string {
  if (day.profit == null || !day.own) return "—";
  return `${Math.round((day.profit / day.own) * 100)}%`;
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-black text-text-primary",
          tone === "good" && "text-brand-green",
          tone === "warn" && "text-brand-orange",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default function PlanejamentoPage() {
  const { activeBusinessId, withQuery } = useBusinessScope();
  const [month, setMonth] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<PlanningView>({
    queryKey: ["planning", activeBusinessId, month],
    queryFn: async () => {
      const base = withQuery("/api/planning");
      const url = month ? `${base}${base.includes("?") ? "&" : "?"}month=${month}` : base;
      const r = await fetch(url);
      const json = await r.json();
      if (!r.ok || json.error) throw new Error(json.error || "Não foi possível carregar o planejamento.");
      return json;
    },
    staleTime: 60_000,
  });

  const title = "Planejamento";
  const subtitle = "Resumos, relatórios, metas e projeções do mês";

  if (isError) {
    return (
      <ModuleShell title={title} subtitle={subtitle}>
        <p className="mb-3 text-text-muted">{error instanceof Error ? error.message : "Erro ao carregar."}</p>
        <button type="button" className="text-sm text-brand-orange underline" onClick={() => void refetch()}>
          Tentar novamente
        </button>
      </ModuleShell>
    );
  }

  if (isLoading || !data) {
    return (
      <ModuleShell title={title} subtitle={subtitle}>
        <PageLoader />
      </ModuleShell>
    );
  }

  const achieved = data.bank ?? data.profitDone;
  const progress = Math.min(100, Math.round((achieved / data.goal) * 100));
  const gap = data.goal - achieved;
  const closed = data.remainingDays === 0 && data.registeredDays > 0;
  const maxBar = Math.max(data.dailyTarget, ...data.days.map((d) => d.profit ?? 0), 1);

  const monthPicker = (
    <div className="flex gap-1 rounded-xl border border-surface-border bg-surface-card p-1">
      {data.availableMonths.map((m) => (
        <button
          key={m.month}
          type="button"
          onClick={() => setMonth(m.month)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium",
            m.month === data.month ? "bg-surface-elevated text-text-primary" : "text-text-muted hover:text-text-primary",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );

  return (
    <ModuleShell title={title} subtitle={subtitle} actions={monthPicker}>
      <div className="space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-text-primary">
            {data.label}: meta de {formatCurrency(data.goal)}
          </h1>
          <p className="text-sm text-text-muted">
            Alvo de {formatCurrency(data.dailyTarget)} por dia de venda · {data.sellingDays} dias de venda (seg–sex sem feriados).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label={data.bankSource ? "No banco no mês" : "Lucro no mês"}
            value={formatCurrency(achieved)}
            tone={gap <= 0 ? "good" : undefined}
          />
          <Kpi
            label={gap <= 0 ? "Acima da meta" : "Falta para a meta"}
            value={formatCurrency(Math.abs(gap))}
            tone={gap <= 0 ? "good" : "warn"}
          />
          <Kpi
            label={closed ? "Lucro no diário" : "Precisa por dia restante"}
            value={
              closed
                ? formatCurrency(data.profitDone)
                : data.neededPerRemainingDay != null
                  ? formatCurrency(data.neededPerRemainingDay)
                  : "Meta batida"
            }
          />
          <Kpi
            label={closed ? "Cofrinho prático" : "Projeção no ritmo recente"}
            value={formatCurrency(closed ? data.practicalBalance : data.projection)}
            tone={!closed && data.projection >= data.goal ? "good" : undefined}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-text-muted">
            <span>{progress}% da meta</span>
            <span>
              {formatCurrency(achieved)} de {formatCurrency(data.goal)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-elevated">
            <div className="h-full rounded-full bg-brand-green" style={{ width: `${progress}%` }} />
          </div>
          {data.bankNote && <p className="text-xs text-text-muted">{data.bankNote}</p>}
        </div>

        <Section title="Resumo" subtitle="O que ler primeiro">
          <div className="space-y-2 rounded-2xl border border-surface-border bg-surface-card p-4">
            {data.summary.map((line) => (
              <p key={line} className="text-sm text-text-primary">
                {line}
              </p>
            ))}
          </div>
        </Section>

        {data.trend && <TrendSection data={data} trend={data.trend} />}

        <Section
          title="Planejado × realizado por dia"
          subtitle={`Barra verde = lucro final do diário · traço = alvo de ${formatCurrency(data.dailyTarget)}`}
        >
          <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2">Dia</th>
                  <th className="px-4 py-2">Lucro</th>
                  <th className="w-1/3 px-4 py-2" />
                  <th className="px-4 py-2 text-right">Diferença</th>
                  <th className="px-4 py-2 text-right">Recebido</th>
                  <th className="px-4 py-2 text-right">Próprio</th>
                  <th className="px-4 py-2 text-right">ROI</th>
                  <th className="px-4 py-2 text-right">Un.</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => {
                  const diff = d.profit == null ? null : d.profit - d.planned;
                  return (
                    <tr key={d.date} className="border-t border-surface-border">
                      <td className="whitespace-nowrap px-4 py-2 text-text-secondary">
                        {d.weekday} {d.date.slice(8, 10)}/{d.date.slice(5, 7)}
                      </td>
                      <td className="px-4 py-2 font-semibold text-text-primary">
                        {d.profit == null ? <span className="text-text-muted">—</span> : formatCurrency(d.profit)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="relative h-2.5 rounded-full bg-surface-elevated">
                          {d.profit != null && (
                            <div
                              className={cn(
                                "h-full rounded-full",
                                d.profit >= d.planned ? "bg-brand-green" : "bg-brand-orange",
                              )}
                              style={{ width: `${Math.min(100, (d.profit / maxBar) * 100)}%` }}
                            />
                          )}
                          <div
                            className="absolute top-[-3px] h-4 w-0.5 bg-text-muted"
                            style={{ left: `${(d.planned / maxBar) * 100}%` }}
                          />
                        </div>
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2 text-right",
                          diff != null && diff > 0 && "text-brand-green",
                          diff != null && diff < 0 && "text-brand-orange",
                        )}
                      >
                        {diff == null ? "—" : signed(diff)}
                      </td>
                      <td className="px-4 py-2 text-right text-text-secondary">
                        {d.received ? formatCurrency(d.received) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-text-secondary">
                        {d.own != null ? formatCurrency(d.own) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-text-secondary">{roi(d)}</td>
                      <td className="px-4 py-2 text-right text-text-secondary">{d.sold ?? "—"}</td>
                    </tr>
                  );
                })}
                {data.extraDays.map((d) => (
                  <tr key={d.date} className="border-t border-surface-border text-text-muted">
                    <td className="px-4 py-2">
                      {d.weekday} {d.date.slice(8, 10)}/{d.date.slice(5, 7)} · extra
                    </td>
                    <td className="px-4 py-2">{d.profit != null ? formatCurrency(d.profit) : "—"}</td>
                    <td className="px-4 py-2 text-xs" colSpan={6}>
                      Fora do plano (fim de semana ou feriado)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div className={cn("grid gap-6", !data.trend && "xl:grid-cols-2")}>
          <Section title="Semanas" subtitle="Soma dos dias de venda de cada semana">
            <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-2">Semana</th>
                    <th className="px-4 py-2 text-right">Dias</th>
                    <th className="px-4 py-2 text-right">Plano</th>
                    <th className="px-4 py-2 text-right">Real</th>
                  </tr>
                </thead>
                <tbody>
                  {data.weeks.map((w) => (
                    <tr key={w.label} className="border-t border-surface-border">
                      <td className="px-4 py-2 text-text-secondary">{w.label}</td>
                      <td className="px-4 py-2 text-right text-text-secondary">
                        {w.registered}/{w.days}
                      </td>
                      <td className="px-4 py-2 text-right text-text-secondary">{formatCurrency(w.planned)}</td>
                      <td
                        className={cn(
                          "px-4 py-2 text-right font-semibold",
                          w.registered === 0 && "text-text-muted",
                          w.registered > 0 && w.actual >= w.registered * data.dailyTarget && "text-brand-green",
                        )}
                      >
                        {w.registered === 0 ? "—" : formatCurrency(w.actual)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {!data.trend && (
          <Section
            title="Projeções"
            subtitle={
              data.registeredDays > 0
                ? `Já feito + cenário × ${data.remainingDays} dias que faltam`
                : `Cenário × ${data.sellingDays} dias de venda`
            }
          >
            <div className="grid gap-3">
              {data.scenarios.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-2xl border border-surface-border bg-surface-card p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{s.label}</p>
                    <p className="text-xs text-text-muted">{formatCurrency(s.perDay)} por dia</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-text-primary">{formatCurrency(s.monthTotal)}</p>
                    <p className={cn("text-xs", s.vsGoal >= 0 ? "text-brand-green" : "text-brand-orange")}>
                      {s.vsGoal >= 0 ? `passa ${formatCurrency(s.vsGoal)}` : `falta ${formatCurrency(-s.vsGoal)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              Ritmo recente = média dos últimos 10 dias de venda registrados ({formatCurrency(data.recentAverage)}).
            </p>
          </Section>
          )}
        </div>

        <Section title="Indicadores do mês" subtitle="O que acompanhar todo dia para bater a meta">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.indicators.map((i) => (
              <div key={i.label} className="rounded-2xl border border-surface-border bg-surface-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{i.label}</p>
                <p className="mt-1 text-lg font-bold text-text-primary">{i.target}</p>
                <p className="mt-1 text-xs text-text-muted">{i.why}</p>
              </div>
            ))}
          </div>
        </Section>

        {data.notes.length > 0 && (
          <div className="space-y-1 text-xs text-text-muted">
            {data.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
