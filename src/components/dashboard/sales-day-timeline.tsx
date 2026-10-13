"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sun,
  Sunset,
  User,
  Wallet,
  AlertOctagon,
  Star,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { formatSaleShift } from "@/lib/sale-shift";
import type { DayTimelineGroup } from "@/lib/dashboard-view";
import { useBusinessScope } from "@/hooks/use-business-scope";

interface SalesDayTimelineProps {
  groups: DayTimelineGroup[];
  onLoyaltyChange?: () => void;
}

const PERIOD_META = {
  morning: {
    label: "Manhã",
    icon: Sun,
    gradient: "from-z-primary/20 via-z-emerald/10 to-transparent",
    border: "border-z-primary/25",
    accent: "text-z-primary",
    dot: "bg-z-primary",
  },
  afternoon: {
    label: "Tarde",
    icon: Sunset,
    gradient: "from-z-info/20 via-z-emerald/10 to-transparent",
    border: "border-z-info/25",
    accent: "text-z-emerald",
    dot: "bg-z-info",
  },
} as const;

const STATUS_STYLES = {
  success: {
    badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    amount: "text-emerald-300",
  },
  warning: {
    badge: "bg-z-warning/15 text-z-warning ring-z-warning/30",
    amount: "text-z-warning",
  },
  neutral: {
    badge: "bg-surface-elevated text-text-muted ring-surface-border",
    amount: "text-text-primary",
  },
};

export function SalesDayTimeline({ groups, onLoyaltyChange }: SalesDayTimelineProps) {
  const { activeBusinessId, canWrite } = useBusinessScope();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggleLoyalty(saleId: string, confirmed: boolean) {
    if (!canWrite) return;
    setBusyId(saleId);
    setMsg(null);
    try {
      const res = await fetch("/api/fidelidade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_sale",
          businessId: activeBusinessId,
          saleId,
          confirmed,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha na fidelidade");
      setMsg(json.result?.message ?? json.result?.reason ?? (confirmed ? "Confirmado." : "Removido."));
      onLoyaltyChange?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusyId(null);
    }
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-surface-border bg-surface-elevated/50 px-6 py-10 text-center">
        <Sun className="mx-auto mb-2 h-8 w-8 text-text-muted/50" />
        <p className="text-sm text-text-muted">Nenhuma venda registrada neste dia.</p>
      </div>
    );
  }

  const totalEntries = groups.reduce((sum, g) => sum + g.entries.length, 0);

  return (
    <div className="space-y-5 sm:space-y-6">
      {msg && (
        <p className="rounded-lg border border-brand-green/30 bg-brand-green/5 px-3 py-2 text-xs text-text-secondary">
          {msg}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-text-muted">
        <span>{totalEntries} movimentações</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Pago
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-z-warning" /> Pendente / Perda
          </span>
        </span>
      </div>

      {groups.map((group, groupIndex) => {
        const meta = PERIOD_META[group.period];
        const PeriodIcon = meta.icon;

        return (
          <motion.section
            key={group.period}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: groupIndex * 0.08, duration: 0.4 }}
          >
            <div
              className={cn(
                "mb-3 flex items-center gap-3 rounded-xl border bg-gradient-to-r px-4 py-2.5",
                meta.border,
                meta.gradient,
              )}
            >
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-black/20", meta.accent)}>
                <PeriodIcon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className={cn("text-xs font-bold uppercase tracking-widest", meta.accent)}>{meta.label}</p>
                <p className="text-[11px] text-text-secondary">
                  {group.entries.length} {group.entries.length === 1 ? "venda" : "vendas"}
                </p>
              </div>
            </div>

            <div className="relative ml-4 space-y-2 border-l-2 border-surface-border pl-5 sm:ml-5">
              {group.entries.map((entry, entryIndex) => {
                const styles = STATUS_STYLES[entry.statusTone];
                const isLoss = entry.statusLabel === "Perda";

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: groupIndex * 0.08 + entryIndex * 0.04, duration: 0.35 }}
                    className={cn(
                      "group relative rounded-xl border bg-surface-card/90 p-3.5 transition-colors hover:bg-surface-elevated/80",
                      isLoss ? "border-red-500/25 bg-red-500/5" : "border-surface-border/80",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute -left-[calc(1.25rem+5px)] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-surface-card",
                        isLoss ? "bg-red-400" : meta.dot,
                      )}
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface-elevated px-2 py-0.5 text-xs font-bold text-text-primary">
                            {formatSaleShift(entry.time)}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1",
                              styles.badge,
                            )}
                          >
                            {isLoss && <AlertOctagon className="mr-1 h-3 w-3" />}
                            {entry.statusLabel}
                          </span>
                          {entry.loyaltyConfirmed && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                              <Star className="h-3 w-3" /> Fidelidade
                            </span>
                          )}
                        </div>

                        <p className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                          <User className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                          <span className="truncate">{entry.clientName}</span>
                        </p>

                        <p className="text-xs leading-relaxed text-text-secondary">{entry.products}</p>

                        {entry.paymentLabel && (
                          <p className="flex items-center gap-1 text-[11px] text-text-muted">
                            <Wallet className="h-3 w-3" />
                            {entry.paymentLabel}
                          </p>
                        )}

                        {canWrite && entry.clientId && !isLoss && (
                          <button
                            type="button"
                            disabled={busyId === entry.id}
                            onClick={() => void toggleLoyalty(entry.id, !entry.loyaltyConfirmed)}
                            className="mt-1 text-[11px] font-medium text-z-emerald underline-offset-2 hover:underline disabled:opacity-50"
                          >
                            {entry.loyaltyConfirmed
                              ? "Remover da fidelidade"
                              : "Confirmar comprovante (fidelidade)"}
                          </button>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "text-base font-black tracking-tight sm:text-lg",
                            isLoss ? "text-red-400" : styles.amount,
                          )}
                        >
                          {isLoss ? "—" : formatCurrency(entry.amount)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
