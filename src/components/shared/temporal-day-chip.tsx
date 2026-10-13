"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { isViewingGeneral, useTemporalViewContext } from "@/stores/temporal-context-store";
import { isAllBusinesses } from "@/lib/business-units";

/** Indicador leve de contexto temporal — sem fetch, sem bloquear a tela do módulo. */
export function TemporalDayChip() {
  const context = useTemporalViewContext();
  const { activeBusinessId } = useBusinessScope();

  if (isViewingGeneral(context) || isAllBusinesses(activeBusinessId)) return null;

  const dateLabel =
    context.mode === "range"
      ? `${format(parseISO(context.dateFrom), "dd/MM/yyyy", { locale: ptBR })} – ${format(parseISO(context.dateTo), "dd/MM/yyyy", { locale: ptBR })}`
      : format(parseISO(context.viewDate), "dd/MM/yyyy (EEEE)", { locale: ptBR });

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-z-primary/20 bg-gradient-to-r from-z-primary/8 via-surface-card to-z-emerald/5 px-3 py-2 text-sm">
      <CalendarDays className="h-4 w-4 shrink-0 text-z-primary" />
      <span className="text-text-secondary">
        KPIs filtrados para <strong className="text-text-primary">{dateLabel}</strong>
      </span>
      {context.mode === "day" && (
        <Link
          href="/diario"
          className="ml-auto inline-flex min-h-[32px] items-center px-1 text-xs font-medium text-z-emerald hover:underline"
        >
          Abrir diário →
        </Link>
      )}
    </div>
  );
}
