"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { useSessionUser } from "@/hooks/use-session-user";
import { parseMoney } from "@/lib/personal-finance/money";
import { Field, GoldButton, fieldClass } from "@/components/finance/ui";
import { useFinance } from "@/components/finance/finance-provider";

export function FinanceOnboarding() {
  const { data: user } = useSessionUser();
  const { act } = useFinance();
  const suggested = user?.name?.split(/\s+/)[0] ?? "";
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [income, setIncome] = useState("");
  const [payday, setPayday] = useState("5");
  const [balance, setBalance] = useState("");
  const [accountName, setAccountName] = useState("Conta principal");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const displayName = (name || suggested).trim();

  async function finish() {
    const monthlyIncome = income.trim() === "" ? 0 : parseMoney(income);
    const openingBalance = balance.trim() === "" ? 0 : parseMoney(balance, { allowNegative: true });
    const day = Number(payday);
    if (!displayName) {
      setError("Diz como posso te chamar.");
      return;
    }
    if (monthlyIncome == null || openingBalance == null) {
      setError("Usa um valor como 3500 ou 3.500,00.");
      return;
    }
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      setError("O dia do pagamento fica entre 1 e 28.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await act("onboard", {
        displayName,
        monthlyIncome,
        payday: day,
        openingBalance,
        accountName: accountName.trim() || "Conta principal",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui começar.");
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0C0B09] text-[#F6F1E7]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(232,184,109,0.18),_transparent_55%)]"
        aria-hidden
      />
      <main className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8B86D] text-[#1C1408]">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E8B86D]">ZAIVON Finance</p>
            <p className="text-sm text-[#A8A29E]">Três respostas e o mês começa a aparecer.</p>
          </div>
        </div>

        <div className="mb-6 flex gap-2" aria-hidden>
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={index <= step ? "h-1 flex-1 rounded-full bg-[#E8B86D]" : "h-1 flex-1 rounded-full bg-white/10"}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-5">
            <h1 className="text-3xl font-semibold tracking-tight">Como posso te chamar?</h1>
            <Field label="Seu nome">
              <input
                className={fieldClass}
                value={name}
                placeholder={suggested || "Lucas"}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </Field>
            <GoldButton type="button" className="w-full" onClick={() => setStep(1)}>
              Continuar
            </GoldButton>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h1 className="text-3xl font-semibold tracking-tight">Quanto entra por mês?</h1>
            <p className="text-sm leading-relaxed text-[#A8A29E]">
              Uma estimativa já serve. Se a renda oscila, use a média. Dá para corrigir depois.
            </p>
            <Field label="Renda mensal" hint="Deixe em branco se ainda não quiser informar.">
              <input
                className={fieldClass}
                inputMode="decimal"
                placeholder="0,00"
                value={income}
                onChange={(event) => setIncome(event.target.value)}
              />
            </Field>
            <Field label="Dia em que costuma cair" hint="De 1 a 28. A previsão usa essa data.">
              <input
                className={fieldClass}
                inputMode="numeric"
                value={payday}
                onChange={(event) => setPayday(event.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <button type="button" className="rounded-2xl px-4 py-3 text-sm text-[#A8A29E]" onClick={() => setStep(0)}>
                Voltar
              </button>
              <GoldButton type="button" className="flex-1" onClick={() => setStep(2)}>
                Continuar
              </GoldButton>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h1 className="text-3xl font-semibold tracking-tight">Quanto tem hoje?</h1>
            <p className="text-sm leading-relaxed text-[#A8A29E]">
              O saldo da conta principal. Cartão e investimento entram depois, se quiser.
            </p>
            <Field label="Nome da conta">
              <input className={fieldClass} value={accountName} onChange={(event) => setAccountName(event.target.value)} />
            </Field>
            <Field label="Saldo agora">
              <input
                className={fieldClass}
                inputMode="decimal"
                placeholder="0,00"
                value={balance}
                onChange={(event) => setBalance(event.target.value)}
              />
            </Field>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            <div className="flex gap-2">
              <button type="button" className="rounded-2xl px-4 py-3 text-sm text-[#A8A29E]" onClick={() => setStep(1)}>
                Voltar
              </button>
              <GoldButton type="button" className="flex-1" disabled={saving} onClick={() => void finish()}>
                {saving ? "Abrindo…" : "Começar meu controle"}
              </GoldButton>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
