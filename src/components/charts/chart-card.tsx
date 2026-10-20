"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useFormatMoney, useMoneyHidden } from "@/hooks/use-hide-money";
import { HUB_COLORS } from "@/constants/hub-brand";

const COLORS = [HUB_COLORS.purple, HUB_COLORS.cyan, "#22C55E", "#F59E0B", HUB_COLORS.blue];
const BRAND_PRIMARY = HUB_COLORS.purple;
const BRAND_SECONDARY = HUB_COLORS.cyan;

interface ChartCardProps {
  data: Array<{ label: string; value: number; profit?: number; revenue?: number }>;
  title: string;
  subtitle?: string;
  type?: "area" | "bar" | "pie";
  height?: number;
  showLegend?: boolean;
  /** Pie mais compacto (menos destaque visual). */
  compact?: boolean;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string }>; label?: string }) {
  const money = useFormatMoney();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-surface-border bg-surface-card px-3 py-2 shadow-card">
      <p className="mb-1 text-xs text-text-muted">{label}</p>
      {payload.map((entry, i) => {
        const isMoney =
          typeof entry.value === "number" &&
          (Math.abs(entry.value) >= 1 &&
            (entry.value > 50 || entry.name?.includes("eceita") || entry.name?.includes("ucro")));
        const formatted = isMoney ? money(entry.value) : String(entry.value);
        const line =
          entry.name && entry.name !== "value" ? `${entry.name}: ${formatted}` : formatted;
        return (
          <p key={i} className="text-sm font-medium text-text-primary">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export function ChartCard({
  data,
  title,
  subtitle,
  type = "area",
  height = 260,
  showLegend,
  compact = false,
}: ChartCardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const money = useFormatMoney();
  const moneyHidden = useMoneyHidden();
  const formatAxisValue = (value: number): string => {
    if (moneyHidden) return "••";
    if (!Number.isFinite(value)) return "";
    const abs = Math.abs(value);
    if (abs >= 1000) return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
    return String(Math.round(value));
  };

  const chartData = data.map((d) => ({
    name: d.label,
    value: d.value,
    profit: d.profit,
    revenue: d.revenue ?? d.value,
  }));

  const pieInner = compact ? 28 : 55;
  const pieOuter = compact ? 48 : 85;
  const chartHeight = compact && type === "pie" ? Math.min(height, 140) : height;
  const mobileHeight = compact && type === "pie" ? 120 : 210;

  return (
    <div className={`card-surface ${compact ? "p-3 sm:p-4" : "p-4 sm:p-6"}`}>
      <div className={`mb-3 flex flex-wrap items-start justify-between gap-2 ${compact ? "sm:mb-3" : "sm:mb-6"}`}>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
        </div>
        {type === "area" && showLegend && (
          <div className="flex items-center gap-3 text-xs text-text-muted sm:gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-z-primary" />
              Receita
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-z-emerald" />
              Lucro
            </span>
          </div>
        )}
      </div>
      {/* Altura menor no celular sem depender de JS: variável CSS + breakpoint. */}
      <div
        className="sm:h-[var(--chart-height)]"
        style={
          {
            "--chart-height": `${chartHeight}px`,
            height: `${mobileHeight}px`,
          } as React.CSSProperties
        }
      >
      {!mounted ? (
        <div className="h-full animate-pulse rounded-lg bg-surface-elevated" />
      ) : chartData.length === 0 ? (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface-elevated/30 px-4">
          <p className="text-center text-sm text-text-muted">Sem dados neste período — registre vendas para ver o gráfico.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          {type === "area" ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND_PRIMARY} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={BRAND_PRIMARY} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND_SECONDARY} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={BRAND_SECONDARY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#737373"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              <YAxis
                stroke="#737373"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={formatAxisValue}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke={BRAND_PRIMARY} fill="url(#gradRevenue)" strokeWidth={2} name="Receita" />
              {chartData.some((d) => d.profit !== undefined) && (
                <Area type="monotone" dataKey="profit" stroke={BRAND_SECONDARY} fill="url(#gradProfit)" strokeWidth={2} name="Lucro" />
              )}
            </AreaChart>
          ) : type === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#737373"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              <YAxis
                stroke="#737373"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={formatAxisValue}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" fill={BRAND_PRIMARY} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={pieInner}
                outerRadius={pieOuter}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                stroke="none"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          )}
        </ResponsiveContainer>
      )}
      </div>
      {type === "pie" && mounted && (
        <div className={`mt-3 space-y-1.5 ${compact ? "sm:mt-3" : "mt-4 space-y-2"}`}>
          {chartData.map((item, i) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {item.name}
              </span>
              <span className="font-medium text-text-primary">{money(item.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TopClientsProps {
  clients: Array<{ label: string; value: number }>;
  subtitle?: string;
  /** Ex.: "na semana" — aparece ao lado da contagem. */
  valueSuffix?: string;
}

/** Ranking de clientes por vezes compradas (tickets). */
export function TopClientsCard({
  clients,
  subtitle = "Este mês",
  valueSuffix = "compras",
}: TopClientsProps) {
  const max = Math.max(...clients.map((c) => c.value), 1);

  return (
    <div className="card-surface p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h3 className="text-sm font-semibold text-text-primary">Top clientes</h3>
        <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
      </div>
      <div className="space-y-4">
        {clients.length === 0 ? (
          <p className="text-sm text-text-muted">Sem vendas no período</p>
        ) : (
          clients.slice(0, 5).map((client, i) => (
            <div key={client.label}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-text-secondary">
                  {i + 1}. {client.label}
                </span>
                <span className="shrink-0 font-medium text-text-primary">
                  {client.value} {valueSuffix}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className="h-full rounded-full bg-brand-gradient transition-all duration-500"
                  style={{ width: `${(client.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
