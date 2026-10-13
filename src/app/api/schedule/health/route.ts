import { NextResponse } from "next/server";
import postgres from "postgres";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import {
  getScheduleContext,
  needsScheduleOnboarding,
  toPublicScheduleOrganization,
} from "@/lib/schedule/context";
import { getDatabaseUrl } from "@/platform/db/config";

/** Healthcheck do produto Schedule — schema isolado, sem criar organização. */
export async function GET() {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;

  const sql = postgres(getDatabaseUrl(), { prepare: false, max: 1 });
  try {
    const found = await sql`
      SELECT 1 AS ok FROM information_schema.schemata WHERE schema_name = 'schedule' LIMIT 1
    `;
    const tables = await sql`
      SELECT COUNT(*)::int AS n
      FROM information_schema.tables
      WHERE table_schema = 'schedule'
    `;
    const ctx = await getScheduleContext(auth.id);
    return NextResponse.json({
      product: "ZAIVON Schedule",
      schema: "schedule",
      ready: found.length > 0,
      tables: tables[0]?.n ?? 0,
      userId: auth.id,
      organization: toPublicScheduleOrganization(ctx.organization),
      role: ctx.role,
      needsOnboarding: needsScheduleOnboarding(ctx),
    });
  } catch (error) {
    console.error("Schedule health error:", error);
    return NextResponse.json(
      { product: "ZAIVON Schedule", schema: "schedule", ready: false },
      { status: 503 },
    );
  } finally {
    await sql.end({ timeout: 2 });
  }
}
