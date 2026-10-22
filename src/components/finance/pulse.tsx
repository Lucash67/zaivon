"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { maskMoneyInText, useFormatMoney, useMoneyHidden } from "@/hooks/use-hide-money";
import type { FinanceView } from "@/lib/personal-finance/types";

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

type Metric = {
  href: string;
  label: string;
  symbol: string;
  value: number;
  sub: string;
  accent: string;
};

function periodLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${WEEKDAYS[date.getUTCDay()]}, ${day} ${MONTHS[month - 1]} ${year}`;
}

function reading(view: FinanceView): { badge: string; detail: string } {
  if (view.firstNegative) {
    return { badge: "Caixa aperta", detail: "A previsão cruza zero. Vale olhar as próximas saídas." };
  }
  if (view.spendPlan.verdict === "over" || view.spendPlan.verdict === "already-over") {
    return { badge: "Gasto acima do plano", detail: "Repetir esta semana passa do que você marcou para o mês." };
  }
  if (view.spendPlan.verdict === "hit") {
    return { badge: "No plano", detail: "Se as próximas semanas seguirem a cota, o mês fecha no valor." };
  }
  if (view.cardBalance < 0) {
    return { badge: "Cartão fora do caixa", detail: "A dívida aparece no pulso e não entra no disponível." };
  }
  if (view.month.income === 0 && view.month.expense === 0 && view.upcoming.length === 0) {
    return { badge: "Aguardando o primeiro lançamento", detail: "Um registro já liga a previsão, a meta e os desafios." };
  }
  if (view.spendPlan.verdict === "under") {
    return { badge: "Abaixo do plano", detail: "Ainda cabe gasto neste mês sem passar do valor que você marcou." };
  }
  return { badge: "Mês em movimento", detail: "Estes números saem do que você lançou e do que já está previsto." };
}

export function FinancePulse({
  view,
  name,
}: {
  view: FinanceView;
  name: string;
}) {
  const formatMoney = useFormatMoney("finance");
  const moneyHidden = useMoneyHidden("finance");
  const [greeting, setGreeting] = useState("Olá");
  const status = reading(view);
  const cardDebt = view.cardBalance < 0 ? view.cardBalance : 0;
  const metrics: Metric[] = [
    {
      href: "/finance/mes",
      label: "Disponível",
      symbol: "↗",
      value: view.available,
      sub: "Conta, poupança e carteira.",
      accent: "#B7FF3C",
    },
    {
      href: "/finance/mes",
      label: "Entrou no mês",
      symbol: "↑",
      value: view.month.income,
      sub: "O que caiu na conta.",
      accent: "#2ED3A7",
    },
    {
      href: "/finance/mes",
      label: "Saiu no mês",
      symbol: "↓",
      value: view.month.expense,
      sub: "Gasto já registrado.",
      accent: "#F4F7FA",
    },
    cardDebt < 0
      ? {
          href: "/finance/insights",
          label: "No cartão",
          symbol: "!",
          value: cardDebt,
          sub: "Dívida. Fica fora do disponível.",
          accent: "#F5B942",
        }
      : {
          href: "/finance/projecoes",
          label: "Fim do mês",
          symbol: "→",
          value: view.monthEndBalance,
          sub: "Hoje, mais o que já está previsto.",
          accent: "#C9FF69",
        },
  ];

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite");
  }, []);

  return (
    <section
      aria-labelledby="finance-pulse-greeting"
      className="relative isolate overflow-hidden rounded-[22px] border border-[#303941] bg-[linear-gradient(117deg,#151b22_0%,#10141b_65%,#121b18_100%)] px-4 pb-6 pt-7 shadow-[0_18px_60px_#0000002c] sm:px-8"
    >
      <div
        className="pointer-events-none absolute -right-24 -top-40 -z-10 h-80 w-80 bg-[radial-gradient(circle,#b7ff3c1b,transparent_72%)]"
        aria-hidden
      />

      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-[0.13em] text-[#B7FF3C]">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#587b39] bg-[#293521]" aria-hidden>
            ✦
          </span>
          ZAIVON PULSE
        </div>
        <p className="flex items-center gap-2 text-[10px] text-[#a4afbb] sm:text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2ED3A7] shadow-[0_0_0_4px_#2ed3a716]" aria-hidden />
          Atualizado com os seus lançamentos
        </p>
      </div>

      <div className="flex flex-col items-start justify-between gap-5 sm:flex-row">
        <div className="min-w-0">
          <h2 id="finance-pulse-greeting" className="text-[28px] font-bold leading-[1.12] tracking-[-0.055em] text-[#f4f7fa] sm:text-4xl">
            {greeting}, <em className="not-italic text-[#B7FF3C]">{name}!</em>
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#b1bbc6]">{view.pulse}</p>
        </div>
        <div className="shrink-0 rounded-[11px] border border-[#323c46] bg-[#202831] px-3.5 py-2.5 text-xs text-[#bdc6d0]">
          <span className="block text-[11px] tracking-wide">PERÍODO</span>
          <strong className="mt-1 block text-[13px] font-semibold capitalize text-[#f0f4f7]">{periodLabel(view.today)}</strong>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4" aria-label="Indicadores do seu dinheiro">
        {metrics.map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className="min-w-0 rounded-[15px] border border-[#2d3540] bg-[#1a2028] px-3 py-4 transition hover:-translate-y-0.5 hover:border-[#B7FF3C]/40 sm:px-4"
          >
            <p className="flex items-center gap-1.5 text-[10px] text-[#a6b1be] sm:text-xs">
              <span style={{ color: metric.accent }} aria-hidden>
                {metric.symbol}
              </span>
              {metric.label}
            </p>
            <p
              className="mt-3 text-[21px] font-extrabold tracking-[-0.05em] tabular-nums sm:text-[26px]"
              style={{ color: metric.accent }}
            >
              {formatMoney(metric.value)}
            </p>
            <p className="mt-1.5 text-[11px] leading-snug text-[#8e9ca9]">{metric.sub}</p>
          </Link>
        ))}
      </div>

      <div className="mt-3.5 flex items-start gap-3 rounded-[14px] border border-[#3d5a32] bg-[#1c2a1c] px-3.5 py-3.5 sm:px-4">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#34492b] text-[#B7FF3C]" aria-hidden>
          ✧
        </span>
        <div>
          <p className="text-[10px] font-extrabold tracking-[0.13em] text-[#B7FF3C]">INSIGHT DO DIA</p>
          <p className="mt-1 text-sm font-semibold text-[#f4f7fa]">{view.tip.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#e5eee7]">{maskMoneyInText(view.tip.body, moneyHidden)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1 text-[11px] text-[#8897a4] sm:flex-row sm:items-center sm:gap-2">
        <span className="font-semibold text-[#bfcbd4]">● {status.badge}</span>
        <span className="hidden sm:inline" aria-hidden>
          •
        </span>
        <span>{status.detail}</span>
      </div>
    </section>
  );
}
