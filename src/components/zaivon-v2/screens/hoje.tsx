"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useZaivon } from "@/components/zaivon-v2/store";
import { dayChecks, dayFinance, daysOpen, recovery } from "@/lib/zaivon/finance/day";
import { monthSummary } from "@/lib/zaivon/finance/month";
import { dayLabel, ddmm, pctFmt } from "@/lib/zaivon/format";
import { CheckRow, Kpi, PageHeader, Panel, Pill, Progress, RegisteredSalesList } from "@/components/zaivon-v2/ui";
import { buttonClass } from "@/components/zaivon-v2/primitives";
import { ZAIVON_BASE } from "@/components/zaivon-v2/app-shell";
import { HideMoneyScope, ScreenHideMoneyButton, useScreenHideMoney } from "@/components/zaivon-v2/hide-money";

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
  const passed = checks.filter((c) => c.id !== "cofrinho" && c.ok).length;
  const [cl, tone] = closureLabel[day.closure];

  const oldest = [...o.debts].filter((d) => d.status === "open" && d.type !== "investigacao").sort((a, b) => a.originDate.localeCompare(b.originDate))[0];
  const inv = o.debts.filter((d) => d.status === "open" && d.type === "investigacao");
  const closing = `${ZAIVON_BASE}/registrar?tab=fechamento`;
  const pendings = `${ZAIVON_BASE}/pendencias`;
  const cofCheck = checks.find((c) => c.id === "cofrinho");
  const actions: { text: string; to: string }[] = [];
  if (day.closure !== "closed" && day.closure !== "summary") actions.push({ text: "Fechar o dia (fechamento assistido)", to: closing });
  if (cofCheck?.ok === false) actions.push({ text: `Informar o saldo do cofrinho de ${ddmm(day.date)} — o lucro mudou e o cofrinho ainda não foi atualizado`, to: closing });
  else if (cofCheck?.ok == null) actions.push({ text: `Informar o saldo do cofrinho de ${ddmm(day.date)}`, to: closing });
  const otherFailed = failed.filter((c) => c.id !== "cofrinho");
  if (otherFailed.length) actions.push({ text: `Revisar: ${otherFailed.map((c) => c.label.toLowerCase()).join(", ")}`, to: closing });
  if (oldest) actions.push({ text: `Cobrar ${oldest.person} — ${money(oldest.amount - oldest.paid)} desde ${ddmm(oldest.originDate)} (${daysOpen(oldest.originDate, o.selectedDate)} dias)`, to: pendings });
  if (inv.length) actions.push({ text: `Decidir ${inv.length} itens não identificados (${money(rec.investigacao)})`, to: pendings });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Hoje · ${dayLabel(day.date)}`}
        question="Como está o dia?"
        right={
          <div className="flex items-center gap-2">
            <ScreenHideMoneyButton />
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
            <Kpi big tone="ok" label="Lucro do dia" value={money(f.profit)}
              formula="Lucro = entrada total no caixa + bonificação − meu custo. Fiado, parceiro e rendimento ficam fora."
              explain={`${money(f.cashIn)} de entrada${f.bonus ? ` + ${money(f.bonus)} de bônus` : ""} − ${money(f.ownCost)} de custo próprio`} />
            <div className="grid grid-cols-2 gap-4">
              <Kpi label="Entrada no caixa" value={money(f.cashIn)} formula="Recebido do dia + quitações que entraram hoje" explain={`${money(f.received)} do dia + ${money(f.settlements)} quitações`} />
              <Kpi label="Meu custo" tone="third" value={money(f.ownCost)} formula="O que saiu do meu bolso hoje (terceiros não entram)" explain={`Terceiros: ${money(f.thirdPartyCost)}`} />
              <Kpi label="A recuperar" tone="pending" value={money(rec.total)} formula="Fiados + parceiros + investigação (em aberto)" explain={`${money(rec.identified)} identificados + ${money(rec.investigacao)} investigação`} />
              <Kpi label="Cofrinho" tone="info" value={day.cofrinhoEnd != null ? money(day.cofrinhoEnd) : "—"} formula="Saldo real do cofrinho no Mercado Pago no fim do dia (inclui rendimentos)" explain={day.cofrinhoEnd != null ? "Informado no fechamento" : "Ainda não informado"} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="Batimentos" subtitle={`${passed}/2 operacionais OK`} className="lg:col-span-2">
              <div className="grid gap-2">{checks.map((c) => <CheckRow key={c.id} c={c} />)}</div>
            </Panel>
            <Panel title="Ritmo da meta" subtitle={`${o.plan.label} · ${ms.closedDays} de ${ms.totalDays} dias de venda`}>
              <div className="num text-2xl font-semibold">{money(ms.bank)} <span className="text-sm text-o-muted-foreground">de {money(o.plan.goal)}</span></div>
              <div className="my-3"><Progress value={ms.pctGoal} tone="ok" /></div>
              <p className="text-xs text-o-muted-foreground">{pctFmt(ms.pctGoal, false)} da meta no banco. Precisa de <strong className="text-o-foreground">{money(ms.neededPerDay)}/dia</strong> nos {ms.remainingDays} dias restantes (alvo {money(o.plan.dailyTarget)}).</p>
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
            <Panel title="Vendas gravadas no dia" subtitle="Detalhe do sistema. O lucro do dia vem do diário (resumo do dia).">
              <RegisteredSalesList sales={day.registeredSales} />
            </Panel>
          ) : null}
        </div>
      )}
    </div>
  );
}
