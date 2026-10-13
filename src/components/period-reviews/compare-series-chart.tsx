"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { HUB_COLORS } from "@/constants/hub-brand";

interface ComparePoint {
  label: string;
  previous: number;
  current: number;
}

interface CompareSeriesChartProps {
  title: string;
  subtitle?: string;
  data: ComparePoint[];
  type?: "bar" | "line";
  height?: number;
  previousName?: string;
  currentName?: string;
  currency?: boolean;
}

export function CompareSeriesChart({
  title,
  subtitle,
  data,
  type = "bar",
  height = 240,
  previousName = "Semana anterior",
  currentName = "Semana atual",
  currency = true,
}: CompareSeriesChartProps) {
  const fmt = (v: number) => (currency ? formatCurrency(v) : String(v));

  return (
    <div className="rounded-2xl border border-z-primary/15 bg-surface-card p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p> : null}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        {type === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={48} />
            <Tooltip
              formatter={(value: number, name: string) => [fmt(value), name]}
              contentStyle={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--surface-border)",
                borderRadius: 12,
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="previous"
              name={previousName}
              stroke={HUB_COLORS.cyan}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="current"
              name={currentName}
              stroke={HUB_COLORS.purple}
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={48} />
            <Tooltip
              formatter={(value: number, name: string) => [fmt(value), name]}
              contentStyle={{
                background: "var(--surface-elevated)",
                border: "1px solid var(--surface-border)",
                borderRadius: 12,
              }}
            />
            <Legend />
            <Bar dataKey="previous" name={previousName} fill={HUB_COLORS.cyan} fillOpacity={0.45} radius={[6, 6, 0, 0]} />
            <Bar dataKey="current" name={currentName} fill={HUB_COLORS.purple} radius={[6, 6, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
