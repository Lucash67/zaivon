import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/shared/api-messages";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";
import { requireTenantBusinessWrite } from "@/lib/auth/tenant-scope";
import { SALGADOS_BUSINESS_ID, isAllBusinesses } from "@/lib/business-units";
import {
  deactivateParticipant,
  deliverLoyaltyReward,
  enrollParticipant,
  adjustLoyaltyProgress,
  scheduleLoyaltyReward,
  setSaleLoyaltyConfirmed,
} from "@/lib/loyalty/loyalty-service";
import {
  getLoyaltyClientDetail,
  getLoyaltyView,
  listLoyaltyClientsForEnroll,
} from "@/lib/loyalty/loyalty-view";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;

  try {
    const sp = request.nextUrl.searchParams;
    const businessId = sp.get("businessId");
    const clientId = sp.get("clientId");
    const weekStart = sp.get("weekStart") ?? undefined;
    const listClients = sp.get("listClients") === "1";

    return await withTenantScope(auth, businessId, async (scope) => {
      const scopedId = isAllBusinesses(scope.businessId) ? SALGADOS_BUSINESS_ID : scope.businessId;
      if (listClients) {
        const clients = await listLoyaltyClientsForEnroll(scopedId);
        return NextResponse.json({ clients });
      }
      if (clientId) {
        const detail = await getLoyaltyClientDetail(scopedId, clientId);
        return NextResponse.json({ detail });
      }
      const view = await getLoyaltyView(scopedId, weekStart);
      return NextResponse.json({ view });
    });
  } catch (error) {
    console.error("Loyalty GET error:", error);
    return apiError(error instanceof Error ? error.message : "Não foi possível carregar a fidelidade.");
  }
}

const enrollSchema = z.object({
  action: z.literal("enroll"),
  businessId: z.string().min(1),
  clientId: z.string().uuid(),
  notes: z.string().optional(),
});

const leaveSchema = z.object({
  action: z.literal("leave"),
  businessId: z.string().min(1),
  clientId: z.string().uuid(),
});

const confirmSaleSchema = z.object({
  action: z.literal("confirm_sale"),
  businessId: z.string().min(1),
  saleId: z.string().uuid(),
  confirmed: z.boolean(),
});

const adjustSchema = z.object({
  action: z.literal("adjust"),
  businessId: z.string().min(1),
  clientId: z.string().uuid(),
  dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.number().int().refine((n) => n !== 0),
  reason: z.string().min(1),
});

const scheduleSchema = z.object({
  action: z.literal("schedule_reward"),
  businessId: z.string().min(1),
  rewardId: z.string().uuid(),
  productId: z.string().uuid(),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observation: z.string().optional(),
});

const deliverSchema = z.object({
  action: z.literal("deliver_reward"),
  businessId: z.string().min(1),
  rewardId: z.string().uuid(),
  productId: z.string().uuid().optional(),
});

const bodySchema = z.discriminatedUnion("action", [
  enrollSchema,
  leaveSchema,
  confirmSaleSchema,
  adjustSchema,
  scheduleSchema,
  deliverSchema,
]);

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;

  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
    }
    const body = parsed.data;

    return await withTenantScope(auth, body.businessId, async (scope) => {
      const businessId = requireTenantBusinessWrite(scope, body.businessId);

      switch (body.action) {
        case "enroll": {
          await enrollParticipant({
            businessSlug: businessId,
            clientId: body.clientId,
            notes: body.notes,
            createdBy: auth.id,
          });
          return NextResponse.json({ ok: true });
        }
        case "leave": {
          await deactivateParticipant({
            businessSlug: businessId,
            clientId: body.clientId,
            createdBy: auth.id,
          });
          return NextResponse.json({ ok: true });
        }
        case "confirm_sale": {
          const result = await setSaleLoyaltyConfirmed({
            businessSlug: businessId,
            saleId: body.saleId,
            confirmed: body.confirmed,
            createdBy: auth.id,
          });
          return NextResponse.json({ result });
        }
        case "adjust": {
          const result = await adjustLoyaltyProgress({
            businessSlug: businessId,
            clientId: body.clientId,
            dateIso: body.dateIso,
            quantity: body.quantity,
            reason: body.reason,
            createdBy: auth.id,
          });
          return NextResponse.json({ result });
        }
        case "schedule_reward": {
          await scheduleLoyaltyReward({
            rewardId: body.rewardId,
            productId: body.productId,
            scheduledFor: body.scheduledFor,
            observation: body.observation,
            createdBy: auth.id,
          });
          return NextResponse.json({ ok: true });
        }
        case "deliver_reward": {
          const out = await deliverLoyaltyReward({
            businessSlug: businessId,
            rewardId: body.rewardId,
            productId: body.productId,
            deliveredBy: auth.id,
          });
          return NextResponse.json({ ok: true, saleId: out.saleId });
        }
        default:
          return apiError("Ação inválida.", 400);
      }
    });
  } catch (error) {
    console.error("Loyalty POST error:", error);
    return apiError(error instanceof Error ? error.message : "Falha na fidelidade.");
  }
}
