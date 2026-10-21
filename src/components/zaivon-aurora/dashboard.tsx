"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarX2 } from "lucide-react";
import { useZaivon } from "@/components/zaivon-v2/store";
import type { AuroraSnapshot } from "@/lib/finance/aurora-view";
import { ChannelProvider, ChannelScopeNote, ChannelSwitch } from "@/components/zaivon-aurora/channel";
import { AuroraField, MobileNav, Reveal } from "@/components/zaivon-aurora/chrome";
import { Analises, Bento, Clientes, Fiados, Hero, Narrative, Operation, Ressalvas, Timeline } from "@/components/zaivon-aurora/sections";

export function AuroraDashboard() {
  const o = useZaivon();
  const [mode, setMode] = useState<"day" | "period">("day");
  const [periodStart, setPeriodStart] = useState(o.selectedDate);
  const [periodEnd, setPeriodEnd] = useState(o.selectedDate);
  const [data, setData] = useState<AuroraSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seenStrip = useRef(o.selectedDate);

  useEffect(() => {
    if (seenStrip.current === o.selectedDate) return;
    seenStrip.current = o.selectedDate;
    setMode("day");
  }, [o.selectedDate]);

  const date = mode === "day" ? o.selectedDate : periodStart;
  const endDate = mode === "day" ? o.selectedDate : periodEnd;
  const from = date <= endDate ? date : endDate;
  const to = date <= endDate ? endDate : date;

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(`/api/zaivon/aurora?from=${from}&to=${to}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        setData((await response.json()) as AuroraSnapshot);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("Não foi possível ler o período.");
      });
    return () => controller.abort();
  }, [from, to]);

  const name = data?.profileName || "Lucas";

  return (
    <ChannelProvider>
      <AuroraField />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-1 pb-8 sm:px-2">
        <MobileNav />
        <div id="inicio" className="scroll-mt-28 pt-4">
          <Hero
            name={name}
            mode={mode}
            date={date}
            endDate={endDate}
            giro={mode === "day" ? data?.giro ?? null : null}
            onModeChange={setMode}
            onDateChange={(value) => {
              if (mode === "day") {
                seenStrip.current = value;
                o.selectDate(value);
              } else {
                setPeriodStart(value);
              }
            }}
            onEndDateChange={setPeriodEnd}
          />
          <div className="mt-3">
            <ChannelSwitch />
          </div>
          <ChannelScopeNote />
        </div>
        {error ? <p className="mt-8 text-sm text-aur-amber">{error}</p> : null}
        {data && !data.hasData ? (
          <div className="glass mt-8 rounded-3xl p-10 text-center">
            <CalendarX2 className="mx-auto size-6 text-aur-muted" />
            <h2 className="mt-5 font-display text-lg font-bold">Sem fechamento canônico neste recorte</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-aur-muted">
              Os indicadores não são estimados. Escolha um dia que já tenha fechamento.
            </p>
          </div>
        ) : null}
        {data?.hasData && data.metrics ? (
          <div className="mt-8 flex flex-col gap-14">
            <Reveal><Bento metrics={data.metrics} globalLabel={mode === "day" ? "Dia inteiro" : "Período inteiro"} /></Reveal>
            <Reveal><Narrative snapshot={data} /></Reveal>
            <Reveal><Operation snapshot={data} /></Reveal>
            <Reveal><Timeline snapshot={data} /></Reveal>
            <Reveal><Fiados snapshot={data} /></Reveal>
            <Reveal><Ressalvas snapshot={data} /></Reveal>
            <Reveal><Clientes snapshot={data} /></Reveal>
            <Reveal><Analises /></Reveal>
          </div>
        ) : null}
      </div>
    </ChannelProvider>
  );
}
