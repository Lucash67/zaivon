import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as pgSchema from "@/lib/db/postgres/schema";
import { getDatabaseUrl } from "@/platform/db/config";

const schema = pgSchema;

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function getPostgresDb() {
  if (dbInstance) return dbInstance;

  client = postgres(getDatabaseUrl(), {
    prepare: false,
    // Poucas conexões por instância serverless. max 10 × vários isolates
    // estoura o pooler do Supabase e as rotas pesadas ficam em timeout.
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  dbInstance = drizzle(client, { schema });
  // O schema de auth/tenant já está aplicado. Rodar CREATE/ALTER/DROP
  // em todo cold start trava `businesses` quando 2–3 requests coincidem.
  return dbInstance;
}

export async function runPostgresTransaction<T>(fn: (db: NonNullable<typeof dbInstance>) => Promise<T>): Promise<T> {
  const db = await getPostgresDb();
  return db.transaction(fn);
}

export async function closePostgresConnection(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    dbInstance = null;
  }
}

export { schema as postgresSchema };
