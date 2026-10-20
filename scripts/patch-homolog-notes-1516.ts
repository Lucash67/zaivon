/**
 * Atualiza APENAS notas/operationalAudit de 15 e 16/10 (valores financeiros intactos).
 * Uso: pnpm tsx scripts/patch-homolog-notes-1516.ts [--dry]
 */
import "./load-env";
import { getDiaryEntry, upsertDiaryEntry } from "../src/lib/diary-service";
import { CLOSING_2026_10_15, CLOSING_2026_10_16 } from "../src/lib/finance/day-closing";

async function patch(date: string, closing: typeof CLOSING_2026_10_15) {
  const entry = await getDiaryEntry("salgados", date);
  if (!entry?.dayClosing) throw new Error(`${date}: sem dayClosing`);

  const before = entry.dayClosing;
  const moneyOk =
    Math.abs(before.cash.cashIn - closing.cash.cashIn) < 0.01 &&
    Math.abs(before.costs.ownCost - closing.costs.ownCost) < 0.01 &&
    Math.abs(before.piggyBank.closingBalance - closing.piggyBank.closingBalance) < 0.01 &&
    Math.abs(before.cashManagementResult - closing.cashManagementResult) < 0.01;

  if (!moneyOk) {
    throw new Error(`${date}: valores financeiros divergem do canônico — abortando patch de notas`);
  }

  console.log(`${date}: $ OK — atualizando notas/operationalAudit only`);
  if (process.argv.includes("--dry")) return;

  const { id: _id, createdAt: _c, ...rest } = entry;
  await upsertDiaryEntry({
    ...rest,
    dayClosing: closing,
    observations: [
      ...(rest.observations ? [rest.observations, "---"] : []),
      `HOMOLOGAÇÃO FINAL 19/10/2026 — notas técnicas atualizadas; valores financeiros preservados (caixa ${closing.cash.cashIn}, ownCost ${closing.costs.ownCost}, cofrinho ${closing.piggyBank.closingBalance}).`,
    ].join("\n"),
    tags: Array.from(new Set([...(rest.tags ?? []), "homolog-final-1516-19"])),
  });

  const saved = await getDiaryEntry("salgados", date);
  if (!saved?.dayClosing) throw new Error(`${date}: dayClosing sumiu`);
  if (Math.abs(saved.dayClosing.cash.cashIn - before.cash.cashIn) > 0.01) {
    throw new Error(`${date}: cashIn mudou após patch!`);
  }
  console.log(`  ✓ ${date} notas persistidas · cashIn=${saved.dayClosing.cash.cashIn}`);
}

async function main() {
  await patch("2026-10-15", CLOSING_2026_10_15);
  await patch("2026-10-16", CLOSING_2026_10_16);
  console.log(process.argv.includes("--dry") ? "DRY_OK" : "PATCH_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
