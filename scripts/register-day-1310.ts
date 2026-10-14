/**
 * Registra 13/10/2026 — Salgados + Sanduíche Natural (fechamento em 4 blocos).
 * Uso: pnpm tsx scripts/register-day-1310.ts
 *
 *   caixa R$143 (R$136 das vendas + R$7 quitação Vanderson) · meu custo R$36 · terceiros R$74
 *   lucro R$107 = 143 − 36 · cofrinho R$4.483,49 (= 4.374,55 + 107 + R$1,94 rendimento)
 */
import "./load-env";
import { and, eq, inArray } from "drizzle-orm";
import { cleanupOperationDay } from "./cleanup-operation-day";
import { commitDayRegistration } from "../src/lib/day-registration/day-registration-service";
import { sanitizeRegistrationPlan } from "../src/lib/day-registration/plan-sanitize";
import type { DayRegistrationPlan, DraftSale } from "../src/lib/day-registration/types";
import { getDiaryEntry, upsertDiaryEntry } from "../src/lib/diary-service";
import { UNIDENTIFIED_FLAVOR_PRODUCT_NAME } from "../src/lib/salgados-flavors";
import { closeDay } from "../src/lib/zaivon/zaivon-service";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { toDbBusinessId } from "../src/platform/db/business-id";
import { clients, saleItems, sales } from "../src/lib/db/postgres/schema";
import { queryAll, queryRun } from "../src/platform/db/query";
import { countSalesForDate } from "@/platform/db/repositories/sale-repository";

const BUSINESS = "salgados";
const DATE = "2026-10-13";
const SANDUICHE = "Sanduíche Natural";
const SANDUICHE_COST = 2;

const HENRIQUE = "Henrique Alberto Matos Da Rocha";
const MIKELLY = "Maria Mikelly Monteiro Coutinho";
const VANDERSON = "Francisco Vanderson Dias";

interface PricedSale {
  sale: DraftSale;
  unitPrice: number;
  sandwich: boolean;
}

function salgado(time: string, clientName: string, quantity: number, extra: Partial<DraftSale> = {}): PricedSale {
  return {
    sale: {
      time,
      clientName,
      quantity,
      productName: UNIDENTIFIED_FLAVOR_PRODUCT_NAME,
      paymentMethod: "pix",
      paymentStatus: "paid",
      department: "Acal",
      ...extra,
    },
    unitPrice: 5,
    sandwich: false,
  };
}

function sanduiche(time: string, clientName: string, quantity: number, extra: Partial<DraftSale> = {}): PricedSale {
  return {
    sale: {
      time,
      clientName,
      quantity,
      productName: SANDUICHE,
      paymentMethod: "pix",
      paymentStatus: "paid",
      department: "Acal",
      ...extra,
    },
    unitPrice: 7,
    sandwich: true,
  };
}

const ESPECIE = { paymentMethod: "cash" as const, notes: "Pago em espécie, convertido em Pix pelo Henrique." };

const PRICED: PricedSale[] = [
  salgado("09:07", "Maria Clara Gomes Mororo", 1),
  salgado("09:09", "Raimunda Raimunda Sousa", 1),
  salgado("09:14", "Pedro Henrique Ribeiro", 1),
  salgado("09:26", "Yasmin Michelle Nunes Rodrigues", 1),
  sanduiche("09:27", "Ana Leticia Ferreira dos Santos", 1),
  salgado("09:52", HENRIQUE, 1, {
    department: "Colegas do Henrique",
    notes: "1 queijo frito do Henrique. O Pix dele de R$10 (09:52) + R$5 (13:43) + R$5 (13:47) = R$20 cobre este salgado e 3 vendas em espécie.",
  }),
  salgado("09:52", "Jackson", 1, ESPECIE),
  salgado("13:43", "Cassiano", 1, ESPECIE),
  salgado("13:47", "André Lima", 1, ESPECIE),
  salgado("10:05", "Hilmanita Carvalho Parente", 1),
  salgado("10:06", VANDERSON, 1, { notes: "Linha de R$12: 1 salgado do dia + R$7 de quitação do fiado de 09/10." }),
  salgado("10:07", "Dayanna Kelly Costa da Silva", 1),
  salgado("10:08", "Lucas Moraes", 1),
  salgado("10:31", "Anderson da Silva Nascimento", 1),
  salgado("10:32", "Davi Oliveira Da Silva Ayoub", 3),
  sanduiche("13:18", "Juan Vasco Meneses Ferreira", 1),
  salgado("15:53", "André da Costa Rebouças", 2),
  salgado("16:06", "Ruy de Azevedo Tavares", 1),
  salgado("16:19", "Francisco Nazareno Da Silva Raquel", 1),
  salgado("16:45", "Ana Angelica Magalhaes Martins", 1),
  sanduiche("17:34", "Natália Almeida da Silva Souza", 1),
  salgado("20:03", "Francisco Anderson Das Chagas Xavier Rocha", 2),
  sanduiche("17:40", MIKELLY, 1, { paymentStatus: "pending", notes: "Fiado 13/10 — 1 sanduíche R$7." }),
];

const RECEIVED = 143;
const PENDING = 7;
const PROFIT = 107;
const OWN_COST = 36;
const THIRD_COST = 74;
const LOST = 7;
const COFRINHO = 4483.49;

function units(sandwich: boolean): number {
  return PRICED.filter((p) => p.sandwich === sandwich).reduce((s, p) => s + p.sale.quantity, 0);
}

function money(filter: (p: PricedSale) => boolean): number {
  return PRICED.filter(filter).reduce((s, p) => s + p.unitPrice * p.sale.quantity, 0);
}

function checkPlan(): void {
  const paid = (p: PricedSale) => (p.sale.paymentStatus ?? "paid") === "paid";
  const checks: [string, number, number][] = [
    ["salgados vendidos", units(false), 23],
    ["sanduíches vendidos", units(true), 4],
    ["salgados R$", money((p) => !p.sandwich), 115],
    ["sanduíches pagos R$", money((p) => p.sandwich && paid(p)), 21],
    ["recebido das vendas R$", money(paid), 136],
    ["fiado novo R$", money((p) => !paid(p)), PENDING],
    ["caixa (vendas + quitação) R$", money(paid) + 7, RECEIVED],
    ["lucro R$", RECEIVED - OWN_COST, PROFIT],
    ["estoque salgados", units(false) + LOST, 30],
    ["estoque sanduíches (vendidos + 4 sobras)", units(true) + 4, 8],
  ];
  for (const [label, got, want] of checks) {
    if (Math.abs(got - want) > 0.001) throw new Error(`Conferência falhou — ${label}: ${got} ≠ ${want}`);
    console.log(`  ✓ ${label}: ${got}`);
  }
}

async function applyRealPrices(saleIds: string[]): Promise<void> {
  const db = await getPostgresDb();
  for (let i = 0; i < saleIds.length; i += 1) {
    const { unitPrice, sandwich, sale } = PRICED[i]!;
    const items = await queryAll(db.select().from(saleItems).where(eq(saleItems.saleId, saleIds[i]!)));
    let total = 0;
    let cost = 0;
    for (const item of items) {
      const unitCost = sandwich ? SANDUICHE_COST : Number(item.unitCost);
      const subtotal = unitPrice * item.quantity;
      const itemCost = unitCost * item.quantity;
      total += subtotal;
      cost += itemCost;
      await queryRun(
        db
          .update(saleItems)
          .set({
            unitPrice: unitPrice.toFixed(2),
            unitCost: unitCost.toFixed(2),
            subtotal: subtotal.toFixed(2),
            profit: (subtotal - itemCost).toFixed(2),
          })
          .where(eq(saleItems.id, item.id)),
      );
    }
    const paid = (sale.paymentStatus ?? "paid") === "paid";
    await queryRun(
      db
        .update(sales)
        .set({
          totalAmount: total.toFixed(2),
          totalCost: cost.toFixed(2),
          profit: (total - cost).toFixed(2),
          amountReceived: paid ? total.toFixed(2) : "0.00",
          updatedAt: new Date(),
        })
        .where(eq(sales.id, saleIds[i]!)),
    );
  }
}

async function settle(clientName: string, saleDate: string, settlementDate: string, note: string): Promise<void> {
  const db = await getPostgresDb();
  const rows = await queryAll(
    db
      .select({ id: sales.id, total: sales.totalAmount })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, toDbBusinessId(BUSINESS)),
          eq(sales.saleDate, saleDate),
          inArray(sales.paymentStatus, ["pending", "partial"]),
          eq(clients.name, clientName),
        ),
      ),
  );
  if (rows.length !== 1) throw new Error(`Fiado de ${clientName} em ${saleDate}: ${rows.length} encontrado(s), esperado 1`);
  await queryRun(
    db
      .update(sales)
      .set({ paymentStatus: "paid", amountReceived: rows[0]!.total, settlementDate, notes: note, updatedAt: new Date() })
      .where(eq(sales.id, rows[0]!.id)),
  );
  console.log(`  ✓ quitado ${clientName} (${saleDate}) em ${settlementDate}`);
}

async function main() {
  console.log("Conferência do fechamento:");
  checkPlan();
  if (process.argv.includes("--dry")) {
    console.log("DRY_OK");
    process.exit(0);
  }

  await cleanupOperationDay(BUSINESS, DATE);
  const existing = await countSalesForDate(BUSINESS, DATE);
  if (existing > 0) throw new Error(`${DATE}: ainda ${existing} venda(s) após cleanup`);

  const observations = [
    "Fechamento 13/10 em 4 blocos (Notas) — conciliado.",
    "Salgados: 30 comprados (R$94) · Acal 29 (22 vendidos + 7 retirados sem pagamento = perda) · Henrique 1 · Unifor 0 (feriado).",
    "Sanduíches: 8 feitos (R$16) · 3 pagos R$21 + 1 fiado Mikelly R$7 · 4 sobraram para 14/10 (custo já lançado em 13/10).",
    "Caixa R$143 = R$136 das vendas do dia + R$7 quitação Francisco Vanderson (fiado 09/10).",
    "Espécie R$15 (Jackson, Cassiano, André Lima) convertido em Pix pelo Henrique — já dentro do caixa.",
    "Custo total R$110 · meu custo R$36 · terceiros R$74 · bonificação R$0. Lucro R$107 = 143 − 36 (meta R$77, 138,96%).",
    "Cofrinho prático R$4.483,49 (+R$108,94 = 107 + R$1,94 rendimento).",
  ];

  const plan: DayRegistrationPlan = {
    businessId: BUSINESS,
    date: DATE,
    purchase: {
      totalUnits: 30,
      investment: OWN_COST + THIRD_COST,
      ownInvestment: OWN_COST,
      thirdParty: { name: "Terceiros", amount: THIRD_COST },
      products: [
        { name: "Mistão Frito", quantity: 9 },
        { name: "Queijo Frito", quantity: 6 },
        { name: "Coxinha", quantity: 5 },
        { name: "Frango com Catupiry", quantity: 3 },
        { name: "Mistão de Forno", quantity: 3 },
        { name: "Carne com Cheddar de Forno", quantity: 2 },
        { name: "Croissant", quantity: 2 },
      ],
    },
    summary: {
      revenue: RECEIVED,
      profit: PROFIT,
      quantitySold: 27,
      quantityLost: LOST,
      lossReason: "7 salgados retirados sem pagamento na Acal (pessoas não identificadas) — perda definitiva.",
      forecastProfit: 77,
    },
    sales: PRICED.map((p) => p.sale),
    newClients: Array.from(new Set(PRICED.map((p) => p.sale.clientName))).map((name) => ({
      name,
      sector: name === HENRIQUE ? "Colegas do Henrique" : "Acal",
    })),
    observations: observations.join("\n"),
    manualInsights: "Meta superada (R$107 vs R$77) mesmo com 7 salgados retirados sem pagamento e 4 sanduíches sobrando.",
    lessonsLearned: "Controle mais seguro das retiradas na Acal; conferir estoque físico no fim do dia.",
  };

  const result = await commitDayRegistration(sanitizeRegistrationPlan(plan));
  if (result.saleIds.length !== PRICED.length) {
    throw new Error(`${result.saleIds.length} vendas gravadas, esperado ${PRICED.length}`);
  }
  await applyRealPrices(result.saleIds);

  const entry = await getDiaryEntry(BUSINESS, DATE);
  if (!entry) throw new Error("diário ausente");
  await upsertDiaryEntry({
    ...entry,
    profit: PROFIT,
    bonusIncome: 0,
    quantitySold: 27,
    quantityLost: LOST,
    lossReason: plan.summary.lossReason,
    revenue: { received: RECEIVED, pending: PENDING, total: RECEIVED + PENDING },
    observations: plan.observations,
    manualInsights: plan.manualInsights,
    lessonsLearned: plan.lessonsLearned,
    sales: { paidCount: PRICED.length - 1, creditCount: 1 },
    tags: Array.from(new Set([...(entry.tags ?? []), "zaivon-v2"])),
  });

  await settle(VANDERSON, "2026-10-09", DATE, "Fiado 09/10 quitado em 13/10 (R$7 junto com a compra das 10:06).");
  await closeDay(DATE, "closed", undefined, COFRINHO);

  const saved = await getDiaryEntry(BUSINESS, DATE);
  if (!saved || saved.profit !== PROFIT || saved.revenue.received !== RECEIVED || saved.revenue.pending !== PENDING) {
    throw new Error("diário não fechou");
  }
  console.log(`✅ ${DATE} — lucro R$${saved.profit} · caixa R$${RECEIVED} · fiado R$${PENDING} · ${PRICED.length} vendas · perdas ${saved.quantityLost}`);
  console.log("DAY_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
