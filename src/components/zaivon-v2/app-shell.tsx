"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { Button, Toaster, selectClass } from "@/components/zaivon-v2/primitives";
import { useZaivon } from "@/components/zaivon-v2/store";
import { salesDays } from "@/lib/zaivon/finance/month";
import { dayFinance, recovery } from "@/lib/zaivon/finance/day";
import { ddmm, money as formatMoney, weekday } from "@/lib/zaivon/format";
import { ZAIVON_V2_NAV } from "@/constants/navigation";
import { cn } from "@/lib/utils";
import { hideMoneyScreenFromPath, useHideMoney } from "@/hooks/use-hide-money";
import { QuickRegisterSheet } from "./quick-register";

export const ZAIVON_BASE = "/v2";

/** Barra do dia + atalhos da ZAIVON v2, dentro do layout do sistema atual. */
export function ZaivonFrame({ children }: { children: ReactNode }) {
  const o = useZaivon();
  const pathname = usePathname();
  const screenId = hideMoneyScreenFromPath(pathname) ?? "v2-hoje";
  const { maskMoney } = useHideMoney(screenId);
  const money = maskMoney(formatMoney);
  const [cmd, setCmd] = useState(false);
  const [quick, setQuick] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmd((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const rec = recovery(o.debts);

  return (
    <>
      <div className="sticky top-[56px] z-20 border-b bg-o-background/90 backdrop-blur lg:top-[64px]">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 md:px-6">
          <select
            aria-label="Mês"
            className={cn(selectClass, "h-8 w-auto py-0 text-xs")}
            value={o.plan.month}
            onChange={(e) => o.selectMonth(e.target.value)}
          >
            {o.availableMonths.map((m) => <option key={m.month} value={m.month}>{m.label}</option>)}
          </select>
          <DayStrip />
          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden rounded-lg border bg-o-surface px-2.5 py-1 text-right md:block" title={`${money(rec.investigacao)} em investigação`}>
              <div className="text-[10px] uppercase tracking-wide text-o-muted-foreground">A recuperar</div>
              <div className="num text-sm font-semibold text-o-pending">{money(rec.total)}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCmd(true)} aria-label="Buscar (Ctrl+K)" className="hidden sm:inline-flex">
              <Search className="size-4" /> <span className="text-xs text-o-muted-foreground">Ctrl K</span>
            </Button>
            <Button size="sm" onClick={() => setQuick(true)}><Plus className="size-4" /> <span className="hidden sm:inline">Registrar</span></Button>
          </div>
        </div>
      </div>
      <div className="min-w-0 px-3 pb-10 pt-5 md:px-6">{children}</div>

      <QuickRegisterSheet open={quick} onOpenChange={setQuick} />
      <CommandPalette open={cmd} onClose={() => setCmd(false)} onQuick={() => { setCmd(false); setQuick(true); }} />
      <Toaster />
    </>
  );
}

function CommandPalette({ open, onClose, onQuick }: { open: boolean; onClose: () => void; onQuick: () => void }) {
  const o = useZaivon();
  const router = useRouter();
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);
  const people = useMemo(
    () => Array.from(new Set(o.debts.filter((d) => d.status === "open").map((d) => d.person))),
    [o.debts],
  );
  if (!open) return null;
  const go = (to: string) => {
    onClose();
    router.push(to);
  };
  const groups: { heading: string; items: { label: string; run: () => void }[] }[] = [
    {
      heading: "Ações",
      items: [
        { label: "Registrar venda, quitação, compra ou perda", run: onQuick },
        { label: "Fechar o dia", run: () => go(`${ZAIVON_BASE}/registrar?tab=fechamento`) },
        { label: "Colar rascunho", run: () => go(`${ZAIVON_BASE}/registrar?tab=rascunho`) },
      ],
    },
    { heading: "Telas", items: ZAIVON_V2_NAV.map((n) => ({ label: n.label, run: () => go(n.href) })) },
    { heading: "Clientes com pendência", items: people.map((p) => ({ label: p, run: () => go(`${ZAIVON_BASE}/pendencias`) })) },
  ];
  const needle = q.trim().toLowerCase();
  const filtered = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !needle || i.label.toLowerCase().includes(needle)) }))
    .filter((g) => g.items.length);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-start justify-center px-4 pt-[12vh]">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div role="dialog" aria-modal className="relative w-full max-w-lg overflow-hidden rounded-2xl border bg-o-popover shadow-2xl">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter") filtered[0]?.items[0]?.run();
          }}
          placeholder="Buscar tela, ação ou cliente…"
          className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none"
        />
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && <p className="p-4 text-center text-sm text-o-muted-foreground">Nada encontrado.</p>}
          {filtered.map((g) => (
            <div key={g.heading} className="mb-1">
              <div className="px-2 py-1 text-xs font-medium text-o-muted-foreground">{g.heading}</div>
              {g.items.map((i) => (
                <button key={i.label} type="button" onClick={i.run} className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-o-muted">
                  {i.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayStrip() {
  const o = useZaivon();
  const pathname = usePathname();
  const screenId = hideMoneyScreenFromPath(pathname) ?? "v2-hoje";
  const { hidden, mask } = useHideMoney(screenId);
  const all = useMemo(() => [...salesDays(o.plan), ...o.plan.holidays].sort(), [o.plan]);
  const idx = Math.max(0, all.indexOf(o.selectedDate));
  const [page, setPage] = useState(Math.floor(idx / 5));
  useEffect(() => setPage(Math.floor(Math.max(0, all.indexOf(o.selectedDate)) / 5)), [all, o.selectedDate]);
  const visible = all.slice(page * 5, page * 5 + 5);
  const maxPage = Math.ceil(all.length / 5) - 1;
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button variant="ghost" size="icon" className="size-8" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Dias anteriores"><ChevronLeft className="size-4" /></Button>
      <div className="flex gap-1 overflow-x-auto">
        {visible.map((d) => {
          const day = o.days.find((x) => x.date === d);
          const hol = o.plan.holidays.includes(d);
          const p = day ? dayFinance(day, o.settlements).profit : null;
          const sel = d === o.selectedDate;
          return (
            <button key={d} disabled={hol} onClick={() => o.selectDate(d)} aria-pressed={sel}
              className={cn("min-w-14 rounded-lg border px-2 py-1 text-center", sel ? "border-o-primary bg-o-primary/12" : "border-transparent hover:bg-o-muted", hol && "opacity-50")}>
              <div className="text-xs text-o-muted-foreground">{weekday(d)} {ddmm(d)}</div>
              <div className={cn("num text-xs font-semibold", p == null ? "text-o-muted-foreground" : "text-o-ok")}>
                {hol ? "feriado" : p == null ? "—" : hidden ? mask : `R$ ${Math.round(p)}`}
              </div>
            </button>
          );
        })}
      </div>
      <Button variant="ghost" size="icon" className="size-8" disabled={page >= maxPage} onClick={() => setPage(page + 1)} aria-label="Próximos dias"><ChevronRight className="size-4" /></Button>
    </div>
  );
}
