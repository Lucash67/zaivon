"use client";

import { useState } from "react";
import { parseMoney } from "@/lib/personal-finance/money";
import { useFinance, useFinanceHome } from "@/components/finance/finance-provider";
import { TxList } from "@/components/finance/screens/hoje";
import { Field, GoldButton, Money, Panel, fieldClass } from "@/components/finance/ui";

export function MesScreen() {
  const snap = useFinanceHome();
  if (!snap) return null;
  const { view, profile } = snap;
  const expenses = view.month.byCategory.filter((row) => row.kind === "expense");
  const income = view.month.byCategory.filter((row) => row.kind === "income" && row.amount > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A8A29E]">Entrou</p>
          <p className="mt-2 text-2xl font-semibold">
            <Money value={view.month.income} tone="in" />
          </p>
        </Panel>
        <Panel>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A8A29E]">Saiu</p>
          <p className="mt-2 text-2xl font-semibold">
            <Money value={view.month.expense} tone="out" />
          </p>
        </Panel>
        <Panel>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A8A29E]">Guardei</p>
          <p className="mt-2 text-2xl font-semibold">
            <Money value={view.month.saved} tone="save" />
          </p>
        </Panel>
      </div>

      <ProfileCard
        displayName={profile.displayName}
        monthlyIncome={profile.monthlyIncome}
        payday={profile.payday}
      />

      <Panel>
        <p className="text-sm font-semibold">{view.monthLabel}</p>
        <p className="mt-1 text-sm text-[#A8A29E]">
          Dia {view.month.dayOfMonth} de {view.month.daysInMonth}. Nesse ritmo, o mês vai a{" "}
          <Money value={view.month.paceExpense} tone="neutral" /> de gastos
          {view.month.referenceIncome > 0 ? (
            <>
              {" "}
              contra <Money value={view.month.referenceIncome} tone="neutral" /> de renda.
            </>
          ) : (
            "."
          )}
        </p>
        <ul className="mt-4 space-y-4">
          {expenses.map((row) => (
            <li key={row.categoryId}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  {row.name}
                  <span className="ml-2 text-xs text-[#78716C]">{row.group}</span>
                </span>
                <Money value={row.amount} tone="out" />
              </div>
              {row.budget != null && row.budget > 0 ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <span
                    className={row.amount > row.budget ? "block h-full bg-rose-400" : "block h-full bg-[#E8B86D]"}
                    style={{ width: `${Math.min(100, Math.round((row.amount / row.budget) * 100))}%` }}
                  />
                </div>
              ) : null}
              <BudgetField categoryId={row.categoryId} yearMonth={view.yearMonth} limit={row.budget} />
            </li>
          ))}
        </ul>
        {income.length > 0 ? (
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#A8A29E]">Renda lançada</p>
            <ul className="mt-2 space-y-1 text-sm">
              {income.map((row) => (
                <li key={row.categoryId} className="flex justify-between">
                  <span>{row.name}</span>
                  <Money value={row.amount} tone="in" />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>

      <Panel>
        <p className="text-sm font-semibold">Lançamentos do período</p>
        <TxList limit={20} />
      </Panel>
    </div>
  );
}

function ProfileCard({
  displayName,
  monthlyIncome,
  payday,
}: {
  displayName: string;
  monthlyIncome: number;
  payday: number;
}) {
  const { act } = useFinance();
  const [name, setName] = useState(displayName);
  const [income, setIncome] = useState(monthlyIncome ? String(monthlyIncome).replace(".", ",") : "");
  const [day, setDay] = useState(String(payday));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = income.trim() === "" ? 0 : parseMoney(income);
    const paydayNumber = Number(day);
    if (!name.trim() || parsed == null || paydayNumber < 1 || paydayNumber > 28) {
      setError("Nome, renda e um dia entre 1 e 28.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await act("updateProfile", { displayName: name.trim(), monthlyIncome: parsed, payday: paydayNumber });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui atualizar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel>
      <p className="text-sm font-semibold">Renda prevista</p>
      <p className="mt-1 text-sm text-[#A8A29E]">A previsão e o desafio de 10% usam este número. O salário recorrente acompanha.</p>
      <form onSubmit={(event) => void save(event)} className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Nome">
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Renda mensal">
          <input className={fieldClass} inputMode="decimal" value={income} onChange={(event) => setIncome(event.target.value)} />
        </Field>
        <Field label="Dia do pagamento">
          <input className={fieldClass} inputMode="numeric" value={day} onChange={(event) => setDay(event.target.value)} />
        </Field>
        <GoldButton type="submit" disabled={saving} className="sm:col-span-3">
          {saving ? "Salvando…" : "Atualizar renda"}
        </GoldButton>
        {error ? <p className="text-sm text-rose-300 sm:col-span-3">{error}</p> : null}
      </form>
    </Panel>
  );
}

function BudgetField({
  categoryId,
  yearMonth,
  limit,
}: {
  categoryId: string;
  yearMonth: string;
  limit: number | null;
}) {
  const { act } = useFinance();
  const [value, setValue] = useState(limit && limit > 0 ? String(limit).replace(".", ",") : "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const parsed = value.trim() === "" ? 0 : parseMoney(value);
    if (parsed == null) {
      setError("Valor inválido.");
      return;
    }
    if ((limit ?? 0) === parsed) return;
    setError(null);
    try {
      await act("setBudget", { categoryId, yearMonth, limit: parsed });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui salvar o teto.");
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-[#78716C]">Teto</span>
      <input
        className="w-28 rounded-xl border border-white/10 bg-transparent px-2 py-1 text-xs outline-none focus:border-[#E8B86D]/70"
        inputMode="decimal"
        placeholder="sem teto"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void save()}
      />
      {error ? <span className="text-[11px] text-rose-300">{error}</span> : null}
    </div>
  );
}
