/**
 * Auditoria READ-ONLY custos sanduíches / lucro 15–16/10.
 * Uso: pnpm tsx scripts/audit-costs-1510-1610-readonly.ts
 */
import "./load-env";
import { and, asc, eq, gte, lte, ilike, or, sql } from "drizzle-orm";
import { getDiaryEntry } from "../src/lib/diary-service";
import { clients, saleItems, sales, products } from "../src/lib/db/postgres/schema";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { toDbBusinessId } from "../src/platform/db/business-id";
import { queryAll } from "../src/platform/db/query";
import {
  CLOSING_2026_10_14,
  CLOSING_2026_10_15,
  CLOSING_2026_10_16,
} from "../src/lib/finance/day-closing";

const DATES = ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-19"] as const;

async function main() {
  const biz = toDbBusinessId("salgados");
  const db = await getPostgresDb();

  console.log("=== DAY CLOSING (constantes canônicas + diário persistido) ===");
  for (const d of DATES) {
    const diary = await getDiaryEntry("salgados", d);
    const dc = diary?.dayClosing;
    const purchase = diary?.purchase;
    console.log(`\n--- ${d} diary=${diary ? "yes" : "no"} ---`);
    if (dc) {
      console.log({
        competenceStatus: dc.competenceStatus,
        competenceRevenue: dc.competenceRevenue,
        competenceProfit: dc.competenceProfit,
        cashIn: dc.cash.cashIn,
        salesReceived: dc.cash.salesReceived,
        priorSettlements: dc.cash.priorSettlements,
        otherInflows: dc.cash.otherInflows,
        ownCost: dc.costs.ownCost,
        thirdPartyCost: dc.costs.thirdPartyCost,
        totalNewCost: dc.costs.totalNewCost,
        ownCostPaymentDates: dc.costs.ownCostPaymentDates,
        newCredit: dc.newCredit,
        lossesAmount: dc.lossesAmount,
        lossesUnits: dc.lossesUnits,
        stockRemaining: dc.stockRemainingUnits,
        piggy: dc.piggyBank,
        operationalAudit: dc.operationalAudit,
        provisional: dc.provisionalCompetence,
      });
    }
    if (purchase) {
      console.log("purchase", {
        totalUnits: purchase.totalUnits,
        investment: purchase.investment,
        ownInvestment: purchase.ownInvestment,
        products: purchase.products,
      });
    }
    if (diary) {
      console.log("diary summary", {
        revenue: diary.revenue,
        profit: diary.profit,
        qtySold: diary.quantitySold,
        qtyLost: diary.quantityLost,
        lossReason: diary.lossReason,
      });
    }
  }

  console.log("\n=== CONSTANTES CLOSING (código) ===");
  for (const c of [CLOSING_2026_10_14, CLOSING_2026_10_15, CLOSING_2026_10_16]) {
    console.log(c.date, {
      ownCost: c.costs.ownCost,
      third: c.costs.thirdPartyCost,
      losses: `${c.lossesUnits}u R$${c.lossesAmount}`,
      stock: c.stockRemainingUnits,
      notes: c.reconciliation.notes.slice(0, 3),
      extra: c.reconciliation.notes.filter((n) => /sandu|custo|15\/10|estoque/i.test(n)),
    });
  }

  // All sandwich sales 14–19/10
  const sandwichRows = await queryAll(
    db
      .select({
        id: sales.id,
        saleDate: sales.saleDate,
        time: sales.saleTime,
        status: sales.paymentStatus,
        total: sales.totalAmount,
        received: sales.amountReceived,
        settlement: sales.settlementDate,
        notes: sales.notes,
        client: clients.name,
        product: products.name,
        qty: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        unitCost: saleItems.unitCost,
        totalCost: sales.totalCost,
        profit: sales.profit,
      })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .innerJoin(saleItems, eq(saleItems.saleId, sales.id))
      .innerJoin(products, eq(products.id, saleItems.productId))
      .where(
        and(
          eq(sales.businessId, biz),
          gte(sales.saleDate, "2026-10-13"),
          lte(sales.saleDate, "2026-10-19"),
          or(ilike(products.name, "%sandu%"), ilike(products.name, "%Sanduíche%")),
        ),
      )
      .orderBy(asc(sales.saleDate), asc(sales.saleTime)),
  );

  console.log("\n=== SANDUÍCHES NO BANCO (13–19/10) ===");
  let costSum = 0;
  let qtySum = 0;
  for (const r of sandwichRows) {
    const qc = Number(r.unitCost) || 0;
    const q = Number(r.qty) || 0;
    costSum += qc * q;
    qtySum += q;
    console.log(
      `${r.saleDate} ${r.time ?? "—"} | ${r.status} | ${r.qty}×${r.product} @${r.unitPrice} costU=${r.unitCost} totalCost=${r.totalCost} | R$${r.total} | ${r.client} | settle=${r.settlement ?? "—"} | id=${r.id.slice(0, 8)} | ${(r.notes ?? "").slice(0, 100)}`,
    );
  }
  console.log(`TOTAL sanduíches linhas: ${sandwichRows.length} · un=${qtySum} · Σ(unitCost×qty)=${costSum.toFixed(2)}`);

  // Ana Laura
  const ana = await queryAll(
    db
      .select({
        id: sales.id,
        saleDate: sales.saleDate,
        time: sales.saleTime,
        status: sales.paymentStatus,
        total: sales.totalAmount,
        createdAt: sales.createdAt,
        updatedAt: sales.updatedAt,
        notes: sales.notes,
        product: products.name,
        qty: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        unitCost: saleItems.unitCost,
      })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .leftJoin(saleItems, eq(saleItems.saleId, sales.id))
      .leftJoin(products, eq(products.id, saleItems.productId))
      .where(and(eq(sales.businessId, biz), eq(clients.name, "Ana Laura")))
      .orderBy(asc(sales.saleDate)),
  );
  console.log("\n=== ANA LAURA (todas) ===");
  for (const r of ana) {
    console.log(
      `${r.saleDate} ${r.time} | ${r.status} | ${r.qty}×${r.product}@${r.unitPrice} cost=${r.unitCost} | R$${r.total} | created=${r.createdAt?.toISOString?.() ?? r.createdAt} updated=${r.updatedAt?.toISOString?.() ?? r.updatedAt} | id=${r.id} | ${(r.notes ?? "").slice(0, 140)}`,
    );
  }

  // Natalia
  const natalia = sandwichRows.filter((r) => /natál|natal/i.test(r.client));
  console.log("\n=== NATÁLIA ===");
  console.log(JSON.stringify(natalia, null, 2));

  // Aggregates by day for sandwiches
  console.log("\n=== AGG SANDUÍCHE POR DIA ===");
  const byDay = new Map<string, { paid: number; pending: number; qtyPaid: number; qtyPend: number; cost: number }>();
  for (const r of sandwichRows) {
    const d = r.saleDate;
    let a = byDay.get(d);
    if (!a) {
      a = { paid: 0, pending: 0, qtyPaid: 0, qtyPend: 0, cost: 0 };
      byDay.set(d, a);
    }
    const amt = Number(r.total) || 0;
    const q = Number(r.qty) || 0;
    const c = (Number(r.unitCost) || 0) * q;
    a.cost += c;
    if (r.status === "paid") {
      a.paid += amt;
      a.qtyPaid += q;
    } else {
      a.pending += amt;
      a.qtyPend += q;
    }
  }
  for (const [d, a] of [...byDay.entries()].sort()) {
    console.log(d, a);
  }

  // All sales cost on 15 and 16 (COGS por item — distinto do ownCost do fechamento)
  for (const d of ["2026-10-15", "2026-10-16"] as const) {
    const items = await queryAll(
      db
        .select({
          product: products.name,
          qty: sql<number>`coalesce(sum(${saleItems.quantity}),0)::int`,
          cost: sql<number>`coalesce(sum((${saleItems.quantity})::numeric * (${saleItems.unitCost})::numeric),0)::float`,
          revenue: sql<number>`coalesce(sum((${saleItems.quantity})::numeric * (${saleItems.unitPrice})::numeric),0)::float`,
        })
        .from(saleItems)
        .innerJoin(sales, eq(sales.id, saleItems.saleId))
        .innerJoin(products, eq(products.id, saleItems.productId))
        .where(and(eq(sales.businessId, biz), eq(sales.saleDate, d)))
        .groupBy(products.name),
    );
    console.log(`\n=== COGS POR PRODUTO (sale_items) ${d} ===`);
    console.log(items);
  }

  // 15/10 observations excerpt
  const d15 = await getDiaryEntry("salgados", "2026-10-15");
  const d16 = await getDiaryEntry("salgados", "2026-10-16");
  console.log("\n=== OBS 15/10 (trechos custo/sanduíche) ===");
  console.log(
    (d15?.observations ?? "")
      .split("\n")
      .filter((l) => /sandu|custo|estoque|16|cofrinho/i.test(l))
      .join("\n"),
  );
  console.log("\n=== OBS 16/10 (trechos) ===");
  console.log(
    (d16?.observations ?? "")
      .split("\n")
      .filter((l) => /sandu|custo|estoque|15\/10|Ana Laura|Natál/i.test(l))
      .join("\n"),
  );
  console.log("\n=== EXTRA NOTES CLOSING 15/16 ===");
  console.log("15:", CLOSING_2026_10_15.reconciliation.notes.filter((n) => /sandu|custo|estoque/i.test(n)));
  console.log("16:", CLOSING_2026_10_16.reconciliation.notes.filter((n) => /sandu|custo|estoque|15/i.test(n)));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
