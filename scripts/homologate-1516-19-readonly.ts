/**
 * Snapshot READ-ONLY 15/16/19/10 para homologação final.
 * Uso: pnpm tsx scripts/homologate-1516-19-readonly.ts
 */
import "./load-env";
import { and, asc, eq } from "drizzle-orm";
import { getDiaryEntry } from "../src/lib/diary-service";
import {
  CLOSING_2026_10_15,
  CLOSING_2026_10_16,
} from "../src/lib/finance/day-closing";
import { clients, saleItems, sales, products } from "../src/lib/db/postgres/schema";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { toDbBusinessId } from "../src/platform/db/business-id";
import { queryAll } from "../src/platform/db/query";

const DATES = ["2026-10-15", "2026-10-16", "2026-10-19"] as const;

async function snap(d: string) {
  const diary = await getDiaryEntry("salgados", d);
  const dc = diary?.dayClosing;
  console.log(`\n==== ${d} diary=${!!diary} ====`);
  if (dc) {
    console.log(
      JSON.stringify(
        {
          competenceStatus: dc.competenceStatus,
          competenceRevenue: dc.competenceRevenue,
          competenceProfit: dc.competenceProfit,
          cashIn: dc.cash.cashIn,
          salesReceived: dc.cash.salesReceived,
          priorSettlements: dc.cash.priorSettlements,
          otherInflows: dc.cash.otherInflows,
          ownCost: dc.costs.ownCost,
          cashMgmt: dc.cashManagementResult,
          deposit: dc.piggyBank.deposit,
          piggyOpen: dc.piggyBank.openingBalance,
          piggyClose: dc.piggyBank.closingBalance,
          newCredit: dc.newCredit,
          losses: dc.lossesAmount,
          stock: dc.stockRemainingUnits,
          sandwichAudit: dc.operationalAudit?.sandwiches,
          provisionalGap: dc.provisionalCompetence?.gap,
        },
        null,
        2,
      ),
    );
  } else if (diary) {
    console.log("diary sem dayClosing", {
      revenue: diary.revenue,
      profit: diary.profit,
      cofrinho: diary.cofrinhoBalance,
      status: diary.status,
    });
  }
}

async function main() {
  for (const d of DATES) await snap(d);

  console.log("\n==== CONST vs DIARY 15 ====");
  const d15 = await getDiaryEntry("salgados", "2026-10-15");
  const c15 = CLOSING_2026_10_15;
  if (d15?.dayClosing) {
    const dc = d15.dayClosing;
    const checks = [
      ["ownCost", dc.costs.ownCost, c15.costs.ownCost, 110],
      ["cashIn", dc.cash.cashIn, c15.cash.cashIn, 217],
      ["cashMgmt", dc.cashManagementResult, c15.cashManagementResult, 107],
      ["otherInflows", dc.cash.otherInflows, c15.cash.otherInflows, 19],
      ["deposit", dc.piggyBank.deposit, c15.piggyBank.deposit, 107],
      ["piggyClose", dc.piggyBank.closingBalance, c15.piggyBank.closingBalance, 4725.44],
      ["stock", dc.stockRemainingUnits, c15.stockRemainingUnits, 16],
    ];
    for (const [k, a, b, exp] of checks) {
      console.log(`${k}: diary=${a} const=${b} expect=${exp} ok=${a === exp && b === exp}`);
    }
  }

  console.log("\n==== CONST vs DIARY 16 ====");
  const d16 = await getDiaryEntry("salgados", "2026-10-16");
  const c16 = CLOSING_2026_10_16;
  if (d16?.dayClosing) {
    const dc = d16.dayClosing;
    const checks = [
      ["salesReceived", dc.cash.salesReceived, 154],
      ["priorSettlements", dc.cash.priorSettlements, 53],
      ["cashIn", dc.cash.cashIn, 207],
      ["ownCost", dc.costs.ownCost, 93.3],
      ["cashMgmt", dc.cashManagementResult, 113.7],
      ["competenceRevenue", dc.competenceRevenue, 168],
      ["competenceProfit", dc.competenceProfit, 74.7],
      ["deposit", dc.piggyBank.deposit, 127],
      ["piggyOpen", dc.piggyBank.openingBalance, 4727.52],
      ["piggyClose", dc.piggyBank.closingBalance, 4854.52],
      ["personalPaid", dc.cash.salesReceived - dc.costs.ownCost, 60.7],
    ];
    for (const [k, a, exp] of checks) {
      console.log(`${k}: got=${a} expect=${exp} ok=${Math.abs(Number(a) - Number(exp)) < 0.01}`);
    }
    console.log("const match diary cashIn", dc.cash.cashIn === c16.cash.cashIn);
  }

  const biz = toDbBusinessId("salgados");
  const db = await getPostgresDb();

  for (const d of DATES) {
    const rows = await queryAll(
      db
        .select({
          id: sales.id,
          status: sales.paymentStatus,
          total: sales.totalAmount,
          client: clients.name,
          product: products.name,
          qty: saleItems.quantity,
          notes: sales.notes,
        })
        .from(sales)
        .innerJoin(clients, eq(clients.id, sales.clientId))
        .leftJoin(saleItems, eq(saleItems.saleId, sales.id))
        .leftJoin(products, eq(products.id, saleItems.productId))
        .where(and(eq(sales.businessId, biz), eq(sales.saleDate, d)))
        .orderBy(asc(sales.saleTime)),
    );
    const paid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.total), 0);
    const pend = rows.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.total), 0);
    console.log(`\n=== SALES ${d}: n=${rows.length} paidΣ=${paid} pendΣ=${pend} ===`);
    if (d === "2026-10-19") {
      for (const r of rows) {
        console.log(
          `${r.status} ${r.qty}×${r.product} R$${r.total} | ${r.client} | ${String(r.notes ?? "").slice(0, 90)} | ${r.id.slice(0, 8)}`,
        );
      }
    }
  }

  const settle19 = await queryAll(
    db
      .select({
        id: sales.id,
        saleDate: sales.saleDate,
        settlement: sales.settlementDate,
        total: sales.totalAmount,
        client: clients.name,
        status: sales.paymentStatus,
      })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(and(eq(sales.businessId, biz), eq(sales.settlementDate, "2026-10-19"))),
  );
  console.log("\n=== SETTLEMENTS settlement_date=19/10 ===", settle19.length);
  for (const r of settle19) console.log(r);

  // Mikelly open debts
  const mikelly = await queryAll(
    db
      .select({
        id: sales.id,
        saleDate: sales.saleDate,
        status: sales.paymentStatus,
        total: sales.totalAmount,
        notes: sales.notes,
      })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(and(eq(sales.businessId, biz), eq(clients.name, "Maria Mikelly Monteiro Coutinho")))
      .orderBy(asc(sales.saleDate)),
  );
  console.log("\n=== MIKELLY ALL ===");
  for (const r of mikelly) {
    console.log(`${r.saleDate} ${r.status} R$${r.total} | ${String(r.notes ?? "").slice(0, 100)} | ${r.id.slice(0, 8)}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
