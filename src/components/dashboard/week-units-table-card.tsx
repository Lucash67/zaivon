"use client";

import { cn } from "@/lib/utils";
import type { WeekUnitsPanel } from "@/lib/dashboard-view";
import { Package } from "lucide-react";

interface WeekUnitsTableCardProps {
  panel: WeekUnitsPanel;
}

export function WeekUnitsTableCard({ panel }: WeekUnitsTableCardProps) {
  if (!panel.available) {
    return (
      <div className="card-surface flex h-full flex-col justify-center p-4 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-z-emerald/10">
            <Package className="h-4 w-4 text-z-emerald" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Unidades da semana</h3>
            <p className="text-xs text-text-muted">Seg–dom · volume diário</p>
          </div>
        </div>
        <p className="rounded-xl border border-dashed border-surface-border bg-surface-elevated/40 px-3 py-4 text-sm leading-relaxed text-text-secondary">
          {panel.notice}
        </p>
      </div>
    );
  }

  const max = Math.max(...panel.rows.map((r) => r.units), 1);

  return (
    <div className="card-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-z-emerald/10">
            <Package className="h-4 w-4 text-z-emerald" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Unidades da semana</h3>
            <p className="text-xs text-text-muted">{panel.rangeLabel}</p>
          </div>
        </div>
        <div className="rounded-full border border-z-emerald/25 bg-z-emerald/10 px-3 py-1 text-xs font-semibold text-z-emerald">
          {panel.total} un.
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border/80">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-surface-border/80 bg-surface-elevated/50 text-xs text-text-muted">
              <th className="px-3 py-2 font-medium">Dia</th>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium text-right">Unidades</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell sm:w-[40%]">Volume</th>
            </tr>
          </thead>
          <tbody>
            {panel.rows.map((row) => (
              <tr
                key={row.date}
                className={cn(
                  "border-t border-surface-border/60",
                  row.isFocus && "bg-z-primary/10",
                  row.outOfScope && "opacity-40",
                )}
              >
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "font-medium capitalize",
                      row.isFocus ? "text-z-lime-300" : "text-text-primary",
                    )}
                  >
                    {row.weekday}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-text-secondary">{row.dayLabel}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-text-primary">
                  {row.outOfScope ? "—" : row.units}
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  {row.outOfScope ? (
                    <span className="text-xs text-text-muted">Fora do período</span>
                  ) : (
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-z-primary to-z-emerald"
                        style={{ width: `${(row.units / max) * 100}%` }}
                      />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
