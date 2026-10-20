"use client";

import { motion } from "framer-motion";
import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/utils";
import { useFormatMoney } from "@/hooks/use-hide-money";

export type PulseVariant = "gain" | "loss" | "revenue" | "meta" | "info" | "neutral";

const VARIANT_STYLES: Record<
  PulseVariant,
  { ring: string; glow: string; icon: string; value: string; blob: string }
> = {
  gain: {
    ring: "border-brand-green/35",
    glow: "shadow-[0_0_28px_rgba(34,197,94,0.18)]",
    icon: "bg-brand-green/15 text-brand-green",
    value: "text-brand-green",
    blob: "bg-brand-green/10",
  },
  loss: {
    ring: "border-brand-red/35",
    glow: "shadow-[0_0_28px_rgba(239,68,68,0.16)]",
    icon: "bg-brand-red/15 text-brand-red",
    value: "text-brand-red",
    blob: "bg-brand-red/10",
  },
  revenue: {
    ring: "border-z-emerald/40",
    glow: "shadow-[0_0_28px_rgb(var(--z-emerald-rgb)/0.2)]",
    icon: "bg-z-emerald/15 text-z-emerald",
    value: "text-z-emerald",
    blob: "bg-z-emerald/12",
  },
  meta: {
    ring: "border-z-primary/40",
    glow: "shadow-[0_0_28px_rgb(var(--z-primary-rgb)/0.22)]",
    icon: "bg-z-primary/15 text-z-primary",
    value: "text-z-primary",
    blob: "bg-z-primary/12",
  },
  info: {
    ring: "border-z-info/35",
    glow: "shadow-[0_0_24px_rgb(var(--z-info-rgb)/0.16)]",
    icon: "bg-z-info/15 text-z-info",
    value: "text-z-info",
    blob: "bg-z-info/10",
  },
  neutral: {
    ring: "border-surface-border",
    glow: "",
    icon: "bg-surface-elevated text-text-secondary",
    value: "text-text-primary",
    blob: "bg-surface-elevated/80",
  },
};

interface PulseMetricProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  variant?: PulseVariant;
  format?: "currency" | "number" | "percent" | "raw";
  trend?: number;
  trendLabel?: string;
  subtext?: string;
  delay?: number;
  className?: string;
}

export function PulseMetric({
  label,
  value,
  icon: Icon,
  variant = "neutral",
  format: fmt = "currency",
  trend,
  trendLabel,
  subtext,
  delay = 0,
  className,
}: PulseMetricProps) {
  const money = useFormatMoney();
  const v = VARIANT_STYLES[variant];
  const formatted =
    fmt === "currency"
      ? money(Number(value))
      : fmt === "number"
        ? formatNumber(Number(value))
        : fmt === "percent"
          ? formatPercent(Number(value))
          : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay: delay * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-surface-card/90 p-3.5 backdrop-blur-sm sm:p-4",
        v.ring,
        v.glow,
        className,
      )}
    >
      <div className={cn("absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl", v.blob)} />
      <div className="relative flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            {label}
          </p>
          <p className={cn("text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl", v.value)}>
            {formatted}
          </p>
          {trend !== undefined && (
            <p
              className={cn(
                "mt-1.5 flex items-center gap-1 text-xs font-semibold",
                trend >= 0 ? "text-brand-green" : "text-brand-red",
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {formatPercent(Math.abs(trend))} {trendLabel}
            </p>
          )}
          {subtext && <p className="mt-1 text-xs text-text-secondary leading-snug">{subtext}</p>}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10",
            v.icon,
          )}
        >
          <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" strokeWidth={2} />
        </div>
      </div>
    </motion.div>
  );
}
