/**
 * Regressão das 5 dimensões financeiras de 15/10 (read-only).
 * Uso: pnpm tsx scripts/assert-day-finance-1510.ts
 */
import "./load-env";
import { getDiaryEntry } from "../src/lib/diary-service";
import { dayChecks, dayFinance, impliedYield } from "../src/lib/zaivon/finance/day";
import type { MonthPlan, OperationDay, Settlement } from "../src/lib/zaivon/types";
import { CLOSING_2026_10_15 } from "../src/lib/finance/day-closing";

const DATE = "2026-10-15";

async function main() {
  const diary = await getDiaryEntry("salgados", DATE);
  if (!diary?.dayClosing) throw new Error("15/10 sem dayClosing persistido");
  const dc = diary.dayClosing;

  const day: OperationDay = {
    date: DATE,
    receivedBase: dc.cash.salesReceived,
    ownCost: dc.costs.ownCost,
    thirdPartyCost: dc.costs.thirdPartyCost,
    bonus: diary.bonusIncome ?? 0,
    soldUnits: diary.quantitySold,
    lostUnits: diary.quantityLost,
    cofrinhoEnd: dc.piggyBank.closingBalance,
    lines: [],
    closure: "closed_with_note",
    competenceRevenue: dc.competenceRevenue,
    competenceProfit: dc.competenceProfit,
    competenceStatus: dc.competenceStatus,
    newCredit: dc.newCredit,
    dayClosing: dc,
  };

  const prev: OperationDay = {
    ...day,
    date: "2026-10-14",
    cofrinhoEnd: dc.piggyBank.openingBalance,
    dayClosing: undefined,
    lines: [],
  };

  const settlements: Settlement[] = [
    { id: "s", person: "prior", originDate: "2026-10-14", paidDate: DATE, amount: 25 },
  ];
  const plan: MonthPlan = {
    month: "2026-10",
    label: "Outubro",
    goal: 5000,
    dailyTarget: 200,
    holidays: [],
    practicalAtStart: 4000,
    scenarios: { conservative: 4000, ambitious: 6000 },
    indicators: {
      profitPerDay: 150,
      unitsPerDay: [30, 40],
      ownCapitalPerDay: [80, 120],
      thirdPartyMaxPerDay: 0,
      maxLossesPerDay: 2,
    },
  };

  const f = dayFinance(day, settlements);
  const y = impliedYield(day, [prev, day], settlements, plan);
  const checks = dayChecks(day, [prev, day], settlements, plan);

  const expect: Array<[string, number, number]> = [
    ["cashIn", f.cashIn, 217],
    ["otherInflows", f.otherInflows, 19],
    ["salesReceived", f.received, 173],
    ["settlements", f.settlements, 25],
    ["operationalProfit", f.operationalProfit, 107],
    ["profit", f.profit, 107],
    ["competenceRevenue", f.competenceRevenue, 198],
    ["competenceProfit", f.competenceProfit, 88],
    ["piggyClosing", dc.piggyBank.closingBalance, 4725.44],
    ["piggyDeposit", dc.piggyBank.deposit, 107],
    ["buildDayClosing cashIn", CLOSING_2026_10_15.cash.cashIn, 217],
    ["buildDayClosing result", CLOSING_2026_10_15.cashManagementResult, 107],
  ];

  let failed = 0;
  for (const [label, got, want] of expect) {
    const ok = Math.abs(got - want) < 0.001;
    console.log(`${ok ? "✓" : "✗"} ${label}: ${got} (esperado ${want})`);
    if (!ok) failed++;
  }

  console.log(`${f.competenceStatus === "provisional" ? "✓" : "✗"} competenceStatus: ${f.competenceStatus}`);
  if (f.competenceStatus !== "provisional") failed++;

  console.log(`${y != null && Math.abs(y) < 0.01 ? "✓" : "✗"} impliedYield: ${y}`);
  if (y == null || Math.abs(y) >= 0.01) failed++;

  const cof = checks.find((c) => c.id === "cofrinho");
  console.log(`${cof?.ok === true ? "✓" : "✗"} batimento cofrinho ok=${cof?.ok} · ${cof?.detail}`);
  if (cof?.ok !== true) failed++;

  const fis = checks.find((c) => c.id === "fisico");
  const fin = checks.find((c) => c.id === "financeiro");
  console.log(`· batimento físico: ok=${fis?.ok} · ${fis?.detail}`);
  console.log(`· batimento financeiro: ok=${fin?.ok} · ${fin?.detail}`);

  // 16/10 pode existir; não pode ter sido alterado por regressões de 15/10
  const d16 = await getDiaryEntry("salgados", "2026-10-16");
  if (d16?.dayClosing) {
    const ok16 =
      Math.abs(d16.dayClosing.cash.cashIn - 207) < 0.01 &&
      Math.abs(d16.dayClosing.piggyBank.deposit - 127) < 0.01;
    console.log(`${ok16 ? "✓" : "✗"} 16/10 intacto (cashIn 207 · depósito 127)`);
    if (!ok16) failed++;
  } else {
    console.log("· 16/10 ainda sem dayClosing (ok se não registrado)");
  }

  if (failed) {
    console.error(`ASSERT_FAIL ${failed}`);
    process.exit(1);
  }
  console.log("ASSERT_OK — 5 dimensões 15/10");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
