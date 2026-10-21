"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Direction, FinanceSnapshot } from "@/lib/personal-finance/types";

const FINANCE_KEY = ["zaivon-finance"] as const;

export type ComposerSeed = {
  direction: Direction;
  goalId: string | null;
  token: number;
};

type FinanceContextValue = {
  snapshot: FinanceSnapshot | undefined;
  loading: boolean;
  error: string | null;
  composer: ComposerSeed | null;
  openComposer: (seed?: Partial<ComposerSeed>) => void;
  closeComposer: () => void;
  diagnosisOpen: boolean;
  openDiagnosis: () => void;
  closeDiagnosis: () => void;
  act: (action: string, payload?: unknown) => Promise<void>;
  reload: () => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

async function fetchSnapshot(): Promise<FinanceSnapshot> {
  const res = await fetch("/api/finance", { credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; snapshot?: FinanceSnapshot };
  if (!res.ok || !data.ok || !data.snapshot) {
    throw new Error(data.error || "Não consegui abrir o Finance.");
  }
  return data.snapshot;
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: FINANCE_KEY, queryFn: fetchSnapshot });
  const [composer, setComposer] = useState<ComposerSeed | null>(null);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);

  const act = useCallback(
    async (action: string, payload?: unknown) => {
      const res = await fetch("/api/finance", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Não deu certo.");
      await queryClient.invalidateQueries({ queryKey: FINANCE_KEY });
    },
    [queryClient],
  );

  const value: FinanceContextValue = {
    snapshot: query.data,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : query.error ? "Não consegui abrir o Finance." : null,
    composer,
    openComposer: (seed) =>
      setComposer({
        direction: seed?.direction ?? "out",
        goalId: seed?.goalId ?? null,
        token: Date.now(),
      }),
    closeComposer: () => setComposer(null),
    diagnosisOpen,
    openDiagnosis: () => setDiagnosisOpen(true),
    closeDiagnosis: () => setDiagnosisOpen(false),
    act,
    reload: () => {
      void query.refetch();
    },
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance precisa estar dentro do Finance.");
  return ctx;
}

export function useFinanceHome() {
  const { snapshot } = useFinance();
  if (!snapshot || snapshot.needsOnboarding) return null;
  return snapshot;
}
