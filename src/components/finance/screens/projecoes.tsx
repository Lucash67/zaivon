"use client";

import { useState } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatShort } from "@/lib/personal-finance/dates";
import { parseMoney } from "@/lib/personal-finance/money";
import type { Cadence, Direction } from "@/lib/personal-finance/types";
import { formatCurrency } from "@/lib/utils";
import { useFinance, useFinanceHome } from "@/components/finance/finance-provider";
import { SpendPlanPanel } from "@/components/finance/spend-plan-panel";
import { Field, GoldButton, Money, Panel, ShortDate, directionLabel, fieldClass } from "@/components/finance/ui";

export function ProjecoesScreen() {
  const snap = useFinanceHome();
  const { act } = useFinance();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<Direction>("out");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState(String(snap && !snap.needsOnboarding ? snap.profile.payday : 5));
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!snap) return null;
  const { view } = snap;
  const kind = direction === "in" ? "income" : direction === "save" ? "reserve" : "expense";
  const categories = snap.categories.filter((category) => category.kind === kind);
  const chosenCategory = categories.some((category) => category.id === categoryId) ? categoryId : (categories[0]?.id ?? "");
  const chosenAccount = snap.accounts.some((account) => account.id === accountId) ? accountId : (snap.accounts[0]?.id ?? "");

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseMoney(amount);
    const day = Number(dayOfMonth);
    if (!name.trim() || parsed == null || parsed <= 0) {
      setError("Nome e valor da recorrência.");
      return;
    }
    if (cadence === "monthly" && (day < 1 || day > 28)) {
      setError("O dia mensal fica entre 1 e 28.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await act("addRecurring", {
        name: name.trim(),
        amount: parsed,
        direction,
        accountId: chosenAccount,
        categoryId: chosenCategory,
        cadence,
        dayOfMonth: cadence === "weekly" ? 1 : day,
      });
      setName("");
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui criar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SpendPlanPanel />
      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#93A0B1]">Daqui a 90 dias</p>
            <p className="mt-1 text-2xl font-semibold">
              <Money value={view.projection[view.projection.length - 1]?.balance ?? view.available} />
            </p>
          </div>
          <div className="text-right text-sm text-[#93A0B1]">
            <p>
              Ponto mais baixo: <Money value={view.lowest.balance} /> em <ShortDate iso={view.lowest.date} />
            </p>
            {view.firstNegative ? (
              <p className="mt-1 text-rose-300">
                Fica negativo em <ShortDate iso={view.firstNegative.date} />
              </p>
            ) : (
              <p className="mt-1 text-emerald-300">Não cruza zero nesse horizonte.</p>
            )}
          </div>
        </div>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={view.projection}>
              <defs>
                <linearGradient id="financeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B7FF3C" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#B7FF3C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => formatShort(value)}
                interval={14}
                tick={{ fill: "#93A0B1", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                labelFormatter={(label) => formatShort(String(label))}
                contentStyle={{ background: "#10141B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
              />
              {view.firstNegative ? <ReferenceLine y={0} stroke="#FB7185" strokeDasharray="4 4" /> : null}
              <Area type="monotone" dataKey="balance" stroke="#B7FF3C" fill="url(#financeFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#6F7B8C]">
          Parte do disponível de hoje. Soma recorrências e lançamentos futuros. O que já aconteceu está no saldo, não de novo na curva.
          Quando você lança o salário ou o aluguel de verdade, a recorrência correspondente avança.
        </p>
      </Panel>

      <Panel>
        <p className="text-sm font-semibold">Recorrências</p>
        {snap.recurring.length === 0 ? (
          <p className="mt-2 text-sm text-[#93A0B1]">Nada fixo ainda. Salário, aluguel, assinatura — o que se repete mora aqui.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {snap.recurring.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-xs text-[#6F7B8C]">
                    {directionLabel(rule.direction)} · {rule.cadence === "weekly" ? "toda semana" : `dia ${rule.dayOfMonth}`} · próxima{" "}
                    <ShortDate iso={rule.nextOn} />
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Money value={rule.amount} tone={rule.direction === "in" ? "in" : rule.direction === "save" ? "save" : "out"} />
                  <button
                    type="button"
                    className="text-[11px] text-[#6F7B8C] hover:text-rose-300"
                    onClick={() => void act("deactivateRecurring", { recurringId: rule.id })}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={(event) => void add(event)} className="mt-5 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
          <Field label="Nome">
            <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Aluguel" />
          </Field>
          <Field label="Valor">
            <input className={fieldClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
          <Field label="Tipo">
            <select className={fieldClass} value={direction} onChange={(event) => setDirection(event.target.value as Direction)}>
              <option value="out">Sai</option>
              <option value="in">Entra</option>
              <option value="save">Guardo</option>
            </select>
          </Field>
          <Field label="Categoria">
            <select className={fieldClass} value={chosenCategory} onChange={(event) => setCategoryId(event.target.value)}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Conta">
            <select className={fieldClass} value={chosenAccount} onChange={(event) => setAccountId(event.target.value)}>
              {snap.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quando">
            <select className={fieldClass} value={cadence} onChange={(event) => setCadence(event.target.value as Cadence)}>
              <option value="monthly">Todo mês</option>
              <option value="weekly">Toda semana</option>
            </select>
          </Field>
          {cadence === "monthly" ? (
            <Field label="Dia do mês">
              <input className={fieldClass} inputMode="numeric" value={dayOfMonth} onChange={(event) => setDayOfMonth(event.target.value)} />
            </Field>
          ) : null}
          <div className="flex items-end">
            <GoldButton type="submit" disabled={saving} className="w-full">
              {saving ? "Salvando…" : "Adicionar recorrência"}
            </GoldButton>
          </div>
          {error ? <p className="text-sm text-rose-300 sm:col-span-2">{error}</p> : null}
        </form>
      </Panel>
    </div>
  );
}
