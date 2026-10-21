/**
 * Vista da Dashboard Aurora.
 * Totais financeiros saem de buildOperationalReading / dayClosing.
 * A timeline lista recebimentos, fiados e movimentos — uma vez cada.
 */
import type { DayClosingFinance } from "@/lib/finance/day-closing";
import {
  buildOperationalReading,
  type CashAllocation,
  type DashboardDayReading,
  type ReadingSale,
  type ReadingSettlement,
  type ReceiptEvent,
} from "@/lib/finance/operational-reading";

export type AurChannel = "unifor" | "acal" | "unknown";
export type AurEventType = "sale" | "credit" | "settlement" | "movement";

/** 60% salgados movimentados/encomendados + 40% sanduíches vendidos/preparados. */
export const GIRO_SALGADO_WEIGHT = 0.6;
export const GIRO_SANDWICH_WEIGHT = 0.4;
export const GIRO_FORMULA =
  "Giro = 60% × (salgados movimentados ÷ encomendados) + 40% × (sanduíches vendidos ÷ preparados). Mede o giro do estoque do dia. Não é diagnóstico financeiro.";

export interface AuroraMetrics {
  entries: number;
  cashResult: number;
  ownCost: number;
  theoreticalCost: number | null;
  competence: number;
  salesReceived: number;
  newCredit: number;
  priorSettlements: number;
  bonus: number;
  deposit: number;
  unclassifiedBankDelta: number | null;
  depositEqualsResult: boolean;
}

export interface AuroraGiro {
  score: number | null;
  label: string;
  detail: string;
  formula: string;
}

export interface AuroraTimelineEvent {
  id: string;
  date: string;
  time: string | null;
  name: string;
  detail: string;
  type: AurEventType;
  channel: AurChannel;
  value: number | null;
  noteRef?: string;
  allocations: CashAllocation[];
}

export interface AuroraFiado {
  id: string;
  client: string;
  product: string;
  value: number;
  channel: AurChannel;
}

export interface AuroraWalletItem {
  id: string;
  name: string;
  detail: string;
  amount: number;
  status: "acordo" | "confirmar" | "historico" | "aberto";
  statusLabel: string;
}

export interface AuroraTopClient {
  id: string;
  name: string;
  units: number;
}

export interface AuroraFlavor {
  name: string;
  units: number;
  identified: boolean;
}

export interface AuroraSnapshot {
  from: string;
  to: string;
  hasData: boolean;
  daysWithClosing: string[];
  daysWithoutClosing: string[];
  profileName: string;
  metrics: AuroraMetrics | null;
  giro: AuroraGiro | null;
  operation: {
    salgados: { ordered: number; moved: number; paid: number; fiado: number } | null;
    sandwiches: { produced: number; sold: number; paid: number; fiado: number; remaining: number } | null;
    transfer: { from: string; to: string; salgados: number; sandwiches: number } | null;
    stockFinal: string | null;
    flavors: AuroraFlavor[];
    channelSplitKnown: boolean;
  };
  timeline: AuroraTimelineEvent[];
  counts: { salesPaid: number; salesPending: number; salesTotal: number; receipts: number };
  fiados: AuroraFiado[];
  wallet: AuroraWalletItem[];
  walletOpenTotal: number;
  caveats: { id: string; title: string; text: string }[];
  topClients: AuroraTopClient[];
  readings: DashboardDayReading[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function normalizeChannel(raw: string | null | undefined): AurChannel {
  const value = (raw ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (value.includes("unifor")) return "unifor";
  if (value.includes("acal")) return "acal";
  return "unknown";
}

export function buildGiro(audit: DayClosingFinance["operationalAudit"] | undefined): AuroraGiro | null {
  if (!audit?.salgados && !audit?.sandwiches) return null;
  const ordered = audit.salgados?.initial;
  const moved = audit.salgados != null ? audit.salgados.initial - audit.salgados.final : null;
  const produced = audit.sandwiches?.initial;
  const sold =
    audit.sandwiches != null
      ? audit.sandwiches.initial - audit.sandwiches.counted - audit.sandwiches.ownConsumption
      : null;
  const salgadoRatio = ordered != null && ordered > 0 && moved != null ? moved / ordered : null;
  const sandwichRatio = produced != null && produced > 0 && sold != null ? sold / produced : null;
  const score =
    salgadoRatio != null && sandwichRatio != null
      ? Math.round(salgadoRatio * GIRO_SALGADO_WEIGHT * 100 + sandwichRatio * GIRO_SANDWICH_WEIGHT * 100)
      : null;
  const bits: string[] = [];
  if (moved != null && ordered != null) bits.push(`${moved} de ${ordered} salgados movimentados`);
  if (sold != null && produced != null) bits.push(`${sold} de ${produced} sanduíches vendidos`);
  return {
    score,
    label: "Giro do estoque",
    detail: bits.join(" · "),
    formula: GIRO_FORMULA,
  };
}

export function parseTransfer(notes: string[]): { salgados: number; sandwiches: number } | null {
  const blob = notes.join("\n");
  if (!/transfer/i.test(blob) || !/unifor/i.test(blob) || !/acal/i.test(blob)) return null;
  const match = blob.match(/(\d+)\s+salgados?\s+e\s+(\d+)\s+sandu[ií]ches?/i);
  if (!match?.[1] || !match[2]) return null;
  return { salgados: Number(match[1]), sandwiches: Number(match[2]) };
}

function saleChannel(sales: ReadingSale[], receipt: ReceiptEvent): AurChannel {
  const ids = new Set(receipt.allocations.map((a) => a.id));
  const channels = sales
    .filter((s) => ids.has(s.id))
    .map((s) => normalizeChannel(s.channel));
  const known = channels.filter((c) => c !== "unknown");
  if (known.length === 0) return "unknown";
  return known.every((c) => c === known[0]) ? known[0]! : "unknown";
}

function caveatFor(reading: DashboardDayReading, receiptId: string, payer: string): string | undefined {
  const hit = reading.caveats.find((c) => c.linkedReceiptIds.includes(receiptId));
  if (hit) return hit.id;
  const fold = payer.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (fold.includes("joao pedro")) return reading.caveats.find((c) => c.id === "R1")?.id;
  if (fold.includes("raimunda")) return reading.caveats.find((c) => c.id === "R2")?.id;
  return undefined;
}

function productLabel(sale: ReadingSale): string {
  const name = sale.product === "sanduiche" ? "sanduíche" : sale.product === "salgado" ? "salgado" : "item";
  const plural = sale.quantity === 1 ? name : name === "sanduíche" ? "sanduíches" : `${name}s`;
  return `${sale.quantity} ${plural}`;
}

export function buildDayTimeline(
  reading: DashboardDayReading,
  sales: ReadingSale[],
  closing: DayClosingFinance,
): AuroraTimelineEvent[] {
  const events: AuroraTimelineEvent[] = [];

  for (const receipt of reading.receipts) {
    const mixed = receipt.allocations.length > 1 || receipt.allocations.some((a) => a.kind !== "sale");
    const parts = receipt.allocations.map((a) => a.label);
    events.push({
      id: receipt.id,
      date: reading.date,
      time: receipt.time,
      name: receipt.payer,
      detail: mixed
        ? `Um recebimento, ${receipt.allocations.length} classificações: ${parts.join(" + ")}.`
        : parts.join(" + ") || "Recebimento",
      type: mixed ? "settlement" : "sale",
      channel: saleChannel(sales, receipt),
      value: receipt.gross,
      noteRef: caveatFor(reading, receipt.id, receipt.payer),
      allocations: receipt.allocations,
    });
  }

  for (const credit of reading.credits) {
    const sale = sales.find((s) => s.id === credit.id);
    events.push({
      id: credit.id,
      date: reading.date,
      time: credit.time,
      name: credit.person,
      detail: sale ? `${productLabel(sale)} · novo fiado` : "Novo fiado",
      type: "credit",
      channel: normalizeChannel(credit.channel),
      value: credit.amount,
      noteRef: reading.caveats.some((c) => c.id === "R3") ? "R3" : undefined,
      allocations: [],
    });
  }

  const notes = closing.reconciliation.notes;
  const transfer = parseTransfer(notes);
  if (transfer) {
    events.push({
      id: `${reading.date}-transfer`,
      date: reading.date,
      time: null,
      name: "Transferência Unifor → Acal",
      detail: `${transfer.salgados} salgados e ${transfer.sandwiches} sanduíche · estoque, não venda`,
      type: "movement",
      channel: "unknown",
      value: null,
      allocations: [],
    });
  }

  const counted = closing.operationalAudit?.sandwiches;
  if (counted && counted.counted > 0) {
    events.push({
      id: `${reading.date}-stock`,
      date: reading.date,
      time: counted.countedAt ?? null,
      name: "Conferência de estoque",
      detail: `${counted.counted} sanduíches físicos${counted.countedAt ? ` às ${counted.countedAt}` : ""}. Não são venda nem perda.`,
      type: "movement",
      channel: "acal",
      value: null,
      noteRef: reading.caveats.some((c) => c.id === "R4") ? "R4" : undefined,
      allocations: [],
    });
  }

  if (closing.costs.ownCost > 0) {
    events.push({
      id: `${reading.date}-cost`,
      date: reading.date,
      time: null,
      name: "Custo real pago",
      detail:
        reading.theoreticalCost != null
          ? "Saída efetiva do dia. O teórico permanece só como referência."
          : "Saída efetiva do dia.",
      type: "movement",
      channel: "unknown",
      value: -closing.costs.ownCost,
      noteRef: reading.caveats.some((c) => c.id === "R5") ? "R5" : undefined,
      allocations: [],
    });
  }

  if (closing.piggyBank.deposit > 0) {
    events.push({
      id: `${reading.date}-deposit`,
      date: reading.date,
      time: null,
      name: "Depósito no cofrinho",
      detail: "Transferência do resultado. Não é receita nova e não é o saldo.",
      type: "movement",
      channel: "unknown",
      value: -closing.piggyBank.deposit,
      noteRef: reading.caveats.some((c) => c.id === "R6") ? "R6" : undefined,
      allocations: [],
    });
  }

  return events.sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time) || a.name.localeCompare(b.name);
    if (a.time) return -1;
    if (b.time) return 1;
    return a.name.localeCompare(b.name);
  });
}

function operationOf(closing: DayClosingFinance, sales: ReadingSale[]) {
  const salgados = closing.operationalAudit?.salgados;
  const sandwiches = closing.operationalAudit?.sandwiches;
  const paidSalgado = sales
    .filter((s) => s.paymentStatus === "paid" && s.product === "salgado")
    .reduce((sum, s) => sum + s.quantity, 0);
  const fiadoSalgado = sales
    .filter((s) => s.paymentStatus !== "paid" && s.product === "salgado")
    .reduce((sum, s) => sum + s.quantity, 0);
  const paidSandwich = sales
    .filter((s) => s.paymentStatus === "paid" && s.product === "sanduiche")
    .reduce((sum, s) => sum + s.quantity, 0);
  const fiadoSandwich = sales
    .filter((s) => s.paymentStatus !== "paid" && s.product === "sanduiche")
    .reduce((sum, s) => sum + s.quantity, 0);
  const transfer = parseTransfer(closing.reconciliation.notes);
  const flavors = new Map<string, { units: number; identified: boolean }>();
  for (const sale of sales) {
    const identified = sale.product === "other";
    const name =
      sale.product === "sanduiche"
        ? "Sanduíche"
        : sale.product === "salgado"
          ? "Salgado (sabor não identificado)"
          : "Outro item";
    const row = flavors.get(name) ?? { units: 0, identified };
    row.units += sale.quantity;
    flavors.set(name, row);
  }
  const remaining = sandwiches?.counted ?? null;
  return {
    salgados: salgados
      ? {
          ordered: salgados.initial,
          moved: salgados.initial - salgados.final,
          paid: salgados.paidUnits || paidSalgado,
          fiado: Math.max(0, salgados.initial - salgados.paidUnits - salgados.lostUnits - salgados.final),
        }
      : null,
    sandwiches: sandwiches
      ? {
          produced: sandwiches.initial,
          sold: sandwiches.initial - sandwiches.counted - sandwiches.ownConsumption,
          paid: paidSandwich,
          fiado: fiadoSandwich,
          remaining: sandwiches.counted,
        }
      : null,
    transfer: transfer ? { from: "Unifor", to: "Acal", ...transfer } : null,
    stockFinal:
      remaining != null ? `${remaining} sanduíches${sandwiches?.countedAt ? ` às ${sandwiches.countedAt}` : ""}` : null,
    flavors: Array.from(flavors.entries()).map(([name, row]) => ({ name, ...row })),
    channelSplitKnown: false,
  };
}

function metricsOf(reading: DashboardDayReading): AuroraMetrics {
  return {
    entries: reading.entries,
    cashResult: reading.cashResult,
    ownCost: reading.ownCost,
    theoreticalCost: reading.theoreticalCost,
    competence: reading.competence,
    salesReceived: reading.salesReceived,
    newCredit: reading.newCredit,
    priorSettlements: reading.priorSettlements,
    bonus: reading.otherInflows,
    deposit: reading.deposit,
    unclassifiedBankDelta: reading.unclassifiedBankDelta,
    depositEqualsResult: Math.abs(reading.deposit - reading.cashResult) < 0.02,
  };
}

function addMetrics(base: AuroraMetrics, next: AuroraMetrics): AuroraMetrics {
  return {
    entries: round2(base.entries + next.entries),
    cashResult: round2(base.cashResult + next.cashResult),
    ownCost: round2(base.ownCost + next.ownCost),
    theoreticalCost:
      base.theoreticalCost == null && next.theoreticalCost == null
        ? null
        : round2((base.theoreticalCost ?? 0) + (next.theoreticalCost ?? 0)),
    competence: round2(base.competence + next.competence),
    salesReceived: round2(base.salesReceived + next.salesReceived),
    newCredit: round2(base.newCredit + next.newCredit),
    priorSettlements: round2(base.priorSettlements + next.priorSettlements),
    bonus: round2(base.bonus + next.bonus),
    deposit: round2(base.deposit + next.deposit),
    unclassifiedBankDelta: null,
    depositEqualsResult: false,
  };
}

export interface AuroraDayInput {
  closing: DayClosingFinance;
  sales: ReadingSale[];
  extraSettlements: ReadingSettlement[];
}

export function buildAuroraSnapshot(input: {
  from: string;
  to: string;
  days: Array<{
    date: string;
    closing: DayClosingFinance | null;
    sales: ReadingSale[];
    extraSettlements: ReadingSettlement[];
  }>;
  profileName: string;
  wallet?: AuroraWalletItem[];
  topClients?: AuroraTopClient[];
}): AuroraSnapshot {
  const closed = input.days.filter((d): d is AuroraDayInput & { date: string; closing: DayClosingFinance } => d.closing != null);
  const readings: DashboardDayReading[] = [];
  const timeline: AuroraTimelineEvent[] = [];
  const fiados: AuroraFiado[] = [];
  let metrics: AuroraMetrics | null = null;
  let counts = { salesPaid: 0, salesPending: 0, salesTotal: 0, receipts: 0 };
  let operation = {
    salgados: null as AuroraSnapshot["operation"]["salgados"],
    sandwiches: null as AuroraSnapshot["operation"]["sandwiches"],
    transfer: null as AuroraSnapshot["operation"]["transfer"],
    stockFinal: null as string | null,
    flavors: [] as AuroraFlavor[],
    channelSplitKnown: false,
  };
  const caveats: AuroraSnapshot["caveats"] = [];

  for (const day of closed) {
    const reading = buildOperationalReading({
      closing: day.closing,
      sales: day.sales,
      extraSettlements: day.extraSettlements,
    });
    readings.push(reading);
    const dayMetrics = metricsOf(reading);
    metrics = metrics ? addMetrics(metrics, dayMetrics) : dayMetrics;
    timeline.push(...buildDayTimeline(reading, day.sales, day.closing));
    for (const credit of reading.credits) {
      const sale = day.sales.find((s) => s.id === credit.id);
      fiados.push({
        id: credit.id,
        client: credit.person,
        product: sale ? productLabel(sale) : "fiado",
        value: credit.amount,
        channel: normalizeChannel(credit.channel),
      });
    }
    counts = {
      salesPaid: counts.salesPaid + day.sales.filter((s) => s.paymentStatus === "paid").length,
      salesPending: counts.salesPending + day.sales.filter((s) => s.paymentStatus !== "paid").length,
      salesTotal: counts.salesTotal + day.sales.length,
      receipts: counts.receipts + reading.receipts.length,
    };
    if (closed.length === 1) {
      operation = operationOf(day.closing, day.sales);
      for (const caveat of reading.caveats) {
        caveats.push({ id: caveat.id, title: caveat.id, text: caveat.text });
      }
    }
  }

  if (metrics) {
    metrics = {
      ...metrics,
      depositEqualsResult: Math.abs(metrics.deposit - metrics.cashResult) < 0.02,
    };
  }

  const wallet = input.wallet ?? [];
  const single = closed.length === 1 ? closed[0] : null;

  return {
    from: input.from,
    to: input.to,
    hasData: closed.length > 0,
    daysWithClosing: closed.map((d) => d.date),
    daysWithoutClosing: input.days.filter((d) => d.closing == null).map((d) => d.date),
    profileName: input.profileName,
    metrics,
    giro: single ? buildGiro(single.closing.operationalAudit) : null,
    operation,
    timeline,
    counts,
    fiados,
    wallet,
    walletOpenTotal: round2(wallet.filter((w) => w.status !== "historico").reduce((sum, w) => sum + w.amount, 0)),
    caveats,
    topClients: input.topClients ?? [],
    readings,
  };
}
