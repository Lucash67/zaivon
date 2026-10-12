"use client";

import { useState } from "react";
import { Button, Input, Label, Sheet, Tabs, TabsList, TabsTrigger, selectClass, toast } from "@/components/omni-v2/primitives";
import { useOmni } from "@/components/omni-v2/store";
import { OMNI_CHANNELS, OMNI_PRODUCTS } from "@/lib/omni/catalog";
import type { Channel, PaymentMethod, ProductId } from "@/lib/omni/types";
import type { QuickSaleStatus } from "@/lib/omni/omni-service";
import { dayLabel, ddmm, money, parseBrNumber } from "@/lib/omni/format";

type Kind = "venda" | "quitacao" | "compra" | "perda";

export function QuickRegisterForm({ initial = "venda", onDone }: { initial?: Kind; onDone?: () => void }) {
  const o = useOmni();
  const [kind, setKind] = useState<Kind>(initial);
  const [date, setDate] = useState(o.selectedDate <= o.today ? o.selectedDate : o.today);
  const [product, setProduct] = useState<ProductId>("salgado");
  const [channel, setChannel] = useState<Channel>("acal");
  const [status, setStatus] = useState<QuickSaleStatus>("paid");
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [qty, setQty] = useState("1");
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(o.today);
  const [own, setOwn] = useState("");
  const [third, setThird] = useState("");
  const [reason, setReason] = useState("");
  const p = OMNI_PRODUCTS.find((x) => x.id === product)!;
  const unit = p.prices[channel] ?? p.prices.default;
  const units = Math.max(0, Math.round(Number(qty) || 0));
  const people = Array.from(new Set(o.debts.filter((d) => d.status === "open" && d.type !== "investigacao").map((d) => d.person))).sort();
  const openOf = (name: string) =>
    o.debts.filter((d) => d.status === "open" && d.person === name).reduce((s, d) => s + d.amount - d.paid, 0);

  const done = (title: string, description: string) => {
    toast.success(title, { description });
    setQty("1");
    setPerson("");
    setAmount("");
    setOwn("");
    setThird("");
    setReason("");
    onDone?.();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (kind === "quitacao") {
        const v = parseBrNumber(amount);
        if (!person || v <= 0) return void toast.error("Escolha a pessoa e o valor.");
        const r = await o.pay(person, v, paidDate);
        return done(
          "Quitação registrada",
          `${person}: ${money(v)} entrou no caixa de ${ddmm(paidDate)}${r?.extra > 0 ? ` (${money(r.extra)} sem dívida vinculada)` : ""}. Informe o cofrinho do dia para conferir.`,
        );
      }
      if (kind === "venda") {
        if (units < 1) return void toast.error("Informe a quantidade.");
        if (status === "fiado" && !person.trim()) return void toast.error("Informe quem pegou fiado.");
        const r = await o.sale({ date, product, channel, qty: units, status, person: person.trim() || undefined, payment });
        const where = status === "paid" ? "entrou no caixa" : "foi para as pendências";
        return done("Venda registrada", `${units} ${p.name.toLowerCase()} · ${money(r.amount)} ${where} de ${ddmm(date)}.`);
      }
      if (kind === "compra") {
        const vOwn = parseBrNumber(own);
        const vThird = parseBrNumber(third);
        if (units < 1 && vOwn + vThird <= 0) return void toast.error("Informe unidades ou valores.");
        await o.purchase({ date, units, own: vOwn, third: vThird });
        return done("Compra registrada", `${units} un · meu custo ${money(vOwn)} · terceiros ${money(vThird)} em ${ddmm(date)}.`);
      }
      if (units < 1) return void toast.error("Informe a quantidade.");
      await o.waste({ date, qty: units, reason: reason.trim() || undefined });
      return done("Perda registrada", `${units} un em ${ddmm(date)}. O custo já saiu na compra; o lucro não muda.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="venda">Venda</TabsTrigger>
          <TabsTrigger value="quitacao">Quitação</TabsTrigger>
          <TabsTrigger value="compra">Compra</TabsTrigger>
          <TabsTrigger value="perda">Perda</TabsTrigger>
        </TabsList>
      </Tabs>

      {kind !== "quitacao" && (
        <Field label="Dia">
          <Input type="date" value={date} max={o.today} onChange={(e) => setDate(e.target.value)} />
          <p className="text-xs text-o-muted-foreground">{dayLabel(date)}</p>
        </Field>
      )}

      {kind === "venda" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Produto">
              <select className={selectClass} value={product} onChange={(e) => setProduct(e.target.value as ProductId)}>
                {OMNI_PRODUCTS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </Field>
            <Field label="Canal">
              <select className={selectClass} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                {OMNI_CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Quantidade"><Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            <Field label="Total"><div className="num flex h-9 items-center text-sm">{money(unit * units)} <span className="ml-1 text-xs text-o-muted-foreground">({money(unit)} cada)</span></div></Field>
            <Field label="Situação">
              <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as QuickSaleStatus)}>
                <option value="paid">Pago</option>
                <option value="fiado">Fiado</option>
                <option value="parceiro">Parceiro (a receber)</option>
                <option value="investigar">Não identificado</option>
              </select>
            </Field>
            <Field label="Pagamento">
              <select className={selectClass} value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
                <option value="pix">Pix</option>
                <option value="cash">Espécie</option>
                <option value="card">Cartão</option>
              </select>
            </Field>
          </div>
          {status !== "investigar" && (
            <Field label={status === "fiado" ? "Quem pegou fiado" : status === "parceiro" ? "Parceiro (padrão Meia Sola)" : "Cliente (opcional)"}>
              <Input value={person} onChange={(e) => setPerson(e.target.value)} list="omni-people" placeholder="Nome" />
              <datalist id="omni-people">{people.map((x) => <option key={x} value={x} />)}</datalist>
            </Field>
          )}
          <p className="text-xs text-o-muted-foreground">
            {status === "paid" ? "Soma no caixa e no lucro do dia." : "Não entra no lucro: fica nas pendências até cair no banco."}
          </p>
        </>
      )}

      {kind === "quitacao" && (
        <>
          <Field label="Quem pagou">
            <select className={selectClass} value={person} onChange={(e) => { setPerson(e.target.value); setAmount(e.target.value ? String(openOf(e.target.value)).replace(".", ",") : ""); }}>
              <option value="">Escolha…</option>
              {people.map((x) => <option key={x} value={x}>{x} · {money(openOf(x))}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Dia em que entrou"><Input type="date" value={paidDate} max={o.today} onChange={(e) => setPaidDate(e.target.value)} /></Field>
          </div>
          <p className="text-xs text-o-muted-foreground">Conta no lucro do dia em que entrou no banco. Quita primeiro as dívidas mais antigas.</p>
        </>
      )}

      {kind === "compra" && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Unidades"><Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            <Field label="Meu custo (R$)"><Input inputMode="decimal" value={own} onChange={(e) => setOwn(e.target.value)} /></Field>
            <Field label="Terceiros (R$)"><Input inputMode="decimal" value={third} onChange={(e) => setThird(e.target.value)} /></Field>
          </div>
          <p className="text-xs text-o-muted-foreground">O meu custo sai do lucro do dia. A parte de terceiros (Henrique) não.</p>
        </>
      )}

      {kind === "perda" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unidades perdidas"><Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            <Field label="Motivo (opcional)"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Caiu, estragou…" /></Field>
          </div>
          <p className="text-xs text-o-muted-foreground">Venda não paga por cliente desconhecido é “Venda · Não identificado”, não perda.</p>
        </>
      )}

      <Button type="submit" className="w-full" disabled={o.busy}>
        {o.busy ? "Salvando…" : "Registrar"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

export function QuickRegisterSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <h2 className="text-lg font-semibold">Registro rápido</h2>
      <p className="mb-4 text-sm text-o-muted-foreground">Grava no sistema e atualiza o dia, as pendências e os números na hora.</p>
      <QuickRegisterForm onDone={() => onOpenChange(false)} />
    </Sheet>
  );
}
