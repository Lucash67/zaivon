"use client";

import { useState } from "react";
import { toast } from "@/components/zaivon-v2/primitives";
import { useZaivon } from "@/components/zaivon-v2/store";
import { daysOpen, recovery, round2 } from "@/lib/zaivon/finance/day";
import { ddmm, money as formatMoney, parseBrNumber } from "@/lib/zaivon/format";
import { Empty, Kpi, PageHeader, Panel, Pill, type Tone } from "@/components/zaivon-v2/ui";
import { Button, Input, Tabs, TabsList, TabsTrigger } from "@/components/zaivon-v2/primitives";
import type { DebtType } from "@/lib/zaivon/types";
import { HideMoneyScope, ScreenHideMoneyButton, useScreenHideMoney } from "@/components/zaivon-v2/hide-money";

const typeInfo: Record<DebtType, [string, Tone]> = {
  fiado: ["Fiado", "pending"],
  parceiro: ["Parceiro", "info"],
  investigacao: ["Investigação", "alert"],
};

export function Pendencias() {
  return (
    <HideMoneyScope screenId="v2-pendencias">
      <PendenciasBody />
    </HideMoneyScope>
  );
}

function PendenciasBody() {
  const o = useZaivon();
  const { money } = useScreenHideMoney();
  const [filter, setFilter] = useState<"all" | DebtType>("all");
  const [paying, setPaying] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(o.today);
  const rec = recovery(o.debts);
  const open = o.debts.filter((d) => d.status === "open" && !d.referenceOnly && (filter === "all" || d.type === filter));
  const groups = Array.from(new Set(open.map((d) => d.person)))
    .map((person) => {
      const items = open.filter((d) => d.person === person).sort((a, b) => a.originDate.localeCompare(b.originDate));
      return { person, items, total: round2(items.reduce((s, d) => s + d.amount - d.paid, 0)), oldest: items[0]!.originDate, type: items[0]!.type };
    })
    .sort((a, b) => a.oldest.localeCompare(b.oldest));
  const history = [...o.settlements].sort((a, b) => b.paidDate.localeCompare(a.paidDate)).slice(0, 12);

  const confirmPay = async (person: string) => {
    const v = parseBrNumber(amount);
    if (!v || v <= 0) { toast.error("Informe um valor."); return; }
    try {
      await o.pay(person, v, paidDate);
      toast.success(`${person} pagou ${formatMoney(v)}`, { description: `Entrou no caixa de ${ddmm(paidDate)}. Informe o cofrinho do dia para conferir.` });
      setPaying(null);
      setAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  };

  const markLoss = async (id: string, label: string) => {
    try {
      await o.markLoss(id);
      toast("Baixado como perda", { description: label });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Pendências" question="Quem me deve?" right={<ScreenHideMoneyButton />} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
        <Kpi big tone="pending" label="Total a recuperar" value={money(rec.total)} formula="Fiados + parceiros + investigação em aberto. Fica fora do lucro até virar quitação." explain={`${money(rec.identified)} identificados + ${money(rec.investigacao)} investigação`} />
        <Kpi label="Fiados" tone="pending" value={money(rec.fiado)} explain={`Parceiros: ${money(rec.parceiro)}`} />
        <Kpi label="Investigação" tone="alert" value={money(rec.investigacao)} explain="Nunca vira perda sozinho" />
      </div>

      {(o.declaredReferences ?? []).length > 0 && (
        <Panel title="Referências declaradas" subtitle="Valores informados pelo responsável. A diferença não vira cobrança." className="mt-4">
          <div className="grid gap-3">
            {(o.declaredReferences ?? []).map((row) => (
              <div key={row.id} className="rounded-xl bg-o-surface p-3 text-sm">
                <p className="font-medium">{row.person}</p>
                <p className="mt-1 text-xs text-o-muted-foreground">
                  Aberto no cadastro: {money(row.liveOpenAmount)}
                  {row.declaredAmount != null ? ` · referência declarada: ${money(row.declaredAmount)}` : ""}
                  {row.lossAmount > 0 ? ` · perda classificada: ${money(row.lossAmount)}` : ""}
                  {row.nonReceivableAmount > 0 ? ` · confirmação fora da cobrança: ${money(row.nonReceivableAmount)}` : ""}
                </p>
                <p className="mt-1 text-xs text-o-muted-foreground">{row.unreconciledNote} Fonte: {row.source}.</p>
              </div>
            ))}
            <p className="text-xs text-o-muted-foreground">Os 14 salgados pagos na Unifor em 28/10 continuam sem pagadores individualizados.</p>
          </div>
        </Panel>
      )}

      {o.debts.some((debt) => debt.status === "loss") && (
        <Panel title="Perdas de crédito" subtitle="Continuam pendentes na venda e ficam fora do total a recuperar." className="mt-4">
          <ul className="grid gap-1.5">
            {o.debts.filter((debt) => debt.status === "loss").map((debt) => (
              <li key={debt.id} className="flex items-center justify-between rounded-lg bg-o-surface px-3 py-2 text-sm">
                <span>{debt.person} · {ddmm(debt.originDate)}</span>
                <span className="num">{money(debt.amount - debt.paid)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mt-5">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="fiado">Fiados</TabsTrigger>
          <TabsTrigger value="parceiro">Parceiros</TabsTrigger>
          <TabsTrigger value="investigacao">Investigação</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 grid gap-3">
        {groups.length === 0 && <Empty>Nenhuma pendência neste filtro.</Empty>}
        {groups.map((g) => {
          const age = daysOpen(g.oldest, o.today);
          const [tl, tt] = typeInfo[g.type];
          return (
            <Panel key={g.person}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><h3 className="text-base font-semibold">{g.person}</h3><Pill tone={tt}>{tl}</Pill>{age >= 5 && <Pill tone="alert">prioridade</Pill>}</div>
                  <p className="text-xs text-o-muted-foreground">Mais antiga: {ddmm(g.oldest)} · {age} dias</p>
                </div>
                <div className="num text-xl font-semibold">{money(g.total)}</div>
              </div>
              <ul className="mt-3 grid gap-1.5">
                {g.items.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-o-surface px-3 py-2 text-sm">
                    <span>{ddmm(d.originDate)} · {d.description}</span>
                    <span className="flex items-center gap-2">
                      <span className="num">{money(d.amount - d.paid)}</span>
                      {d.type === "investigacao" && (
                        <Button size="sm" variant="ghost" disabled={o.busy} onClick={() => markLoss(d.id, `${d.description} de ${ddmm(d.originDate)}`)}>Virar perda</Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {g.type !== "investigacao" && (
                paying === g.person ? (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="text-xs text-o-muted-foreground">Valor<Input autoFocus inputMode="decimal" placeholder="Valor" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-28" aria-label="Valor pago" /></label>
                    <label className="text-xs text-o-muted-foreground">Dia em que entrou<Input type="date" value={paidDate} max={o.today} onChange={(e) => setPaidDate(e.target.value)} className="mt-1 w-40" /></label>
                    <Button disabled={o.busy} onClick={() => confirmPay(g.person)}>{o.busy ? "Salvando…" : "Confirmar"}</Button>
                    <Button variant="ghost" onClick={() => setPaying(null)}>Cancelar</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => { setPaying(g.person); setAmount(String(g.total).replace(".", ",")); setPaidDate(o.today); }}>Registrar pagamento</Button>
                )
              )}
            </Panel>
          );
        })}
      </div>

      <Panel title="Quitações recentes" className="mt-5">
        <ul className="grid gap-1.5 text-sm">
          {history.map((s) => (
            <li key={s.id} className="flex justify-between rounded-lg bg-o-surface px-3 py-2">
              <span>{s.person} <span className="text-xs text-o-muted-foreground">venda {ddmm(s.originDate)} → entrou {ddmm(s.paidDate)}{s.note ? ` · ${s.note}` : ""}</span></span>
              <span className="num text-o-ok">{money(s.amount)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
