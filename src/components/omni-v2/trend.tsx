"use client";

import type { ReactNode } from "react";
import { useOmni } from "@/components/omni-v2/store";
import { monthDays, monthSummary, toHistory } from "@/lib/omni/finance/month";
import { computeTrend } from "@/lib/omni/finance/trend";

export function useTrend() {
  const o = useOmni();
  const ms = monthSummary(o.days, o.settlements, o.plan);
  const series = toHistory(monthDays(o.days, o.plan), o.settlements);
  return { ms, series, t: computeTrend(series, o.previousHistory, o.plan, ms) };
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="num w-full min-w-[480px] text-sm">
        <thead><tr className="text-left text-xs text-o-muted-foreground">{head.map((h, i) => <th key={`${h}-${i}`} className="py-2 pr-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="py-2 pr-3">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
