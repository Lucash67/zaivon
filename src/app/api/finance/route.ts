import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { ensureFinanceSchema } from "@/lib/personal-finance/schema-bootstrap";
import {
  FinanceError,
  addFinanceAccount,
  addFinanceGoal,
  addFinanceRecurring,
  addFinanceTransaction,
  archiveFinanceGoal,
  deactivateFinanceRecurring,
  deleteFinanceTransaction,
  getFinanceSnapshot,
  applyFinanceDiagnosis,
  onboardFinance,
  setFinanceBudget,
  setMonthSpendTarget,
  setWeekSpend,
  startFinanceChallenge,
  updateFinanceProfile,
} from "@/lib/personal-finance/service";

export const dynamic = "force-dynamic";

const money = z.number().finite().positive().max(1_000_000_000);
const signedMoney = z.number().finite().min(-1_000_000_000).max(1_000_000_000);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const yearMonth = z.string().regex(/^\d{4}-\d{2}$/);
const id = z.string().uuid();
const direction = z.enum(["in", "out", "save"]);
const label = z.string().trim().min(1).max(40);
const diagnosisPayload = z.object({
  displayName: label,
  intent: z.enum(["organize", "breathe", "reserve", "debt"]),
  incomeSource: z.enum(["salary", "variable", "mixed", "none"]),
  monthlyIncome: z.number().finite().min(0).max(1_000_000_000),
  payday: z.number().int().min(1).max(28),
  fixed: z
    .array(
      z.object({
        category: z.enum(["Moradia", "Contas", "Mercado", "Transporte", "Assinaturas"]),
        amount: z.number().finite().positive().max(1_000_000_000),
      }),
    )
    .max(5),
  accountName: label,
  openingBalance: signedMoney,
  savingsBalance: z.number().finite().min(0).max(1_000_000_000).nullable(),
  cardDebt: z.number().finite().positive().max(1_000_000_000).nullable(),
  reserveTarget: z.number().finite().positive().max(1_000_000_000).nullable(),
});

export async function GET() {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    await ensureFinanceSchema();
    const snapshot = await getFinanceSnapshot(auth.id);
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    console.error("Finance GET:", error);
    return NextResponse.json({ ok: false, error: "Não consegui abrir seu Finance agora." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  const parsed = z.object({ action: z.string(), payload: z.unknown().optional() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  try {
    await ensureFinanceSchema();
    await dispatch(auth.id, parsed.data.action, parsed.data.payload ?? {});
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof FinanceError || error instanceof z.ZodError) {
      const message = error instanceof FinanceError ? error.message : "Confere os campos e tenta de novo.";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
    console.error("Finance POST:", error);
    return NextResponse.json({ ok: false, error: "Não consegui salvar agora." }, { status: 500 });
  }
}

async function dispatch(userId: string, action: string, payload: unknown) {
  switch (action) {
    case "onboard": {
      await onboardFinance(userId, diagnosisPayload.parse(payload));
      return;
    }
    case "applyDiagnosis": {
      await applyFinanceDiagnosis(userId, diagnosisPayload.parse(payload));
      return;
    }
    case "addTransaction": {
      const data = z
        .object({
          accountId: id,
          categoryId: id,
          direction,
          amount: money,
          occurredOn: isoDate,
          description: z.string().trim().max(140).optional(),
          goalId: id.nullable().optional(),
        })
        .parse(payload);
      await addFinanceTransaction(userId, {
        ...data,
        description: data.description ?? "",
        goalId: data.goalId ?? null,
      });
      return;
    }
    case "deleteTransaction": {
      const data = z.object({ transactionId: id }).parse(payload);
      await deleteFinanceTransaction(userId, data.transactionId);
      return;
    }
    case "addAccount": {
      const data = z
        .object({
          name: label,
          kind: z.enum(["checking", "savings", "cash", "credit", "investment"]),
          balance: signedMoney,
        })
        .parse(payload);
      await addFinanceAccount(userId, data);
      return;
    }
    case "addRecurring": {
      const data = z
        .object({
          name: label,
          amount: money,
          direction,
          accountId: id,
          categoryId: id,
          cadence: z.enum(["monthly", "weekly"]),
          dayOfMonth: z.number().int().min(1).max(28),
        })
        .parse(payload);
      await addFinanceRecurring(userId, data);
      return;
    }
    case "deactivateRecurring": {
      const data = z.object({ recurringId: id }).parse(payload);
      await deactivateFinanceRecurring(userId, data.recurringId);
      return;
    }
    case "addGoal": {
      const data = z
        .object({
          name: label,
          target: money,
          deadline: isoDate.nullable().optional(),
        })
        .parse(payload);
      await addFinanceGoal(userId, { name: data.name, target: data.target, deadline: data.deadline ?? null });
      return;
    }
    case "archiveGoal": {
      const data = z.object({ goalId: id }).parse(payload);
      await archiveFinanceGoal(userId, data.goalId);
      return;
    }
    case "setBudget": {
      const data = z
        .object({
          categoryId: id,
          yearMonth,
          limit: z.number().finite().min(0).max(1_000_000_000),
        })
        .parse(payload);
      await setFinanceBudget(userId, data);
      return;
    }
    case "startChallenge": {
      const data = z.object({ code: z.string().trim().min(1).max(40) }).parse(payload);
      await startFinanceChallenge(userId, data.code);
      return;
    }
    case "setMonthSpendTarget": {
      const data = z
        .object({
          yearMonth,
          target: z.number().finite().min(0).max(1_000_000_000),
        })
        .parse(payload);
      await setMonthSpendTarget(userId, data);
      return;
    }
    case "setWeekSpend": {
      const data = z
        .object({
          weekStart: isoDate,
          amount: z.number().finite().min(0).max(1_000_000_000).nullable(),
        })
        .parse(payload);
      await setWeekSpend(userId, data);
      return;
    }
    case "updateProfile": {
      const data = z
        .object({
          displayName: label,
          monthlyIncome: z.number().finite().min(0).max(1_000_000_000),
          payday: z.number().int().min(1).max(28),
        })
        .parse(payload);
      await updateFinanceProfile(userId, data);
      return;
    }
    default:
      throw new FinanceError("Ação desconhecida.");
  }
}
