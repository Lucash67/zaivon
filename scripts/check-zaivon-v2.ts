/**
 * Confere os números da ZAIVON v2 (/v2) com o banco: lucro por dia, batimento do cofrinho,
 * resumo do mês, pendências e tendência.
 *   npx tsx scripts/check-zaivon-v2.ts [aaaa-mm]
 */
import "./load-env";
import { getZaivonData } from "../src/lib/zaivon/zaivon-service";
import { dayChecks, dayFinance, recovery } from "../src/lib/zaivon/finance/day";
import { monthDays, monthSummary, toHistory } from "../src/lib/zaivon/finance/month";
import { computeTrend } from "../src/lib/zaivon/finance/trend";

async function main() {
  const o = await getZaivonData(process.argv[2]);
  console.log(`\n${o.plan.label} · hoje ${o.today}`);
  for (const d of o.days) {
    const f = dayFinance(d, o.settlements);
    const cof = dayChecks(d, o.days, o.settlements, o.plan).find((c) => c.id === "cofrinho")!;
    console.log(
      `${d.date}  caixa ${f.cashIn.toFixed(2)} (dia ${f.received} + quit ${f.settlements})  bônus ${f.bonus}  meu custo ${f.ownCost}  terceiros ${f.thirdPartyCost}  lucro ${f.profit}  cofrinho ${d.cofrinhoEnd ?? "—"}  ${cof.ok == null ? "sem dado" : cof.ok ? "OK" : "REVISAR"} ${cof.detail}`,
    );
  }
  const ms = monthSummary(o.days, o.settlements, o.plan);
  console.log("\nResumo:", ms);
  const rec = recovery(o.debts);
  console.log("\nA recuperar:", rec);
  const byMonth = new Map<string, number>();
  for (const d of o.debts.filter((x) => x.status === "open")) byMonth.set(d.originDate.slice(0, 7), (byMonth.get(d.originDate.slice(0, 7)) ?? 0) + d.amount - d.paid);
  console.log("Por mês de origem:", Object.fromEntries(byMonth));
  const t = computeTrend(toHistory(monthDays(o.days, o.plan), o.settlements), o.previousHistory, o.plan, ms);
  console.log("\nTendência:", {
    monthAvg: t.monthAvg,
    prevMonthAvg: t.prevMonthAvg,
    weekAvg: t.weekAvg,
    last10: t.last10,
    projectedProfit: t.projectedProfit,
    projectedBank: t.projectedBank,
    revisedGoal: t.revisedGoal,
  });
  console.log("Mês anterior:", o.previousMonth, `${o.previousHistory.length} dias`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
