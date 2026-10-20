import "./load-env";
import { eq } from "drizzle-orm";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { users } from "../src/lib/db/postgres/schema";
import { queryAll } from "../src/platform/db/query";
import { listIdeaItems } from "../src/platform/db/repositories/idea-repository";

async function main() {
  const email = process.env.LBO_OWNER_EMAIL?.trim() || "lucashcampos667@gmail.com";
  const db = await getPostgresDb();
  const rows = await queryAll(
    db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email)),
  );
  const owner = rows[0];
  if (!owner) throw new Error(`Usuário não encontrado: ${email}`);
  const items = await listIdeaItems(owner.id, { includeArchived: true });
  console.log(`owner=${owner.email} ideias=${items.length}`);
  for (const i of items) {
    console.log(
      `\n[${i.status}/${i.kind}${i.pinned ? "/PIN" : ""}] ${i.id}\n  ${i.title}\n  ${(i.body ?? "").replace(/\s+/g, " ").slice(0, 160)}`,
    );
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
