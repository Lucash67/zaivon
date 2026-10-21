/**
 * Leitura operacional de um dia a partir do fechamento canônico,
 * das vendas e das quitações extras. Não grava e não recalcula o caixa:
 * os totais vêm do dayClosing. As linhas só explicam a composição.
 */
import type { DayClosingFinance } from "@/lib/finance/day-closing";
import { redactPatrimonyText } from "@/lib/privacy/money-visibility";

export type ReadingConfidence = "confirmed" | "inferred_approved" | "to_verify";

export interface ReadingSale {
  id: string;
  time: string | null;
  clientName: string;
  quantity: number;
  total: number;
  product: "salgado" | "sanduiche" | "other";
  channel: string | null;
  paymentStatus: "paid" | "pending" | "partial";
  notes: string | null;
}

export interface ReadingSettlement {
  id: string;
  person: string;
  amount: number;
  paidDate: string;
  originDate: string;
  note?: string | undefined;
}

export interface CashAllocation {
  id: string;
  kind: "sale" | "prior_settlement" | "bonus";
  amount: number;
  label: string;
  confidence: ReadingConfidence;
}

/** Um recebimento original. As alocações são classificação, não um novo Pix. */
export interface ReceiptEvent {
  id: string;
  time: string | null;
  payer: string;
  gross: number;
  confidence: ReadingConfidence;
  allocations: CashAllocation[];
}

export interface CreditEvent {
  id: string;
  time: string | null;
  person: string;
  amount: number;
  quantity: number;
  product: ReadingSale["product"];
  channel: string | null;
  confidence: ReadingConfidence;
}

export interface DashboardCaveat {
  id: string;
  text: string;
  confidence: ReadingConfidence;
  linkedReceiptIds: string[];
}

export interface DashboardDayReading {
  date: string;
  entries: number;
  cashResult: number;
  ownCost: number;
  theoreticalCost: number | null;
  competence: number;
  salesReceived: number;
  newCredit: number;
  priorSettlements: number;
  otherInflows: number;
  deposit: number;
  /** Diferença informada − esperada, sem abrir o saldo. */
  unclassifiedBankDelta: number | null;
  receipts: ReceiptEvent[];
  credits: CreditEvent[];
  caveats: DashboardCaveat[];
  stock: {
    salgadosFinal: number | null;
    sandwichesCounted: number | null;
    sandwichesCountedAt: string | null;
  };
  warnings: string[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseMoneyToken(raw: string): number {
  const t = raw.trim();
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", "."));
  return Number(t);
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function confidenceOf(note: string): ReadingConfidence {
  if (/a apurar/i.test(note)) return "to_verify";
  if (/infer[eê]ncia aprovada|n[aã]o confirmad|\binferid/i.test(note)) return "inferred_approved";
  return "confirmed";
}

function clockIn(note: string): string | null {
  if (/hor[aá]rio n[aã]o informado|âncora t[eé]cnica/i.test(note)) return null;
  const m = note.match(/\b([01]\d|2[0-3]):[0-5]\d\b/);
  return m ? m[0] : null;
}

function pixGross(note: string): number | null {
  const m =
    note.match(/parte de um pix de R\$\s*([\d.]+(?:,\d{2})?)/i) ||
    note.match(/pix(?:\s+\S+){0,3}?\s+R\$\s*([\d.]+(?:,\d{2})?)/i);
  if (!m?.[1]) return null;
  const n = parseMoneyToken(m[1]);
  return Number.isFinite(n) ? n : null;
}

function theoreticalFrom(closing: DayClosingFinance): number | null {
  const blob = [
    ...(closing.costs.ownCostPaymentDates ?? []).map((d) => d.note ?? ""),
    ...closing.reconciliation.notes,
  ].join("\n");
  const m = blob.match(/te[oó]rico(?:\s+total)?\s+R\$\s*([\d.]+(?:,\d{2})?)/i);
  if (!m?.[1]) return null;
  const n = parseMoneyToken(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function buildOperationalReading(input: {
  closing: DayClosingFinance;
  sales: ReadingSale[];
  extraSettlements: ReadingSettlement[];
}): DashboardDayReading {
  const { closing, sales, extraSettlements } = input;
  const warnings: string[] = [];
  const daySettlements = extraSettlements.filter((s) => s.paidDate === closing.date);

  type Piece = {
    payer: string;
    time: string | null;
    grossHint: number | null;
    allocation: CashAllocation;
  };
  const pieces: Piece[] = [];

  for (const sale of sales) {
    if (sale.paymentStatus !== "paid") continue;
    const note = sale.notes ?? "";
    const notedTime = clockIn(note);
    const anchor = /hor[aá]rio n[aã]o informado|âncora t[eé]cnica/i.test(note);
    pieces.push({
      payer: sale.clientName,
      time: anchor ? null : notedTime ?? sale.time,
      grossHint: pixGross(note),
      allocation: {
        id: sale.id,
        kind: "sale",
        amount: sale.total,
        label: `${sale.quantity}× ${sale.product === "sanduiche" ? "sanduíche" : "salgado"}`,
        confidence: confidenceOf(note),
      },
    });
  }

  const paidPieces = pieces.filter((p) => p.allocation.amount > 0);
  const credits: CreditEvent[] = sales
    .filter((s) => s.paymentStatus !== "paid")
    .map((s) => ({
      id: s.id,
      time: clockIn(s.notes ?? ""),
      person: s.clientName,
      amount: s.total,
      quantity: s.quantity,
      product: s.product,
      channel: s.channel,
      confidence: confidenceOf(s.notes ?? ""),
    }));

  for (const s of daySettlements) {
    const note = s.note ?? "";
    paidPieces.push({
      payer: s.person,
      time: clockIn(note),
      grossHint: pixGross(note),
      allocation: {
        id: s.id,
        kind: "prior_settlement",
        amount: s.amount,
        label: "quitação não vinculada",
        confidence: confidenceOf(note),
      },
    });
  }

  let bonusLeft = closing.cash.otherInflows;
  const bonusHost = paidPieces.find((p) => /b[oô]nus/i.test(daySettlements.find((s) => s.id === p.allocation.id)?.note ?? ""));
  if (bonusHost && bonusLeft > 0) {
    const room = bonusHost.grossHint != null ? round2(bonusHost.grossHint - bonusHost.allocation.amount) : bonusLeft;
    const take = round2(Math.min(bonusLeft, room > 0 ? room : bonusLeft));
    if (take > 0) {
      paidPieces.push({
        payer: bonusHost.payer,
        time: bonusHost.time,
        grossHint: bonusHost.grossHint,
        allocation: {
          id: `${bonusHost.allocation.id}-bonus`,
          kind: "bonus",
          amount: take,
          label: "bônus",
          confidence: bonusHost.allocation.confidence,
        },
      });
      bonusLeft = round2(bonusLeft - take);
    }
  }
  if (bonusLeft > 0.001) {
    paidPieces.push({
      payer: "Outras entradas",
      time: null,
      grossHint: null,
      allocation: {
        id: `${closing.date}-other-inflows`,
        kind: "bonus",
        amount: bonusLeft,
        label: "outras entradas",
        confidence: "to_verify",
      },
    });
  }

  const groups = new Map<string, Piece[]>();
  for (const piece of paidPieces) {
    const key =
      piece.grossHint != null && piece.time
        ? `${fold(piece.payer)}|${piece.time}|${piece.grossHint}`
        : `solo|${piece.allocation.id}`;
    const list = groups.get(key) ?? [];
    list.push(piece);
    groups.set(key, list);
  }

  const receipts: ReceiptEvent[] = [];
  for (const [key, list] of Array.from(groups.entries())) {
    const head = list[0]!;
    const allocations = list.map((p) => p.allocation);
    const sum = round2(allocations.reduce((s, a) => s + a.amount, 0));
    const gross = head.grossHint != null && list.every((p) => p.grossHint === head.grossHint) ? head.grossHint : sum;
    if (Math.abs(gross - sum) > 0.02) {
      warnings.push(`Recebimento ${key}: bruto ${gross} ≠ alocações ${sum}`);
    }
    const rank = { confirmed: 0, inferred_approved: 1, to_verify: 2 } as const;
    const confidence = allocations.reduce<ReadingConfidence>(
      (acc, a) => (rank[a.confidence] > rank[acc] ? a.confidence : acc),
      "confirmed",
    );
    receipts.push({
      id: key.startsWith("solo|") ? head.allocation.id : `pix-${key}`,
      time: head.time,
      payer: head.payer,
      gross,
      confidence,
      allocations,
    });
  }

  const cashFromLines = round2(
    receipts.flatMap((r) => r.allocations).reduce((s, a) => s + a.amount, 0),
  );
  if (Math.abs(cashFromLines - closing.cash.cashIn) > 0.02) {
    warnings.push(`Alocações ${cashFromLines} ≠ caixa do fechamento ${closing.cash.cashIn}`);
  }
  const paidSum = round2(sales.filter((s) => s.paymentStatus === "paid").reduce((s, x) => s + x.total, 0));
  if (Math.abs(paidSum - closing.cash.salesReceived) > 0.02) {
    warnings.push(`Vendas pagas ${paidSum} ≠ salesReceived ${closing.cash.salesReceived}`);
  }
  const creditSum = round2(credits.reduce((s, c) => s + c.amount, 0));
  if (Math.abs(creditSum - closing.newCredit) > 0.02) {
    warnings.push(`Fiados ${creditSum} ≠ newCredit ${closing.newCredit}`);
  }

  const piggy = closing.piggyBank;
  const expected = round2(piggy.openingBalance + piggy.deposit - piggy.withdrawal + piggy.bankYield);
  const delta = round2(piggy.closingBalance - expected);

  const caveats: DashboardCaveat[] = closing.reconciliation.notes
    .filter((n) => /^R\d\b/.test(n))
    .map((n) => {
      const id = n.slice(0, 2);
      const text = redactPatrimonyText(n);
      const linked = receipts
        .filter((r) => fold(text).includes(fold(r.payer).slice(0, 12)) || (id === "R1" && /joao pedro/i.test(fold(r.payer))) || (id === "R2" && /raimunda/i.test(fold(r.payer))))
        .map((r) => r.id);
      return {
        id,
        text,
        confidence: confidenceOf(n),
        linkedReceiptIds: linked,
      };
    });

  return {
    date: closing.date,
    entries: closing.cash.cashIn,
    cashResult: closing.cashManagementResult,
    ownCost: closing.costs.ownCost,
    theoreticalCost: theoreticalFrom(closing),
    competence: closing.competenceRevenue,
    salesReceived: closing.cash.salesReceived,
    newCredit: closing.newCredit,
    priorSettlements: closing.cash.priorSettlements,
    otherInflows: closing.cash.otherInflows,
    deposit: piggy.deposit,
    unclassifiedBankDelta: Math.abs(delta) > 0.001 ? delta : 0,
    receipts,
    credits,
    caveats,
    stock: {
      salgadosFinal: closing.operationalAudit?.salgados?.final ?? null,
      sandwichesCounted: closing.operationalAudit?.sandwiches?.counted ?? null,
      sandwichesCountedAt: closing.operationalAudit?.sandwiches?.countedAt ?? null,
    },
    warnings,
  };
}
