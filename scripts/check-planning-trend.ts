/** Uso: pnpm tsx scripts/check-planning-trend.ts 2026-10 — imprime a tendência do Planejamento. */
import "./load-env";
import { getPlanningView } from "../src/lib/planning/planning-service";

async function main() {
  const view = await getPlanningView("salgados", process.argv[2] ?? "2026-10");
  console.log(JSON.stringify({ summary: view.summary, recent: view.recentAverage, trend: { ...view.trend, curve: undefined } }, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
