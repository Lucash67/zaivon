"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { parseMoney } from "@/lib/personal-finance/money";
import type { Direction } from "@/lib/personal-finance/types";
import { useFinance, useFinanceHome } from "@/components/finance/finance-provider";
import { Field, GoldButton, fieldClass } from "@/components/finance/ui";

const DIRECTIONS: { id: Direction; label: string }[] = [
  { id: "out", label: "Saiu" },
  { id: "in", label: "Entrou" },
  { id: "save", label: "Guardei" },
];

function kindFor(direction: Direction) {
  if (direction === "in") return "income";
  if (direction === "save") return "reserve";
  return "expense";
}

export function FinanceComposer() {
  const snap = useFinanceHome();
  const { composer, closeComposer, act } = useFinance();
  const [direction, setDirection] = useState<Direction>(composer?.direction ?? "out");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState(snap?.accounts[0]?.id ?? "");
  const [occurredOn, setOccurredOn] = useState(snap?.view.today ?? "");
  const [description, setDescription] = useState("");
  const [goalId, setGoalId] = useState(composer?.goalId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categories = useMemo(
    () => snap?.categories.filter((category) => category.kind === kindFor(direction)) ?? [],
    [snap, direction],
  );
  const selectedCategory = categories.some((category) => category.id === categoryId)
    ? categoryId
    : (categories[0]?.id ?? "");

  if (!composer || !snap) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseMoney(amount);
    if (parsed == null || parsed <= 0) {
      setError("Informa o valor. Ex.: 42,90");
      return;
    }
    if (!selectedCategory || !accountId) {
      setError("Escolhe conta e categoria.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await act("addTransaction", {
        accountId,
        categoryId: selectedCategory,
        direction,
        amount: parsed,
        occurredOn,
        description,
        goalId: direction === "save" && goalId ? goalId : null,
      });
      closeComposer();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui lançar.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/70" aria-label="Fechar" onClick={closeComposer} />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-composer-title"
        onSubmit={(event) => void submit(event)}
        className="relative z-10 w-full max-w-md rounded-t-3xl border border-white/10 bg-[#120F0C] p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="finance-composer-title" className="text-lg font-semibold">
            Novo lançamento
          </h2>
          <button type="button" onClick={closeComposer} className="rounded-full p-2 text-[#93A0B1] hover:text-white" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-black/40 p-1">
          {DIRECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDirection(item.id)}
              className={
                direction === item.id
                  ? "rounded-xl bg-[#B7FF3C] py-2 text-sm font-semibold text-[#07110A]"
                  : "rounded-xl py-2 text-sm text-[#93A0B1]"
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="sr-only">Valor</span>
          <input
            autoFocus
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full bg-transparent text-center text-4xl font-semibold tabular-nums outline-none placeholder:text-[#44403C]"
          />
        </label>

        <div className="mt-4 space-y-3">
          <Field label="Categoria">
            <select
              className={fieldClass}
              value={selectedCategory}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Conta">
            <select className={fieldClass} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              {snap.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input type="date" className={fieldClass} value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} />
            </Field>
            <Field label="Descrição">
              <input
                className={fieldClass}
                placeholder="Opcional"
                value={description}
                maxLength={140}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>
          {direction === "save" && snap.goals.length > 0 ? (
            <Field label="Abater nesta meta" hint="Opcional. O valor entra na meta e sai da conta.">
              <select className={fieldClass} value={goalId} onChange={(event) => setGoalId(event.target.value)}>
                <option value="">Só na reserva</option>
                {snap.goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        <GoldButton type="submit" className="mt-4 w-full" disabled={saving}>
          {saving ? "Lançando…" : "Lançar"}
        </GoldButton>
      </form>
    </div>
  );
}
