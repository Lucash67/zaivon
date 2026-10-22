"use client";

import { useState } from "react";
import Link from "next/link";
import { maskMoneyInText, useMoneyHidden } from "@/hooks/use-hide-money";
import { parseMoney } from "@/lib/personal-finance/money";
import type { SpendVerdict, SpendWeek } from "@/lib/personal-finance/spend-plan";
import { useFinance, useFinanceHome } from "@/components/finance/finance-provider";
import { Field, GoldButton, Money, Panel, fieldClass } from "@/components/finance/ui";

const VERDICT: Record<SpendVerdict, string> = {
  unset: "Defina o gasto do mês",
  hit: "Bate",
  over: "Passa",
  under: "Fica abaixo",
  "already-over": "Já passou",
};

function asInput(value: number | null): string {
  if (value == null) return "";
  return value.toFixed(2).replace(".", ",");
}

export function SpendPlanPanel() {
  const snap = useFinanceHome();
  const { act } = useFinance();
  const moneyHidden = useMoneyHidden("finance");
  const plan = snap?.view.spendPlan;
  const [target, setTarget] = useState(plan?.target ? asInput(plan.target) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!snap || !plan) return null;
  const yearMonth = snap.view.yearMonth;

  async function saveTarget(event: React.FormEvent) {
    event.preventDefault();
    const parsed = target.trim() === "" ? 0 : parseMoney(target);
    if (parsed == null) {
      setError("Use um valor como 2000 ou 2.000,00.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await act("setMonthSpendTarget", { yearMonth, target: parsed });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui salvar o gasto do mês.");
    } finally {
      setSaving(false);
    }
  }

  const tone = plan.verdict === "hit" ? "text-emerald-300" : plan.verdict === "under" ? "text-sky-300" : plan.verdict === "unset" ? "text-[#93A0B1]" : "text-rose-300";

  return (
    <Panel>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B7FF3C]">Projeção de gasto</p>
      <p className="mt-1 text-sm text-[#93A0B1]">
        Um valor fixo para o mês e o que sai na semana. O resto vira quanto ainda dá para gastar, e se o mês bate.
      </p>

      <form onSubmit={(event) => void saveTarget(event)} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Quanto você precisa gastar no mês">
          <input
            className={fieldClass}
            inputMode="decimal"
            placeholder="2.000,00"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </Field>
        <GoldButton type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Definir"}
        </GoldButton>
      </form>
      {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}

      {plan.target != null ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#93A0B1]">Pode gastar nas próximas</p>
            <p className="mt-2 text-xl font-semibold">
              {plan.perNextWeek == null ? "—" : <Money value={plan.perNextWeek} tone="neutral" />}
            </p>
            <p className="mt-1 text-xs text-[#6F7B8C]">
              {plan.nextWeekCount === 0
                ? "Não há outra semana neste mês."
                : plan.nextWeekCount === 1
                  ? "Na semana que vem, para bater o mês."
                  : `Em cada uma das ${plan.nextWeekCount} semanas, para bater o mês.`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#93A0B1]">Valor final se seguir</p>
            <p className="mt-2 text-xl font-semibold">
              <Money value={plan.finalIfFollow ?? plan.target} tone="neutral" />
            </p>
            <p className="mt-1 text-xs text-[#6F7B8C]">Exato, se as próximas respeitarem a cota.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#93A0B1]">Se repetir esta semana</p>
            <p className="mt-2 text-xl font-semibold">
              <Money value={plan.paceFinal ?? 0} tone="neutral" />
            </p>
            <p className={`mt-1 text-xs font-semibold ${tone}`}>{VERDICT[plan.verdict]}</p>
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed text-[#C8D0DB]">{maskMoneyInText(plan.note, moneyHidden)}</p>

      <ul className="mt-4 space-y-3">
        {plan.weeks.map((week) => (
          <WeekRow key={week.weekStart} week={week} />
        ))}
      </ul>
    </Panel>
  );
}

function WeekRow({ week }: { week: SpendWeek }) {
  const { act } = useFinance();
  const moneyHidden = useMoneyHidden("finance");
  const [value, setValue] = useState(asInput(week.declared));
  const [error, setError] = useState<string | null>(null);
  const status = week.status === "current" ? "Esta semana" : week.status === "past" ? "Já foi" : "Próxima";

  async function save() {
    const trimmed = value.trim();
    if (trimmed === "" && week.declared == null) return;
    if (trimmed === "") {
      setError(null);
      try {
        await act("setWeekSpend", { weekStart: week.weekStart, amount: null });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não consegui limpar a semana.");
      }
      return;
    }
    const parsed = parseMoney(trimmed);
    if (parsed == null) {
      setError("Valor inválido.");
      return;
    }
    if (week.declared != null && parsed === week.declared) return;
    setError(null);
    try {
      await act("setWeekSpend", { weekStart: week.weekStart, amount: parsed });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui salvar a semana.");
    }
  }

  return (
    <li className="grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-[140px_1fr_160px] sm:items-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#93A0B1]">{status}</p>
        <p className="text-sm tabular-nums">{week.label}</p>
      </div>
      {week.status === "next" && week.declared == null ? (
        week.allowance == null ? (
          <p className="text-sm text-[#6F7B8C]">A cota aparece depois que o mês tiver um valor.</p>
        ) : (
          <p className="text-sm">
            Pode gastar <Money value={week.allowance} tone="neutral" />
          </p>
        )
      ) : (
        <p className="text-xs text-[#6F7B8C]">
          Lançamentos nesta semana: <Money value={week.fromTransactions} tone="neutral" className="text-xs" />
          {week.declared == null ? ". Em branco, a conta usa esse valor." : ". Este valor substitui os lançamentos."}
        </p>
      )}
      <div>
        <input
          className={fieldClass}
          inputMode="decimal"
          placeholder={moneyHidden ? "••••" : week.status === "next" ? "fixar" : asInput(week.fromTransactions)}
          value={moneyHidden ? "" : value}
          readOnly={moneyHidden}
          aria-label={`Gasto da semana ${week.label}`}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            if (!moneyHidden) void save();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
        />
        {error ? <p className="mt-1 text-[11px] text-rose-300">{error}</p> : null}
      </div>
    </li>
  );
}

export function SpendPlanSummary() {
  const snap = useFinanceHome();
  const moneyHidden = useMoneyHidden("finance");
  const plan = snap?.view.spendPlan;
  if (!plan) return null;

  if (plan.target == null) {
    return (
      <Panel>
        <p className="text-sm font-semibold">Projeção de gasto</p>
        <p className="mt-1 text-sm text-[#93A0B1]">
          Defina quanto precisa gastar no mês e o que sai na semana. As próximas semanas ganham um valor exato.
        </p>
        <Link href="/finance/projecoes" className="mt-3 inline-flex text-sm font-semibold text-[#B7FF3C]">
          Montar a projeção
        </Link>
      </Panel>
    );
  }

  const tone = plan.verdict === "hit" ? "text-emerald-300" : plan.verdict === "under" ? "text-sky-300" : "text-rose-300";

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B7FF3C]">Projeção de gasto</p>
          <p className={`mt-1 text-sm font-semibold ${tone}`}>{VERDICT[plan.verdict]}</p>
        </div>
        <Link href="/finance/projecoes" className="text-xs font-semibold text-[#B7FF3C]">
          Ajustar
        </Link>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#93A0B1]">Próximas semanas</p>
          <p className="mt-1 text-lg font-semibold">
            {plan.perNextWeek == null ? "—" : <Money value={plan.perNextWeek} />}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#93A0B1]">Valor final</p>
          <p className="mt-1 text-lg font-semibold">
            <Money value={plan.finalIfFollow ?? plan.spent} />
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#93A0B1]">Se repetir a semana</p>
          <p className="mt-1 text-lg font-semibold">
            <Money value={plan.paceFinal ?? 0} />
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[#C8D0DB]">{maskMoneyInText(plan.note, moneyHidden)}</p>
    </Panel>
  );
}
