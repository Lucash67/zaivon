/**
 * Regressão dashboard: 15/10 e 16/10 (5 dimensões + cofrinho + batimentos).
 */
import "./load-env";
import { dayChecks, dayFinance, impliedYield, recovery } from "../src/lib/zaivon/finance/day";
import { getZaivonData } from "../src/lib/zaivon/zaivon-service";

async function main() {
  const data = await getZaivonData("2026-10");
  let fail = 0;

  const d15 = data.days.find((d) => d.date === "2026-10-15");
  const d16 = data.days.find((d) => d.date === "2026-10-16");
  if (!d15?.dayClosing || !d16?.dayClosing) throw new Error("dias ausentes");

  const f15 = dayFinance(d15, data.settlements);
  const f16 = dayFinance(d16, data.settlements);
  const y15 = impliedYield(d15, data.days, data.settlements, data.plan);
  const y16 = impliedYield(d16, data.days, data.settlements, data.plan);
  const c15 = dayChecks(d15, data.days, data.settlements, data.plan);
  const c16 = dayChecks(d16, data.days, data.settlements, data.plan);

  const checks: [string, boolean][] = [
    ["15 cashIn 217", Math.abs(f15.cashIn - 217) < 0.01],
    ["15 result 107", Math.abs(f15.operationalProfit - 107) < 0.01],
    ["15 yield ~0", y15 != null && Math.abs(y15) < 0.01],
    ["15 cof ok", c15.find((c) => c.id === "cofrinho")?.ok === true],
    ["16 cashIn 207", Math.abs(f16.cashIn - 207) < 0.01],
    ["16 result 113.7", Math.abs(f16.operationalProfit - 113.7) < 0.01],
    ["16 fat 168", Math.abs(f16.competenceRevenue - 168) < 0.01],
    ["16 deposit 127", Math.abs((d16.dayClosing?.piggyBank.deposit ?? 0) - 127) < 0.01],
    ["16 piggy 4854.52", Math.abs((d16.cofrinhoEnd ?? 0) - 4854.52) < 0.01],
    ["16 yield ~0 (não 15,38)", y16 != null && Math.abs(y16) < 0.01],
    ["16 cof ok", c16.find((c) => c.id === "cofrinho")?.ok === true],
    ["16 fisico parcial (sanduíches)", c16.find((c) => c.id === "fisico")?.ok === null],
    ["16 financeiro parcial", c16.find((c) => c.id === "financeiro")?.ok === null],
  ];

  for (const [label, ok] of checks) {
    console.log(`${ok ? "✓" : "✗"} ${label}`);
    if (!ok) fail++;
  }

  console.log("16 yield=", y16, "15 yield=", y15);
  console.log(
    "16 checks:",
    c16.map((c) => `${c.id}:${c.ok}`),
  );

  const rec = recovery(data.debts);
  const anaDeferred = data.debts.filter(
    (d) => d.person === "Ana Laura" && d.status === "open" && d.deferredUntil === "2026-11-07",
  );
  const mikellyOpen = data.debts.filter(
    (d) => /Mikelly/i.test(d.person) && d.status === "open",
  );
  const mikellyLoss = data.debts.filter(
    (d) => /Mikelly/i.test(d.person) && d.status === "loss",
  );
  console.log({
    recoveryTotal: rec.total,
    recoveryFiado: rec.fiado,
    anaDeferred: anaDeferred.length,
    mikellyOpen: mikellyOpen.map((d) => d.amount),
    mikellyLoss: mikellyLoss.map((d) => d.amount),
  });

  const cobrancaOk =
    Math.abs(rec.fiado - 38) < 0.01 &&
    anaDeferred.length === 4 &&
    mikellyOpen.length === 1 &&
    Math.abs(mikellyOpen[0]!.amount - 5) < 0.01 &&
    mikellyLoss.some((d) => Math.abs(d.amount - 7) < 0.01);
  console.log(`${cobrancaOk ? "✓" : "✗"} cobranças R$38 · Ana Laura diferida · Mikelly 5 open / 7 loss`);
  if (!cobrancaOk) fail++;

  if (fail) {
    console.error(`ASSERT_FAIL ${fail}`);
    process.exit(1);
  }
  console.log("ASSERT_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
