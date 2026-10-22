"use client";

import { cn } from "@/lib/utils";
import { useFormatMoney } from "@/hooks/use-hide-money";
import { formatShort } from "@/lib/personal-finance/dates";
import type { Direction } from "@/lib/personal-finance/types";

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-3xl border border-white/10 bg-[#10141B]/90 p-4 sm:p-5", className)}>
      {children}
    </section>
  );
}

export function Money({
  value,
  className,
  tone = "auto",
}: {
  value: number;
  className?: string;
  tone?: "auto" | "in" | "out" | "save" | "neutral";
}) {
  const formatMoney = useFormatMoney("finance");
  const color =
    tone === "in"
      ? "text-emerald-300"
      : tone === "out"
        ? "text-rose-300"
        : tone === "save"
          ? "text-sky-300"
          : tone === "neutral"
            ? "text-[#F7F9FC]"
            : value < 0
              ? "text-rose-300"
              : "text-[#F7F9FC]";
  return <span className={cn("tabular-nums", color, className)}>{formatMoney(value)}</span>;
}

export function directionTone(direction: Direction): "in" | "out" | "save" {
  return direction;
}

export function directionLabel(direction: Direction): string {
  if (direction === "in") return "Entrou";
  if (direction === "save") return "Guardei";
  return "Saiu";
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#93A0B1]">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1 block text-xs text-[#6F7B8C]">{hint}</span> : null}
    </label>
  );
}

export const fieldClass =
  "w-full rounded-2xl border border-white/10 bg-[#0A0D12] px-3 py-3 text-sm text-[#F7F9FC] outline-none transition placeholder:text-[#6F7B8C] focus:border-[#B7FF3C]/70";

export function GoldButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#B7FF3C] px-4 py-3 text-sm font-semibold text-[#07110A] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-[#E7E5E4] transition hover:border-white/25 hover:text-white disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ShortDate({ iso }: { iso: string }) {
  return <span className="tabular-nums">{formatShort(iso)}</span>;
}
