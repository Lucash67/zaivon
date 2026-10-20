"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Channel, ClosureStatus, ZaivonData, OperationDay, PaymentMethod, ProductId } from "@/lib/zaivon/types";
import type { DraftPreview, QuickSaleStatus } from "@/lib/zaivon/zaivon-service";

const QUERY_KEY = "zaivon-v2";

export type ZaivonAction =
  | { action: "pay"; person: string; amount: number; paidDate: string }
  | { action: "cofrinho"; date: string; amount: number }
  | { action: "close"; date: string; status: Exclude<ClosureStatus, "summary" | "open">; note?: string; cofrinho?: number }
  | { action: "loss"; debtId: string }
  | {
      action: "sale";
      date: string;
      product: ProductId;
      channel: Channel;
      qty: number;
      status: QuickSaleStatus;
      person?: string;
      payment: PaymentMethod;
    }
  | { action: "purchase"; date: string; units: number; own: number; third: number; thirdName?: string }
  | { action: "waste"; date: string; qty: number; reason?: string }
  | { action: "draftCommit"; date: string; text: string; settlements: { person: string; amount: number }[] };

async function fetchZaivon(month: string | null): Promise<ZaivonData> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch(`/api/zaivon${month ? `?month=${month}` : ""}`, {
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Falha ao carregar.");
    return res.json();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Demorou demais para carregar. Toque em Tentar de novo.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function postJson<T = unknown>(body: unknown): Promise<T> {
  const res = await fetch("/api/zaivon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Não foi possível salvar.");
  return json as T;
}

export function previewDraft(text: string, date: string) {
  return postJson<DraftPreview>({ action: "draftPreview", text, date });
}

export function emptyDay(date: string): OperationDay {
  return {
    date,
    receivedBase: 0,
    ownCost: 0,
    thirdPartyCost: 0,
    bonus: 0,
    soldUnits: 0,
    lostUnits: 0,
    cofrinhoEnd: null,
    lines: [],
    closure: "open",
  };
}

function useZaivonState(data: ZaivonData, selectMonth: (month: string) => void) {
  const qc = useQueryClient();
  const lastDay = data.days[data.days.length - 1]?.date ?? (data.today.startsWith(data.plan.month) ? data.today : `${data.plan.month}-01`);
  const [selectedDate, setSelectedDate] = useState(lastDay);
  useEffect(() => {
    setSelectedDate((d) => d || lastDay);
  }, [lastDay]);

  const mutation = useMutation({
    mutationFn: (body: ZaivonAction) => postJson<Record<string, unknown>>(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
  const run = (body: ZaivonAction) => mutation.mutateAsync(body);

  const selectedDay = data.days.find((d) => d.date === selectedDate) ?? emptyDay(selectedDate);
  return {
    ...data,
    selectedDate,
    selectedDay,
    busy: mutation.isPending,
    selectDate: setSelectedDate,
    selectMonth,
    pay: (person: string, amount: number, paidDate: string) =>
      run({ action: "pay", person, amount, paidDate }) as Promise<{ settled: number; extra: number }>,
    setCofrinho: (date: string, amount: number) => run({ action: "cofrinho", date, amount }),
    close: (date: string, status: Exclude<ClosureStatus, "summary" | "open">, note?: string, cofrinho?: number) =>
      run({ action: "close", date, status, note, cofrinho }),
    markLoss: (debtId: string) => run({ action: "loss", debtId }),
    sale: (input: Omit<Extract<ZaivonAction, { action: "sale" }>, "action">) =>
      run({ action: "sale", ...input }) as Promise<{ amount: number }>,
    purchase: (input: Omit<Extract<ZaivonAction, { action: "purchase" }>, "action">) => run({ action: "purchase", ...input }),
    waste: (input: Omit<Extract<ZaivonAction, { action: "waste" }>, "action">) => run({ action: "waste", ...input }),
    commitDraft: (date: string, text: string, settlements: { person: string; amount: number }[]) =>
      run({ action: "draftCommit", date, text, settlements }) as Promise<{ sales: number; profit: number }>,
  };
}

export type Zaivon = ReturnType<typeof useZaivonState>;
const Ctx = createContext<Zaivon | null>(null);

function Ready({ data, selectMonth, children }: { data: ZaivonData; selectMonth: (m: string) => void; children: ReactNode }) {
  const v = useZaivonState(data, selectMonth);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function ZaivonProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<string | null>(null);
  const q = useQuery({
    queryKey: [QUERY_KEY, month],
    queryFn: () => fetchZaivon(month),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  if (q.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center gap-2 px-4 text-center text-sm text-o-muted-foreground">
        <p>Carregando a ZAIVON…</p>
        <p className="text-xs opacity-70">Se travar, aguarde ou atualize a página.</p>
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4 text-center text-sm">
        <div className="max-w-sm space-y-3">
          <p className="font-semibold">Não foi possível carregar os dados.</p>
          <p className="text-o-muted-foreground">{q.error instanceof Error ? q.error.message : ""}</p>
          <button
            type="button"
            className="rounded-lg border border-o-border bg-o-card px-3 py-2 text-sm font-medium hover:bg-o-muted/40"
            onClick={() => void q.refetch()}
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }
  return (
    <Ready key={q.data.plan.month} data={q.data} selectMonth={setMonth}>
      {children}
    </Ready>
  );
}

export function useZaivon() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useZaivon fora do ZaivonProvider");
  return v;
}
