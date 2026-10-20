/**
 * Verificação pós-registro 16/10.
 */
import "./load-env";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDiaryEntry } from "../src/lib/diary-service";
import { dayFinance } from "../src/lib/zaivon/finance/day";
import type { OperationDay, Settlement } from "../src/lib/zaivon/types";
import { clients, sales } from "../src/lib/db/postgres/schema";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { toDbBusinessId } from "../src/platform/db/business-id";
import { queryAll } from "../src/platform/db/query";
import { countSalesForDate } from "@/platform/db/repositories/sale-repository";

async function openSum(name: string): Promise<number> {
  const db = await getPostgresDb();
  const rows = await queryAll(
    db
      .select({ total: sales.totalAmount, received: sales.amountReceived, status: sales.paymentStatus })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, toDbBusinessId("salgados")),
          eq(clients.name, name),
          inArray(sales.paymentStatus, ["pending", "partial"]),
        ),
      ),
  );
  return rows.reduce((s, r) => {
    const t = Number(r.total) || 0;
    const a = r.status === "partial" ? Number(r.received) || 0 : 0;
    return s + (t - a);
  }, 0);
}

async function main() {
  const d16 = await getDiaryEntry("salgados", "2026-10-16");
  const d15 = await getDiaryEntry("salgados", "2026-10-15");
  const dc = d16?.dayClosing;
  if (!dc) throw new Error("sem dayClosing 16/10");

  const day: OperationDay = {
    date: "2026-10-16",
    receivedBase: dc.cash.salesReceived,
    ownCost: dc.costs.ownCost,
    thirdPartyCost: 0,
    bonus: 0,
    soldUnits: d16!.quantitySold,
    lostUnits: d16!.quantityLost,
    cofrinhoEnd: dc.piggyBank.closingBalance,
    lines: [],
    closure: "closed_with_note",
    competenceRevenue: dc.competenceRevenue,
    competenceProfit: dc.competenceProfit,
    competenceStatus: dc.competenceStatus,
    newCredit: dc.newCredit,
    dayClosing: dc,
  };
  const settlements: Settlement[] = [
    { id: "a", person: "x", originDate: "2026-10-15", paidDate: "2026-10-16", amount: 53 },
  ];
  const f = dayFinance(day, settlements);

  const checks: [string, number, number][] = [
    ["UI cashIn", f.cashIn, 207],
    ["UI result", f.operationalProfit, 113.7],
    ["UI fat", f.competenceRevenue, 168],
    ["UI lucro", f.competenceProfit, 74.7],
    ["deposit", dc.piggyBank.deposit, 127],
    ["piggy", dc.piggyBank.closingBalance, 4854.52],
    ["losses", dc.lossesAmount, 5],
    ["stock", dc.stockRemainingUnits, 7],
    ["15/10 cashIn intact", d15!.dayClosing!.cash.cashIn, 217],
  ];
  let fail = 0;
  for (const [l, g, w] of checks) {
    const ok = Math.abs(g - w) < 0.02;
    console.log(`${ok ? "✓" : "✗"} ${l}: ${g}`);
    if (!ok) fail++;
  }
  console.log(`${f.competenceStatus === "provisional" ? "✓" : "✗"} provisional`);

  const sales16 = await countSalesForDate("salgados", "2026-10-16");
  console.log(`· sales 16/10: ${sales16}`);

  const db = await getPostgresDb();
  const settled16 = await queryAll(
    db
      .select({
        n: sql<number>`count(*)::int`,
        sum: sql<number>`coalesce(sum(${sales.totalAmount}),0)::float`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.businessId, toDbBusinessId("salgados")),
          eq(sales.settlementDate, "2026-10-16"),
          eq(sales.paymentStatus, "paid"),
          sql`${sales.saleDate} < ${"2026-10-16"}`,
        ),
      ),
  );
  console.log(`· quitações settlement_date=16/10 (sale_date<16): n=${settled16[0]?.n} sum=${settled16[0]?.sum}`);

  const names = [
    ["Ana Laura", 28],
    ["Maria Mikelly Monteiro Coutinho", 12], // sistema após R$43; alvo operacional era 7
    ["Bernardo Ferreira Domingo", 5],
    ["João Victor dos Santos Carvalho", 0],
    ["Joao Lucas Eloi Pinto", 0],
    ["Carlos Eduardo", 0],
  ] as const;
  for (const [name, want] of names) {
    const got = await openSum(name);
    const ok = Math.abs(got - want) < 0.02;
    console.log(`${ok ? "✓" : "✗"} aberto ${name}: R$${got} (esperado sistema ${want})`);
    if (!ok) fail++;
  }

  if (fail) {
    console.error(`VERIFY_FAIL ${fail}`);
    process.exit(1);
  }
  console.log("VERIFY_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
