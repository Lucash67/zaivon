import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/shared/api-messages";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";
import { requireTenantBusinessWrite } from "@/lib/auth/tenant-scope";
import { SALGADOS_BUSINESS_ID } from "@/lib/business-units";
import {
  closeDay,
  commitDraft,
  getOmniData,
  markDebtAsLoss,
  previewDraft,
  registerPayment,
  registerPurchase,
  registerQuickSale,
  registerWaste,
  setDayCofrinho,
} from "@/lib/omni/omni-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, SALGADOS_BUSINESS_ID, async () => {
      const month = request.nextUrl.searchParams.get("month") ?? undefined;
      return NextResponse.json(await getOmniData(month));
    });
  } catch (error) {
    console.error("OMNI GET error:", error);
    return apiError("Não foi possível carregar a OMNI.");
  }
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pay"), person: z.string().min(1), amount: z.number().positive(), paidDate: isoDate }),
  z.object({ action: z.literal("cofrinho"), date: isoDate, amount: z.number().positive() }),
  z.object({
    action: z.literal("close"),
    date: isoDate,
    status: z.enum(["closed", "closed_with_note", "draft"]),
    note: z.string().optional(),
    cofrinho: z.number().positive().optional(),
  }),
  z.object({ action: z.literal("loss"), debtId: z.string().uuid() }),
  z.object({
    action: z.literal("sale"),
    date: isoDate,
    product: z.enum(["salgado", "sanduiche"]),
    channel: z.enum(["acal", "unifor", "meia_sola", "henrique"]),
    qty: z.number().int().min(1).max(500),
    status: z.enum(["paid", "fiado", "parceiro", "investigar"]),
    person: z.string().max(120).optional(),
    payment: z.enum(["pix", "card", "cash"]),
  }),
  z.object({
    action: z.literal("purchase"),
    date: isoDate,
    units: z.number().int().min(0).max(5000),
    own: z.number().min(0),
    third: z.number().min(0),
    thirdName: z.string().max(80).optional(),
  }),
  z.object({ action: z.literal("waste"), date: isoDate, qty: z.number().int().min(1).max(500), reason: z.string().max(300).optional() }),
  z.object({ action: z.literal("draftPreview"), date: isoDate, text: z.string().min(1).max(50_000) }),
  z.object({
    action: z.literal("draftCommit"),
    date: isoDate,
    text: z.string().min(1).max(50_000),
    settlements: z.array(z.object({ person: z.string().min(1), amount: z.number().positive() })).max(50).default([]),
  }),
]);

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const body = parsed.data;
  try {
    return await withTenantScope(auth, SALGADOS_BUSINESS_ID, async (scope) => {
      if (body.action !== "draftPreview") requireTenantBusinessWrite(scope, SALGADOS_BUSINESS_ID);
      switch (body.action) {
        case "pay":
          return NextResponse.json(await registerPayment(body.person, body.amount, body.paidDate));
        case "cofrinho":
          await setDayCofrinho(body.date, body.amount);
          break;
        case "close":
          await closeDay(body.date, body.status, body.note, body.cofrinho);
          break;
        case "loss":
          await markDebtAsLoss(body.debtId);
          break;
        case "sale":
          return NextResponse.json(await registerQuickSale(body));
        case "purchase":
          await registerPurchase(body);
          break;
        case "waste":
          await registerWaste(body);
          break;
        case "draftPreview":
          return NextResponse.json(await previewDraft(body.text, body.date));
        case "draftCommit":
          return NextResponse.json(await commitDraft(body.text, body.date, body.settlements));
      }
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    console.error("OMNI POST error:", error);
    return apiError(error instanceof Error && error.message ? error.message : "Não foi possível salvar.", 400);
  }
}
