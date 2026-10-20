import "./load-env";
import { and, eq, inArray } from "drizzle-orm";
import { getDiaryEntry } from "../src/lib/diary-service";
import { listSettingsMap } from "../src/platform/db/repositories/settings-repository";
import { clients, sales } from "../src/lib/db/postgres/schema";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { toDbBusinessId } from "../src/platform/db/business-id";
import { queryAll } from "../src/platform/db/query";

const META_KEY = "omni_v2_meta_salgados";

async function main() {
  const raw = (await listSettingsMap())[META_KEY];
  const meta = raw ? (JSON.parse(raw) as { lossSaleIds?: string[] }) : {};
  const lost = new Set(meta.lossSaleIds ?? []);

  const db = await getPostgresDb();
  const rows = await queryAll(
    db
      .select({
        id: sales.id,
        date: sales.saleDate,
        total: sales.totalAmount,
        status: sales.paymentStatus,
      })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, toDbBusinessId("salgados")),
          eq(clients.name, "Maria Mikelly Monteiro Coutinho"),
          inArray(sales.paymentStatus, ["pending", "partial"]),
        ),
      ),
  );

  const active = rows.filter((r) => !lost.has(r.id));
  const written = rows.filter((r) => lost.has(r.id));
  console.log(
    "cobrança ativa:",
    active.map((r) => ({ date: r.date, amount: r.total, id: r.id.slice(0, 8) })),
  );
  console.log(
    "inadimplência (lossSaleIds):",
    written.map((r) => ({ date: r.date, amount: r.total, id: r.id.slice(0, 8) })),
  );

  const d16 = await getDiaryEntry("salgados", "2026-10-16");
  console.log("16/10", {
    cashIn: d16?.dayClosing?.cash.cashIn,
    deposit: d16?.dayClosing?.piggyBank.deposit,
    piggy: d16?.dayClosing?.piggyBank.closingBalance,
    lossesAmount: d16?.dayClosing?.lossesAmount,
  });

  const hasFiado15 = active.some((r) => r.date === "2026-10-15" && Math.abs(Number(r.total) - 5) < 0.01);
  const hasFiado19 = active.some((r) => r.date === "2026-10-19" && Math.abs(Number(r.total) - 7) < 0.01);
  const ok =
    hasFiado15 &&
    hasFiado19 &&
    written.some((r) => r.id.startsWith("4834b3a8") && Math.abs(Number(r.total) - 7) < 0.01) &&
    !active.some((r) => r.id.startsWith("4834b3a8")) &&
    Math.abs((d16?.dayClosing?.cash.cashIn ?? 0) - 207) < 0.01 &&
    Math.abs((d16?.dayClosing?.lossesAmount ?? 0) - 5) < 0.01;

  console.log(ok ? "VERIFY_OK" : "VERIFY_FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
