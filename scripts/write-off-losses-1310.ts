/**
 * Baixa como perda (sem excluir) as pendências decididas em 13/10/2026:
 * Meia Sola 09/10, não identificados 09/10 e tudo em aberto de julho a setembro.
 * A venda continua gravada; só entra na lista de perdas e ganha uma nota.
 *   pnpm tsx scripts/write-off-losses-1310.ts [--dry]
 */
import "./load-env";
import { eq } from "drizzle-orm";
import { getZaivonData, markDebtAsLoss } from "../src/lib/zaivon/zaivon-service";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { sales } from "../src/lib/db/postgres/schema";
import { queryAll, queryRun } from "../src/platform/db/query";

const NOTE = "Baixado como perda em 13/10/2026 (decisão do fechamento) — mantido no histórico.";

async function main() {
  const o = await getZaivonData("2026-10");
  const open = o.debts.filter((d) => d.status === "open");
  const targets = open.filter(
    (d) =>
      d.originDate < "2026-10-01" ||
      (d.originDate === "2026-10-09" && (d.type === "parceiro" || d.type === "investigacao")),
  );
  const total = targets.reduce((s, d) => s + d.amount - d.paid, 0);
  for (const d of targets) console.log(` ${d.originDate} ${d.person} [${d.type}] R$${d.amount - d.paid} — ${d.description}`);
  console.log(`${targets.length} pendências · R$${total}`);
  if (Math.abs(total - 119) > 0.001) throw new Error(`Total R$${total} ≠ R$119 esperado`);
  if (process.argv.includes("--dry")) process.exit(0);

  const db = await getPostgresDb();
  for (const d of targets) {
    await markDebtAsLoss(d.id);
    const [row] = await queryAll(db.select({ notes: sales.notes }).from(sales).where(eq(sales.id, d.id)));
    if (row && !row.notes?.includes(NOTE)) {
      await queryRun(
        db
          .update(sales)
          .set({ notes: [row.notes, NOTE].filter(Boolean).join(" · "), updatedAt: new Date() })
          .where(eq(sales.id, d.id)),
      );
    }
  }

  const after = await getZaivonData("2026-10");
  const left = after.debts.filter((d) => d.status === "open");
  const lost = after.debts.filter((d) => d.status === "loss");
  console.log(`Abertas: ${left.length} · R$${left.reduce((s, d) => s + d.amount - d.paid, 0)}`);
  for (const d of left) console.log(`  ${d.originDate} ${d.person} R$${d.amount - d.paid}`);
  console.log(`Perdas registradas: ${lost.length} · R$${lost.reduce((s, d) => s + d.amount - d.paid, 0)}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
