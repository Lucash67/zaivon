import { NextRequest, NextResponse } from "next/server";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";
import { SALGADOS_BUSINESS_ID } from "@/lib/business-units";
import { loadAuroraSnapshot } from "@/lib/finance/aurora-load";
import { apiError } from "@/shared/api-messages";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? from;
  if (!ISO.test(from) || !ISO.test(to)) return apiError("Informe o período.", 400);
  const span = Math.abs(Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (span > 62) return apiError("O período da homologação fica em até 62 dias.", 400);
  try {
    return await withTenantScope(auth, SALGADOS_BUSINESS_ID, async () => {
      const first = auth.name.trim().split(/\s+/)[0] || "Lucas";
      const snapshot = await loadAuroraSnapshot({ from, to, profileName: first });
      return NextResponse.json(snapshot);
    });
  } catch (error) {
    console.error("ZAIVON aurora GET error:", error);
    return apiError("Não foi possível montar a leitura operacional.");
  }
}
