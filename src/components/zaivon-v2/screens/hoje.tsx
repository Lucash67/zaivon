"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useZaivon } from "@/components/zaivon-v2/store";
import { dayChecks, dayFinance, daysOpen, recovery } from "@/lib/zaivon/finance/day";
import { monthSummary } from "@/lib/zaivon/finance/month";
import { dayLabel, ddmm, pctFmt } from "@/lib/zaivon/format";
import { CheckRow, Kpi, PageHeader, Panel, Pill, Progress, RegisteredSalesList } from "@/components/zaivon-v2/ui";
import { DayReconciliationPanel } from "@/components/zaivon-v2/day-reconciliation";
import { buttonClass } from "@/components/zaivon-v2/primitives";
import { ZAIVON_BASE } from "@/components/zaivon-v2/app-shell";
import { HideMoneyScope, ScreenHideMoneyButton, useScreenHideMoney } from "@/components/zaivon-v2/hide-money";
import { FINANCE_LABELS, PROVISIONAL_HINT } from "@/lib/finance/labels";

const closureLabel = {
  closed: ["Fechado ✓", "ok"],
  closed_with_note: ["Fechado com ressalva", "pending"],
  draft: ["A revisar", "pending"],
  summary: ["Fechado (resumo)", "info"],
  open: ["Em aberto", "neutral"],
} as const;

export function Hoje() {
  return (
    <HideMoneyScope screenId="v2-hoje">
      <HojeBody />
    </HideMoneyScope>
  );
}

function HojeBody() {
  const o = useZaivon();
  const { money } = useScreenHideMoney();
  const day = o.selectedDay;
  const exists = o.days.some((d) => d.date === day.date);
  const f = dayFinance(day, o.settlements);
  const checks = dayChecks(day, o.days, o.settlements, o.plan);
  const rec = recovery(o.debts);
  const ms = monthSummary(o.days, o.settlements, o.plan);
  const failed = checks.filter((c) => c.ok === false);
  const passed = checks.filter((c) => c.id !== "cofrinho" && c.ok === true).length;
  const partialOps = checks.filter((c) => c.id !== "cofrinho" && c.ok === null).length;
  const [cl, tone] = closureLabel[day.closure];

  const oldest = [...o.debts]
    .filter(
      (d) =>
        d.status === "open" &&
        d.type !== "investigacao" &&
        (!d.deferredUntil || d.deferredUntil <= o.selectedDate),
    )
    .sort((a, b) => a.originDate.localeCompare(b.originDate))[0];
  const deferredOpen = o.debts.filter(
    (d) => d.status === "open" && d.deferredUntil && d.deferredUntil > o.selectedDate,
  );
  const inv = o.debts.filter((d) => d.status === "open" && d.type === "investigacao");
  const closing = `${ZAIVON_BASE}/registrar?tab=fechamento`;
  const pendings = `${ZAIVON_BASE}/pendencias`;
  const cofCheck = checks.find((c) => c.id === "cofrinho");
  const actions: { text: string; to: string }[] = [];
  const fullyClosed = day.closure === "closed" || day.closure === "summary" || day.closure === "closed_with_note";
  if (!fullyClosed) actions.push({ text: "Fechar o dia (fechamento assistido)", to: closing });
  if (cofCheck?.ok === false && day.cofrinhoEnd == null) {
    actions.push({ text: `Informar o saldo do cofrinho de ${ddmm(day.date)}`, to: closing });
  } else if (cofCheck?.ok === false) {
    actions.push({
      text: `Revisar batimento do cofrinho de ${ddmm(day.date)} (saldo já informado — não redepositar)`,
      to: closing,
    });
  } else if (cofCheck?.ok == null && day.cofrinhoEnd == null) {
    actions.push({ text: `Informar o saldo do cofrinho de ${ddmm(day.date)}`, to: closing });
  }
  const otherFailed = failed.filter((c) => c.id !== "cofrinho");
  if (otherFailed.length) actions.push({ text: `Revisar: ${otherFailed.map((c) => c.label.toLowerCase()).join(", ")}`, to: closing });
  if (oldest) {
    actions.push({
      text: `Cobrar ${oldest.person} — ${money(oldest.amount - oldest.paid)} desde ${ddmm(oldest.originDate)} (${daysOpen(oldest.originDate, o.selectedDate)} dias)`,
      to: pendings,
    });
  }
  if (deferredOpen.length) {
    const names = [...new Set(deferredOpen.map((d) => d.person))];
    const sum = deferredOpen.reduce((s, d) => s + (d.amount - d.paid), 0);
    actions.push({
      text: `Acordo diferido: ${names.join(", ")} — ${money(sum)} (não cobrar agora; ver pendências)`,
      to: pendings,
    });
  }
  if (inv.length) actions.push({ text: `Decidir ${inv.length} itens não identificados (${money(rec.investigacao)})`, to: pendings });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Hoje · ${dayLabel(day.date)}`}
        question="Como está o dia? · 5 dimensões financeiras"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <ScreenHideMoneyButton />
            {f.competenceStatus === "provisional" && <Pill tone="pending">Provisório</Pill>}
            <Pill tone={tone}>{cl}</Pill>
          </div>
        }
      />
      {!exists ? (
        <Panel>
          <div className="py-8 text-center">
            <p className="text-sm text-o-muted-foreground">Nada registrado em {dayLabel(day.date)} ainda.</p>
            <Link href={`${ZAIVON_BASE}/registrar`} className={buttonClass("default", "default", "mt-4")}>Começar o registro</Link>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4">
          {f.competenceStatus === "provisional" && (
            <div className="rounded-xl border border-o-pending/40 bg-o-pending/10 px-4 py-3 text-sm text-o-pending">
              {PROVISIONAL_HINT}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="grid gap-4 sm:grid-cols-2">
              <Kpi
                big
                tone="ok"
                label={FINANCE_LABELS.cashManagementResult.short}
                value={money(f.profit)}
                formula={FINANCE_LABELS.cashManagementResult.formula}
                explain={`${money(f.cashIn)} de entrada${f.bonus ? ` + ${money(f.bonus)} de bônus` : ""} − ${money(f.ownCost)} de custo próprio`}
              />
              <Kpi
                big
                label={
                  f.competenceStatus === "provisional"
                    ? `${FINANCE_LABELS.competenceProfit.short} (provisório)`
                    : FINANCE_LABELS.competenceProfit.short
                }
                value={money(f.competenceProfit)}
                formula={FINANCE_LABELS.competenceProfit.formula}
                explain={
                  f.competenceStatus === "provisional"
                    ? `PROVISÓRIO — working figure ${money(f.competenceRevenue)} − ${money(f.ownCost)}. Há Δ diário×sales; não tratar como confirmado.`
                    : `${FINANCE_LABELS.competenceRevenue.short} ${money(f.competenceRevenue)} − custo ${money(f.ownCost)} · gap vs caixa ${money(f.competenceProfit - f.operationalProfit)}`
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Kpi
                label={FINANCE_LABELS.competenceRevenue.short}
                value={money(f.competenceRevenue)}
                formula={FINANCE_LABELS.competenceRevenue.formula}
                explain={f.competenceStatus === "provisional" ? "Working figure (provisório)" : `Fiados novos: ${money(f.newCredit)}`}
              />
              <Kpi
                label={FINANCE_LABELS.cashIn.short}
                value={money(f.cashIn)}
                formula={FINANCE_LABELS.cashIn.formula}
                explain={
                  f.otherInflows > 0
                    ? `${money(f.received)} do dia + ${money(f.settlements)} quitações + ${money(f.otherInflows)} outras`
                    : `${money(f.received)} do dia + ${money(f.settlements)} quitações`
                }
              />
              <Kpi label="Meu custo" tone="third" value={money(f.ownCost)} formula="O que saiu do meu bolso hoje (terceiros não entram)" explain={`Terceiros: ${money(f.thirdPartyCost)}`} />
              <Kpi label="A recuperar" tone="pending" value={money(rec.total)} formula="Fiados + parceiros + investigação (em aberto)" explain={`${money(rec.identified)} identificados + ${money(rec.investigacao)} investigação`} />
              <Kpi
                label={FINANCE_LABELS.piggyBalance.short}
                tone="info"
                value={day.cofrinhoEnd != null ? money(day.cofrinhoEnd) : "—"}
                formula={FINANCE_LABELS.piggyBalance.formula}
                explain={
                  day.dayClosing?.piggyBank.deposit != null
                    ? `Depósito do dia: ${money(day.dayClosing.piggyBank.deposit)}`
                    : day.cofrinhoEnd != null
                      ? "Informado no fechamento"
                      : "Ainda não informado"
                }
              />
            </div>
          </div>

          <DayReconciliationPanel finance={f} dayClosing={day.dayClosing} cofrinhoEnd={day.cofrinhoEnd} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel
              title="Batimentos"
              subtitle={
                partialOps
                  ? `${passed}/2 OK · ${partialOps} parcial/pendente`
                  : `${passed}/2 operacionais OK`
              }
              className="lg:col-span-2"
            >
              <div className="grid gap-2">{checks.map((c) => <CheckRow key={c.id} c={c} />)}</div>
            </Panel>
            <Panel title="Ritmo da meta" subtitle={`${o.plan.label} · ${ms.closedDays} de ${ms.totalDays} dias de venda`}>
              <div className="num text-2xl font-semibold">{money(ms.bank)} <span className="text-sm text-o-muted-foreground">de {money(o.plan.goal)}</span></div>
              <div className="my-3"><Progress value={ms.pctGoal} tone="ok" /></div>
              <p className="text-xs text-o-muted-foreground">
                {pctFmt(ms.pctGoal, false)} da meta no <strong className="text-o-foreground">banco do mês</strong>{" "}
                (último cofrinho − início do mês). Precisa de{" "}
                <strong className="text-o-foreground">{money(ms.neededPerDay)}/dia</strong> nos {ms.remainingDays} dias
                restantes (alvo {money(o.plan.dailyTarget)}). Não usa lucro por competência nem o caixa de um único dia.
              </p>
              <Link href={`${ZAIVON_BASE}/planejamento`} className={buttonClass("link", "default", "mt-1 h-auto p-0")}>Ver planejamento <ArrowRight className="size-3" /></Link>
            </Panel>
          </div>

          <Panel title="Próximas ações">
            {actions.length ? (
              <ul className="grid gap-2">
                {actions.map((a) => (
                  <li key={a.text}><Link href={a.to} className="flex items-center justify-between rounded-xl bg-o-surface p-3 text-sm hover:bg-o-muted">{a.text}<ArrowRight className="size-4 text-o-muted-foreground" /></Link></li>
                ))}
              </ul>
            ) : <p className="text-sm text-o-muted-foreground">Tudo em dia.</p>}
            {day.closureNote && <p className="mt-3 text-xs text-o-pending">Ressalva: {day.closureNote}</p>}
            {day.observations && (
              <details className="mt-3 text-xs text-o-muted-foreground">
                <summary className="cursor-pointer">Notas do dia</summary>
                <p className="mt-2 whitespace-pre-line">{day.observations}</p>
              </details>
            )}
          </Panel>

          {day.registeredSales?.length ? (
            <Panel
              title="Vendas gravadas no dia"
              subtitle="Cadastro operacional. Caixa e competência vêm do dayClosing — não use o total abaixo como entrada no caixa."
            >
              <RegisteredSalesList sales={day.registeredSales} dayClosing={day.dayClosing} />
            </Panel>
          ) : null}
        </div>
      )}
    </div>
  );
}
