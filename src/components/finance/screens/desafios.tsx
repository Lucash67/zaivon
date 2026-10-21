"use client";

import { useState } from "react";
import { useFinance, useFinanceHome } from "@/components/finance/finance-provider";
import { GoldButton, Panel } from "@/components/finance/ui";

export function DesafiosScreen() {
  const snap = useFinanceHome();
  const { act } = useFinance();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  if (!snap) return null;
  const { view } = snap;

  async function start(code: string) {
    setPending(code);
    setError(null);
    try {
      await act("startChallenge", { code });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui aceitar.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8B86D]">
          Nível {view.level.level}
        </p>
        <p className="mt-1 text-2xl font-semibold">{view.level.name}</p>
        <p className="mt-2 text-sm text-[#A8A29E]">{view.xp} XP · sequência de {view.streak} dia{view.streak === 1 ? "" : "s"} registrando</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <span
            className="block h-full rounded-full bg-[#E8B86D]"
            style={{ width: `${Math.min(100, Math.round((view.level.into / view.level.span) * 100))}%` }}
          />
        </div>
      </Panel>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="grid gap-3">
        {view.challenges.map((challenge) => {
          const blocked = challenge.status === "available" && challenge.code === "dez-por-cento" && challenge.target <= 0;
          return (
            <Panel key={challenge.code}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">{challenge.title}</p>
                  <p className="mt-1 text-sm text-[#A8A29E]">{challenge.description}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-[#E8B86D]">+{challenge.xp} XP</span>
              </div>
              <p className="mt-3 text-sm">{challenge.detail}</p>
              {challenge.status !== "available" ? (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-[#E8B86D]" style={{ width: `${Math.round(challenge.ratio * 100)}%` }} />
                </div>
              ) : null}
              <div className="mt-4">
                {challenge.status === "available" ? (
                  <GoldButton type="button" disabled={blocked || pending === challenge.code} onClick={() => void start(challenge.code)}>
                    {pending === challenge.code ? "Aceitando…" : "Aceitar"}
                  </GoldButton>
                ) : (
                  <p className="text-xs uppercase tracking-[0.16em] text-[#A8A29E]">
                    {challenge.status === "done" ? "Completo" : challenge.status === "expired" ? "Encerrado" : "Em curso"}
                  </p>
                )}
                {challenge.status === "expired" ? (
                  <GoldButton type="button" className="mt-3" disabled={pending === challenge.code} onClick={() => void start(challenge.code)}>
                    Aceitar de novo
                  </GoldButton>
                ) : null}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
