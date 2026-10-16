/**
 * Auditoria + correção idempotente do fechamento 14/10/2026.
 * - Cadastra dívida Henrique R$20 (13/10) e vincula quitação 14/10 (remove extraSettlement).
 * - Normaliza espécie / Tap to Pay.
 * - Garante perdas operacionais de 5 sanduíches.
 * - Lança caixa de 15/10 (R$25) via cash_flow sem duplicar vendas.
 * - Persiste dayClosing (5 dimensões) no diário.
 *
 * Uso: pnpm tsx scripts/audit-fix-1410.ts [--dry]
 */
import "./load-env";
import { and, eq, inArray, like, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { CLOSING_2026_10_14 } from "../src/lib/finance/day-closing";
import { getDiaryEntry, upsertDiaryEntry } from "../src/lib/diary-service";
import { UNIDENTIFIED_FLAVOR_PRODUCT_NAME } from "../src/lib/salgados-flavors";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { toDbBusinessId } from "../src/platform/db/business-id";
import { ensureOperationDayId } from "../src/platform/db/repositories/operation-day-repository";
import { listSettingsMap, upsertSetting } from "../src/platform/db/repositories/settings-repository";
import {
  cashFlowEvents,
  clients,
  operationalLosses,
  saleItems,
  sales,
} from "../src/lib/db/postgres/schema";
import { queryAll, queryRun } from "../src/platform/db/query";

const BUSINESS = "salgados";
const DATE = "2026-10-14";
const PREV = "2026-10-13";
const NEXT = "2026-10-15";
const HENRIQUE = "Henrique Alberto Matos Da Rocha";
const META_KEY = "omni_v2_meta_salgados";
const SALGADO_ID = "4da6e5b2-86ad-4f3e-8e71-9492f43f8291";
const SANDUICHE_ID = "b1161a39-149e-475c-9eb1-345553006c0d";
const HENRIQUE_NOTE =
  "Fiado 13/10 — 4 salgados R$20 (dívida original reconhecida na auditoria 14/10). Quitado em 14/10 às 11:56.";

type Meta = {
  cofrinho: Record<string, number>;
  closure: Record<string, { status: string; note?: string }>;
  extraSettlements: Array<{
    id: string;
    person: string;
    originDate: string;
    paidDate: string;
    amount: number;
    note?: string;
  }>;
  lossSaleIds: string[];
};

const DRY = process.argv.includes("--dry");

async function readMeta(): Promise<Meta> {
  const raw = (await listSettingsMap())[META_KEY];
  if (!raw) return { cofrinho: {}, closure: {}, extraSettlements: [], lossSaleIds: [] };
  return JSON.parse(raw) as Meta;
}

async function writeMeta(meta: Meta): Promise<void> {
  if (DRY) return;
  await upsertSetting(META_KEY, JSON.stringify(meta));
}

async function ensureHenriqueDebt(): Promise<{ saleId: string; created: boolean }> {
  const db = await getPostgresDb();
  const biz = toDbBusinessId(BUSINESS);
  const existing = await queryAll(
    db
      .select({ id: sales.id, status: sales.paymentStatus, settlementDate: sales.settlementDate, notes: sales.notes })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, biz),
          eq(sales.saleDate, PREV),
          eq(clients.name, HENRIQUE),
          or(eq(sales.totalAmount, "20.00"), like(sales.notes, "%4 salgados R$20%")),
        ),
      ),
  );

  if (existing.length > 0) {
    const row = existing[0]!;
    if (row.status !== "paid" || row.settlementDate !== DATE) {
      if (!DRY) {
        await queryRun(
          db
            .update(sales)
            .set({
              paymentStatus: "paid",
              amountReceived: "20.00",
              settlementDate: DATE,
              notes: HENRIQUE_NOTE,
              updatedAt: new Date(),
            })
            .where(eq(sales.id, row.id)),
        );
      }
      console.log(`  ✓ dívida Henrique ${PREV} vinculada à quitação ${DATE}`);
    } else {
      console.log(`  ✓ dívida Henrique ${PREV} já quitada em ${DATE}`);
    }
    return { saleId: row.id, created: false };
  }

  const opDayId = await ensureOperationDayId(BUSINESS, PREV);
  const clientRows = await queryAll(db.select({ id: clients.id }).from(clients).where(eq(clients.name, HENRIQUE)));
  if (!clientRows[0]) throw new Error("Cliente Henrique não encontrado");
  const saleId = randomUUID();
  const itemId = randomUUID();
  if (!DRY) {
    await queryRun(
      db.insert(sales).values({
        id: saleId,
        businessId: biz,
        operationDayId: opDayId,
        clientId: clientRows[0].id,
        saleDate: PREV,
        saleTime: "20:00",
        paymentMethod: "pix",
        paymentStatus: "paid",
        amountReceived: "20.00",
        settlementDate: DATE,
        totalAmount: "20.00",
        totalCost: "0.00",
        profit: "20.00",
        department: "Colegas do Henrique",
        notes: HENRIQUE_NOTE,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await queryRun(
      db.insert(saleItems).values({
        id: itemId,
        saleId,
        productId: SALGADO_ID,
        quantity: 4,
        unitPrice: "5.00",
        unitCost: "0.00",
        subtotal: "20.00",
        profit: "20.00",
        flavorConfidence: "unknown",
      }),
    );
  }
  console.log(`  ✓ criada dívida Henrique ${PREV} R$20 → quitada ${DATE} (${saleId})`);
  return { saleId, created: true };
}

async function stripHenriqueExtraSettlement(): Promise<void> {
  const meta = await readMeta();
  const before = meta.extraSettlements.length;
  meta.extraSettlements = meta.extraSettlements.filter(
    (s) => !(s.person === HENRIQUE && s.paidDate === DATE && Math.abs(s.amount - 20) < 0.001),
  );
  if (meta.extraSettlements.length !== before) {
    await writeMeta(meta);
    console.log(`  ✓ removido extraSettlement Henrique R$20 (${before - meta.extraSettlements.length})`);
  } else {
    console.log("  ✓ sem extraSettlement Henrique R$20 duplicado");
  }
}

async function normalizeEspecieAndTap(): Promise<void> {
  const db = await getPostgresDb();
  const biz = toDbBusinessId(BUSINESS);
  const especie = await queryAll(
    db
      .select({ saleId: sales.id, clientId: clients.id, name: clients.name })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(and(eq(sales.businessId, biz), eq(sales.saleDate, DATE), like(clients.name, "%Espécie%"))),
  );
  let i = 1;
  for (const row of especie) {
    const newName = `Cliente desconhecido (espécie 14/10) #${i}`;
    if (!DRY && row.name !== newName) {
      await queryRun(db.update(clients).set({ name: newName }).where(eq(clients.id, row.clientId)));
      await queryRun(
        db
          .update(sales)
          .set({
            paymentMethod: "cash",
            notes:
              "Espécie convertida em Pix pelo Henrique (R$25 às 11:55) — troca de meio de pagamento, não faturamento adicional. Cliente desconhecido.",
            updatedAt: new Date(),
          })
          .where(eq(sales.id, row.saleId)),
      );
    }
    console.log(`  ✓ espécie ${row.name} → ${newName}`);
    i += 1;
  }

  const tap = await queryAll(
    db
      .select({ id: sales.id, paymentMethod: sales.paymentMethod, notes: sales.notes })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(and(eq(sales.businessId, biz), eq(sales.saleDate, DATE), like(clients.name, "%Tap to Pay%"))),
  );
  for (const row of tap) {
    if (!DRY) {
      await queryRun(
        db
          .update(sales)
          .set({
            paymentMethod: "card",
            notes:
              "Tap to Pay: valor bruto no cartão R$5,20 · valor de venda/faturamento R$5,00. Os R$0,20 não criam segunda venda.",
            updatedAt: new Date(),
          })
          .where(eq(sales.id, row.id)),
      );
    }
    console.log("  ✓ Tap to Pay: card · bruto 5,20 / venda 5,00");
  }
}

async function ensureOperationalLoss(): Promise<void> {
  const opDayId = await ensureOperationDayId(BUSINESS, DATE);
  const db = await getPostgresDb();
  const existing = await queryAll(
    db.select().from(operationalLosses).where(eq(operationalLosses.operationDayId, opDayId)),
  );
  const sandwichLoss = existing.find(
    (l) => Number(l.quantity) === 5 && /sandu/i.test(l.productName),
  );
  if (sandwichLoss) {
    console.log("  ✓ operational_losses 5 sanduíches já existe");
    return;
  }
  if (!DRY) {
    await queryRun(
      db.insert(operationalLosses).values({
        id: randomUUID(),
        operationDayId: opDayId,
        productId: SANDUICHE_ID,
        productName: "Sanduíche Natural",
        quantity: 5,
        reason:
          "Retiradas anônimas na Acal sem pagamento/identificação — perda definitiva R$35 (5×R$7). Sem fiado fictício.",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }
  console.log("  ✓ registrada perda operacional 5 sanduíches R$35");
}

async function ensureCashFlow1510(): Promise<void> {
  const db = await getPostgresDb();
  const biz = toDbBusinessId(BUSINESS);
  const settled = await queryAll(
    db
      .select({
        id: sales.id,
        total: sales.totalAmount,
        name: clients.name,
      })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(and(eq(sales.businessId, biz), eq(sales.saleDate, DATE), eq(sales.settlementDate, NEXT))),
  );
  const want = [
    { match: /Sarah/i, amount: 5 },
    { match: /Anderson das Chagas Oliveira/i, amount: 10 },
    { match: /Não Identificado \(2026-10-14\)/i, amount: 5 },
    { match: /Paulo André Carvalho/i, amount: 5 },
  ];
  let total = 0;
  const opDayId = await ensureOperationDayId(BUSINESS, NEXT);
  for (const w of want) {
    const row = settled.find((s) => w.match.test(s.name));
    if (!row) throw new Error(`Quitação 15/10 não encontrada: ${w.match}`);
    if (Math.abs(Number(row.total) - w.amount) > 0.001) {
      throw new Error(`${row.name}: R$${row.total} ≠ R$${w.amount}`);
    }
    total += w.amount;
    const already = await queryAll(
      db
        .select({ id: cashFlowEvents.id })
        .from(cashFlowEvents)
        .where(and(eq(cashFlowEvents.saleId, row.id), eq(cashFlowEvents.eventDate, NEXT))),
    );
    if (already.length) {
      console.log(`  ✓ cash_flow 15/10 já existe · ${row.name} R$${w.amount}`);
      continue;
    }
    if (!DRY) {
      await queryRun(
        db.insert(cashFlowEvents).values({
          id: randomUUID(),
          businessId: biz,
          operationDayId: opDayId,
          saleId: row.id,
          eventType: "income",
          category: "recebimento_venda_anterior",
          description: `Quitação de fiado 14/10 — ${row.name}`,
          amount: w.amount.toFixed(2),
          eventDate: NEXT,
          createdAt: new Date(),
        }),
      );
    }
    console.log(`  ✓ cash_flow 15/10 · ${row.name} R$${w.amount}`);
  }
  if (Math.abs(total - 25) > 0.001) throw new Error(`Total quitações 15/10 R$${total} ≠ 25`);
}

async function assertRecoverableBalances(): Promise<void> {
  const db = await getPostgresDb();
  const meta = await readMeta();
  const lost = new Set(meta.lossSaleIds);
  const open = await queryAll(
    db
      .select({
        name: clients.name,
        total: sales.totalAmount,
        received: sales.amountReceived,
        id: sales.id,
        date: sales.saleDate,
      })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(inArray(sales.paymentStatus, ["pending", "partial"])),
  );
  const byPerson = new Map<string, number>();
  for (const r of open) {
    if (lost.has(r.id)) continue;
    const amt = Number(r.total) - Number(r.received);
    byPerson.set(r.name, (byPerson.get(r.name) ?? 0) + amt);
  }
  const mikelly = [...byPerson.entries()].filter(([n]) => /mikelly/i.test(n)).reduce((s, [, v]) => s + v, 0);
  const laura = [...byPerson.entries()].filter(([n]) => /laura/i.test(n)).reduce((s, [, v]) => s + v, 0);
  const carlos = [...byPerson.entries()].filter(([n]) => /^Carlos Eduardo$/i.test(n)).reduce((s, [, v]) => s + v, 0);
  const total = mikelly + laura + carlos;
  console.log(`  · Mikelly R$${mikelly} · Laura R$${laura} · Carlos Eduardo R$${carlos} · total R$${total}`);
  if (Math.abs(mikelly - 50) > 0.001) throw new Error(`Mikelly R$${mikelly} ≠ 50`);
  if (Math.abs(laura - 14) > 0.001) throw new Error(`Laura R$${laura} ≠ 14`);
  if (Math.abs(carlos - 8) > 0.001) throw new Error(`Carlos Eduardo R$${carlos} ≠ 8`);
  if (Math.abs(total - 72) > 0.001) throw new Error(`Recuperável R$${total} ≠ 72`);
  console.log("  ✓ saldos recuperáveis atuais R$72");
}

async function persistDayClosing(): Promise<void> {
  const entry = await getDiaryEntry(BUSINESS, DATE);
  if (!entry) throw new Error("Diário 14/10 ausente");
  const closing = CLOSING_2026_10_14;
  if (Math.abs(closing.competenceProfit - 151) > 0.001) throw new Error("competenceProfit ≠ 151");
  if (Math.abs(closing.cashManagementResult - 131) > 0.001) throw new Error("cashManagementResult ≠ 131");
  if (Math.abs(closing.cash.cashIn - 231) > 0.001) throw new Error("cashIn ≠ 231");
  if (!DRY) {
    const { id: _id, createdAt: _c, ...rest } = entry;
    await upsertDiaryEntry({
      ...rest,
      version: 2,
      profit: closing.cashManagementResult,
      revenue: {
        received: closing.cash.cashIn,
        pending: closing.newCredit,
        total: closing.competenceRevenue,
      },
      quantitySold: 47,
      quantityLost: 5,
      dayClosing: closing,
      observations: [
        rest.observations,
        "",
        "— Método financeiro v2 (auditoria) —",
        `Faturamento competência R$${closing.competenceRevenue} · Lucro competência R$${closing.competenceProfit}`,
        `Caixa R$${closing.cash.cashIn} (vendas ${closing.cash.salesReceived} + quitação ${closing.cash.priorSettlements}) · Resultado caixa R$${closing.cashManagementResult}`,
        `Cofrinho depósito R$${closing.piggyBank.deposit} + rendimento R$${closing.piggyBank.bankYield} → saldo R$${closing.piggyBank.closingBalance}`,
        "Trajetória física dos 2 sanduíches não entregues na Unifor: sem evidência individual; saldo final 2 un na Acal confirmado.",
        "Perdas históricas (visão notas): 09/10 Meia Sola R$32 · 13/10 notas R$15 (sistema 13/10 quantityLost=7) · 14/10 R$35 — ver relatório.",
      ]
        .filter(Boolean)
        .join("\n"),
      tags: Array.from(new Set([...(rest.tags ?? []), "zaivon-v2", "day-closing-v2"])),
    });
  }
  console.log("  ✓ dayClosing v2 persistido no diário 14/10");
}

async function main() {
  console.log(`Auditoria 14/10${DRY ? " (DRY)" : ""}`);
  console.log("1) Dívida Henrique + quitação");
  await ensureHenriqueDebt();
  await stripHenriqueExtraSettlement();
  console.log("2) Espécie + Tap to Pay");
  await normalizeEspecieAndTap();
  console.log("3) Perdas 14/10");
  await ensureOperationalLoss();
  console.log("4) Caixa 15/10 (quitações R$25)");
  await ensureCashFlow1510();
  console.log("5) Saldos recuperáveis");
  await assertRecoverableBalances();
  console.log("6) dayClosing permanente");
  await persistDayClosing();

  const closing = CLOSING_2026_10_14;
  console.log("\nConciliação 5 dimensões:");
  console.log(`  Faturamento competência: R$${closing.competenceRevenue}`);
  console.log(`  Caixa: R$${closing.cash.cashIn} (vendas ${closing.cash.salesReceived} + antigas ${closing.cash.priorSettlements})`);
  console.log(`  Lucro competência: R$${closing.competenceProfit}`);
  console.log(`  Resultado caixa: R$${closing.cashManagementResult}`);
  console.log(`  Cofrinho: depósito ${closing.piggyBank.deposit} + yield ${closing.piggyBank.bankYield} → ${closing.piggyBank.closingBalance}`);
  console.log(`  Gap competência−caixa: R$${closing.reconciliation.competenceMinusCash}`);
  console.log(DRY ? "DRY_OK" : "AUDIT_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
