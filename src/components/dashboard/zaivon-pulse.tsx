"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getFirstName, getTimeGreeting, resolveUserTimeZone } from "@/lib/time-greeting";
import { useSessionUser } from "@/hooks/use-session-user";
import { useHideMoney, type HideMoneyScreen } from "@/hooks/use-hide-money";
import { formatCurrency } from "@/lib/utils";
import {
  PULSE_METRIC_META,
  PULSE_TONE_STYLES,
  type ZaivonPulseView,
} from "@/lib/zaivon-pulse";

interface ZaivonPulseProps {
  pulse: ZaivonPulseView;
  className?: string;
  /** Escopo do olhinho (dashboard ou v2-hoje). */
  hideMoneyScreen?: HideMoneyScreen;
}

function formatPulseMoney(
  value: number | null,
  mask: (fn: typeof formatCurrency) => (n: number) => string,
): string {
  if (value == null) return "A apurar";
  return mask(formatCurrency)(value);
}

export function ZaivonPulse({ pulse, className, hideMoneyScreen = "dashboard" }: ZaivonPulseProps) {
  const { data: user } = useSessionUser();
  const { maskMoney } = useHideMoney(hideMoneyScreen);
  const reduceMotion = useReducedMotion();
  const firstName = getFirstName(user?.name ?? "Lucas");
  const [greeting, setGreeting] = useState("Boa noite");

  useEffect(() => {
    const tz = resolveUserTimeZone();
    const apply = () => setGreeting(getTimeGreeting(tz));
    apply();
    const id = window.setInterval(apply, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const tone = PULSE_TONE_STYLES[pulse.tone];
  const liveLabel = useMemo(() => {
    if (pulse.source === "dayClosing") return "Atualizado com fechamento canônico";
    if (pulse.source === "diary") return "Atualizado com o diário do dia";
    return "Atualizado com seus dados";
  }, [pulse.source]);

  return (
    <motion.section
      aria-labelledby="pulse-greeting"
      initial={reduceMotion ? false : { opacity: 0.1, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "zaivon-pulse relative isolate overflow-hidden rounded-[22px] border border-[#303941]",
        "bg-[linear-gradient(117deg,#151b22_0%,#10141b_65%,#121b18_100%)]",
        "px-4 pb-[25px] pt-[29px] shadow-[0_18px_60px_#0000002c] sm:px-8",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-[105px] -top-[190px] -z-10 h-[340px] w-[340px] bg-[radial-gradient(circle,#b7ff3c1b,transparent_72%)]"
        aria-hidden
      />

      <div className="mb-[26px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-[0.13em] text-z-lime-500">
          <span
            className="grid h-[27px] w-[27px] place-items-center rounded-lg border border-[#587b39] bg-[#293521] text-base"
            aria-hidden
          >
            ✦
          </span>
          ZAIVON PULSE
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#a4afbb] sm:text-xs">
          <span
            className="h-[7px] w-[7px] rounded-full bg-[#2ed3a7] shadow-[0_0_0_4px_#2ed3a716]"
            aria-hidden
          />
          <span>{liveLabel}</span>
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:gap-6">
        <div className="min-w-0">
          <h2
            id="pulse-greeting"
            className="m-0 text-[28px] font-bold leading-[1.12] tracking-[-0.055em] text-[#f4f7fa] sm:text-[clamp(25px,3.2vw,37px)]"
          >
            {greeting}, <em className="not-italic text-z-lime-500">{firstName}!</em> ✦
          </h2>
          <p className="m-0 mt-[11px] text-[13px] leading-[1.55] text-[#b1bbc6] sm:text-sm">
            {pulse.description}
          </p>
        </div>
        <div className="shrink-0 self-start rounded-[11px] border border-[#323c46] bg-[#202831] px-[13px] py-[10px] text-xs text-[#bdc6d0]">
          <span className="block text-[11px] tracking-wide">PERÍODO FINANCEIRO</span>
          <strong className="mt-1 block text-[13px] font-semibold text-[#f0f4f7]">
            {pulse.periodLabel}
          </strong>
        </div>
      </div>

      <div
        className="mt-[22px] grid grid-cols-2 gap-[9px] sm:mt-7 sm:gap-3 lg:grid-cols-4"
        aria-label="Indicadores financeiros"
      >
        {PULSE_METRIC_META.map((meta) => {
          const raw = pulse.metrics[meta.key];
          const accent = raw != null && raw < 0 ? "#ff8585" : meta.accent;
          return (
            <div
              key={meta.key}
              className="min-w-0 rounded-[15px] border border-[#2d3540] bg-[#1a2028] px-3 py-4 sm:px-4"
              style={{ ["--accent" as string]: accent }}
            >
              <div className="flex items-center gap-1.5 whitespace-nowrap text-[10px] text-[#a6b1be] sm:gap-2 sm:text-xs">
                <span className="text-[15px]" style={{ color: accent }} aria-hidden>
                  {meta.symbol}
                </span>
                {meta.label}
              </div>
              <div
                className="mt-3 whitespace-nowrap text-[21px] font-extrabold tracking-[-0.05em] tabular-nums sm:text-[clamp(19px,2.1vw,27px)]"
                style={{ color: accent === "#f4f7fa" ? "#f4f7fa" : accent }}
              >
                {formatPulseMoney(raw, maskMoney)}
              </div>
              <div className="mt-1.5 text-[10px] text-[#8e9ca9] sm:text-[11px]">{meta.sub}</div>
            </div>
          );
        })}
      </div>

      <div
        className="mt-3.5 flex items-start gap-2.5 rounded-[14px] border px-3 py-3.5 sm:gap-3 sm:px-[17px] sm:py-[15px]"
        style={{ background: tone.bg, borderColor: tone.border }}
      >
        <div
          className="grid h-[29px] w-[29px] shrink-0 place-items-center rounded-lg bg-[#34492b] text-base"
          style={{ color: tone.accent, background: `${tone.accent}22` }}
          aria-hidden
        >
          ✧
        </div>
        <div>
          <div
            className="mb-1.5 text-[10px] font-extrabold tracking-[0.13em]"
            style={{ color: tone.accent }}
          >
            {pulse.insightTitle}
          </div>
          <p className="m-0 text-[13px] leading-[1.55] text-[#e5eee7]" aria-live="polite">
            {pulse.insightMessage}
          </p>
        </div>
      </div>

      <div className="mt-[15px] flex flex-col items-start justify-between gap-2 text-[11px] text-[#8897a4] sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            <b className="font-semibold text-[#bfcbd4]">● {pulse.closingStatus}</b>
          </span>
          <span className="text-[#57636d]" aria-hidden>
            •
          </span>
          <span>{pulse.updateLabel}</span>
          {pulse.competenceProvisional && (
            <>
              <span className="text-[#57636d]" aria-hidden>
                •
              </span>
              <span className="text-[#c2af82]">Competência provisória</span>
            </>
          )}
        </div>
        <span className="sr-only">
          Fontes: {pulse.source}. Dimensões separadas — competência, caixa, lucro e fiados.
        </span>
      </div>
    </motion.section>
  );
}
