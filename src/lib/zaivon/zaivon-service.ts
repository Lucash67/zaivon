import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getPostgresDb } from "@/platform/db";
import { toDbBusinessId } from "@/platform/db/business-id";
import { queryAll, queryRun } from "@/platform/db/query";
import {
  clients,
  dailyInvestments,
  diaryEntries,
  operationDays,
  operationalPendings,
  products,
  saleItems,
  sales,
  stockMovements,
} from "@/lib/db/postgres/schema";
import { listSettingsMap, upsertSetting } from "@/platform/db/repositories/settings-repository";
import { createClient, listClientsRaw } from "@/platform/db/repositories/client-repository";
import { createProduct, listProducts } from "@/platform/db/repositories/product-repository";
import { countSalesForDate } from "@/platform/db/repositories/sale-repository";
import { ensureOperationDayId } from "@/platform/db/repositories/operation-day-repository";
import { executeSaleOperation } from "@/domains/sales/sale-operation-handler";
import { commitDayRegistration, previewDayRegistration } from "@/lib/day-registration/day-registration-service";
import type { DayRegistrationPreview } from "@/lib/day-registration/types";
import { getDiaryEntry, listDiaryEntries, upsertDiaryEntry } from "@/lib/diary-service";
import { deriveDiaryTotalProfit, DIARY_SCHEMA_VERSION, type OperationalDiaryEntry } from "@/lib/diary/types";
import { setPracticalProfitBankBalance } from "@/lib/profit-bank-service";
import { SALGADOS_BUSINESS_ID } from "@/lib/business-units";
import { UNIDENTIFIED_FLAVOR_PRODUCT_NAME } from "@/lib/salgados-flavors";
import { normalizeSaleShiftTime } from "@/lib/sale-shift";
import { generateId } from "@/shared/ids/generate-id";
import { getMonthPlan } from "@/lib/planning/month-plans";
import { round2, settlementsOn } from "@/lib/zaivon/finance/day";
import { buildDeclaredReferences } from "@/lib/zaivon/finance/debt-reading";
import { loadVaultSnapshot } from "@/lib/vault/vault-service";
import { parseDraftFinancials, type DraftFinancials } from "@/lib/zaivon/finance/draft-financials";
import { ZAIVON_CHANNELS, ZAIVON_PRODUCTS } from "@/lib/zaivon/catalog";
import type {
  Channel,
  ClosureStatus,
  Debt,
  DebtType,
  HistoryDay,
  MonthPlan,
  ZaivonData,
  OperationDay,
  PaymentMethod,
  ProductId,
  RegisteredSale,
  Settlement,
  StockReading,
} from "@/lib/zaivon/types";

const BUSINESS = SALGADOS_BUSINESS_ID;
// Chave gravada em settings no banco (cofrinho, fechamentos): não renomear.
const META_KEY = `omni_v2_meta_${BUSINESS}`;
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Dados do dia que não existem nas tabelas do diário. */
interface ProvisionalReceivableLine {
  id: string;
  date: string;
  amount: number;
  /** Só a linha de 21/10 entra na competência; as anteriores existem para a carteira. */
  inCompetence: boolean;
  description: string;
}

interface ProvisionalReceivable {
  id: string;
  label: string;
  promiseDate?: string;
  lines: ProvisionalReceivableLine[];
}

interface ZaivonMeta {
  /** Cofrinho prático informado no fim de cada dia. */
  cofrinho: Record<string, number>;
  closure: Record<string, { status: ClosureStatus; note?: string }>;
  /** Quitações que entraram no caixa sem venda pendente no sistema. */
  extraSettlements: Settlement[];
  /** Vendas pendentes que o dono baixou como perda. */
  lossSaleIds: string[];
  /** Crédito com saldo. Não é fiado e não é entrada de caixa. */
  customerCredits?: unknown[];
  /** Compromissos cuja identidade ainda não pode ir para um cartão. */
  provisionalReceivables?: ProvisionalReceivable[];
  /** Diferença entre o fechamento anterior e a abertura informada. */
  openingBridges?: unknown[];
  /** Confirmação fora da cobrança. Não é recebível. */
  henriqueConfirmations?: Array<{ amount?: number; receivable?: boolean }>;
}

const EMPTY_META: ZaivonMeta = { cofrinho: {}, closure: {}, extraSettlements: [], lossSaleIds: [] };

const JOAO_LUCAS_TOKEN = "IDENTITY-PENDING:zaivon-2026-10-21-joao-lucas-identity-pending";

async function readMeta(): Promise<ZaivonMeta> {
  const raw = (await listSettingsMap())[META_KEY];
  if (!raw) return { ...EMPTY_META };
  try {
    return { ...EMPTY_META, ...(JSON.parse(raw) as Partial<ZaivonMeta>) };
  } catch {
    return { ...EMPTY_META };
  }
}

async function writeMeta(meta: ZaivonMeta): Promise<void> {
  await upsertSetting(META_KEY, JSON.stringify(meta));
}

export function todayFortaleza(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(now);
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function previousMonthKey(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 2, 1));
  return d.toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_LABELS[m! - 1]}/${y}`;
}

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
}

function isWeekday(date: string) {
  const wd = new Date(date + "T12:00:00Z").getUTCDay();
  return wd >= 1 && wd <= 5;
}

function resolvePlan(month: string, realizedProfit: number, realizedDays: number): MonthPlan {
  const base = getMonthPlan(month);
  if (!base) {
    const avg = realizedDays ? round2(realizedProfit / realizedDays) : 0;
    return {
      month,
      label: `${monthLabel(month)} (sem meta)`,
      goal: Math.max(1, round2(realizedProfit)),
      dailyTarget: avg,
      holidays: [],
      practicalAtStart: 0,
      historical: true,
      scenarios: { conservative: avg, ambitious: avg },
      indicators: { profitPerDay: avg, unitsPerDay: [0, 0], ownCapitalPerDay: [0, 0], thirdPartyMaxPerDay: 0, maxLossesPerDay: 0 },
    };
  }
  const t = base.targets;
  return {
    month: base.month,
    label: base.label,
    goal: base.goal,
    dailyTarget: base.dailyTarget,
    holidays: base.holidays,
    practicalAtStart: base.practicalAtStart ?? 0,
    bankDeposited: base.bankDeposited,
    scenarios: base.scenarios,
    indicators: {
      profitPerDay: t?.profitPerDay ?? base.dailyTarget,
      unitsPerDay: t?.unitsPerDay ?? [0, 0],
      ownCapitalPerDay: t?.ownCapitalPerDay ?? [0, 0],
      thirdPartyMaxPerDay: t?.thirdPartyMaxPerDay ?? 0,
      maxLossesPerDay: t?.maxLossesPerDay ?? 0,
    },
  };
}

function debtType(clientName: string): DebtType {
  if (/n[ãa]o identificad|n[ãa]o reconhecid|desconhecid|retirada n[ãa]o identificad/i.test(clientName))
    return "investigacao";
  if (/meia sola/i.test(clientName)) return "parceiro";
  return "fiado";
}

/**
 * Acordos de cobrança diferida (não listar como “Cobrar agora” até a data).
 * Ana Laura: acumular até o 5º dia útil de novembro / quitação à noite.
 */
const COLLECTION_DEFERRED_UNTIL: Record<string, string> = {
  "Ana Laura": "2026-11-07",
};

function deferredUntilFor(clientName: string): string | undefined {
  for (const [name, until] of Object.entries(COLLECTION_DEFERRED_UNTIL)) {
    if (clientName === name || clientName.startsWith(name + " ")) return until;
  }
  return undefined;
}

function describeItems(items: { product: string; qty: number }[]): string {
  let salgados = 0;
  let sanduiches = 0;
  for (const i of items) {
    if (/sandu/i.test(i.product)) sanduiches += i.qty;
    else salgados += i.qty;
  }
  const parts: string[] = [];
  if (salgados) parts.push(`${salgados} ${salgados === 1 ? "salgado" : "salgados"}`);
  if (sanduiches) parts.push(`${sanduiches} ${sanduiches === 1 ? "sanduíche" : "sanduíches"}`);
  return parts.join(" + ") || "venda";
}

interface SaleRow {
  id: string;
  saleDate: string;
  settlementDate: string | null;
  paymentStatus: string;
  totalAmount: string;
  amountReceived: string;
  clientName: string | null;
  notes: string | null;
}

async function loadSalesForZaivon(from: string): Promise<{ open: SaleRow[]; settled: SaleRow[]; items: Map<string, { product: string; qty: number }[]> }> {
  const db = await getPostgresDb();
  const businessDbId = toDbBusinessId(BUSINESS);
  const select = {
    id: sales.id,
    saleDate: sales.saleDate,
    settlementDate: sales.settlementDate,
    paymentStatus: sales.paymentStatus,
    totalAmount: sales.totalAmount,
    amountReceived: sales.amountReceived,
    clientName: clients.name,
    notes: sales.notes,
  };
  const [open, settled] = await Promise.all([
    queryAll(
      db
        .select(select)
        .from(sales)
        .leftJoin(clients, eq(clients.id, sales.clientId))
        .where(and(eq(sales.businessId, businessDbId), inArray(sales.paymentStatus, ["pending", "partial"])))
        .orderBy(asc(sales.saleDate)),
    ),
    queryAll(
      db
        .select(select)
        .from(sales)
        .leftJoin(clients, eq(clients.id, sales.clientId))
        .where(
          and(
            eq(sales.businessId, businessDbId),
            inArray(sales.paymentStatus, ["paid", "partial"]),
            gte(sales.settlementDate, from),
          ),
        ),
    ),
  ]);
  const ids = open.map((r) => r.id);
  const itemRows = ids.length
    ? await queryAll(
        db
          .select({ saleId: saleItems.saleId, qty: saleItems.quantity, product: products.name })
          .from(saleItems)
          .innerJoin(products, eq(products.id, saleItems.productId))
          .where(inArray(saleItems.saleId, ids)),
      )
    : [];
  const items = new Map<string, { product: string; qty: number }[]>();
  for (const r of itemRows) items.set(r.saleId, [...(items.get(r.saleId) ?? []), { product: r.product, qty: r.qty }]);
  return {
    open: open as SaleRow[],
    settled: (settled as SaleRow[]).filter((s) => s.settlementDate && s.settlementDate > s.saleDate),
    items,
  };
}

async function loadMonthSales(month: string): Promise<Map<string, RegisteredSale[]>> {
  const db = await getPostgresDb();
  const rows = await queryAll(
    db
      .select({
        id: sales.id,
        saleDate: sales.saleDate,
        saleTime: sales.saleTime,
        paymentStatus: sales.paymentStatus,
        totalAmount: sales.totalAmount,
        clientName: clients.name,
        notes: sales.notes,
      })
      .from(sales)
      .leftJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, toDbBusinessId(BUSINESS)),
          gte(sales.saleDate, `${month}-01`),
          lte(sales.saleDate, lastDayOfMonth(month)),
        ),
      )
      .orderBy(asc(sales.saleDate), asc(sales.saleTime)),
  );
  const ids = rows.map((r) => r.id);
  const itemRows = ids.length
    ? await queryAll(
        db
          .select({ saleId: saleItems.saleId, qty: saleItems.quantity, product: products.name })
          .from(saleItems)
          .innerJoin(products, eq(products.id, saleItems.productId))
          .where(inArray(saleItems.saleId, ids)),
      )
    : [];
  const items = new Map<string, { product: string; qty: number }[]>();
  for (const r of itemRows) items.set(r.saleId, [...(items.get(r.saleId) ?? []), { product: r.product, qty: r.qty }]);
  const byDate = new Map<string, RegisteredSale[]>();
  for (const r of rows) {
    const its = items.get(r.id) ?? [];
    const notes = r.notes ?? "";
    const identityPending = notes.includes(JOAO_LUCAS_TOKEN);
    const prepaid = notes.includes("PREPAID-APPLIED:");
    const credit = notes.includes("CREDIT-APPLIED:");
    if (notes.includes("MIGRATED-2210-PIX-140")) continue;
    const aggregate = notes.includes("AGGREGATE-2210");
    const courtesy = notes.includes("CORTESIA-2210");
    const partialBuyer = notes.includes("PARCIAL-2210:Francisco de Assis");
    const informedName = notes.match(/NOME-INFORMADO:([^|]+)/);
    const local = notes.match(/LOCAL:([A-Za-z]+)/);
    const confidence = notes.match(/CONFIANCA:(confirmado|provisorio)/);
    const timeConfidence = notes.match(/HORARIO-CONFIANCA:(comprovado|estimado|nao-informado)/)?.[1] as
      | "comprovado"
      | "estimado"
      | "nao-informado"
      | undefined;
    const receipt = notes.includes("RECEBIMENTO-SEM-COMPOSICAO");
    const extra = prepaid
      ? " Pré-pago aplicado, sem Pix em 21/10."
      : credit
        ? " Crédito aplicado, sem Pix novo."
        : aggregate
          ? " Consolidado do fechamento, sem lista nominal."
          : courtesy
            ? " Cortesia, valor recebido zero."
            : partialBuyer
              ? " Espécie líquida de R$10. Identidade incompleta."
              : local
                ? ` ${local[1]}, classificação ${confidence?.[1] ?? "não informada"}.`
                : "";
    const sale: RegisteredSale = {
      id: r.id,
      time: r.saleTime ? String(r.saleTime).slice(0, 5) : "",
      timeConfidence,
      receiptWithoutComposition: receipt || undefined,
      person: identityPending
        ? "João Lucas (identidade pendente)"
        : credit
          ? "Vanderson (identidade pendente)"
          : partialBuyer
            ? "Francisco de Assis (identidade incompleta)"
            : aggregate
              ? "Vendas de salgados sem lista nominal"
              : informedName
                ? `${informedName[1].trim()} (vínculo pendente)`
                : (r.clientName ?? "Sem nome"),
      description: receipt ? "Pix Acal, composição não identificada" : `${describeItems(its)}${extra}`,
      qty: its.reduce((s, i) => s + i.qty, 0),
      amount: round2(Number(r.totalAmount) || 0),
      status: r.paymentStatus as RegisteredSale["status"],
    };
    byDate.set(r.saleDate, [...(byDate.get(r.saleDate) ?? []), sale]);
  }
  return byDate;
}

/** Meses com diário — query leve (só datas), sem narrative/relacionados. */
async function listAvailableDiaryMonths(): Promise<string[]> {
  const db = await getPostgresDb();
  const rows = await queryAll(
    db
      .select({ date: operationDays.operationDate })
      .from(operationDays)
      .innerJoin(diaryEntries, eq(diaryEntries.operationDayId, operationDays.id))
      .where(eq(operationDays.businessId, toDbBusinessId(BUSINESS)))
      .orderBy(asc(operationDays.operationDate)),
  );
  return Array.from(new Set(rows.map((r) => monthKey(r.date))));
}

export async function getZaivonData(requestedMonth?: string): Promise<ZaivonData> {
  const today = todayFortaleza();
  const month = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : monthKey(today);
  const prevMonth = previousMonthKey(month);
  const from = `${prevMonth}-01`;
  const to = lastDayOfMonth(month);

  // Sequencial de propósito: pool serverless max=3. Promise.all com
  // listDiaryEntries + sales estoura conexões e vira statement_timeout eterno no /v2.
  const entries = await listDiaryEntries(BUSINESS, from, to);
  const meta = await readMeta();
  const salesData = await loadSalesForZaivon(from);
  const monthSales = await loadMonthSales(month);
  const monthKeys = await listAvailableDiaryMonths();

  const monthEntries = entries.filter((e) => e.date.startsWith(month));
  const plan = resolvePlan(
    month,
    monthEntries.reduce((s, e) => s + deriveDiaryTotalProfit(e), 0),
    monthEntries.length,
  );
  const monthsWithData = new Set(monthKeys);
  monthsWithData.add(monthKey(today));
  monthsWithData.add(month);
  const availableMonths = Array.from(monthsWithData)
    .sort()
    .reverse()
    .map((m) => ({ month: m, label: getMonthPlan(m)?.label ?? monthLabel(m) }));

  const settlements: Settlement[] = [
    ...salesData.settled.map((s) => ({
      id: s.id,
      person: s.clientName ?? "Cliente",
      originDate: s.saleDate,
      paidDate: s.settlementDate!,
      amount: round2(Number(s.amountReceived) || Number(s.totalAmount) || 0),
    })),
    ...meta.extraSettlements.filter((s) => s.paidDate >= from),
  ];

  const lost = new Set(meta.lossSaleIds);
  const debts: Debt[] = salesData.open.map((s) => {
    const identityPending = (s.notes ?? "").includes(JOAO_LUCAS_TOKEN);
    const informedName = (s.notes ?? "").match(/NOME-INFORMADO:([^|]+)/);
    const name = identityPending
      ? "João Lucas (identidade pendente)"
      : informedName
        ? `${informedName[1].trim()} (vínculo pendente)`
        : (s.clientName ?? "Não identificado");
    const type = identityPending || informedName ? "fiado" : debtType(name);
    const person = type === "investigacao" ? "Não identificado" : name;
    return {
      id: s.id,
      person,
      type,
      originDate: s.saleDate,
      amount: round2(Number(s.totalAmount) || 0),
      paid: round2(s.paymentStatus === "partial" ? Number(s.amountReceived) || 0 : 0),
      description: describeItems(salesData.items.get(s.id) ?? []),
      status: lost.has(s.id) ? "loss" : "open",
      deferredUntil: identityPending ? "2026-10-30" : deferredUntilFor(person),
    };
  });
  for (const book of meta.provisionalReceivables ?? []) {
    for (const line of book.lines) {
      if (line.inCompetence) continue;
      if (debts.some((d) => d.id === line.id)) continue;
      debts.push({
        id: line.id,
        person: book.label,
        type: "fiado",
        originDate: line.date,
        amount: round2(line.amount),
        paid: 0,
        description: line.description,
        status: "open",
        deferredUntil: book.promiseDate,
        referenceOnly: /n[aã]o é venda/i.test(line.description) || undefined,
      });
    }
  }

  const unlinked = await loadUnlinkedUnits();
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const days: OperationDay[] = sorted
    .filter((e) => e.date.startsWith(plan.month))
    .map((e) => {
      const dc = e.dayClosing;
      const received = e.revenue.received;
      const ownCost = dc?.costs.ownCost ?? Math.max(0, round2(received - e.profit));
      const investment = e.purchase?.investment;
      const thirdPartyCost =
        dc?.costs.thirdPartyCost ??
        (investment != null ? Math.max(0, round2(investment - ownCost)) : 0);
      const closure = meta.closure[e.date];
      const priorOnDay = dc?.cash.priorSettlements ?? settlementsOn(e.date, settlements);
      return {
        date: e.date,
        receivedBase: dc ? dc.cash.salesReceived : round2(received - priorOnDay),
        ownCost,
        thirdPartyCost,
        bonus: e.bonusIncome ?? 0,
        bonusNote: e.bonusIncomeDescription,
        purchaseUnits: e.purchase?.totalUnits,
        purchaseCost: investment ?? dc?.costs.totalNewCost,
        soldUnits: e.quantitySold,
        lostUnits: e.quantityLost,
        cofrinhoEnd: meta.cofrinho[e.date] ?? dc?.piggyBank.closingBalance ?? null,
        lines: [],
        closure: closure?.status ?? "summary",
        closureNote: closure?.note,
        observations: e.observations,
        registeredSales: monthSales.get(e.date),
        competenceRevenue: dc?.competenceRevenue,
        competenceProfit: dc?.competenceProfit,
        competenceStatus: dc?.competenceStatus,
        newCredit: dc?.newCredit,
        dayClosing: dc,
        snapshotPending: e.revenue.pending,
        unlinkedUnits: unlinked.get(e.date),
      };
    });

  const prevEntries = sorted.filter((e) => e.date.startsWith(prevMonth) && isWeekday(e.date));
  const previousHistory: HistoryDay[] = prevEntries.map((e) => ({
    date: e.date,
    profit: deriveDiaryTotalProfit(e),
    bonus: e.bonusIncome ?? 0,
  }));
  const prevCount = prevEntries.length || 1;

  return {
    plan,
    days,
    debts,
    settlements,
    previousHistory,
    previousMonth: {
      month: prevMonth,
      label: monthLabel(prevMonth),
      avgCashPerDay: round2(prevEntries.reduce((s, e) => s + e.revenue.received, 0) / prevCount),
      avgOwnCostPerDay: round2(
        prevEntries.reduce((s, e) => s + Math.max(0, e.revenue.received - e.profit), 0) / prevCount,
      ),
    },
    today,
    availableMonths,
    vault: await loadVaultSnapshot(BUSINESS),
    stockReadings: await loadStockReadings(),
    declaredReferences: buildDeclaredReferences(
      debts,
      (meta.henriqueConfirmations ?? []).map((item) => ({
        person: "Henrique",
        amount: Number(item.amount) || 0,
        receivable: item.receivable === true,
      })),
    ),
  };
}

const DAILY_STOCK_IDS = [
  "b1161a39-149e-475c-9eb1-345553006c0d",
  "4da6e5b2-86ad-4f3e-8e71-9492f43f8291",
];

async function loadUnlinkedUnits(): Promise<Map<string, number>> {
  const db = await getPostgresDb();
  const rows = await queryAll(
    db
      .select({ date: operationDays.operationDate, quantity: stockMovements.quantity })
      .from(stockMovements)
      .innerJoin(operationDays, eq(stockMovements.operationDayId, operationDays.id))
      .where(sql`${stockMovements.reason} ilike '%saida-sem-vinculo%'`),
  );
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.date, (totals.get(row.date) ?? 0) + row.quantity);
  return totals;
}

async function loadStockReadings(): Promise<StockReading[]> {
  const db = await getPostgresDb();
  const catalog = await queryAll(
    db
      .select({ id: products.id, name: products.name, stock: products.stockQuantity })
      .from(products)
      .where(inArray(products.id, DAILY_STOCK_IDS)),
  );
  const pendings = await queryAll(
    db
      .select({
        id: operationalPendings.id,
        productId: operationalPendings.productId,
        quantity: operationalPendings.quantity,
        description: operationalPendings.description,
        dayId: operationalPendings.operationDayId,
      })
      .from(operationalPendings)
      .where(and(
        eq(operationalPendings.status, "open"),
        eq(operationalPendings.pendingType, "inventory_investigation"),
        inArray(operationalPendings.productId, DAILY_STOCK_IDS),
      )),
  );
  const dayIds = Array.from(new Set(pendings.map((row) => row.dayId)));
  const days = dayIds.length === 0
    ? []
    : await queryAll(
      db.select({ id: operationDays.id, date: operationDays.operationDate }).from(operationDays).where(inArray(operationDays.id, dayIds)),
    );
  const dates = new Map(days.map((row) => [row.id, row.date]));
  return catalog.map((product) => ({
    productId: product.id,
    name: product.name,
    bookQuantity: product.stock,
    openInvestigations: pendings
      .filter((row) => row.productId === product.id)
      .map((row) => ({
        id: row.id,
        date: dates.get(row.dayId) ?? "",
        quantity: row.quantity,
        summary: row.description.slice(0, 180),
      })),
  }));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function setDayCofrinho(date: string, amount: number): Promise<void> {
  if (!ISO_DATE.test(date) || !(amount > 0)) throw new Error("Data ou valor inválido.");
  const meta = await readMeta();
  meta.cofrinho[date] = round2(amount);
  await writeMeta(meta);
  const latest = Object.keys(meta.cofrinho).sort().at(-1);
  if (latest === date) await setPracticalProfitBankBalance(BUSINESS, amount);
}

export async function closeDay(
  date: string,
  status: ClosureStatus,
  note?: string,
  cofrinho?: number,
): Promise<void> {
  if (!ISO_DATE.test(date)) throw new Error("Data inválida.");
  if (cofrinho != null && cofrinho > 0) await setDayCofrinho(date, cofrinho);
  const meta = await readMeta();
  meta.closure[date] = { status, ...(note?.trim() ? { note: note.trim() } : {}) };
  await writeMeta(meta);
}

export async function markDebtAsLoss(saleId: string): Promise<void> {
  const meta = await readMeta();
  if (!meta.lossSaleIds.includes(saleId)) meta.lossSaleIds.push(saleId);
  await writeMeta(meta);
}

/** Soma uma quitação ao caixa do dia em que entrou (cria o dia se ainda não existir). */
async function addSettlementToDiary(paidDate: string, amount: number, note: string): Promise<void> {
  const entry = await getDiaryEntry(BUSINESS, paidDate);
  if (!entry) {
    await upsertDiaryEntry({
      version: DIARY_SCHEMA_VERSION,
      businessId: BUSINESS,
      date: paidDate,
      revenue: { received: amount, pending: 0, total: amount },
      profit: amount,
      quantitySold: 0,
      quantityLost: 0,
      observations: note,
    });
    return;
  }
  const { id: _id, createdAt: _createdAt, ...rest } = entry;
  await upsertDiaryEntry({
    ...rest,
    revenue: { ...rest.revenue, received: round2(rest.revenue.received + amount) },
    profit: round2(rest.profit + amount),
    observations: [rest.observations, note].filter(Boolean).join("\n"),
  });
}

async function reduceDiaryPending(originDate: string, amount: number): Promise<void> {
  const entry = await getDiaryEntry(BUSINESS, originDate);
  if (!entry || entry.revenue.pending <= 0) return;
  const { id: _id, createdAt: _createdAt, ...rest } = entry;
  await upsertDiaryEntry({
    ...rest,
    revenue: { ...rest.revenue, pending: Math.max(0, round2(rest.revenue.pending - amount)) },
  });
}

/**
 * Registra o pagamento de uma pessoa: quita as vendas pendentes mais antigas primeiro.
 * O dinheiro conta no caixa de `paidDate` (o dia em que entrou no banco).
 */
export async function registerPayment(
  person: string,
  amount: number,
  paidDate: string,
  { addToDiary = true }: { addToDiary?: boolean } = {},
): Promise<{ settled: number; extra: number }> {
  if (!person.trim() || !(amount > 0) || !ISO_DATE.test(paidDate)) throw new Error("Pessoa, valor ou data inválidos.");
  const db = await getPostgresDb();
  const meta = await readMeta();
  const lost = new Set(meta.lossSaleIds);
  const rows = (
    await queryAll(
      db
        .select({
          id: sales.id,
          saleDate: sales.saleDate,
          total: sales.totalAmount,
          received: sales.amountReceived,
          status: sales.paymentStatus,
        })
        .from(sales)
        .innerJoin(clients, eq(clients.id, sales.clientId))
        .where(
          and(
            eq(sales.businessId, toDbBusinessId(BUSINESS)),
            inArray(sales.paymentStatus, ["pending", "partial"]),
            eq(clients.name, person),
            lte(sales.saleDate, paidDate),
          ),
        )
        .orderBy(asc(sales.saleDate)),
    )
  ).filter((r) => !lost.has(r.id));

  let left = round2(amount);
  const byOrigin = new Map<string, number>();
  for (const r of rows) {
    if (left <= 0) break;
    const total = Number(r.total) || 0;
    const already = r.status === "partial" ? Number(r.received) || 0 : 0;
    const open = round2(total - already);
    if (open <= 0) continue;
    const pay = Math.min(open, left);
    left = round2(left - pay);
    const full = round2(already + pay) >= total;
    await queryRun(
      db
        .update(sales)
        .set({
          paymentStatus: full ? "paid" : "partial",
          amountReceived: round2(already + pay).toFixed(2),
          settlementDate: paidDate,
          updatedAt: new Date(),
        })
        .where(eq(sales.id, r.id)),
    );
    byOrigin.set(r.saleDate, round2((byOrigin.get(r.saleDate) ?? 0) + pay));
  }

  const settled = round2(amount - left);
  if (left > 0) {
    meta.extraSettlements.push({
      id: `extra-${Date.now().toString(36)}`,
      person,
      originDate: paidDate,
      paidDate,
      amount: left,
      note: "Sem dívida vinculada",
    });
    await writeMeta(meta);
  }

  const origins = Array.from(byOrigin.entries());
  for (const [origin, value] of origins) await reduceDiaryPending(origin, value);
  if (addToDiary) {
    const from = origins.map(([d]) => d.slice(8, 10) + "/" + d.slice(5, 7)).join(", ");
    await addSettlementToDiary(
      paidDate,
      round2(amount),
      `Quitação ${person}: R$ ${round2(amount).toFixed(2).replace(".", ",")}${from ? ` (vendas de ${from})` : ""} — registrada na ZAIVON v2.`,
    );
  }
  return { settled, extra: left };
}

type DiaryRecord = OperationalDiaryEntry;

function emptyDiary(date: string): DiaryRecord {
  return {
    version: DIARY_SCHEMA_VERSION,
    businessId: BUSINESS,
    date,
    revenue: { received: 0, pending: 0, total: 0 },
    profit: 0,
    quantitySold: 0,
    quantityLost: 0,
    tags: ["zaivon-v2"],
  };
}

/** Lê o diário do dia (ou um vazio), aplica a mudança e grava. */
async function patchDiary(date: string, fn: (entry: DiaryRecord) => DiaryRecord): Promise<void> {
  const current = await getDiaryEntry(BUSINESS, date);
  let base: DiaryRecord = emptyDiary(date);
  if (current) {
    const { id: _id, createdAt: _createdAt, ...rest } = current;
    base = rest;
  }
  await upsertDiaryEntry(fn(base));
}

function appendNote(existing: string | undefined, note: string): string {
  return [existing, note].filter(Boolean).join("\n");
}

function normalizeName(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

async function resolveZaivonProductId(product: ProductId): Promise<string> {
  const catalog = ZAIVON_PRODUCTS.find((p) => p.id === product)!;
  const list = await listProducts(BUSINESS);
  const found =
    product === "sanduiche"
      ? list.find((p) => normalizeName(p.name).includes("sandu"))
      : list.find((p) => normalizeName(p.name) === normalizeName(UNIDENTIFIED_FLAVOR_PRODUCT_NAME));
  if (found) return found.id;
  return createProduct({
    businessId: BUSINESS,
    name: product === "sanduiche" ? catalog.name : UNIDENTIFIED_FLAVOR_PRODUCT_NAME,
    category: catalog.category,
    price: catalog.prices.default,
    cost: catalog.cost,
    stockQuantity: 0,
    minStock: 0,
    status: "active",
  });
}

async function resolveClientId(name: string, sector: string): Promise<string> {
  const existing = (await listClientsRaw()).find((c) => normalizeName(c.name) === normalizeName(name));
  if (existing) return existing.id;
  return createClient({ businessId: BUSINESS, name, sector });
}

function nowShiftTime(): string {
  const hhmm = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  return normalizeSaleShiftTime(hhmm);
}

export type QuickSaleStatus = "paid" | "fiado" | "parceiro" | "investigar";

export interface QuickSaleInput {
  date: string;
  product: ProductId;
  channel: Channel;
  qty: number;
  status: QuickSaleStatus;
  person?: string | undefined;
  payment: PaymentMethod;
}

/** Venda avulsa: grava a venda (cliente, estoque, pendência) e soma no diário do dia. */
export async function registerQuickSale(input: QuickSaleInput): Promise<{ amount: number }> {
  if (!ISO_DATE.test(input.date) || !(input.qty >= 1)) throw new Error("Data ou quantidade inválida.");
  const catalog = ZAIVON_PRODUCTS.find((p) => p.id === input.product);
  if (!catalog) throw new Error("Produto inválido.");
  const unitPrice = catalog.prices[input.channel] ?? catalog.prices.default;
  const amount = round2(unitPrice * input.qty);
  const channelName = ZAIVON_CHANNELS.find((c) => c.id === input.channel)?.name ?? input.channel;
  const person = input.person?.trim();

  let clientName: string | null = person || null;
  if (input.status === "investigar") clientName = `Cliente Não Identificado (${input.date})`;
  if (input.status === "parceiro" && !clientName) clientName = "Meia Sola";
  if (input.status === "fiado" && !clientName) throw new Error("Informe quem pegou fiado.");

  const productId = await resolveZaivonProductId(input.product);
  const clientId = clientName ? await resolveClientId(clientName, channelName) : null;
  const paid = input.status === "paid";

  await executeSaleOperation({
    productId,
    quantity: input.qty,
    clientId,
    paymentMethod: input.payment,
    paymentStatus: paid ? "paid" : "pending",
    date: input.date,
    time: nowShiftTime(),
    department: channelName,
    notes: "Registrada na ZAIVON v2",
    unitPrice,
  });

  await patchDiary(input.date, (e) => ({
    ...e,
    quantitySold: e.quantitySold + input.qty,
    revenue: {
      received: round2(e.revenue.received + (paid ? amount : 0)),
      pending: round2(e.revenue.pending + (paid ? 0 : amount)),
      total: round2(e.revenue.total + amount),
    },
    profit: round2(e.profit + (paid ? amount : 0)),
  }));
  return { amount };
}

/** Compra do dia: soma unidades e investimento; o meu custo sai do lucro. */
export async function registerPurchase(input: {
  date: string;
  units: number;
  own: number;
  third: number;
  thirdName?: string | undefined;
}): Promise<void> {
  if (!ISO_DATE.test(input.date)) throw new Error("Data inválida.");
  const own = round2(Math.max(0, input.own));
  const third = round2(Math.max(0, input.third));
  if (!(own + third > 0) && !(input.units > 0)) throw new Error("Informe unidades ou valores da compra.");
  const thirdName = input.thirdName?.trim() || "Henrique";

  await patchDiary(input.date, (e) => ({
    ...e,
    purchase: {
      totalUnits: (e.purchase?.totalUnits ?? 0) + Math.max(0, Math.round(input.units)),
      investment: round2((e.purchase?.investment ?? 0) + own + third),
      products: e.purchase?.products ?? [],
    },
    profit: round2(e.profit - own),
  }));

  const operationDayId = await ensureOperationDayId(BUSINESS, input.date);
  const db = await getPostgresDb();
  const rows = [
    own > 0 && { amount: own, sourceType: "own_capital" as const, sourceName: null, description: `Investimento próprio — compra ${input.date} (ZAIVON v2).` },
    third > 0 && { amount: third, sourceType: "family" as const, sourceName: thirdName, description: `Investimento ${thirdName} — compra ${input.date} (ZAIVON v2).` },
  ].filter(Boolean) as { amount: number; sourceType: "own_capital" | "family"; sourceName: string | null; description: string }[];
  for (const r of rows) {
    await queryRun(
      db.insert(dailyInvestments).values({
        id: generateId(),
        operationDayId,
        amount: String(r.amount),
        investmentType: "additional",
        sourceType: r.sourceType,
        sourceName: r.sourceName,
        description: r.description,
      }),
    );
  }
}

/** Perda física (salgado estragou, sumiu, caiu): só conta unidades — o custo já saiu na compra. */
export async function registerWaste(input: { date: string; qty: number; reason?: string | undefined }): Promise<void> {
  if (!ISO_DATE.test(input.date) || !(input.qty >= 1)) throw new Error("Data ou quantidade inválida.");
  await patchDiary(input.date, (e) => ({
    ...e,
    quantityLost: e.quantityLost + input.qty,
    lossReason: input.reason?.trim() ? appendNote(e.lossReason, input.reason.trim()) : e.lossReason,
  }));
}

export interface DraftPreview {
  date: string;
  sales: DayRegistrationPreview["sales"];
  newClients: string[];
  purchase: DayRegistrationPreview["purchase"];
  summary: DayRegistrationPreview["summary"];
  financials: DraftFinancials;
  /** Lucro calculado = entrada + bonificação − meu custo. */
  computedProfit: number | null;
  existingSalesCount: number;
  warnings: string[];
  errors: string[];
}

async function buildDraft(text: string, date: string) {
  const preview = await previewDayRegistration(text);
  const financials = parseDraftFinancials(text);
  const existingSalesCount = await countSalesForDate(BUSINESS, date);
  const warnings = [...preview.warnings].filter((w) => !/Faturamento não informado|Lucro calculado provisoriamente/.test(w));
  const errors = [...preview.errors];
  if (financials.cashIn == null) warnings.push("“Faturamento total real (do dia + quitação)” não encontrado — uso o faturamento lido pelo parser.");
  if (financials.ownCost == null) warnings.push("“Meu custo total” não encontrado — o lucro vem do rascunho.");
  if (financials.cofrinho == null) warnings.push("Cofrinho na prática não encontrado — informe depois no Fechamento.");
  const cashIn = financials.cashIn ?? preview.summary.revenue;
  const computedProfit = financials.ownCost != null ? round2(cashIn + (financials.bonus ?? 0) - financials.ownCost) : null;
  if (computedProfit != null && financials.profit != null && Math.abs(computedProfit - financials.profit) > 0.01) {
    warnings.push(
      `Lucro escrito (R$ ${financials.profit}) difere da conta entrada + bonificação − meu custo (R$ ${computedProfit}). Vou gravar R$ ${computedProfit}.`,
    );
  }
  if (existingSalesCount > 0) errors.push(`${date.slice(8, 10)}/${date.slice(5, 7)} já tem ${existingSalesCount} venda(s) gravada(s). Para não duplicar, o rascunho não grava neste dia.`);
  return { preview, financials, computedProfit, existingSalesCount, warnings, errors };
}

export async function previewDraft(text: string, date: string): Promise<DraftPreview> {
  if (!ISO_DATE.test(date)) throw new Error("Data inválida.");
  const d = await buildDraft(text, date);
  return {
    date,
    sales: d.preview.sales,
    newClients: d.preview.clientMatches.filter((c) => c.willCreate).map((c) => c.clientName),
    purchase: d.preview.purchase,
    summary: d.preview.summary,
    financials: d.financials,
    computedProfit: d.computedProfit,
    existingSalesCount: d.existingSalesCount,
    warnings: d.warnings,
    errors: d.errors,
  };
}

/**
 * Grava o rascunho do dia: vendas/clientes/estoque pelo registro atual e o
 * financeiro (entrada, meu custo, bonificação, perdas, cofrinho) pelo bloco de números.
 * Quitações marcadas baixam as pendências sem somar de novo no caixa (já estão na entrada).
 */
export async function commitDraft(
  text: string,
  date: string,
  settlementsPaid: { person: string; amount: number }[],
): Promise<{ sales: number; profit: number }> {
  if (!ISO_DATE.test(date)) throw new Error("Data inválida.");
  const d = await buildDraft(text, date);
  if (d.errors.length) throw new Error(d.errors[0]);

  const { warnings: _w, errors: _e, productMatches: _p, clientMatches: _c, dayAlreadyRegistered: _a, existingSalesCount: _n, ...plan } = d.preview;
  const result = await commitDayRegistration({ ...plan, date, businessId: BUSINESS });

  const f = d.financials;
  const cashIn = round2(f.cashIn ?? plan.summary.revenue);
  const bonus = round2(f.bonus ?? 0);
  let finalProfit = 0;
  await patchDiary(date, (e) => {
    const ownCost = f.ownCost ?? Math.max(0, round2(e.revenue.received - e.profit));
    finalProfit = round2(cashIn + bonus - ownCost);
    const investment = f.totalCost ?? (f.ownCost != null || f.thirdPartyCost != null ? round2((f.ownCost ?? 0) + (f.thirdPartyCost ?? 0)) : e.purchase?.investment);
    return {
      ...e,
      revenue: { ...e.revenue, received: cashIn, total: round2(cashIn + e.revenue.pending) },
      profit: round2(cashIn - ownCost),
      bonusIncome: bonus > 0 ? bonus : undefined,
      bonusIncomeDescription: bonus > 0 ? e.bonusIncomeDescription ?? "Bonificação do Henrique" : undefined,
      quantityLost: f.losses ?? e.quantityLost,
      purchase:
        investment != null
          ? { totalUnits: e.purchase?.totalUnits ?? 0, investment, products: e.purchase?.products ?? [] }
          : e.purchase,
      tags: Array.from(new Set([...(e.tags ?? []), "zaivon-v2"])),
    };
  });

  for (const s of settlementsPaid) {
    if (s.amount > 0 && s.person.trim()) await registerPayment(s.person, s.amount, date, { addToDiary: false });
  }
  if (f.cofrinho != null && f.cofrinho > 0) await setDayCofrinho(date, f.cofrinho);

  return { sales: result.saleIds.length, profit: finalProfit };
}
