/**
 * Assert homologação final 15/16/19/10.
 * Uso: pnpm tsx scripts/assert-homolog-1516-19.ts
 */
import "./load-env";
import { getDiaryEntry } from "../src/lib/diary-service";
import { countSalesForDate } from "@/platform/db/repositories/sale-repository";

async function main() {
  const d15 = await getDiaryEntry("salgados", "2026-10-15");
  const d16 = await getDiaryEntry("salgados", "2026-10-16");
  const d19 = await getDiaryEntry("salgados", "2026-10-19");
  const n19 = await countSalesForDate("salgados", "2026-10-19");

  const checks: [string, boolean][] = [
    ["15 cashIn 217", Math.abs((d15?.dayClosing?.cash.cashIn ?? 0) - 217) < 0.01],
    ["15 ownCost 110", Math.abs((d15?.dayClosing?.costs.ownCost ?? 0) - 110) < 0.01],
    ["15 cashMgmt 107", Math.abs((d15?.dayClosing?.cashManagementResult ?? 0) - 107) < 0.01],
    ["15 otherInflows 19", Math.abs((d15?.dayClosing?.cash.otherInflows ?? 0) - 19) < 0.01],
    ["15 deposit 107", Math.abs((d15?.dayClosing?.piggyBank.deposit ?? 0) - 107) < 0.01],
    ["15 piggy 4725.44", Math.abs((d15?.dayClosing?.piggyBank.closingBalance ?? 0) - 4725.44) < 0.01],
    ["16 cashIn 207", Math.abs((d16?.dayClosing?.cash.cashIn ?? 0) - 207) < 0.01],
    ["16 ownCost 93.3", Math.abs((d16?.dayClosing?.costs.ownCost ?? 0) - 93.3) < 0.01],
    ["16 cashMgmt 113.7", Math.abs((d16?.dayClosing?.cashManagementResult ?? 0) - 113.7) < 0.01],
    ["16 deposit 127", Math.abs((d16?.dayClosing?.piggyBank.deposit ?? 0) - 127) < 0.01],
    ["16 piggy 4854.52", Math.abs((d16?.dayClosing?.piggyBank.closingBalance ?? 0) - 4854.52) < 0.01],
    ["16 sandwich diverged", d16?.dayClosing?.operationalAudit?.sandwiches?.status === "diverged"],
    ["19 sales n>=8", n19 >= 8],
    ["19 cashIn 118", Math.abs((d19?.dayClosing?.cash.cashIn ?? 0) - 118) < 0.01],
    ["19 ownCost 110", Math.abs((d19?.dayClosing?.costs.ownCost ?? 0) - 110) < 0.01],
    ["19 competence 170", Math.abs((d19?.dayClosing?.competenceRevenue ?? 0) - 170) < 0.01],
    ["19 profit 60", Math.abs((d19?.dayClosing?.competenceProfit ?? 0) - 60) < 0.01],
    ["19 cashMgmt 8", Math.abs((d19?.dayClosing?.cashManagementResult ?? 0) - 8) < 0.01],
    ["19 deposit 118", Math.abs((d19?.dayClosing?.piggyBank.deposit ?? 0) - 118) < 0.01],
    ["19 piggy 4974.61", Math.abs((d19?.dayClosing?.piggyBank.closingBalance ?? 0) - 4974.61) < 0.01],
    ["19 bankYield 0", Math.abs((d19?.dayClosing?.piggyBank.bankYield ?? -1) - 0) < 0.01],
    ["19 newCredit 52", Math.abs((d19?.dayClosing?.newCredit ?? 0) - 52) < 0.01],
    ["19 losses 25", Math.abs((d19?.dayClosing?.lossesAmount ?? 0) - 25) < 0.01],
  ];

  let fail = 0;
  for (const [label, ok] of checks) {
    console.log(ok ? `✓ ${label}` : `✗ ${label}`);
    if (!ok) fail++;
  }
  console.log(fail === 0 ? "ASSERT_HOMOLOG_OK" : `ASSERT_HOMOLOG_FAIL (${fail})`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
