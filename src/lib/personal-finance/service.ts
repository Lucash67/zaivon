import { and, asc, desc, eq } from "drizzle-orm";
import {
  financeAccounts,
  financeBudgets,
  financeCategories,
  financeChallenges,
  financeGoals,
  financeMonthSpendTargets,
  financeProfiles,
  financeRecurring,
  financeTransactions,
  financeWeekSpends,
} from "@/lib/db/postgres/schema-finance";
import { buildDiagnosisPlan, parseFinanceContext, type DiagnosisInput, type DiagnosisPlan } from "@/lib/personal-finance/diagnosis";
import { CHALLENGE_CATALOG, DEFAULT_CATEGORIES } from "@/lib/personal-finance/defaults";
import { addDays, isMonday, paydayOnOrAfter, todayInTimeZone, yearMonth } from "@/lib/personal-finance/dates";
import { buildFinanceView, nextRecurringAfter, roundMoney } from "@/lib/personal-finance/engine";
import type {
  AccountKind,
  Cadence,
  CategoryKind,
  Direction,
  EngineAccount,
  EngineCategory,
  EngineRecurring,
  FinanceSnapshot,
} from "@/lib/personal-finance/types";
import { getPostgresDb } from "@/platform/db";

export class FinanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceError";
  }
}

const ACCOUNT_KINDS = new Set<AccountKind>(["checking", "savings", "cash", "credit", "investment"]);
const COLORS: Record<AccountKind, string> = {
  checking: "#B7FF3C",
  savings: "#6EE7B7",
  cash: "#C8D0DB",
  credit: "#FB7185",
  investment: "#7DD3FC",
};

type Database = Awaited<ReturnType<typeof getPostgresDb>>;

function num(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}

function asDirection(value: string): Direction {
  if (value === "in" || value === "out" || value === "save") return value;
  return "out";
}

function asKind(value: string): CategoryKind {
  if (value === "income" || value === "expense" || value === "reserve") return value;
  return "expense";
}

function asAccountKind(value: string): AccountKind {
  return ACCOUNT_KINDS.has(value as AccountKind) ? (value as AccountKind) : "checking";
}

function asCadence(value: string): Cadence {
  return value === "weekly" ? "weekly" : "monthly";
}

function expectedKind(direction: Direction): CategoryKind {
  if (direction === "in") return "income";
  if (direction === "out") return "expense";
  return "reserve";
}

function dateOnly(value: Date, timeZone: string): string {
  return todayInTimeZone(timeZone, value);
}

async function mustProfile(db: Database, userId: string) {
  const rows = await db
    .select()
    .from(financeProfiles)
    .where(eq(financeProfiles.userId, userId))
    .limit(1);
  const profile = rows[0];
  if (!profile) throw new FinanceError("Comece o Finance antes de lançar.");
  return profile;
}

function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function getFinanceSnapshot(userId: string): Promise<FinanceSnapshot> {
  const db = await getPostgresDb();
  const rows = await db
    .select()
    .from(financeProfiles)
    .where(eq(financeProfiles.userId, userId))
    .limit(1);
  const profile = rows[0];
  if (!profile) return { needsOnboarding: true };

  const today = todayInTimeZone(profile.timezone);
  const [accounts, categories, transactions, recurring, goals, budgets, challenges, spendTargets, weekSpends] =
    await Promise.all([
    db.select().from(financeAccounts).where(eq(financeAccounts.profileId, profile.id)).orderBy(asc(financeAccounts.sortOrder)),
    db.select().from(financeCategories).where(eq(financeCategories.profileId, profile.id)).orderBy(asc(financeCategories.sortOrder)),
    db
      .select()
      .from(financeTransactions)
      .where(eq(financeTransactions.profileId, profile.id))
      .orderBy(desc(financeTransactions.occurredOn))
      .limit(2000),
    db.select().from(financeRecurring).where(and(eq(financeRecurring.profileId, profile.id), eq(financeRecurring.active, true))),
    db.select().from(financeGoals).where(and(eq(financeGoals.profileId, profile.id), eq(financeGoals.status, "active"))),
    db.select().from(financeBudgets).where(eq(financeBudgets.profileId, profile.id)),
    db.select().from(financeChallenges).where(eq(financeChallenges.profileId, profile.id)).orderBy(asc(financeChallenges.createdAt)),
    db.select().from(financeMonthSpendTargets).where(eq(financeMonthSpendTargets.profileId, profile.id)),
    db.select().from(financeWeekSpends).where(eq(financeWeekSpends.profileId, profile.id)),
  ]);

  const engineAccounts: EngineAccount[] = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    kind: asAccountKind(account.kind),
    balance: num(account.balance),
  }));
  const engineCategories: EngineCategory[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    kind: asKind(category.kind),
    group: category.groupName,
  }));

  const view = buildFinanceView({
    today,
    monthlyIncome: num(profile.monthlyIncome),
    createdOn: dateOnly(profile.createdAt, profile.timezone),
    accounts: engineAccounts,
    categories: engineCategories,
    transactions: transactions.map((tx) => ({
      id: tx.id,
      accountId: tx.accountId,
      categoryId: tx.categoryId,
      goalId: tx.goalId,
      direction: asDirection(tx.direction),
      amount: num(tx.amount),
      occurredOn: tx.occurredOn,
      description: tx.description,
    })),
    recurring: recurring.map((rule) => ({
      id: rule.id,
      accountId: rule.accountId,
      direction: asDirection(rule.direction),
      amount: num(rule.amount),
      name: rule.name,
      cadence: asCadence(rule.cadence),
      dayOfMonth: rule.dayOfMonth,
      nextOn: rule.nextOn,
      active: rule.active,
    })),
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      target: num(goal.targetAmount),
      current: num(goal.currentAmount),
      deadline: goal.deadline,
      status: goal.status,
      createdOn: dateOnly(goal.createdAt, profile.timezone),
    })),
    budgets: budgets.map((budget) => ({
      categoryId: budget.categoryId,
      yearMonth: budget.yearMonth,
      limit: num(budget.limitAmount),
    })),
    challenges: challenges.map((challenge) => ({
      id: challenge.id,
      code: challenge.code,
      target: num(challenge.targetAmount),
      startsOn: challenge.startsOn,
      endsOn: challenge.endsOn,
    })),
    monthSpendTarget: num(
      spendTargets.find((row) => row.yearMonth === yearMonth(today))?.targetAmount,
    ),
    weekSpends: weekSpends.map((row) => ({ weekStart: row.weekStart, amount: num(row.amount) })),
  });

  return {
    needsOnboarding: false,
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      monthlyIncome: num(profile.monthlyIncome),
      payday: profile.payday,
      currency: profile.currency,
      timezone: profile.timezone,
      createdOn: dateOnly(profile.createdAt, profile.timezone),
      context: parseFinanceContext(profile.context),
    },
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      kind: asAccountKind(account.kind),
      balance: num(account.balance),
      color: account.color,
    })),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      kind: asKind(category.kind),
      group: category.groupName,
      icon: category.icon,
    })),
    transactions: transactions.map((tx) => ({
      id: tx.id,
      accountId: tx.accountId,
      categoryId: tx.categoryId,
      goalId: tx.goalId,
      direction: asDirection(tx.direction),
      amount: num(tx.amount),
      occurredOn: tx.occurredOn,
      description: tx.description,
    })),
    recurring: recurring.map((rule) => ({
      id: rule.id,
      accountId: rule.accountId,
      categoryId: rule.categoryId,
      direction: asDirection(rule.direction),
      amount: num(rule.amount),
      name: rule.name,
      cadence: asCadence(rule.cadence),
      dayOfMonth: rule.dayOfMonth,
      nextOn: rule.nextOn,
      active: rule.active,
    })),
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      target: num(goal.targetAmount),
      current: num(goal.currentAmount),
      deadline: goal.deadline,
      status: goal.status,
      createdOn: dateOnly(goal.createdAt, profile.timezone),
    })),
    budgets: budgets.map((budget) => ({
      categoryId: budget.categoryId,
      yearMonth: budget.yearMonth,
      limit: num(budget.limitAmount),
    })),
    challenges: challenges.map((challenge) => ({
      id: challenge.id,
      code: challenge.code,
      target: num(challenge.targetAmount),
      startsOn: challenge.startsOn,
      endsOn: challenge.endsOn,
    })),
    view,
  };
}

function planFromDiagnosis(input: DiagnosisInput, keepCheckingBalance = false): DiagnosisPlan {
  try {
    return buildDiagnosisPlan(input, { keepCheckingBalance });
  } catch (error) {
    throw new FinanceError(error instanceof Error ? error.message : "Confere o diagnóstico e tenta de novo.");
  }
}

export async function onboardFinance(userId: string, input: DiagnosisInput): Promise<void> {
  const db = await getPostgresDb();
  const existing = await db
    .select({ id: financeProfiles.id })
    .from(financeProfiles)
    .where(eq(financeProfiles.userId, userId))
    .limit(1);
  if (existing.length > 0) throw new FinanceError("Você já começou o Finance.");

  const plan = planFromDiagnosis(input);
  const timezone = "America/Fortaleza";
  const today = todayInTimeZone(timezone);

  try {
    await db.transaction(async (tx) => {
      const [profile] = await tx
        .insert(financeProfiles)
        .values({
          userId,
          displayName: input.displayName.trim(),
          monthlyIncome: plan.monthlyIncome.toFixed(2),
          payday: plan.payday,
          timezone,
          context: plan.context,
          onboardingCompletedAt: new Date(),
        })
        .returning({ id: financeProfiles.id });

      await tx.insert(financeCategories).values(
        DEFAULT_CATEGORIES.map((category, index) => ({
          profileId: profile.id,
          name: category.name,
          kind: category.kind,
          groupName: category.group,
          icon: category.icon,
          sortOrder: index,
        })),
      );

      await writeAbsorbedDiagnosis(tx as unknown as Database, profile.id, plan, today);
    });
  } catch (error) {
    if (error instanceof FinanceError) throw error;
    if (isUniqueViolation(error)) throw new FinanceError("Você já começou o Finance.");
    throw error;
  }
}

export async function applyFinanceDiagnosis(userId: string, input: DiagnosisInput): Promise<void> {
  const db = await getPostgresDb();
  const profile = await mustProfile(db, userId);
  const today = todayInTimeZone(profile.timezone);
  const checking = await db
    .select({ id: financeAccounts.id })
    .from(financeAccounts)
    .where(and(eq(financeAccounts.profileId, profile.id), eq(financeAccounts.kind, "checking")))
    .limit(1);
  let keepCheckingBalance = false;
  if (checking[0]) {
    const moved = await db
      .select({ id: financeTransactions.id })
      .from(financeTransactions)
      .where(eq(financeTransactions.accountId, checking[0].id))
      .limit(1);
    keepCheckingBalance = moved.length > 0;
  }
  const plan = planFromDiagnosis(input, keepCheckingBalance);

  await db.transaction(async (tx) => {
    await tx
      .update(financeProfiles)
      .set({
        displayName: input.displayName.trim(),
        monthlyIncome: plan.monthlyIncome.toFixed(2),
        payday: plan.payday,
        context: plan.context,
        updatedAt: new Date(),
      })
      .where(eq(financeProfiles.id, profile.id));
    await writeAbsorbedDiagnosis(tx as unknown as Database, profile.id, plan, today);
  });
}

async function writeAbsorbedDiagnosis(tx: Database, profileId: string, plan: DiagnosisPlan, today: string) {
  const accounts = await tx
    .select()
    .from(financeAccounts)
    .where(eq(financeAccounts.profileId, profileId))
    .orderBy(asc(financeAccounts.sortOrder));
  const checkingPlan = plan.accounts.find((account) => account.kind === "checking");
  if (!checkingPlan) throw new FinanceError("O diagnóstico precisa de uma conta principal.");

  let checking = accounts.find((account) => account.kind === "checking") ?? null;
  if (!checking) {
    const [created] = await tx
      .insert(financeAccounts)
      .values({
        profileId,
        name: checkingPlan.name,
        kind: "checking",
        balance: checkingPlan.balance.toFixed(2),
        color: COLORS.checking,
        sortOrder: 0,
      })
      .returning();
    checking = created ?? null;
  } else {
    const moved = await tx
      .select({ id: financeTransactions.id })
      .from(financeTransactions)
      .where(eq(financeTransactions.accountId, checking.id))
      .limit(1);
    await tx
      .update(financeAccounts)
      .set({
        name: checkingPlan.name,
        ...(moved.length === 0 ? { balance: checkingPlan.balance.toFixed(2) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(financeAccounts.id, checking.id));
  }
  if (!checking) throw new FinanceError("Não consegui abrir a conta principal.");

  let sort = accounts.length;
  for (const extra of plan.accounts.filter((account) => account.kind !== "checking")) {
    if (accounts.some((account) => account.kind === extra.kind)) continue;
    await tx.insert(financeAccounts).values({
      profileId,
      name: extra.name,
      kind: extra.kind,
      balance: extra.balance.toFixed(2),
      color: COLORS[extra.kind],
      sortOrder: sort,
    });
    sort += 1;
  }

  const categories = await tx
    .select({ id: financeCategories.id, name: financeCategories.name })
    .from(financeCategories)
    .where(eq(financeCategories.profileId, profileId));
  const rules = await tx
    .select()
    .from(financeRecurring)
    .where(and(eq(financeRecurring.profileId, profileId), eq(financeRecurring.active, true)));

  for (const rule of plan.recurring) {
    const category = categories.find((item) => item.name === rule.category);
    if (!category) continue;
    const nextOn = paydayOnOrAfter(today, rule.dayOfMonth);
    const existing = rules.find((item) => item.name === rule.name);
    if (existing) {
      await tx
        .update(financeRecurring)
        .set({
          accountId: checking.id,
          categoryId: category.id,
          direction: rule.direction,
          amount: rule.amount.toFixed(2),
          cadence: "monthly",
          dayOfMonth: rule.dayOfMonth,
          nextOn,
        })
        .where(eq(financeRecurring.id, existing.id));
      continue;
    }
    await tx.insert(financeRecurring).values({
      profileId,
      accountId: checking.id,
      categoryId: category.id,
      direction: rule.direction,
      amount: rule.amount.toFixed(2),
      name: rule.name,
      cadence: "monthly",
      dayOfMonth: rule.dayOfMonth,
      nextOn,
    });
  }

  if (plan.spendTarget > 0) {
    const month = yearMonth(today);
    const existing = await tx
      .select()
      .from(financeMonthSpendTargets)
      .where(and(eq(financeMonthSpendTargets.profileId, profileId), eq(financeMonthSpendTargets.yearMonth, month)))
      .limit(1);
    const target = plan.spendTarget.toFixed(2);
    if (existing[0]) {
      await tx
        .update(financeMonthSpendTargets)
        .set({ targetAmount: target })
        .where(eq(financeMonthSpendTargets.id, existing[0].id));
    } else {
      await tx.insert(financeMonthSpendTargets).values({
        profileId,
        yearMonth: month,
        targetAmount: target,
      });
    }
  }

  if (plan.goal) {
    const goals = await tx
      .select()
      .from(financeGoals)
      .where(and(eq(financeGoals.profileId, profileId), eq(financeGoals.status, "active"), eq(financeGoals.name, plan.goal.name)))
      .limit(1);
    if (goals[0]) {
      const current = Math.max(num(goals[0].currentAmount), plan.goal.current);
      await tx
        .update(financeGoals)
        .set({
          targetAmount: plan.goal.target.toFixed(2),
          currentAmount: current.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(financeGoals.id, goals[0].id));
    } else {
      await tx.insert(financeGoals).values({
        profileId,
        name: plan.goal.name,
        targetAmount: plan.goal.target.toFixed(2),
        currentAmount: plan.goal.current.toFixed(2),
        status: "active",
      });
    }
  }
}

async function ownedAccount(db: Database, profileId: string, accountId: string) {
  const rows = await db
    .select()
    .from(financeAccounts)
    .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.profileId, profileId)))
    .limit(1);
  const account = rows[0];
  if (!account) throw new FinanceError("Conta não encontrada.");
  return account;
}

async function ownedCategory(db: Database, profileId: string, categoryId: string) {
  const rows = await db
    .select()
    .from(financeCategories)
    .where(and(eq(financeCategories.id, categoryId), eq(financeCategories.profileId, profileId)))
    .limit(1);
  const category = rows[0];
  if (!category) throw new FinanceError("Categoria não encontrada.");
  return category;
}

export async function addFinanceTransaction(
  userId: string,
  input: {
    accountId: string;
    categoryId: string;
    direction: Direction;
    amount: number;
    occurredOn: string;
    description: string;
    goalId: string | null;
  },
): Promise<void> {
  const db = await getPostgresDb();
  const profile = await mustProfile(db, userId);
  const today = todayInTimeZone(profile.timezone);
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new FinanceError("Informe um valor maior que zero.");

  await db.transaction(async (tx) => {
    const account = await ownedAccount(tx as unknown as Database, profile.id, input.accountId);
    const category = await ownedCategory(tx as unknown as Database, profile.id, input.categoryId);
    if (asKind(category.kind) !== expectedKind(input.direction)) {
      throw new FinanceError("Essa categoria não combina com o tipo do lançamento.");
    }

    let goalId: string | null = null;
    if (input.goalId) {
      if (input.direction !== "save") {
        throw new FinanceError("Para abater uma meta, use Guardei.");
      }
      const goals = await tx
        .select()
        .from(financeGoals)
        .where(and(eq(financeGoals.id, input.goalId), eq(financeGoals.profileId, profile.id)))
        .limit(1);
      const goal = goals[0];
      if (!goal || goal.status !== "active") throw new FinanceError("Meta não encontrada.");
      goalId = goal.id;
      await tx
        .update(financeGoals)
        .set({
          currentAmount: roundMoney(num(goal.currentAmount) + amount).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(financeGoals.id, goal.id));
    }

    await tx.insert(financeTransactions).values({
      profileId: profile.id,
      accountId: account.id,
      categoryId: category.id,
      goalId,
      direction: input.direction,
      amount: amount.toFixed(2),
      occurredOn: input.occurredOn,
      description: input.description,
    });

    if (input.occurredOn <= today) {
      const delta = input.direction === "in" ? amount : -amount;
      await tx
        .update(financeAccounts)
        .set({
          balance: roundMoney(num(account.balance) + delta).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(financeAccounts.id, account.id));
    }

    const rules = await tx
      .select()
      .from(financeRecurring)
      .where(and(eq(financeRecurring.profileId, profile.id), eq(financeRecurring.active, true)));
    const match = rules.find((rule) => {
      if (asDirection(rule.direction) !== input.direction) return false;
      if (rule.categoryId !== category.id) return false;
      const ruleAmount = num(rule.amount);
      const gap = Math.abs(ruleAmount - amount);
      if (ruleAmount > 0 && gap / ruleAmount > 0.02 && gap > 0.05) return false;
      const distance = Math.abs(rule.nextOn <= input.occurredOn
        ? daysBetweenSafe(rule.nextOn, input.occurredOn)
        : daysBetweenSafe(input.occurredOn, rule.nextOn));
      return distance <= 3;
    });
    if (match) {
      const engineRule: EngineRecurring = {
        id: match.id,
        accountId: match.accountId,
        direction: asDirection(match.direction),
        amount: num(match.amount),
        name: match.name,
        cadence: asCadence(match.cadence),
        dayOfMonth: match.dayOfMonth,
        nextOn: match.nextOn,
        active: true,
      };
      await tx
        .update(financeRecurring)
        .set({ nextOn: nextRecurringAfter(engineRule, input.occurredOn) })
        .where(eq(financeRecurring.id, match.id));
    }
  });
}

function daysBetweenSafe(from: string, to: string): number {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export async function deleteFinanceTransaction(userId: string, transactionId: string): Promise<void> {
  const db = await getPostgresDb();
  const profile = await mustProfile(db, userId);
  const today = todayInTimeZone(profile.timezone);

  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(financeTransactions)
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.profileId, profile.id)))
      .limit(1);
    const row = rows[0];
    if (!row) throw new FinanceError("Lançamento não encontrado.");

    if (row.occurredOn <= today) {
      const accountRows = await tx
        .select()
        .from(financeAccounts)
        .where(eq(financeAccounts.id, row.accountId))
        .limit(1);
      const account = accountRows[0];
      if (account) {
        const amount = num(row.amount);
        const delta = asDirection(row.direction) === "in" ? -amount : amount;
        await tx
          .update(financeAccounts)
          .set({
            balance: roundMoney(num(account.balance) + delta).toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(financeAccounts.id, account.id));
      }
    }

    if (row.goalId && asDirection(row.direction) === "save") {
      const goals = await tx.select().from(financeGoals).where(eq(financeGoals.id, row.goalId)).limit(1);
      const goal = goals[0];
      if (goal) {
        await tx
          .update(financeGoals)
          .set({
            currentAmount: Math.max(0, roundMoney(num(goal.currentAmount) - num(row.amount))).toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(financeGoals.id, goal.id));
      }
    }

    await tx.delete(financeTransactions).where(eq(financeTransactions.id, row.id));
  });
}

export async function addFinanceAccount(
  userId: string,
  input: { name: string; kind: AccountKind; balance: number },
): Promise<void> {
  const db = await getPostgresDb();
  const profile = await mustProfile(db, userId);
  const count = await db
    .select({ id: financeAccounts.id })
    .from(financeAccounts)
    .where(eq(financeAccounts.profileId, profile.id));
  await db.insert(financeAccounts).values({
    profileId: profile.id,
    name: input.name,
    kind: input.kind,
    balance: roundMoney(input.balance).toFixed(2),
    color: COLORS[input.kind],
    sortOrder: count.length,
  });
}

export async function addFinanceRecurring(
  userId: string,
  input: {
    name: string;
    amount: number;
    direction: Direction;
    accountId: string;
    categoryId: string;
    cadence: Cadence;
    dayOfMonth: number;
  },
): Promise<void> {
  const db = await getPostgresDb();
  const profile = await mustProfile(db, userId);
  const today = todayInTimeZone(profile.timezone);
  const account = await ownedAccount(db, profile.id, input.accountId);
  const category = await ownedCategory(db, profile.id, input.categoryId);
  if (asKind(category.kind) !== expectedKind(input.direction)) {
    throw new FinanceError("Essa categoria não combina com a recorrência.");
  }
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new FinanceError("Informe um valor maior que zero.");
  const nextOn =
    input.cadence === "weekly" ? addDays(today, 7) : paydayOnOrAfter(today, input.dayOfMonth);

  await db.insert(financeRecurring).values({
    profileId: profile.id,
    accountId: account.id,
    categoryId: category.id,
    direction: input.direction,
    amount: amount.toFixed(2),
    name: input.name,
    cadence: input.cadence,
    dayOfMonth: input.cadence === "weekly" ? 0 : input.dayOfMonth,
    nextOn,
  });
}

export async function deactivateFinanceRecurring(userId: string, recurringId: string): Promise<void> {
  const db = await getPostgresDb();
  const profile = await mustProfile(db, userId);
  await db
    .update(financeRecurring)
    .set({ active: false })
    .where(and(eq(financeRecurring.id, recurringId), eq(financeRecurring.profileId, profile.id)));
}

export async function addFinanceGoal(
  userId: string,
  input: { name: string; target: number; deadline: string | null },
): Promise<void> {
  const db = await getPostgresDb();
  const profile = await mustProfile(db, userId);
  const target = roundMoney(input.target);
  if (target <= 0) throw new FinanceError("A meta precisa de um valor.");
  await db.insert(financeGoals).values({
    profileId: profile.id,
    name: input.name,
    targetAmount: target.toFixed(2),
    currentAmount: "0.00",
    deadline: input.deadline,
    status: "active",
  });
}

export async function archiveFinanceGoal(userId: string, goalId: string): Promise<void> {
  const db = await getPostgresDb();
  const profile = await mustProfile(db, userId);
  await db
    .update(financeGoals)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(eq(financeGoals.id, goalId), eq(financeGoals.profileId, profile.id)));
}

export async function setFinanceBudget(
  userId: string,
  input: { categoryId: string; yearMonth: string; limit: number },
): Promise<void> {
  const db = await getPostgresDb();
  const profile = await mustProfile(db, userId);
  const category = await ownedCategory(db, profile.id, input.categoryId);
  if (asKind(category.kind) !== "expense") {
    throw new FinanceError("Teto só existe em categoria de gasto.");
  }
  const existing = await db
    .select()
    .from(financeBudgets)
    .where(
      and(
        eq(financeBudgets.profileId, profile.id),
        eq(financeBudgets.categoryId, category.id),
        eq(financeBudgets.yearMonth, input.yearMonth),
      ),
    )
    .limit(1);

  if (input.limit <= 0) {
    if (existing[0]) await db.delete(financeBudgets).where(eq(financeBudgets.id, existing[0].id));
    return;
  }

  const limit = roundMoney(input.limit).toFixed(2);
  if (existing[0]) {
    await db.update(financeBudgets).set({ limitAmount: limit }).where(eq(financeBudgets.id, existing[0].id));
    return;
  }
  await db.insert(financeBudgets).values({
    profileId: profile.id,
    categoryId: category.id,
    yearMonth: input.yearMonth,
    limitAmount: limit,
  });
}

export async function startFinanceChallenge(userId: string, code: string): Promise<void> {
  const db = await getPostgresDb();
  const profile = await mustProfile(db, userId);
  const def = CHALLENGE_CATALOG.find((item) => item.code === code);
  if (!def) throw new FinanceError("Desafio desconhecido.");
  const income = num(profile.monthlyIncome);
  if (def.metric === "save_amount" && income <= 0) {
    throw new FinanceError("Informe sua renda mensal para calcular os 10%.");
  }

  const today = todayInTimeZone(profile.timezone);
  const rows = await db
    .select()
    .from(financeChallenges)
    .where(and(eq(financeChallenges.profileId, profile.id), eq(financeChallenges.code, code)))
    .orderBy(desc(financeChallenges.createdAt))
    .limit(1);
  const latest = rows[0];
  if (latest && latest.endsOn >= today) {
    throw new FinanceError("Esse desafio já foi aceito neste período.");
  }

  const target = def.metric === "save_amount" ? roundMoney(income * 0.1) : def.defaultTarget;
  await db.insert(financeChallenges).values({
    profileId: profile.id,
    code,
    targetAmount: target.toFixed(2),
    startsOn: today,
    endsOn: addDays(today, def.windowDays),
  });
}

export async function updateFinanceProfile(
  userId: string,
  input: { displayName: string; monthlyIncome: number; payday: number },
): Promise<void> {
  const db = await getPostgresDb();
  const profile = await mustProfile(db, userId);
  const income = roundMoney(Math.max(0, input.monthlyIncome));
  const today = todayInTimeZone(profile.timezone);
  await db
    .update(financeProfiles)
    .set({
      displayName: input.displayName,
      monthlyIncome: income.toFixed(2),
      payday: input.payday,
      updatedAt: new Date(),
    })
    .where(eq(financeProfiles.id, profile.id));

  const rules = await db
    .select()
    .from(financeRecurring)
    .where(
      and(
        eq(financeRecurring.profileId, profile.id),
        eq(financeRecurring.active, true),
        eq(financeRecurring.name, "Salário"),
      ),
    );
  const salary = rules.find((rule) => asDirection(rule.direction) === "in");
  if (salary && income > 0) {
    await db
      .update(financeRecurring)
      .set({
        amount: income.toFixed(2),
        ...(input.payday !== profile.payday
          ? { dayOfMonth: input.payday, nextOn: paydayOnOrAfter(today, input.payday) }
          : {}),
      })
      .where(eq(financeRecurring.id, salary.id));
  }
}

export async function setMonthSpendTarget(
  userId: string,
  input: { yearMonth: string; target: number },
): Promise<void> {
  const db = await getPostgresDb();
  const profile = await mustProfile(db, userId);
  const existing = await db
    .select()
    .from(financeMonthSpendTargets)
    .where(
      and(eq(financeMonthSpendTargets.profileId, profile.id), eq(financeMonthSpendTargets.yearMonth, input.yearMonth)),
    )
    .limit(1);

  if (input.target <= 0) {
    if (existing[0]) await db.delete(financeMonthSpendTargets).where(eq(financeMonthSpendTargets.id, existing[0].id));
    return;
  }

  const target = roundMoney(input.target).toFixed(2);
  if (existing[0]) {
    await db
      .update(financeMonthSpendTargets)
      .set({ targetAmount: target })
      .where(eq(financeMonthSpendTargets.id, existing[0].id));
    return;
  }
  await db.insert(financeMonthSpendTargets).values({
    profileId: profile.id,
    yearMonth: input.yearMonth,
    targetAmount: target,
  });
}

export async function setWeekSpend(
  userId: string,
  input: { weekStart: string; amount: number | null },
): Promise<void> {
  const db = await getPostgresDb();
  const profile = await mustProfile(db, userId);
  if (!isMonday(input.weekStart)) throw new FinanceError("A semana começa na segunda-feira.");

  const existing = await db
    .select()
    .from(financeWeekSpends)
    .where(and(eq(financeWeekSpends.profileId, profile.id), eq(financeWeekSpends.weekStart, input.weekStart)))
    .limit(1);

  if (input.amount == null) {
    if (existing[0]) await db.delete(financeWeekSpends).where(eq(financeWeekSpends.id, existing[0].id));
    return;
  }

  const amount = roundMoney(input.amount).toFixed(2);
  if (existing[0]) {
    await db.update(financeWeekSpends).set({ amount }).where(eq(financeWeekSpends.id, existing[0].id));
    return;
  }
  await db.insert(financeWeekSpends).values({
    profileId: profile.id,
    weekStart: input.weekStart,
    amount,
  });
}
