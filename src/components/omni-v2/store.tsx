"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Channel, ClosureStatus, OmniData, OperationDay, PaymentMethod, ProductId } from "@/lib/omni/types";
import type { DraftPreview, QuickSaleStatus } from "@/lib/omni/omni-service";

const QUERY_KEY = "omni-v2";

export type OmniAction =
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

async function fetchOmni(month: string | null): Promise<OmniData> {
  const res = await fetch(`/api/omni${month ? `?month=${month}` : ""}`, { cache: "no-store" });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Falha ao carregar.");
  return res.json();
}

async function postJson<T = unknown>(body: unknown): Promise<T> {
  const res = await fetch("/api/omni", {
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

function useOmniState(data: OmniData, selectMonth: (month: string) => void) {
  const qc = useQueryClient();
  const lastDay = data.days[data.days.length - 1]?.date ?? (data.today.startsWith(data.plan.month) ? data.today : `${data.plan.month}-01`);
  const [selectedDate, setSelectedDate] = useState(lastDay);
  useEffect(() => {
    setSelectedDate((d) => d || lastDay);
  }, [lastDay]);

  const mutation = useMutation({
    mutationFn: (body: OmniAction) => postJson<Record<string, unknown>>(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
  const run = (body: OmniAction) => mutation.mutateAsync(body);

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
    sale: (input: Omit<Extract<OmniAction, { action: "sale" }>, "action">) =>
      run({ action: "sale", ...input }) as Promise<{ amount: number }>,
    purchase: (input: Omit<Extract<OmniAction, { action: "purchase" }>, "action">) => run({ action: "purchase", ...input }),
    waste: (input: Omit<Extract<OmniAction, { action: "waste" }>, "action">) => run({ action: "waste", ...input }),
    commitDraft: (date: string, text: string, settlements: { person: string; amount: number }[]) =>
      run({ action: "draftCommit", date, text, settlements }) as Promise<{ sales: number; profit: number }>,
  };
}

export type Omni = ReturnType<typeof useOmniState>;
const Ctx = createContext<Omni | null>(null);

function Ready({ data, selectMonth, children }: { data: OmniData; selectMonth: (m: string) => void; children: ReactNode }) {
  const v = useOmniState(data, selectMonth);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function OmniProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<string | null>(null);
  const q = useQuery({
    queryKey: [QUERY_KEY, month],
    queryFn: () => fetchOmni(month),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  if (q.isLoading) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-o-muted-foreground">Carregando a OMNI…</div>;
  }
  if (q.error || !q.data) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4 text-center text-sm">
        <div>
          <p className="font-semibold">Não foi possível carregar os dados.</p>
          <p className="mt-1 text-o-muted-foreground">{q.error instanceof Error ? q.error.message : ""}</p>
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

export function useOmni() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOmni fora do OmniProvider");
  return v;
}
