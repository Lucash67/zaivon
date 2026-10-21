"use client";

import { useFinanceHome } from "@/components/finance/finance-provider";
import { Panel } from "@/components/finance/ui";
import { cn } from "@/lib/utils";

const TONE = {
  warn: "border-rose-400/40 bg-rose-400/5",
  info: "border-[#E8B86D]/30 bg-[#E8B86D]/5",
  good: "border-emerald-400/30 bg-emerald-400/5",
} as const;

export function InsightsScreen() {
  const snap = useFinanceHome();
  if (!snap) return null;
  const { view } = snap;

  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8B86D]">Dica do dia</p>
        <p className="mt-2 text-xl font-semibold">{view.tip.title}</p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#D6D3D1]">{view.tip.body}</p>
      </Panel>
      <div className="grid gap-3">
        {view.insights.map((insight) => (
          <article key={insight.id} className={cn("rounded-3xl border p-4 sm:p-5", TONE[insight.tone])}>
            <p className="text-base font-semibold">{insight.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-[#E7E5E4]">{insight.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
