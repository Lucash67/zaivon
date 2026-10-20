"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { CRM_COPY } from "@/constants/crm-brand";

type Kpis = {
  openLeads: number;
  inProposal: number;
  wonThisMonth: number;
  wonValueThisMonth: number;
  pipelineValue: number;
  potentialGains: number;
  toConvertCount: number;
  toConvertValue: number;
  restOpenCount: number;
  restOpenValue: number;
  qualifiedCount: number;
  qualifiedValue: number;
  negotiationValue: number;
};

function formatBrl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CrmHomeClient() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/crm/pipeline");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Falha ao carregar.");
        if (!cancelled) setKpis(data.kpis);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { label: "Leads abertos", value: kpis ? String(kpis.openLeads) : "…" },
    { label: "Em negociação", value: kpis ? String(kpis.inProposal) : "…" },
    {
      label: "Ganhos no mês",
      value: kpis
        ? `${kpis.wonThisMonth} · ${formatBrl(kpis.wonValueThisMonth)}`
        : "…",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
          Início
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {CRM_COPY.homeHint}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-[#A0A0A0]">
          Funil do seu freela de sites, fluxos e softwares. O Norte diz a próxima
          jogada — o pipeline guarda o mapa.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-emerald-500/20 bg-[#1a1c24] p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#A0A0A0]">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-white">{card.value}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 sm:col-span-2 lg:col-span-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">
            Ganhos potenciais
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {kpis ? formatBrl(kpis.potentialGains) : "…"}
          </p>
          <p className="mt-1 text-sm text-[#C8C8C8]">
            Se fechar tudo que ainda está aberto no funil.
          </p>
          {kpis ? (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#A0A0A0]">
              <span>
                A converter · {kpis.toConvertCount} · {formatBrl(kpis.toConvertValue)}
              </span>
              <span>
                Qualificação · {kpis.qualifiedCount} · {formatBrl(kpis.qualifiedValue)}
              </span>
              <span>
                Negociação · {kpis.inProposal} · {formatBrl(kpis.negotiationValue)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/crm/norte"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-[#3882F6] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Abrir o Norte
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/crm/mensagens"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-[#F5F6FA] hover:bg-white/10"
        >
          Mensagens
        </Link>
        <Link
          href="/crm/pipeline"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-[#F5F6FA] hover:bg-white/10"
        >
          Pipeline
        </Link>
        <Link
          href="/crm/contatos"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-[#F5F6FA] hover:bg-white/10"
        >
          Contatos
        </Link>
      </div>
    </div>
  );
}
