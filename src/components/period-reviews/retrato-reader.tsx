"use client";

import { formatCurrency, cn } from "@/lib/utils";
import type { PeriodReview } from "@/lib/period-reviews/types";
import { Badge } from "@/components/ui/badge";
import { CompareSeriesChart } from "@/components/period-reviews/compare-series-chart";

function money(n: number) {
  return formatCurrency(n);
}

function pct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

const IMPACT_BADGE: Record<string, string> = {
  critical: "border-brand-red/40 bg-brand-red/10 text-brand-red",
  high: "border-z-warning/40 bg-z-warning/10 text-z-warning",
  medium: "border-z-info/25 bg-z-info/8 text-z-info",
  low: "border-surface-border bg-surface-card text-text-muted",
};

interface RetratoReaderProps {
  review: PeriodReview;
}

export function RetratoReader({ review }: RetratoReaderProps) {
  const snap = review.metricsSnapshot;
  const curr = snap.current;
  const prev = snap.previous;
  const profitDelta = curr.diaryProfit - prev.diaryProfit;
  const profitDeltaPct = prev.diaryProfit !== 0 ? (profitDelta / prev.diaryProfit) * 100 : 0;
  const revDeltaPct = prev.revenue !== 0 ? ((curr.revenue - prev.revenue) / prev.revenue) * 100 : 0;
  const ownDeltaPct =
    prev.ownCapital !== 0 ? ((curr.ownCapital - prev.ownCapital) / prev.ownCapital) * 100 : 0;
  const ownRoiPrev = prev.ownCapital > 0 ? prev.diaryProfit / prev.ownCapital : 0;
  const ownRoiCurr = curr.ownCapital > 0 ? curr.diaryProfit / curr.ownCapital : 0;

  const pills =
    snap.pills ??
    [
      {
        label: `Lucro ${profitDelta >= 0 ? "+" : "−"}${money(Math.abs(profitDelta))}`,
        tone: profitDelta >= 0 ? ("success" as const) : ("warning" as const),
      },
    ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
          {review.title || review.headline}
        </h1>
        <p className="text-sm text-text-muted">
          Comparativo {curr.label} × {prev.label}
        </p>
        <div className="flex flex-wrap gap-2">
          {pills.map((p) => (
            <Badge
              key={p.label}
              className={cn(
                "border px-3 py-1 text-xs font-medium",
                p.tone === "warning" && "border-z-warning/40 bg-z-warning/10 text-z-warning",
                p.tone === "danger" && "border-brand-red/40 bg-brand-red/10 text-brand-red",
                p.tone === "success" && "border-brand-green/40 bg-brand-green/10 text-brand-green",
                p.tone === "neutral" && "border-surface-border bg-surface-elevated text-text-secondary",
              )}
            >
              {p.label}
            </Badge>
          ))}
        </div>
      </header>

      <div className="rounded-2xl border border-z-primary/30 bg-gradient-to-br from-z-primary/10 via-surface-card to-z-emerald/5 px-4 py-4 sm:px-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-gradient">
          Veredito em uma frase
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-primary sm:text-base">{review.summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBlock
          label="Lucro (diário)"
          value={money(curr.diaryProfit)}
          hint={`Anterior ${money(prev.diaryProfit)} · ${pct(profitDeltaPct)}`}
          tone={profitDelta < 0 ? "warning" : "success"}
        />
        <StatBlock
          label="Faturamento"
          value={money(curr.revenue)}
          hint={`Anterior ${money(prev.revenue)} · ${pct(revDeltaPct)}`}
          tone="info"
        />
        <StatBlock
          label="Seu capital no estoque"
          value={money(curr.ownCapital)}
          hint={`Anterior ${money(prev.ownCapital)} · ${pct(ownDeltaPct)}`}
          tone="danger"
        />
        <StatBlock
          label="Retorno / R$ próprio"
          value={`${ownRoiCurr.toFixed(2)}×`}
          hint={`Anterior ${ownRoiPrev.toFixed(2)}×`}
          tone={ownRoiCurr < ownRoiPrev ? "danger" : "success"}
        />
      </div>

      {snap.dailyProfitCompare && snap.dailyProfitCompare.length > 0 && (
        <CompareSeriesChart
          title={snap.chartTitleProfit ?? "Lucro dia a dia"}
          subtitle={snap.dailyProfitNote}
          data={snap.dailyProfitCompare}
          type="bar"
        />
      )}

      {snap.dailyAcalRevenueCompare && snap.dailyAcalRevenueCompare.length > 0 && (
        <CompareSeriesChart
          title={snap.chartTitleAcal ?? "Faturamento Acal (o canal que mais dói)"}
          subtitle={snap.dailyAcalNote}
          data={snap.dailyAcalRevenueCompare}
          type="line"
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {snap.channels && snap.channels.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-z-primary/15 bg-surface-card">
            <div className="border-b border-z-primary/15 bg-z-primary/5 px-4 py-3">
              <h3 className="text-sm font-semibold text-text-primary">Por canal</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="text-xs text-text-muted">
                    <th className="px-4 py-2 font-medium">Canal</th>
                    <th className="px-2 py-2 font-medium">Fat. ant.</th>
                    <th className="px-2 py-2 font-medium">Fat. atual</th>
                    <th className="px-2 py-2 font-medium">Lucro ant.</th>
                    <th className="px-4 py-2 font-medium">Lucro atual</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.channels.map((c) => (
                    <tr key={c.name} className="border-t border-surface-border/80">
                      <td className="px-4 py-2.5 font-medium text-text-primary">{c.name}</td>
                      <td className="px-2 py-2.5 text-text-secondary">{money(c.previousRevenue)}</td>
                      <td className="px-2 py-2.5 text-text-secondary">{money(c.currentRevenue)}</td>
                      <td className="px-2 py-2.5 text-text-secondary">{money(c.previousProfit)}</td>
                      <td className="px-4 py-2.5 font-medium text-text-primary">
                        {money(c.currentProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {snap.volumeRows && snap.volumeRows.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-z-emerald/15 bg-surface-card">
            <div className="border-b border-z-emerald/15 bg-z-emerald/5 px-4 py-3">
              <h3 className="text-sm font-semibold text-text-primary">Volume e perdas</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-text-muted">
                    <th className="px-4 py-2 font-medium">Métrica</th>
                    <th className="px-2 py-2 font-medium">Anterior</th>
                    <th className="px-2 py-2 font-medium">Atual</th>
                    <th className="px-4 py-2 font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.volumeRows.map((r) => (
                    <tr key={r.metric} className="border-t border-surface-border/80">
                      <td className="px-4 py-2.5 font-medium text-text-primary">{r.metric}</td>
                      <td className="px-2 py-2.5 text-text-secondary">{r.previous}</td>
                      <td className="px-2 py-2.5 text-text-secondary">{r.current}</td>
                      <td className="px-4 py-2.5 font-medium text-text-primary">{r.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {review.causes.length > 0 && (
        <section className="space-y-3">
          <h2 className="border-l-2 border-z-primary/50 pl-3 text-lg font-semibold text-text-primary">
            Por que foi assim (ordenado por impacto)
          </h2>
          <div className="space-y-3">
            {review.causes
              .slice()
              .sort((a, b) => a.rank - b.rank)
              .map((cause) => (
                <article
                  key={cause.rank}
                  className={cn(
                    "rounded-2xl border bg-surface-card p-4 sm:p-5",
                    cause.rank === 1 ? "border-brand-red/35" : "border-surface-border",
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text-primary sm:text-base">
                      {cause.title}
                    </h3>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                        IMPACT_BADGE[cause.impact] ?? IMPACT_BADGE.medium,
                      )}
                    >
                      {cause.badge ?? `#${cause.rank}`}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-text-secondary">{cause.detail}</p>
                </article>
              ))}
          </div>
        </section>
      )}

      {(review.nextGoals || review.actions.length > 0) && (
        <section className="space-y-3">
          <h2 className="border-l-2 border-z-emerald/50 pl-3 text-lg font-semibold text-text-primary">
            O que fazer para voltar à semana boa
          </h2>
          {review.nextGoals ? (
            <div className="space-y-1 rounded-xl border border-z-primary/20 bg-z-primary/5 px-4 py-3">
              <h3 className="text-sm font-medium text-z-primary">Meta da próxima semana</h3>
              <p className="text-sm leading-relaxed text-text-secondary">{review.nextGoals}</p>
            </div>
          ) : null}
          {review.actions.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-z-primary/15 bg-surface-card">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-z-primary/15 bg-z-primary/5 text-xs text-text-muted">
                    <th className="px-4 py-3 font-medium">Ação</th>
                    <th className="hidden px-2 py-3 font-medium sm:table-cell">Por quê</th>
                    <th className="px-4 py-3 font-medium">Como medir</th>
                  </tr>
                </thead>
                <tbody>
                  {review.actions.map((a) => (
                    <tr key={a.title} className="border-t border-surface-border/80 align-top">
                      <td className="px-4 py-3 font-medium text-text-primary">{a.title}</td>
                      <td className="hidden px-2 py-3 text-text-secondary sm:table-cell">{a.why}</td>
                      <td className="px-4 py-3 text-text-secondary">{a.measure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {review.fairReading ? (
        <div className="rounded-2xl border border-brand-green/25 bg-brand-green/5 px-4 py-4 sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
            Leitura justa
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-primary">{review.fairReading}</p>
        </div>
      ) : null}

      {snap.footerNote ? (
        <p className="text-xs text-text-muted">{snap.footerNote}</p>
      ) : null}
    </div>
  );
}

function StatBlock({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "success" | "warning" | "danger" | "info";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-surface-card p-3 sm:p-4",
        tone === "success" && "border-brand-green/25",
        tone === "warning" && "border-z-warning/30",
        tone === "danger" && "border-brand-red/25",
        tone === "info" && "border-z-info/25",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-bold sm:text-2xl",
          tone === "success" && "text-brand-green",
          tone === "warning" && "text-z-warning",
          tone === "danger" && "text-brand-red",
          tone === "info" && "text-z-info",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-text-muted">{hint}</p>
    </div>
  );
}
