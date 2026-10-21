"use client";

import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { useSessionUser } from "@/hooks/use-session-user";
import {
  DIAGNOSIS_INTENTS,
  FIXED_COMMITMENTS,
  INCOME_SOURCES,
  buildDiagnosisPlan,
  diagnosisInputFromDraft,
  emptyFixed,
  validateDiagnosisStep,
  type DiagnosisDraft,
  type DiagnosisIntent,
  type DiagnosisPlan,
  type FixedKey,
  type IncomeSource,
} from "@/lib/personal-finance/diagnosis";
import { Field, GoldButton, fieldClass } from "@/components/finance/ui";
import { useFinance } from "@/components/finance/finance-provider";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Nome", title: "Como posso te chamar?", why: "O Finance usa esse nome na conversa do dia." },
  { label: "Prioridade", title: "O que você quer resolver agora?", why: "A prioridade escolhe o que o diagnóstico monta primeiro." },
  { label: "Entrada", title: "Como o dinheiro entra?", why: "A resposta vira a previsão de entrada do mês." },
  {
    label: "Compromissos",
    title: "O que já está comprometido?",
    why: "Cada valor vira uma recorrência. A soma vira o gasto fixo do mês.",
  },
  { label: "Caixa", title: "Onde está o dinheiro hoje?", why: "Conta, reserva e cartão entram separados." },
  { label: "Leitura", title: "O que o Finance absorveu", why: "Confere a leitura. Em seguida o mês nasce com esse contexto." },
] as const;

function blankDraft(seed?: Partial<DiagnosisDraft>): DiagnosisDraft {
  return {
    displayName: "",
    intent: null,
    incomeSource: null,
    income: "",
    payday: "5",
    fixed: emptyFixed(),
    accountName: "Conta principal",
    openingBalance: "",
    trackSavings: false,
    savingsBalance: "",
    trackCard: false,
    cardDebt: "",
    trackReserve: false,
    reserveTarget: "",
    ...seed,
  };
}

function moneySeed(value: number): string {
  if (!value) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FinanceOnboarding({ mode }: { mode: "create" | "apply" }) {
  const { data: user } = useSessionUser();
  const { snapshot, act, closeDiagnosis } = useFinance();
  const suggested = user?.name?.split(/\s+/)[0] ?? "";
  const existing = snapshot && !snapshot.needsOnboarding ? snapshot : null;
  const checking = existing?.accounts.find((account) => account.kind === "checking") ?? null;
  const keepCheckingBalance = Boolean(
    checking && existing?.transactions.some((tx) => tx.accountId === checking.id),
  );
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<DiagnosisDraft>(() =>
    blankDraft(
      existing
        ? {
            displayName: existing.profile.displayName,
            income: moneySeed(existing.profile.monthlyIncome),
            payday: String(existing.profile.payday || 5),
            accountName: checking?.name || "Conta principal",
            openingBalance: moneySeed(checking?.balance ?? 0),
          }
        : { displayName: suggested },
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stage = STEPS[step];
  const why =
    step === 3 && draft.intent === "breathe"
      ? "A soma vira o quanto você precisa gastar no mês. As próximas semanas nascem desse número."
      : stage.why;

  const plan = useMemo(() => {
    if (step !== 5) return null;
    try {
      return buildDiagnosisPlan(diagnosisInputFromDraft(draft), { keepCheckingBalance });
    } catch {
      return null;
    }
  }, [draft, keepCheckingBalance, step]);

  function patch(partial: Partial<DiagnosisDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
    setError(null);
  }

  function patchFixed(key: FixedKey, value: string) {
    setDraft((current) => ({ ...current, fixed: { ...current.fixed, [key]: value } }));
    setError(null);
  }

  function chooseIntent(intent: DiagnosisIntent) {
    patch({
      intent,
      trackCard: intent === "debt" ? true : draft.trackCard,
      trackSavings: intent === "reserve" ? true : draft.trackSavings,
      trackReserve: intent === "reserve" ? true : draft.trackReserve,
    });
  }

  function goNext() {
    const message = validateDiagnosisStep(step, draft);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    if (step === 0) {
      if (mode === "apply") closeDiagnosis();
      return;
    }
    setStep((current) => current - 1);
  }

  async function finish() {
    let ready: DiagnosisPlan;
    try {
      ready = buildDiagnosisPlan(diagnosisInputFromDraft(draft), { keepCheckingBalance });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confere as respostas.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await act(mode === "create" ? "onboard" : "applyDiagnosis", {
        displayName: draft.displayName.trim(),
        intent: ready.context.intent,
        incomeSource: ready.context.incomeSource,
        monthlyIncome: ready.monthlyIncome,
        payday: ready.payday,
        fixed: ready.recurring
          .filter((rule) => rule.direction === "out")
          .map((rule) => ({ category: rule.category, amount: rule.amount })),
        accountName: ready.accounts[0]?.name ?? "Conta principal",
        openingBalance: ready.accounts.find((account) => account.kind === "checking")?.balance ?? 0,
        savingsBalance: ready.context.savingsBalance,
        cardDebt: ready.context.cardDebt,
        reserveTarget: ready.context.reserveTarget,
      });
      if (mode === "apply") closeDiagnosis();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui absorver o diagnóstico.");
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-[#0A0D12] text-[#F7F9FC]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(183,255,60,0.16),_transparent_55%)]"
        aria-hidden
      />
      <main className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#B7FF3C] text-[#07110A]">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#B7FF3C]">ZAIVON Finance</p>
            <p className="text-sm text-[#93A0B1]">Diagnóstico do mês. Cada resposta entra na previsão.</p>
          </div>
        </div>

        <div className="mb-2 flex gap-1.5" aria-hidden>
          {STEPS.map((item, index) => (
            <span
              key={item.label}
              className={index <= step ? "h-1 flex-1 rounded-full bg-[#B7FF3C]" : "h-1 flex-1 rounded-full bg-white/10"}
            />
          ))}
        </div>
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.16em] text-[#93A0B1]">
          {step + 1} de {STEPS.length} · {stage.label}
        </p>

        <h1 className="text-3xl font-semibold tracking-tight">{stage.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#93A0B1]">{why}</p>

        <div className="mt-6 space-y-5">
          {step === 0 ? (
            <Field label="Seu nome">
              <input
                className={fieldClass}
                value={draft.displayName}
                placeholder={suggested || "Lucas"}
                onChange={(event) => patch({ displayName: event.target.value })}
                autoFocus
              />
            </Field>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-2">
              {DIAGNOSIS_INTENTS.map((item) => (
                <Choice
                  key={item.id}
                  title={item.title}
                  body={item.body}
                  selected={draft.intent === item.id}
                  onClick={() => chooseIntent(item.id)}
                />
              ))}
            </div>
          ) : null}

          {step === 2 ? (
            <>
              <div className="grid gap-2">
                {INCOME_SOURCES.map((item) => (
                  <Choice
                    key={item.id}
                    title={item.title}
                    body={item.body}
                    selected={draft.incomeSource === item.id}
                    onClick={() => patch({ incomeSource: item.id as IncomeSource })}
                  />
                ))}
              </div>
              {draft.incomeSource && draft.incomeSource !== "none" ? (
                <>
                  <Field
                    label={draft.incomeSource === "variable" ? "Quanto entra num mês típico" : "Renda do mês"}
                    hint="Uma média já serve. Dá para corrigir depois."
                  >
                    <input
                      className={fieldClass}
                      inputMode="decimal"
                      placeholder="0,00"
                      value={draft.income}
                      onChange={(event) => patch({ income: event.target.value })}
                    />
                  </Field>
                  <Field
                    label={draft.incomeSource === "salary" ? "Dia em que costuma cair" : "Dia de referência do mês"}
                    hint="De 1 a 28. Os compromissos também nascem nessa data."
                  >
                    <input
                      className={fieldClass}
                      inputMode="numeric"
                      value={draft.payday}
                      onChange={(event) => patch({ payday: event.target.value })}
                    />
                  </Field>
                </>
              ) : null}
            </>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              {FIXED_COMMITMENTS.map((slot) => (
                <Field key={slot.key} label={slot.label} hint={slot.hint}>
                  <input
                    className={fieldClass}
                    inputMode="decimal"
                    placeholder="Em branco se não tiver"
                    value={draft.fixed[slot.key]}
                    onChange={(event) => patchFixed(slot.key, event.target.value)}
                  />
                </Field>
              ))}
            </div>
          ) : null}

          {step === 4 ? (
            <>
              <Field label="Nome da conta principal">
                <input
                  className={fieldClass}
                  value={draft.accountName}
                  onChange={(event) => patch({ accountName: event.target.value })}
                />
              </Field>
              <Field
                label="Saldo agora"
                hint={
                  keepCheckingBalance
                    ? "Esta conta já tem lançamentos. O saldo fica como está."
                    : "Pode ficar em branco se ainda estiver zerada."
                }
              >
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  placeholder="0,00"
                  value={draft.openingBalance}
                  onChange={(event) => patch({ openingBalance: event.target.value })}
                  disabled={keepCheckingBalance}
                />
              </Field>
              <Toggle
                checked={draft.trackSavings}
                title="Tenho dinheiro separado numa reserva"
                onClick={() => patch({ trackSavings: !draft.trackSavings })}
              />
              {draft.trackSavings ? (
                <Field label="Quanto já está separado">
                  <input
                    className={fieldClass}
                    inputMode="decimal"
                    placeholder="0,00"
                    value={draft.savingsBalance}
                    onChange={(event) => patch({ savingsBalance: event.target.value })}
                  />
                </Field>
              ) : null}
              <Toggle
                checked={draft.trackCard}
                title="Tenho fatura ou dívida no cartão"
                onClick={() => patch({ trackCard: !draft.trackCard })}
              />
              {draft.trackCard ? (
                <Field label="Quanto está devendo" hint="Entra numa conta de cartão, fora do saldo disponível.">
                  <input
                    className={fieldClass}
                    inputMode="decimal"
                    placeholder="0,00"
                    value={draft.cardDebt}
                    onChange={(event) => patch({ cardDebt: event.target.value })}
                  />
                </Field>
              ) : null}
              {draft.intent === "reserve" ? (
                <>
                  <Toggle
                    checked={draft.trackReserve}
                    title="Quero uma meta de reserva"
                    onClick={() => patch({ trackReserve: !draft.trackReserve })}
                  />
                  {draft.trackReserve ? (
                    <Field label="Quanto quer ter guardado">
                      <input
                        className={fieldClass}
                        inputMode="decimal"
                        placeholder="0,00"
                        value={draft.reserveTarget}
                        onChange={(event) => patch({ reserveTarget: event.target.value })}
                      />
                    </Field>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}

          {step === 5 ? (
            <ul className="space-y-3">
              {(plan?.reading ?? []).map((line) => (
                <li key={line} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <div className="flex gap-2">
            {step > 0 || mode === "apply" ? (
              <button type="button" className="rounded-2xl px-4 py-3 text-sm text-[#93A0B1]" onClick={goBack}>
                {step === 0 ? "Agora não" : "Voltar"}
              </button>
            ) : null}
            {step === 3 ? (
              <button
                type="button"
                className="rounded-2xl px-4 py-3 text-sm text-[#93A0B1]"
                onClick={() => {
                  patch({ fixed: emptyFixed() });
                  setStep(4);
                }}
              >
                Nenhum por enquanto
              </button>
            ) : null}
            {step < 5 ? (
              <GoldButton type="button" className="flex-1" onClick={goNext}>
                Continuar
              </GoldButton>
            ) : (
              <GoldButton type="button" className="flex-1" disabled={saving || !plan} onClick={() => void finish()}>
                {saving ? "Absorvendo…" : mode === "create" ? "Começar com esse contexto" : "Aplicar no meu mês"}
              </GoldButton>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Choice({
  title,
  body,
  selected,
  onClick,
}: {
  title: string;
  body: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border px-4 py-3 text-left transition",
        selected ? "border-[#B7FF3C]/70 bg-[#B7FF3C]/10" : "border-white/10 bg-white/[0.03] hover:border-white/20",
      )}
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-[#93A0B1]">{body}</span>
    </button>
  );
}

function Toggle({ checked, title, onClick }: { checked: boolean; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm",
        checked ? "border-[#B7FF3C]/70 bg-[#B7FF3C]/10" : "border-white/10",
      )}
      aria-pressed={checked}
    >
      <span>{title}</span>
      <span className={cn("text-xs font-semibold", checked ? "text-[#B7FF3C]" : "text-[#6F7B8C]")}>
        {checked ? "Sim" : "Não"}
      </span>
    </button>
  );
}
