"use client";

import { useState } from "react";
import Link from "next/link";
import { ACCOUNT_KIND_LABEL } from "@/lib/personal-finance/defaults";
import { parseMoney } from "@/lib/personal-finance/money";
import type { AccountKind } from "@/lib/personal-finance/types";
import { useFinance, useFinanceHome } from "@/components/finance/finance-provider";
import { SpendPlanSummary } from "@/components/finance/spend-plan-panel";
import { FinancePulse } from "@/components/finance/pulse";
import { Field, GhostButton, GoldButton, Money, Panel, ShortDate, directionLabel, directionTone, fieldClass } from "@/components/finance/ui";

export function HojeScreen() {
  const snap = useFinanceHome();
  const { openComposer, openDiagnosis, act } = useFinance();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("savings");
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!snap) return null;
  const { view, profile } = snap;
  const first = profile.displayName.split(/\s+/)[0];
  const active = view.challenges.find((challenge) => challenge.status === "active");

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    const parsed = balance.trim() === "" ? 0 : parseMoney(balance, { allowNegative: true });
    if (!name.trim() || parsed == null) {
      setError("Nome e saldo. No cartão, use negativo se estiver devendo.");
      return;
    }
    setError(null);
    try {
      await act("addAccount", { name: name.trim(), kind, balance: parsed });
      setAdding(false);
      setName("");
      setBalance("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui criar a conta.");
    }
  }

  return (
    <div className="space-y-4">
      {profile.context ? null : (
        <Panel>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B7FF3C]">Diagnóstico</p>
          <p className="mt-2 text-lg font-semibold tracking-tight">O mês ainda está sem o seu contexto.</p>
          <p className="mt-2 text-sm leading-relaxed text-[#93A0B1]">
            Renda, compromissos fixos, reserva e cartão entram na previsão. Leva poucos passos e dá para corrigir depois.
          </p>
          <GoldButton type="button" className="mt-4" onClick={openDiagnosis}>
            Fazer o diagnóstico
          </GoldButton>
        </Panel>
      )}

      <FinancePulse view={view} name={first} />

      <SpendPlanSummary />

      {view.firstWeek.active ? (
        <Panel>
          <p className="text-sm font-semibold">Primeiros dias</p>
          <ul className="mt-3 space-y-2">
            {view.firstWeek.items.map((item) => (
              <li key={item.id}>
                <FirstStep item={item} onLaunch={() => openComposer()} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Contas</p>
          <button type="button" className="text-xs font-semibold text-[#B7FF3C]" onClick={() => setAdding((open) => !open)}>
            {adding ? "Fechar" : "Nova conta"}
          </button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {snap.accounts.map((account) => (
            <div key={account.id} className="min-w-[150px] rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-wide text-[#93A0B1]">{ACCOUNT_KIND_LABEL[account.kind]}</p>
              <p className="mt-1 truncate text-sm font-medium">{account.name}</p>
              <p className="mt-2 text-base font-semibold">
                <Money value={account.balance} />
              </p>
            </div>
          ))}
        </div>
        {adding ? (
          <form onSubmit={(event) => void createAccount(event)} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Nome">
              <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Tipo">
              <select className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as AccountKind)}>
                {Object.entries(ACCOUNT_KIND_LABEL).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Saldo" hint={kind === "credit" ? "Se estiver devendo, use negativo. Ex.: -850" : undefined}>
              <input className={fieldClass} inputMode="decimal" value={balance} onChange={(event) => setBalance(event.target.value)} />
            </Field>
            <div className="flex items-end">
              <GoldButton type="submit" className="w-full">
                Adicionar
              </GoldButton>
            </div>
            {error ? <p className="text-sm text-rose-300 sm:col-span-2">{error}</p> : null}
          </form>
        ) : null}
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <p className="text-sm font-semibold">Próximos movimentos</p>
          {view.upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-[#93A0B1]">Nada previsto nas próximas semanas. Recorrências aparecem em Projeções.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {view.upcoming.map((item, index) => (
                <li key={`${item.date}-${item.name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[#93A0B1]">
                    <ShortDate iso={item.date} /> · {item.name}
                  </span>
                  <Money value={item.direction === "in" ? item.amount : -item.amount} tone={directionTone(item.direction)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B7FF3C]">Para onde ir agora</p>
          <p className="mt-2 text-base font-semibold">O pulso resume. As telas explicam.</p>
          <div className="mt-3 grid gap-2 text-sm">
            <Link href="/finance/mes" className="rounded-2xl border border-white/10 px-3 py-2 text-[#C8D0DB] hover:border-[#B7FF3C]/40">
              Mês — o que entrou, o que saiu e o teto de cada categoria.
            </Link>
            <Link href="/finance/projecoes" className="rounded-2xl border border-white/10 px-3 py-2 text-[#C8D0DB] hover:border-[#B7FF3C]/40">
              Projeções — a cota de cada semana e o caixa dos próximos 90 dias.
            </Link>
            <Link href="/finance/metas" className="rounded-2xl border border-white/10 px-3 py-2 text-[#C8D0DB] hover:border-[#B7FF3C]/40">
              Metas — um número, uma data e quanto falta por semana.
            </Link>
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{active ? active.title : "Um desafio deixa o hábito em pé"}</p>
            <p className="mt-1 text-sm text-[#93A0B1]">{active ? active.detail : "Sete dias, 10% ou uma semana sem delivery."}</p>
          </div>
          {active ? (
            <span className="text-xs font-semibold text-[#B7FF3C]">{Math.round(active.ratio * 100)}%</span>
          ) : (
            <Link href="/finance/desafios" className="text-xs font-semibold text-[#B7FF3C]">
              Ver desafios
            </Link>
          )}
        </div>
        {active ? <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#B7FF3C]" style={{ width: `${Math.round(active.ratio * 100)}%` }} /></div> : null}
      </Panel>

      <Panel>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Últimos lançamentos</p>
          <GhostButton type="button" className="px-3 py-2" onClick={() => openComposer()}>
            Lançar
          </GhostButton>
        </div>
        <TxList />
      </Panel>
    </div>
  );
}

function FirstStep({
  item,
  onLaunch,
}: {
  item: { id: string; label: string; done: boolean };
  onLaunch: () => void;
}) {
  const className = `flex w-full items-center gap-2 text-left text-sm ${item.done ? "text-[#93A0B1] line-through" : "hover:text-[#B7FF3C]"}`;
  const mark = <span className={item.done ? "text-emerald-300" : "text-[#6F7B8C]"}>{item.done ? "●" : "○"}</span>;
  if (item.id === "tx") {
    return (
      <button type="button" className={className} onClick={onLaunch}>
        {mark}
        {item.label}
      </button>
    );
  }
  const href = item.id === "goal" ? "/finance/metas" : item.id === "budget" ? "/finance/mes" : "/finance/desafios";
  return (
    <Link href={href} className={className}>
      {mark}
      {item.label}
    </Link>
  );
}

export function TxList({ limit = 8 }: { limit?: number }) {
  const snap = useFinanceHome();
  const { act } = useFinance();
  const [pending, setPending] = useState<string | null>(null);
  if (!snap) return null;
  const rows = [...snap.transactions].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.id.localeCompare(a.id)).slice(0, limit);
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-[#93A0B1]">Nenhum lançamento ainda. O primeiro liga a previsão.</p>;
  }
  return (
    <ul className="mt-3 divide-y divide-white/5">
      {rows.map((tx) => {
        const category = snap.categories.find((item) => item.id === tx.categoryId);
        return (
          <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{tx.description.trim() || category?.name || directionLabel(tx.direction)}</p>
              <p className="text-xs text-[#6F7B8C]">
                <ShortDate iso={tx.occurredOn} /> · {category?.name} · {directionLabel(tx.direction)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Money
                value={tx.direction === "in" ? tx.amount : -tx.amount}
                tone={directionTone(tx.direction)}
              />
              <button
                type="button"
                className="text-[11px] text-[#6F7B8C] hover:text-rose-300"
                onClick={() => {
                  if (pending !== tx.id) {
                    setPending(tx.id);
                    return;
                  }
                  void act("deleteTransaction", { transactionId: tx.id })
                    .catch(() => undefined)
                    .finally(() => setPending(null));
                }}
              >
                {pending === tx.id ? "Confirmar" : "Excluir"}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
