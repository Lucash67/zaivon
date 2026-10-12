"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Tabs, TabsContent, TabsList, TabsTrigger, Textarea, toast } from "@/components/omni-v2/primitives";
import { previewDraft, useOmni } from "@/components/omni-v2/store";
import { dayChecks, dayFinance, dayOutflow, impliedYield, previousCofrinho } from "@/lib/omni/finance/day";
import { buildWeekdayDraftTemplate } from "@/lib/day-registration/weekday-draft-templates";
import type { DraftPreview } from "@/lib/omni/omni-service";
import { dayLabel, ddmm, money, parseBrNumber } from "@/lib/omni/format";
import { CheckRow, Kpi, PageHeader, Panel, Pill, RegisteredSalesList } from "@/components/omni-v2/ui";
import { QuickRegisterForm } from "@/components/omni-v2/quick-register";
import { cn } from "@/lib/utils";

const TABS = ["rapido", "rascunho", "fechamento"] as const;
type Tab = (typeof TABS)[number];

export function Registrar() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "rapido";
  const o = useOmni();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Registrar" question={`Como lanço o dia? · ${dayLabel(o.selectedDate)}`} />
      <Tabs value={tab} onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}>
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="rapido">Registro rápido</TabsTrigger>
          <TabsTrigger value="rascunho">Colar rascunho</TabsTrigger>
          <TabsTrigger value="fechamento">Fechamento</TabsTrigger>
        </TabsList>
        <TabsContent value="rapido" className="mt-4"><Panel><QuickRegisterForm /></Panel></TabsContent>
        <TabsContent value="rascunho" className="mt-4"><Draft /></TabsContent>
        <TabsContent value="fechamento" className="mt-4"><Closing key={`${o.selectedDate}-${o.selectedDay.cofrinhoEnd ?? ""}`} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Draft() {
  const o = useOmni();
  const [text, setText] = useState("");
  const [date, setDate] = useState(o.selectedDate <= o.today ? o.selectedDate : o.today);
  const [preview, setPreview] = useState<DraftPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState<Record<string, string>>({});

  const openPeople = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of o.debts) {
      if (d.status !== "open" || d.type === "investigacao") continue;
      map.set(d.person, (map.get(d.person) ?? 0) + d.amount - d.paid);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [o.debts]);

  const interpret = async () => {
    setLoading(true);
    try {
      const p = await previewDraft(text, date);
      setPreview(p);
      const lower = text.toLowerCase();
      const guess: Record<string, string> = {};
      for (const [person, open] of openPeople) {
        if (lower.includes(person.toLowerCase())) guess[person] = String(open).replace(".", ",");
      }
      setPaid(guess);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível interpretar.");
    } finally {
      setLoading(false);
    }
  };

  const settlements = Object.entries(paid)
    .map(([person, v]) => ({ person, amount: parseBrNumber(v) }))
    .filter((s) => s.amount > 0);
  const settledTotal = settlements.reduce((s, x) => s + x.amount, 0);

  const save = async () => {
    try {
      const r = await o.commitDraft(date, text, settlements);
      toast.success(`Dia ${ddmm(date)} gravado`, { description: `${r.sales} venda(s) · lucro ${money(r.profit)}. Confira no Fechamento.` });
      setPreview(null);
      setText("");
      setPaid({});
      o.selectDate(date);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gravar.");
    }
  };

  const f = preview?.financials;
  const cashIn = f?.cashIn ?? preview?.summary.revenue ?? null;

  return (
    <div className="grid gap-4">
      <Panel
        title="Cole o rascunho das suas notas"
        subtitle="Mesmo formato do Registro do Dia: lista de vendas, pendências, perdas e o bloco de custo, faturamento, lucro e cofrinho."
        action={<Button size="sm" variant="ghost" onClick={() => setText(buildWeekdayDraftTemplate(new Date()))}>Carregar modelo</Button>}
      >
        <Textarea value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} rows={12} className="font-mono text-xs" placeholder="Encomendados hoje: …" aria-label="Rascunho do dia" />
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs">Dia do rascunho<Input type="date" value={date} max={o.today} onChange={(e) => { setDate(e.target.value); setPreview(null); }} className="mt-1" /></label>
          <Button disabled={!text.trim() || loading} onClick={interpret}>{loading ? "Interpretando…" : "Interpretar"}</Button>
        </div>
      </Panel>
      {preview && f && (
        <Panel title={`Prévia · ${dayLabel(preview.date)}`} subtitle="Confira antes de gravar. Nada foi salvo ainda.">
          {preview.errors.map((w) => <p key={w} className="mb-2 rounded-lg bg-o-alert/12 px-3 py-2 text-xs text-o-alert">✕ {w}</p>)}
          {preview.warnings.map((w) => <p key={w} className="mb-2 text-xs text-o-pending">⚠ {w}</p>)}
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[
              ["Compra", preview.purchase ? `${preview.purchase.totalUnits} un / ${money(f.totalCost ?? preview.purchase.investment)}` : f.totalCost != null ? money(f.totalCost) : "—"],
              ["Meu custo", f.ownCost != null ? money(f.ownCost) : "—"],
              ["Terceiros", f.thirdPartyCost != null ? money(f.thirdPartyCost) : "—"],
              ["Bonificação", f.bonus != null ? money(f.bonus) : "—"],
              ["Entrada total", cashIn != null ? money(cashIn) : "—"],
              ["Lucro que será gravado", preview.computedProfit != null ? money(preview.computedProfit) : "—"],
              ["Cofrinho", f.cofrinho != null ? money(f.cofrinho) : "—"],
              ["Perdas", f.losses != null ? `${f.losses} un` : "—"],
            ].map(([k, v]) => <div key={k} className="rounded-lg bg-o-surface p-2"><div className="text-xs text-o-muted-foreground">{k}</div><div className="num font-semibold">{v}</div></div>)}
          </div>

          <h3 className="mb-2 mt-4 text-sm font-semibold">Vendas ({preview.sales.length})</h3>
          <ul className="grid max-h-72 gap-1.5 overflow-y-auto">
            {preview.sales.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-o-surface px-3 py-2 text-sm">
                <span className="min-w-0">{s.clientName} · {s.quantity}× {s.productName}</span>
                <Pill tone={s.paymentStatus === "paid" ? "ok" : "pending"}>{s.paymentStatus === "paid" ? s.paymentMethod : "pendente"}</Pill>
              </li>
            ))}
          </ul>
          {preview.newClients.length > 0 && <p className="mt-2 text-xs text-o-muted-foreground">Clientes novos: {preview.newClients.join(", ")}</p>}

          <h3 className="mb-1 mt-4 text-sm font-semibold">Quem quitou neste dia?</h3>
          <p className="mb-2 text-xs text-o-muted-foreground">Marque quem pagou fiado. Baixa a pendência sem somar de novo: o valor já está na entrada total.</p>
          {openPeople.length === 0 ? <p className="text-xs text-o-muted-foreground">Nenhuma pendência em aberto.</p> : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {openPeople.map(([person, open]) => {
                const on = paid[person] != null;
                return (
                  <li key={person} className="flex items-center gap-2 rounded-lg bg-o-surface px-3 py-2 text-sm">
                    <input type="checkbox" checked={on} onChange={(e) => setPaid((prev) => {
                      const next = { ...prev };
                      if (e.target.checked) next[person] = String(open).replace(".", ",");
                      else delete next[person];
                      return next;
                    })} aria-label={`${person} quitou`} />
                    <span className="min-w-0 flex-1 truncate">{person} <span className="text-xs text-o-muted-foreground">· deve {money(open)}</span></span>
                    {on && <Input inputMode="decimal" value={paid[person]} onChange={(e) => setPaid((prev) => ({ ...prev, [person]: e.target.value }))} className="h-8 w-24" aria-label={`Valor pago por ${person}`} />}
                  </li>
                );
              })}
            </ul>
          )}
          {settledTotal > 0 && <p className="num mt-2 text-xs text-o-muted-foreground">Quitações: {money(settledTotal)} · vendas do dia: {money(Math.max(0, (cashIn ?? 0) - settledTotal))}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={save} disabled={o.busy || preview.errors.length > 0}>{o.busy ? "Gravando…" : `Gravar ${ddmm(preview.date)}`}</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

const STEPS = ["Compra & estoque", "Vendas & saídas", "Recebimentos & quitações", "Batimentos", "Conclusão"];

function Closing() {
  const o = useOmni();
  const day = o.selectedDay;
  const [step, setStep] = useState(0);
  const [cof, setCof] = useState(day.cofrinhoEnd != null ? day.cofrinhoEnd.toFixed(2).replace(".", ",") : "");
  const [note, setNote] = useState(day.closureNote ?? "");
  const typed = parseBrNumber(cof);
  const dayWithCof = typed > 0 ? { ...day, cofrinhoEnd: typed } : day;
  const days = o.days.map((d) => (d.date === day.date ? dayWithCof : d));
  const f = dayFinance(day, o.settlements);
  const out = dayOutflow(day);
  const checks = dayChecks(dayWithCof, days, o.settlements, o.plan);
  const prev = previousCofrinho(day, o.days, o.plan);
  const y = impliedYield(dayWithCof, days, o.settlements, o.plan);
  const qs = o.settlements.filter((s) => s.paidDate === day.date);
  const allOk = checks.every((c) => c.ok !== false);
  const exists = o.days.some((d) => d.date === day.date);

  const save = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  };
  const finish = (withNote: boolean) => {
    if (withNote && !note.trim()) { toast.error("Escreva a ressalva."); return; }
    void save(
      () => o.close(day.date, withNote ? "closed_with_note" : "closed", note || undefined, typed > 0 ? typed : undefined),
      withNote ? "Fechado com ressalva" : "Dia fechado ✓",
    );
  };
  const saveCofrinho = () => {
    if (!(typed > 0)) { toast.error("Informe o saldo do cofrinho."); return; }
    void save(() => o.setCofrinho(day.date, typed), `Cofrinho de ${ddmm(day.date)} atualizado`);
  };

  if (!exists) {
    return <Panel><p className="py-6 text-center text-sm text-o-muted-foreground">{dayLabel(day.date)} ainda não foi registrado. Registre o dia antes de fechar.</p></Panel>;
  }

  return (
    <div className="grid gap-4">
      <ol className="grid grid-cols-5 gap-1" aria-label="Passos do fechamento">
        {STEPS.map((s, i) => (
          <li key={s}><button onClick={() => setStep(i)} className={cn("w-full rounded-lg px-1 py-2 text-xs font-medium", i === step ? "bg-o-primary text-o-primary-foreground" : i < step ? "bg-o-ok/15 text-o-ok" : "bg-o-muted text-o-muted-foreground")}>{i + 1}<span className="hidden sm:inline">. {s}</span></button></li>
        ))}
      </ol>
      <Panel title={`${step + 1}. ${STEPS[step]}`} subtitle={dayLabel(day.date)}>
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Comprado" value={day.purchaseUnits != null ? `${day.purchaseUnits} un` : "—"} explain={day.purchaseCost != null ? money(day.purchaseCost) : undefined} />
            <Kpi label="Disponível" value={day.available != null ? `${day.available} un` : "—"} explain="Compra + sobras anteriores" />
            <Kpi label="Meu custo / terceiros" tone="third" value={money(day.ownCost)} explain={`Terceiros ${money(day.thirdPartyCost)} · econômico ${money(f.economicCost)}`} />
          </div>
        )}
        {step === 1 && (
          day.lines.length ? (
            <div className="grid gap-2 text-sm">
              {([["paid", "Pagos", "ok"], ["fiado", "Fiados", "pending"], ["parceiro", "Parceiro", "info"], ["investigar", "Não identificados", "alert"], ["perda", "Perdas", "alert"], ["sobra", "Sobras", "neutral"]] as const).map(([k, l, t]) => (
                <div key={k} className="flex justify-between rounded-lg bg-o-surface px-3 py-2"><Pill tone={t}>{l}</Pill><span className="num">{out.units[k]} un</span></div>
              ))}
              <p className="num text-xs text-o-muted-foreground">Faturamento potencial: {money(out.potential)}</p>
            </div>
          ) : (
            <div className="grid gap-2">
              <p className="text-sm text-o-muted-foreground">Diário: {day.soldUnits} vendidos, {day.lostUnits} perdas.</p>
              <RegisteredSalesList sales={day.registeredSales} />
            </div>
          )
        )}
        {step === 2 && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi tone="ok" label="Recebido do dia" value={money(f.received)} />
              <Kpi tone="ok" label="Quitações" value={money(f.settlements)} />
              <Kpi label="Entrada total" value={money(f.cashIn)} formula="Recebido do dia + quitações" />
            </div>
            <ul className="grid gap-1 text-sm">{qs.map((s) => <li key={s.id} className="flex justify-between rounded-lg bg-o-surface px-3 py-2"><span>{s.person} (venda {ddmm(s.originDate)})</span><span className="num">{money(s.amount)}</span></li>)}</ul>
          </div>
        )}
        {step === 3 && <div className="grid gap-2">{checks.map((c) => <CheckRow key={c.id} c={c} />)}{!allOk && <p className="text-xs text-o-pending">Algo não bateu. O financeiro (caixa, custo, lucro) continua valendo; você pode fechar com ressalva.</p>}</div>}
        {step === 4 && (
          <div className="grid gap-3">
            <Kpi big tone="ok" label="Lucro final" value={money(f.profit)} explain={`${money(f.cashIn)} + ${money(f.bonus)} bônus − ${money(f.ownCost)}`} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Cofrinho informado (R$)<Input inputMode="decimal" value={cof} onChange={(e) => setCof(e.target.value)} className="mt-1" /></label>
              <div className="rounded-xl bg-o-surface p-3 text-sm"><div className="text-xs text-o-muted-foreground">Rendimento calculado</div><div className="num font-semibold">{y != null ? money(y) : "—"}</div><div className="text-xs text-o-muted-foreground">Cofrinho anterior {money(prev)}</div></div>
            </div>
            <label className="text-sm">Ressalva (opcional)<Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" rows={2} /></label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => finish(false)} disabled={!allOk || o.busy}>Fechar dia ✓</Button>
              <Button variant="outline" disabled={o.busy} onClick={() => finish(true)}>Fechar com ressalva</Button>
              <Button variant="outline" disabled={o.busy} onClick={saveCofrinho}>Salvar só o cofrinho</Button>
              <Button variant="ghost" disabled={o.busy} onClick={() => void save(() => o.close(day.date, "draft", note || undefined), "Rascunho salvo")}>Salvar rascunho</Button>
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</Button>
          {step < 4 && <Button variant="outline" onClick={() => setStep(step + 1)}>Próximo</Button>}
        </div>
      </Panel>
    </div>
  );
}
