"use client";

import { useState } from "react";
import { maskMoneyInText, useMoneyHidden } from "@/hooks/use-hide-money";
import { parseMoney } from "@/lib/personal-finance/money";
import { useFinance, useFinanceHome } from "@/components/finance/finance-provider";
import { Field, GhostButton, GoldButton, Money, Panel, ShortDate, fieldClass } from "@/components/finance/ui";

export function MetasScreen() {
  const snap = useFinanceHome();
  const moneyHidden = useMoneyHidden("finance");
  const { act, openComposer } = useFinance();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!snap) return null;

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseMoney(target);
    if (!name.trim() || parsed == null || parsed <= 0) {
      setError("Dê um nome e um valor para a meta.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await act("addGoal", { name: name.trim(), target: parsed, deadline: deadline || null });
      setName("");
      setTarget("");
      setDeadline("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui criar a meta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {snap.view.goals.length === 0 ? (
        <Panel>
          <p className="text-lg font-semibold">Nenhuma meta ainda.</p>
          <p className="mt-2 text-sm leading-relaxed text-[#93A0B1]">
            Reserva de emergência, viagem, entrada. Com data, o Finance diz quanto por semana falta separar.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-3">
          {snap.view.goals.map((goal) => (
            <Panel key={goal.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">{goal.name}</p>
                  <p className="mt-1 text-sm text-[#93A0B1]">{maskMoneyInText(goal.note, moneyHidden)}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-[#B7FF3C]">{Math.round(goal.ratio * 100)}%</p>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-[#B7FF3C]" style={{ width: `${Math.round(goal.ratio * 100)}%` }} />
              </div>
              <p className="mt-3 text-sm">
                <Money value={goal.current} tone="save" /> de <Money value={goal.target} tone="neutral" />
                {goal.deadline ? (
                  <>
                    {" "}
                    · até <ShortDate iso={goal.deadline} />
                  </>
                ) : null}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <GoldButton type="button" className="px-3 py-2" onClick={() => openComposer({ direction: "save", goalId: goal.id })}>
                  Guardar nesta meta
                </GoldButton>
                <GhostButton type="button" className="px-3 py-2" onClick={() => void act("archiveGoal", { goalId: goal.id })}>
                  Arquivar
                </GhostButton>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Panel>
        <p className="text-sm font-semibold">Nova meta</p>
        <form onSubmit={(event) => void create(event)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Reserva de 3 meses" />
          </Field>
          <Field label="Valor">
            <input className={fieldClass} inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} />
          </Field>
          <Field label="Data" hint="Opcional, mas é ela que cria o ritmo semanal.">
            <input type="date" className={fieldClass} value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </Field>
          <div className="flex items-end">
            <GoldButton type="submit" disabled={saving} className="w-full">
              {saving ? "Criando…" : "Criar meta"}
            </GoldButton>
          </div>
          {error ? <p className="text-sm text-rose-300 sm:col-span-2">{error}</p> : null}
        </form>
      </Panel>
    </div>
  );
}
