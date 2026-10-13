"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { ModuleShell } from "@/components/layout/module-shell";
import { PageLoader } from "@/components/ui/loading";
import { EmptyModuleState } from "@/components/ui/empty-module-state";
import { Button } from "@/components/ui/button";
import { RetratoReader } from "@/components/period-reviews/retrato-reader";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { cn } from "@/lib/utils";
import type { PeriodReview, PeriodType } from "@/lib/period-reviews/types";

interface PeriodReviewResponse {
  review: PeriodReview | null;
  window: {
    periodType: PeriodType;
    periodKey: string;
    rangeStart: string;
    rangeEnd: string;
    label: string;
    offset: number;
  };
}

export default function RetratoPage() {
  const { activeBusinessId, withQuery } = useBusinessScope();
  const [period, setPeriod] = useState<PeriodType>("weekly");
  const [offset, setOffset] = useState(-1);

  const { data, isLoading, isError, error, refetch } = useQuery<PeriodReviewResponse>({
    queryKey: ["period-reviews", activeBusinessId, period, offset],
    queryFn: async () => {
      const r = await fetch(withQuery(`/api/period-reviews?period=${period}&offset=${offset}`));
      const json = await r.json();
      if (!r.ok || json.error) {
        throw new Error(json.error || "Não foi possível carregar o Retrato.");
      }
      return json;
    },
    staleTime: 60_000,
  });

  if (isError) {
    return (
      <ModuleShell
        title="Retrato"
        subtitle="Análise da operação — veredito, causas e plano"
        temporalFilter={false}
      >
        <EmptyModuleState
          icon={ScrollText}
          title="Não foi possível carregar o Retrato"
          description={error instanceof Error ? error.message : "Tente novamente."}
          onRetry={() => void refetch()}
        />
      </ModuleShell>
    );
  }

  if (isLoading || !data) {
    return (
      <ModuleShell
        title="Retrato"
        subtitle="Análise da operação — veredito, causas e plano"
        temporalFilter={false}
      >
        <PageLoader />
      </ModuleShell>
    );
  }

  const { review, window } = data;

  return (
    <ModuleShell
      title="Retrato"
      subtitle="Análise da operação — veredito, causas e plano"
      temporalFilter={false}
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-z-primary/25 bg-gradient-to-br from-z-primary/10 via-surface-card to-z-emerald/5 px-4 py-3 text-sm text-text-secondary">
          Módulo novo: não é Metas, não é gráfico solto. É a{" "}
          <span className="font-medium text-text-primary">leitura interpretativa</span> da semana ou
          do mês — igual ao canvas de análise. No fim do período você pede no Cursor; eu monto e
          publico aqui, no mesmo fluxo dos registros de salgados.
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex w-full rounded-xl border border-z-primary/20 bg-surface-card p-1 sm:w-auto">
            {(["weekly", "monthly"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPeriod(p);
                  setOffset(-1);
                }}
                className={cn(
                  "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:flex-none sm:py-2",
                  period === p
                    ? "bg-brand-gradient text-brand-on shadow-[0_4px_14px_rgb(var(--z-primary-rgb)/0.3)]"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {p === "weekly" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => setOffset((o) => o - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-0 flex-1 text-center text-sm font-medium capitalize text-text-primary sm:min-w-[180px] sm:flex-none">
              {window.label}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => setOffset((o) => o + 1)}
              disabled={offset >= 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {review ? (
          <RetratoReader review={review} />
        ) : (
          <EmptyModuleState
            icon={ScrollText}
            title="Ainda sem análise deste período"
            description="Feche a semana (ou o mês), peça a análise no Cursor com a mesma lógica do canvas (veredito, gráficos, causas, plano). Eu subo aqui — você só lê e executa."
            compact
          />
        )}
      </div>
    </ModuleShell>
  );
}
