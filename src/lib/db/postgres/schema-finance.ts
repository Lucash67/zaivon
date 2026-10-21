/**
 * ZAIVON Finance — schema isolado (`finance.*`).
 *
 * Controle pessoal. Não mistura com o financeiro do ZAIVON Business (`public.*`)
 * nem com Schedule/CRM. Auth só compartilha `public.users` por UUID, sem FK cross-schema.
 */
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const financeSchema = pgSchema("finance");

export const financeProfiles = financeSchema.table(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    displayName: text("display_name").notNull(),
    currency: text("currency").notNull().default("BRL"),
    timezone: text("timezone").notNull().default("America/Fortaleza"),
    monthlyIncome: numeric("monthly_income", { precision: 12, scale: 2 }).notNull().default("0"),
    payday: integer("payday").notNull().default(5),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: uniqueIndex("idx_fin_profiles_user").on(t.userId),
  }),
);

export const financeAccounts = financeSchema.table(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => financeProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("checking"),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
    color: text("color").notNull().default("#E8B86D"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("idx_fin_accounts_profile").on(t.profileId),
  }),
);

export const financeCategories = financeSchema.table(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => financeProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    groupName: text("group_name").notNull(),
    icon: text("icon").notNull().default("wallet"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("idx_fin_categories_profile").on(t.profileId),
  }),
);

export const financeGoals = financeSchema.table(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => financeProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetAmount: numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
    currentAmount: numeric("current_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    deadline: date("deadline"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("idx_fin_goals_profile").on(t.profileId),
  }),
);

export const financeTransactions = financeSchema.table(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => financeProfiles.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => financeAccounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => financeCategories.id, { onDelete: "restrict" }),
    goalId: uuid("goal_id").references(() => financeGoals.id, { onDelete: "set null" }),
    direction: text("direction").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    occurredOn: date("occurred_on").notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileDateIdx: index("idx_fin_tx_profile_date").on(t.profileId, t.occurredOn),
  }),
);

export const financeRecurring = financeSchema.table(
  "recurring_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => financeProfiles.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => financeAccounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => financeCategories.id, { onDelete: "restrict" }),
    direction: text("direction").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    name: text("name").notNull(),
    cadence: text("cadence").notNull().default("monthly"),
    dayOfMonth: integer("day_of_month").notNull().default(1),
    nextOn: date("next_on").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("idx_fin_recurring_profile").on(t.profileId),
  }),
);

export const financeBudgets = financeSchema.table(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => financeProfiles.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => financeCategories.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(),
    limitAmount: numeric("limit_amount", { precision: 14, scale: 2 }).notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("idx_fin_budgets_uniq").on(t.profileId, t.categoryId, t.yearMonth),
  }),
);

/** Quanto a pessoa precisa gastar no mês — o número fixo da projeção semanal. */
export const financeMonthSpendTargets = financeSchema.table(
  "month_spend_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => financeProfiles.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(),
    targetAmount: numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("idx_fin_month_spend_uniq").on(t.profileId, t.yearMonth),
  }),
);

/** Gasto informado na semana. Sem linha, a semana usa a soma dos lançamentos. */
export const financeWeekSpends = financeSchema.table(
  "week_spends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => financeProfiles.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("idx_fin_week_spends_uniq").on(t.profileId, t.weekStart),
  }),
);

export const financeChallenges = financeSchema.table(
  "challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => financeProfiles.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    targetAmount: numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("idx_fin_challenges_profile").on(t.profileId, t.code),
  }),
);
