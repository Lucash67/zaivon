/**
 * Carga somente leitura da Dashboard Aurora.
 * Não grava fechamento, venda, quitação nem meta.
 */
import { and, asc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { SALGADOS_BUSINESS_ID } from "@/lib/business-units";
import { listDiaryEntries } from "@/lib/diary-service";
import {
  buildAuroraSnapshot,
  type AuroraSnapshot,
  type AuroraTopClient,
  type AuroraWalletItem,
} from "@/lib/finance/aurora-view";
import type { ReadingSale, ReadingSettlement } from "@/lib/finance/operational-reading";
import type { Settlement } from "@/lib/zaivon/types";
import { clients, products, saleItems, sales } from "@/lib/db/postgres/schema";
import { toDbBusinessId } from "@/platform/db/business-id";
import { getPostgresDb } from "@/platform/db/postgres/client";
import { queryAll } from "@/platform/db/query";
import { listSettingsMap } from "@/platform/db/repositories/settings-repository";

const META_KEY = `omni_v2_meta_${SALGADOS_BUSINESS_ID}`;
const DEFERRED: Record<string, string> = { "Ana Laura": "2026-11-07" };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function productKind(name: string): ReadingSale["product"] {
  if (/sandu/i.test(name)) return "sanduiche";
  if (/salgad/i.test(name)) return "salgado";
  return "other";
}

function excludedClient(name: string): boolean {
  return /n[aã]o identific|sem nome|desconhecid|agregad|colegas do|^henrique$/i.test(name.trim());
}

function inferredSale(notes: string | null): boolean {
  return /infer[eê]ncia aprovada|n[aã]o confirmad[oa] pelo pagador/i.test(notes ?? "");
}

async function readMeta(): Promise<{ extraSettlements: Settlement[]; lossSaleIds: string[] }> {
  const raw = (await listSettingsMap())[META_KEY];
  if (!raw) return { extraSettlements: [], lossSaleIds: [] };
  try {
    const parsed = JSON.parse(raw) as { extraSettlements?: Settlement[]; lossSaleIds?: string[] };
    return {
      extraSettlements: parsed.extraSettlements ?? [],
      lossSaleIds: parsed.lossSaleIds ?? [],
    };
  } catch {
    return { extraSettlements: [], lossSaleIds: [] };
  }
}

export async function loadAuroraSnapshot(input: {
  from: string;
  to: string;
  profileName: string;
}): Promise<AuroraSnapshot> {
  const from = input.from <= input.to ? input.from : input.to;
  const to = input.from <= input.to ? input.to : input.from;
  const businessId = toDbBusinessId(SALGADOS_BUSINESS_ID);
  const db = await getPostgresDb();

  const entries = await listDiaryEntries(SALGADOS_BUSINESS_ID, from, to);
  const meta = await readMeta();

  const saleRows = await queryAll(
    db
      .select({
        id: sales.id,
        saleDate: sales.saleDate,
        saleTime: sales.saleTime,
        department: sales.department,
        paymentStatus: sales.paymentStatus,
        totalAmount: sales.totalAmount,
        amountReceived: sales.amountReceived,
        settlementDate: sales.settlementDate,
        notes: sales.notes,
        clientId: sales.clientId,
        clientName: clients.name,
      })
      .from(sales)
      .leftJoin(clients, eq(clients.id, sales.clientId))
      .where(and(eq(sales.businessId, businessId), gte(sales.saleDate, from), lte(sales.saleDate, to)))
      .orderBy(asc(sales.saleDate), asc(sales.saleTime)),
  );

  const ids = saleRows.map((row) => row.id);
  const itemRows = ids.length
    ? await queryAll(
        db
          .select({ saleId: saleItems.saleId, qty: saleItems.quantity, product: products.name })
          .from(saleItems)
          .innerJoin(products, eq(products.id, saleItems.productId))
          .where(inArray(saleItems.saleId, ids)),
      )
    : [];
  const items = new Map<string, { qty: number; product: string }[]>();
  for (const row of itemRows) {
    items.set(row.saleId, [...(items.get(row.saleId) ?? []), { qty: row.qty, product: row.product }]);
  }

  const salesByDate = new Map<string, ReadingSale[]>();
  for (const row of saleRows) {
    const lines = items.get(row.id) ?? [];
    const kind = lines.some((line) => productKind(line.product) === "sanduiche")
      ? "sanduiche"
      : lines.some((line) => productKind(line.product) === "other")
        ? "other"
        : "salgado";
    const sale: ReadingSale = {
      id: row.id,
      time: String(row.saleTime).slice(0, 5),
      clientName: row.clientName ?? "Sem nome",
      quantity: lines.reduce((sum, line) => sum + line.qty, 0) || 1,
      total: round2(Number(row.totalAmount) || 0),
      product: kind,
      channel: row.department,
      paymentStatus: row.paymentStatus,
      notes: row.notes,
    };
    salesByDate.set(row.saleDate, [...(salesByDate.get(row.saleDate) ?? []), sale]);
  }

  const dates = Array.from(new Set([...entries.map((entry) => entry.date), ...Array.from(salesByDate.keys())])).sort();
  const days = dates.map((date) => {
    const entry = entries.find((item) => item.date === date);
    const extra: ReadingSettlement[] = meta.extraSettlements
      .filter((item) => item.paidDate === date)
      .map((item) => ({
        id: item.id,
        person: item.person,
        amount: item.amount,
        paidDate: item.paidDate,
        originDate: item.originDate,
        note: item.note,
      }));
    return {
      date,
      closing: entry?.dayClosing ?? null,
      sales: salesByDate.get(date) ?? [],
      extraSettlements: extra,
    };
  });

  const wallet = await loadWallet(to, meta.lossSaleIds);
  const topClients = await loadTopClients(meta.lossSaleIds);

  return buildAuroraSnapshot({
    from,
    to,
    days,
    profileName: input.profileName,
    wallet,
    topClients,
  });
}

async function loadWallet(to: string, lossSaleIds: string[]): Promise<AuroraWalletItem[]> {
  const db = await getPostgresDb();
  const businessId = toDbBusinessId(SALGADOS_BUSINESS_ID);
  const open = await queryAll(
    db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        saleDate: sales.saleDate,
        paymentStatus: sales.paymentStatus,
        totalAmount: sales.totalAmount,
        amountReceived: sales.amountReceived,
        settlementDate: sales.settlementDate,
        clientName: clients.name,
      })
      .from(sales)
      .leftJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, businessId),
          lte(sales.saleDate, to),
          or(
            inArray(sales.paymentStatus, ["pending", "partial"]),
            sql`${sales.settlementDate} > ${to}`,
          ),
        ),
      )
      .orderBy(asc(sales.saleDate)),
  );

  const lost = new Set(lossSaleIds);
  const grouped = new Map<string, AuroraWalletItem & { titles: number; since: string }>();
  for (const row of open) {
    if (lost.has(row.id)) continue;
    if (row.settlementDate && row.settlementDate <= to && row.paymentStatus === "paid") continue;
    const name = row.clientName ?? "Sem nome";
    const key = row.clientId ?? row.id;
    const remaining =
      row.settlementDate && row.settlementDate > to
        ? round2(Number(row.totalAmount) || 0)
        : round2((Number(row.totalAmount) || 0) - (Number(row.amountReceived) || 0));
    const deferred = Object.entries(DEFERRED).find(([person]) => name === person || name.startsWith(`${person} `))?.[1];
    const status: AuroraWalletItem["status"] = /^henrique$/i.test(name)
      ? "confirmar"
      : deferred && to < deferred
        ? "acordo"
        : "aberto";
    const statusLabel =
      status === "confirmar" ? "A confirmar" : status === "acordo" ? `Acordo até ${deferred!.split("-").reverse().join("/")}` : "Em aberto";
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        id: row.id,
        name,
        detail: "",
        amount: remaining,
        status,
        statusLabel,
        titles: 1,
        since: row.saleDate,
      });
    } else {
      current.amount = round2(current.amount + remaining);
      current.titles += 1;
      if (row.saleDate < current.since) current.since = row.saleDate;
    }
  }
  for (const item of Array.from(grouped.values())) {
    const since = item.since.split("-").reverse().join("/");
    item.detail = item.titles === 1 ? `1 título · desde ${since}` : `${item.titles} títulos · desde ${since}`;
  }

  const historical: AuroraWalletItem[] = [];
  if (lossSaleIds.length) {
    const losses = await queryAll(
      db
        .select({
          id: sales.id,
          saleDate: sales.saleDate,
          totalAmount: sales.totalAmount,
          clientName: clients.name,
        })
        .from(sales)
        .leftJoin(clients, eq(clients.id, sales.clientId))
        .where(and(eq(sales.businessId, businessId), inArray(sales.id, lossSaleIds), lte(sales.saleDate, to))),
    );
    for (const row of losses) {
      historical.push({
        id: row.id,
        name: `${row.clientName ?? "Sem nome"} · baixa`,
        detail: `Registrada como perda · origem ${row.saleDate.split("-").reverse().join("/")}`,
        amount: round2(Number(row.totalAmount) || 0),
        status: "historico",
        statusLabel: "Histórico",
      });
    }
  }

  return [...Array.from(grouped.values()), ...historical];
}

async function loadTopClients(lossSaleIds: string[]): Promise<AuroraTopClient[]> {
  const db = await getPostgresDb();
  const businessId = toDbBusinessId(SALGADOS_BUSINESS_ID);
  const rows = await queryAll(
    db
      .select({
        saleId: sales.id,
        clientId: sales.clientId,
        clientName: clients.name,
        notes: sales.notes,
        qty: saleItems.quantity,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .leftJoin(clients, eq(clients.id, sales.clientId))
      .where(eq(sales.businessId, businessId)),
  );
  const lost = new Set(lossSaleIds);
  const totals = new Map<string, AuroraTopClient>();
  for (const row of rows) {
    if (!row.clientId || !row.clientName || excludedClient(row.clientName)) continue;
    if (lost.has(row.saleId) || inferredSale(row.notes)) continue;
    const current = totals.get(row.clientId) ?? { id: row.clientId, name: row.clientName, units: 0 };
    current.units += row.qty;
    totals.set(row.clientId, current);
  }
  return Array.from(totals.values())
    .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 5);
}
