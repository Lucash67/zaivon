"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Ban,
  LineChart,
  CircleAlert,
  CircleHelp,
  Clock,
  FileCheck,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuroraSnapshot, AurChannel, AurEventType } from "@/lib/finance/aurora-view";
import { Money, useAuroraPrivacy } from "@/components/zaivon-aurora/privacy";
import { useChannel } from "@/components/zaivon-aurora/channel";
import { Disclosure } from "@/components/zaivon-aurora/chrome";

const CHANNEL_LABEL: Record<AurChannel, string> = {
  unifor: "Unifor",
  acal: "Acal",
  unknown: "Canal não identificado",
};

function channelClass(channel: AurChannel) {
  if (channel === "unifor") return "border-aur-lime/30 bg-aur-lime/10 text-aur-lime";
  if (channel === "acal") return "border-aur-cyan/30 bg-aur-cyan/10 text-aur-cyan";
  return "border-aur-line/60 bg-aur-panel3/60 text-aur-muted";
}

function GiroRing({ score }: { score: number | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const shown = score ?? 0;
  const offset = circumference * (1 - (mounted ? shown : 0) / 100);
  return (
    <div className="relative grid place-items-center">
      <svg viewBox="0 0 128 128" className="size-36 -rotate-90 sm:size-44" role="img" aria-label={score == null ? "Giro do estoque sem base completa" : `Giro do estoque: ${score} de 100`}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="oklch(var(--aur-panel-3))" strokeWidth="9" />
        {score != null ? (
          <circle cx="64" cy="64" r={r} fill="none" stroke="oklch(var(--aur-lime))" strokeWidth="9" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="health-ring__progress" />
        ) : null}
      </svg>
      <div className="absolute text-center">
        <p className="font-display text-4xl font-bold tabular-nums sm:text-5xl">{score ?? "—"}</p>
        <p className="mt-0.5 text-[10px] font-semibold tracking-[0.18em] text-aur-muted uppercase">Giro</p>
      </div>
    </div>
  );
}

export function Hero({
  name,
  mode,
  date,
  endDate,
  giro,
  onModeChange,
  onDateChange,
  onEndDateChange,
}: {
  name: string;
  mode: "day" | "period";
  date: string;
  endDate: string;
  giro: AuroraSnapshot["giro"];
  onModeChange: (mode: "day" | "period") => void;
  onDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}) {
  const [greeting, setGreeting] = useState("Olá");
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite");
  }, []);
  return (
    <div className="glass-strong relative overflow-hidden rounded-3xl p-6 sm:p-9">
      <div className="relative flex flex-wrap items-center justify-between gap-8">
        <div className="min-w-0 flex-1 basis-80">
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] text-aur-lime uppercase">
            <Sparkles className="size-3.5" /> ZAIVON Pulse · Central de inteligência operacional
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            {greeting}, <span className="text-aur-lime">{name}</span>
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-aur-muted">
            Seu negócio, em perspectiva. Entenda o dia em segundos e investigue cada detalhe em poucos cliques.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <select value={mode} onChange={(e) => onModeChange(e.target.value as "day" | "period")} aria-label="Selecionar período" className="rounded-full border border-aur-line bg-aur-panel2/80 px-4 py-2.5 text-sm">
              <option value="day">Dia específico</option>
              <option value="period">Período personalizado</option>
            </select>
            <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} aria-label="Data inicial" className="rounded-full border border-aur-line bg-aur-panel2/80 px-4 py-2.5 text-sm" />
            {mode === "period" ? (
              <input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} aria-label="Data final" className="rounded-full border border-aur-line bg-aur-panel2/80 px-4 py-2.5 text-sm" />
            ) : null}
          </div>
        </div>
        <div className="flex max-w-xs flex-col items-center gap-3">
          <GiroRing score={giro?.score ?? null} />
          <div className="text-center">
            <p className="text-sm font-semibold text-aur-lime">{giro?.label ?? "Giro do estoque"}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-aur-muted">{giro?.detail || "O anel só fecha quando o dia tem encomenda de salgados e contagem de sanduíches."}</p>
            <p className="mt-2 text-[10px] leading-relaxed text-aur-muted">{giro?.formula}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Bento({ metrics, globalLabel }: { metrics: NonNullable<AuroraSnapshot["metrics"]>; globalLabel: string }) {
  const { hidden } = useAuroraPrivacy();
  const parts = [
    { label: "Vendas recebidas", value: metrics.salesReceived, tone: "bg-aur-lime" },
    { label: "Quitações", value: metrics.priorSettlements, tone: "bg-aur-azure" },
    { label: "Bônus", value: metrics.bonus, tone: "bg-aur-amber" },
  ];
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  const depositRatio = metrics.cashResult > 0 ? Math.max(0, Math.min(1, metrics.deposit / metrics.cashResult)) : 0;
  return (
    <section aria-label="Indicadores financeiros">
      <p className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-aur-muted uppercase">{globalLabel} · não muda com o filtro de canal</p>
      <div className="grid gap-3.5 md:grid-cols-4">
        <article className="glass lift relative overflow-hidden rounded-3xl p-6 md:col-span-2 md:row-span-2 sm:p-7">
          <p className="text-xs font-semibold tracking-[0.14em] text-aur-muted uppercase">Resultado de caixa</p>
          <Money value={metrics.cashResult} className="mt-5 block font-display text-5xl font-bold tracking-tight text-aur-lime tabular-nums sm:text-6xl" />
          <p className="mt-3 text-xs leading-relaxed text-aur-muted">
            Entradas efetivas − custo real pago.
            {metrics.depositEqualsResult ? " O depósito do recorte cobre esse resultado." : " O depósito é uma transferência, não o saldo do cofrinho."}
          </p>
          <div className="mt-auto pt-6">
            <div className="flex items-end justify-between text-[11px] text-aur-muted">
              <span>Depósito no cofrinho</span>
              <Money value={metrics.deposit} className="text-sm font-bold text-aur-fg tabular-nums" />
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-aur-panel3">
              {hidden ? null : <div className="h-full rounded-full bg-aur-lime" style={{ width: `${depositRatio * 100}%` }} />}
            </div>
          </div>
        </article>
        <article className="glass lift rounded-3xl p-6 md:col-span-2">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold tracking-[0.14em] text-aur-muted uppercase">Entradas totais</p>
            <ArrowUpRight className="size-4 text-aur-muted" />
          </div>
          <Money value={metrics.entries} className="mt-4 block font-display text-4xl font-bold tabular-nums" />
          <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full bg-aur-panel3">
            {hidden
              ? null
              : parts.map((part) => (
                  <div key={part.label} className={cn("h-full", part.tone)} style={{ width: `${(part.value / total) * 100}%` }} />
                ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {parts.map((part) => (
              <span key={part.label} className="flex items-center gap-1.5 text-[11px] text-aur-muted">
                <span className={cn("size-1.5 rounded-full", part.tone)} />
                {part.label} <Money value={part.value} className="font-semibold text-aur-fg/80" />
              </span>
            ))}
          </div>
        </article>
        <article className="glass lift rounded-3xl p-6">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold tracking-[0.14em] text-aur-muted uppercase">Custo real pago</p>
            <ArrowDownRight className="size-4 text-aur-muted" />
          </div>
          <Money value={metrics.ownCost} className="mt-4 block font-display text-4xl font-bold tabular-nums" />
          <p className="mt-3 text-[11px] leading-relaxed text-aur-muted">
            Custo efetivo
            {metrics.theoreticalCost != null ? (
              <>
                {" "}· teórico de <Money value={metrics.theoreticalCost} className="font-semibold" /> é só referência
              </>
            ) : null}
          </p>
        </article>
        <article className="glass lift rounded-3xl p-6">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold tracking-[0.14em] text-aur-muted uppercase">Novos fiados</p>
            <ArrowUpRight className="size-4 text-aur-amber" />
          </div>
          <Money value={metrics.newCredit} className="mt-4 block font-display text-4xl font-bold text-aur-amber tabular-nums" />
          <p className="mt-3 text-[11px] leading-relaxed text-aur-muted">Reconhecidos, não recebidos · entram na competência, não no caixa</p>
        </article>
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[
          ["Faturamento por competência", metrics.competence],
          ["Vendas atuais recebidas", metrics.salesReceived],
          ["Quitações anteriores", metrics.priorSettlements],
          ["Bônus recebido", metrics.bonus],
        ].map(([label, value]) => (
          <div key={String(label)} className="glass rounded-2xl px-5 py-4">
            <p className="text-[11px] text-aur-muted">{label}</p>
            <Money value={Number(value)} className="mt-1.5 block font-display text-xl font-bold tabular-nums" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function Narrative({ snapshot }: { snapshot: AuroraSnapshot }) {
  const metrics = snapshot.metrics;
  if (!metrics) return null;
  const salgados = snapshot.operation.salgados;
  const sandwiches = snapshot.operation.sandwiches;
  return (
    <section aria-label="Leitura do dia">
      <p className="text-[11px] font-bold tracking-[0.22em] text-aur-cyan uppercase">Leitura do recorte</p>
      <p className="mt-4 max-w-4xl font-display text-xl leading-relaxed font-medium sm:text-2xl">
        {salgados ? (
          <>
            Foram movimentados <strong className="text-aur-lime">{salgados.moved} salgados</strong>
          </>
        ) : (
          "Os salgados deste recorte"
        )}
        {sandwiches ? (
          <>
            {" "}e vendidos <strong className="text-aur-lime">{sandwiches.sold} sanduíches</strong>
          </>
        ) : null}
        . Entraram <Money value={metrics.entries} className="font-bold" />, incluindo <Money value={metrics.priorSettlements} className="font-bold" /> em quitações e <Money value={metrics.bonus} className="font-bold" /> em bônus. Após <Money value={metrics.ownCost} className="font-bold" /> de custo efetivo, o resultado de caixa ficou em <Money value={metrics.cashResult} className="font-bold text-aur-lime" />.
      </p>
      <div className="mt-7 grid gap-3.5 md:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-aur-lime uppercase"><TrendingUp className="size-3.5" /> Destaques</p>
          <ul className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-aur-muted">
            <li>{snapshot.daysWithClosing.length} dia(s) com fechamento canônico.</li>
            <li>{snapshot.counts.receipts} recebimentos e {snapshot.counts.salesTotal} lançamentos de venda, sem repetir Pix.</li>
          </ul>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-aur-amber uppercase"><CircleAlert className="size-3.5" /> Pontos de atenção</p>
          <ul className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-aur-muted">
            <li><Money value={metrics.newCredit} className="font-semibold text-aur-amber" /> em fiados novos, fora do caixa.</li>
            {snapshot.operation.stockFinal ? <li>Estoque físico conhecido: {snapshot.operation.stockFinal}.</li> : null}
          </ul>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-aur-azure uppercase"><TriangleAlert className="size-3.5" /> Divergências</p>
          <ul className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-aur-muted">
            {metrics.unclassifiedBankDelta != null && Math.abs(metrics.unclassifiedBankDelta) > 0.001 ? (
              <li><Money value={metrics.unclassifiedBankDelta} className="font-semibold" /> não classificados na conciliação. O saldo fica no Cofrinho.</li>
            ) : (
              <li>Sem diferença de conciliação exposta neste recorte.</li>
            )}
            <li><a href="#notas" className="text-aur-azure underline">{snapshot.caveats.length} ressalvas</a> explicam as classificações do dia.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Operation({ snapshot }: { snapshot: AuroraSnapshot }) {
  const { channel } = useChannel();
  const { salgados, sandwiches, transfer, stockFinal, flavors } = snapshot.operation;
  return (
    <section id="operacao" className="scroll-mt-24">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Operação do dia</h2>
        <span className="text-xs text-aur-muted">{channel === "all" ? "Totais do fechamento" : "Totais globais · canal só filtra a lista"}</span>
      </div>
      {!salgados && !sandwiches ? (
        <p className="mb-4 text-xs text-aur-muted">Estoque e giro são lidos em um dia com auditoria. No período, a linha do tempo reúne os eventos sem somar um estoque fictício.</p>
      ) : null}
      <div className="grid gap-3.5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            {salgados ? (
              <div className="glass rounded-2xl p-5">
                <p className="text-xs font-semibold">Salgados</p>
                <p className="mt-3 font-display text-3xl font-bold tabular-nums">{salgados.moved}<span className="text-base text-aur-muted"> / {salgados.ordered}</span></p>
                <p className="mt-1 text-[11px] text-aur-muted">{salgados.paid} pagos + {salgados.fiado} fiados</p>
              </div>
            ) : null}
            {sandwiches ? (
              <div className="glass rounded-2xl p-5">
                <p className="text-xs font-semibold">Sanduíches</p>
                <p className="mt-3 font-display text-3xl font-bold tabular-nums">{sandwiches.sold}<span className="text-base text-aur-muted"> / {sandwiches.produced}</span></p>
                <p className="mt-1 text-[11px] text-aur-muted">{sandwiches.paid} pagos + {sandwiches.fiado} fiados · {sandwiches.remaining} restantes</p>
              </div>
            ) : null}
          </div>
          {transfer ? (
            <div className="glass flex items-center justify-between gap-4 rounded-2xl px-5 py-4">
              <p className="font-display text-sm font-bold">{transfer.from}</p>
              <p className="flex items-center gap-2 text-[11px] font-semibold"><ArrowRight className="size-4 text-aur-cyan" />{transfer.salgados} salgados + {transfer.sandwiches} sanduíche · estoque</p>
              <p className="font-display text-sm font-bold">{transfer.to}</p>
            </div>
          ) : null}
          {stockFinal ? (
            <div className="glass flex items-center justify-between rounded-2xl px-5 py-4 text-xs text-aur-muted">
              <span>Estoque físico final conhecido</span>
              <strong className="font-display text-sm text-aur-fg">{stockFinal}</strong>
            </div>
          ) : null}
          {channel !== "all" ? (
            <p className="rounded-xl border border-aur-line/60 bg-aur-panel2/50 px-4 py-2.5 text-[11px] leading-relaxed text-aur-muted">
              Pagos, fiados e restantes vêm do fechamento do dia inteiro. O filtro de canal não reparte esses totais.
            </p>
          ) : null}
        </div>
        <div className="glass rounded-3xl p-6">
          <h3 className="font-display text-sm font-bold">Sabores</h3>
          <p className="mt-1 text-xs leading-relaxed text-aur-muted">O que a venda identifica. Sem sabor na linha, permanece “não identificado”.</p>
          <div className="mt-4 flex flex-col gap-2">
            {flavors.length === 0 ? <p className="text-xs text-aur-muted">Nenhuma venda neste recorte.</p> : flavors.map((flavor) => (
              <div key={flavor.name} className="flex items-center justify-between text-xs">
                <span>{flavor.name}</span>
                <span className="tabular-nums text-aur-muted">{flavor.units}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2.5 rounded-xl border border-aur-amber/30 bg-aur-amber/10 px-4 py-3 text-xs leading-relaxed text-aur-amber">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>A encomenda por sabor não é a composição das vendas. Transferência de estoque não vira venda.</span>
          </div>
        </div>
      </div>
    </section>
  );
}

const TYPE_META: Record<AurEventType, { label: string; icon: typeof ArrowUpRight; dot: string }> = {
  sale: { label: "Venda recebida", icon: ArrowUpRight, dot: "bg-aur-lime text-aur-ink" },
  credit: { label: "Fiado", icon: Clock, dot: "bg-aur-amber text-aur-ink" },
  settlement: { label: "Recebimento misto", icon: ArrowLeftRight, dot: "bg-aur-azure text-aur-fg" },
  movement: { label: "Movimento", icon: Package, dot: "bg-aur-panel3 text-aur-muted" },
};

export function Timeline({ snapshot }: { snapshot: AuroraSnapshot }) {
  const { channel } = useChannel();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<AurEventType | "all">("all");
  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase("pt-BR");
    return snapshot.timeline.filter((event) => {
      if (type !== "all" && event.type !== type) return false;
      if (channel !== "all" && event.channel !== channel) return false;
      return `${event.name} ${event.detail}`.toLocaleLowerCase("pt-BR").includes(q);
    });
  }, [snapshot.timeline, query, type, channel]);
  const hiddenUnknown = channel === "all" ? 0 : snapshot.timeline.filter((event) => event.channel === "unknown" && (type === "all" || event.type === type)).length;
  return (
    <section id="historico" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Linha do tempo operacional</h2>
        <span className="text-xs text-aur-muted">{snapshot.counts.salesTotal} lançamentos · {snapshot.counts.salesPaid} pagos · {snapshot.counts.salesPending} fiados · {snapshot.counts.receipts} recebimentos</span>
      </div>
      <div className="glass rounded-3xl p-5 sm:p-7">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-aur-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente, produto ou evento…" className="w-full rounded-full border border-aur-line bg-aur-panel2/70 py-2.5 pr-4 pl-11 text-sm" />
        </label>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["all", "sale", "credit", "settlement", "movement"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setType(value)} className={cn("rounded-full border px-3.5 py-1.5 text-[11px]", type === value ? "border-aur-lime/60 bg-aur-lime/12 text-aur-lime" : "border-aur-line/70 text-aur-muted")}>
              {value === "all" ? "Todos" : TYPE_META[value].label}
            </button>
          ))}
        </div>
        <div className="scrollbar-slim mt-6 max-h-[32rem] overflow-y-auto pr-2">
          {filtered.length === 0 ? <p className="py-10 text-center text-sm text-aur-muted">Nenhum evento neste filtro.</p> : (
            <div className="relative ml-4 border-l border-aur-line/70 pl-7">
              {filtered.map((event) => {
                const meta = TYPE_META[event.type];
                const Icon = meta.icon;
                return (
                  <article key={`${event.date}-${event.id}`} className="relative pb-6 last:pb-1">
                    <span className={cn("absolute top-0 -left-[37px] grid size-6 place-items-center rounded-full", meta.dot)}><Icon className="size-3" /></span>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                          {event.name}
                          <span className="text-[10px] text-aur-muted">{meta.label}</span>
                          <span className={cn("rounded-full border px-1.5 py-px text-[9px]", channelClass(event.channel))}>{CHANNEL_LABEL[event.channel]}</span>
                          {event.noteRef ? (
                            <a href={`#ressalva-${event.noteRef}`} className="rounded-full border border-aur-amber/40 bg-aur-amber/10 px-2 py-0.5 text-[10px] font-semibold text-aur-amber">{event.noteRef}</a>
                          ) : null}
                        </p>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-aur-muted">{event.detail}</p>
                        {event.allocations.length > 1 ? (
                          <p className="mt-1 flex flex-wrap gap-2 text-[11px] text-aur-muted">
                            {event.allocations.map((allocation) => (
                              <span key={allocation.id}>{allocation.label} <Money value={allocation.amount} className="font-semibold text-aur-fg" /></span>
                            ))}
                          </p>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        {event.value != null ? <Money value={event.value} className="text-xs font-bold tabular-nums" /> : null}
                        <p className="mt-1 text-[10px] text-aur-muted">{event.time ?? "Horário não confirmado"}{snapshot.from !== snapshot.to ? ` · ${event.date.slice(8, 10)}/${event.date.slice(5, 7)}` : ""}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
        {hiddenUnknown > 0 ? (
          <p className="mt-5 text-[11px] leading-relaxed text-aur-muted">{hiddenUnknown} eventos sem canal ficam de fora deste filtro. O protótipo não inventa a origem.</p>
        ) : null}
      </div>
    </section>
  );
}

export function Fiados({ snapshot }: { snapshot: AuroraSnapshot }) {
  const { channel } = useChannel();
  const unknown = snapshot.fiados.filter((item) => item.channel === "unknown").length;
  return (
    <section id="fiados" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Fiados e compromissos</h2>
        <span className="text-xs text-aur-muted">Novas dívidas ≠ carteira histórica</span>
      </div>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <div className="glass rounded-3xl p-6">
          <h3 className="font-display text-sm font-bold">Gerados no recorte</h3>
          <p className="mt-1 text-xs text-aur-muted">{snapshot.fiados.length} lançamentos · <Money value={snapshot.metrics?.newCredit ?? 0} className="font-semibold text-aur-amber" /></p>
          <div className="mt-4 flex flex-col gap-2">
            {snapshot.fiados.map((item) => (
              <div key={item.id} className={cn("flex items-center justify-between gap-3 rounded-xl border border-aur-line/60 bg-aur-panel2/60 px-4 py-3", channel !== "all" && item.channel !== channel && "opacity-40")}>
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-xs font-semibold">{item.client} <span className={cn("rounded-full border px-1.5 text-[9px]", channelClass(item.channel))}>{CHANNEL_LABEL[item.channel]}</span></p>
                  <p className="text-[11px] text-aur-muted">{item.product}</p>
                </div>
                <Money value={item.value} className="font-display text-sm font-bold text-aur-amber" />
              </div>
            ))}
          </div>
          {channel !== "all" && unknown > 0 ? <p className="mt-3 text-[11px] text-aur-muted">{unknown} fiados sem canal ficam esmaecidos, não excluídos.</p> : null}
        </div>
        <div className="glass rounded-3xl p-6">
          <h3 className="font-display text-sm font-bold">Carteira acumulada até {snapshot.to.split("-").reverse().join("/")}</h3>
          <p className="mt-1 text-xs text-aur-muted">Posição em aberto até a data final: <Money value={snapshot.walletOpenTotal} className="font-semibold" />. Não soma de novo os fiados do recorte.</p>
          <div className="mt-4 flex max-h-80 flex-col gap-2 overflow-y-auto">
            {snapshot.wallet.filter((item) => item.status !== "historico").map((item) => {
              const Icon = item.status === "acordo" ? FileCheck : item.status === "confirmar" ? CircleHelp : item.status === "historico" ? Ban : CircleAlert;
              return (
                <div key={item.id} className="flex items-start gap-3 rounded-xl border border-aur-line/60 bg-aur-panel2/60 px-4 py-3">
                  <Icon className="mt-0.5 size-3.5 shrink-0 text-aur-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{item.name}</p>
                    <p className="text-[11px] text-aur-muted">{item.detail}</p>
                  </div>
                  <div className="text-right">
                    <Money value={item.amount} className="block text-xs font-bold tabular-nums" />
                    <span className="text-[10px] text-aur-muted">{item.statusLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-aur-muted">
            {snapshot.wallet.filter((item) => item.status === "historico").length} baixas antigas ficam fora da carteira ativa, inclusive a perda já homologada da Mikelly.
          </p>
        </div>
      </div>
    </section>
  );
}

export function Ressalvas({ snapshot }: { snapshot: AuroraSnapshot }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section id="notas" className="scroll-mt-24">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Integridade dos dados</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-aur-emerald/40 bg-aur-emerald/10 px-3 py-1 text-[11px] font-semibold text-aur-emerald">
          <ShieldCheck className="size-3.5" /> {snapshot.caveats.length} observações
        </span>
      </div>
      <div className="glass rounded-3xl p-5 sm:p-7">
        <p className="text-xs leading-relaxed text-aur-muted">Ressalvas registram decisões, limites de evidência e diferenças rastreáveis. O saldo do cofrinho não entra aqui.</p>
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {snapshot.caveats.map((item) => {
            const open = openId === item.id;
            return (
              <div key={item.id} id={`ressalva-${item.id}`} className={cn("scroll-mt-28 rounded-2xl border", open ? "border-aur-amber/50 bg-aur-amber/10" : "border-aur-line/60 bg-aur-panel2/50")}>
                <button type="button" onClick={() => setOpenId(open ? null : item.id)} className="flex w-full items-center justify-between px-4 py-3.5 text-left text-xs font-semibold">
                  {item.id}
                </button>
                {open ? <p className="px-4 pb-4 text-xs leading-6 text-aur-fg/80">{item.text}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Clientes({ snapshot }: { snapshot: AuroraSnapshot }) {
  const slots = Array.from({ length: 5 }, (_, index) => snapshot.topClients[index] ?? null);
  return (
    <section id="clientes" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Clientes mais frequentes</h2>
        <span className="text-xs text-aur-muted">Ranking global por unidades · independente da data</span>
      </div>
      <div className="glass rounded-3xl p-6 sm:p-7">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {slots.map((client, index) => (
            <div key={client?.id ?? index} className="rounded-2xl border border-dashed border-aur-line/80 bg-aur-panel2/40 p-4 text-center">
              <p className="font-display text-xs font-bold text-aur-lime">#0{index + 1}</p>
              <p className="mt-3 text-xs">{client?.name ?? "A calcular"}</p>
              <p className="mt-1 text-[10px] text-aur-muted">{client ? `${client.units} unidades` : "Unidades verificadas"}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-2.5 rounded-xl border border-aur-amber/30 bg-aur-amber/10 px-4 py-3 text-xs leading-relaxed text-aur-amber">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>Cadastros parecidos não são unidos. Unidades de venda inferida e nomes não identificados ficam fora do ranking.</span>
        </div>
      </div>
    </section>
  );
}

export function Analises() {
  return (
    <section id="analise" className="scroll-mt-24">
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold">Análises complementares</h2>
        <p className="text-xs text-aur-muted">Secundárias à leitura operacional</p>
      </div>
      <Disclosure title="Gráficos, metas e semana">
        <div className="flex items-start gap-3 px-4 pb-4">
          <LineChart className="size-4 text-aur-cyan" />
          <p className="text-xs leading-6 text-aur-muted">
            Os gráficos já existentes continuam em <a className="text-aur-cyan underline" href="/v2/desempenho">Desempenho</a> e na <a className="text-aur-cyan underline" href="/">dashboard anterior</a>. Esta homologação não cria uma série nova.
          </p>
        </div>
      </Disclosure>
    </section>
  );
}
