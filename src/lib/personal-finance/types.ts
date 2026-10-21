import type { SpendPlan } from "@/lib/personal-finance/spend-plan";

export type Direction = "in" | "out" | "save";
export type CategoryKind = "income" | "expense" | "reserve";
export type AccountKind = "checking" | "savings" | "cash" | "credit" | "investment";
export type Cadence = "monthly" | "weekly";

export type EngineAccount = {
  id: string;
  name: string;
  kind: AccountKind;
  balance: number;
};

export type EngineCategory = {
  id: string;
  name: string;
  kind: CategoryKind;
  group: string;
};

export type EngineTx = {
  id: string;
  accountId: string;
  categoryId: string;
  goalId: string | null;
  direction: Direction;
  amount: number;
  occurredOn: string;
  description: string;
};

export type EngineRecurring = {
  id: string;
  accountId: string;
  direction: Direction;
  amount: number;
  name: string;
  cadence: Cadence;
  dayOfMonth: number;
  nextOn: string;
  active: boolean;
};

export type EngineGoal = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string | null;
  status: string;
  createdOn: string;
};

export type EngineBudget = {
  categoryId: string;
  yearMonth: string;
  limit: number;
};

export type EngineChallenge = {
  id: string;
  code: string;
  target: number;
  startsOn: string;
  endsOn: string;
};

export type Insight = {
  id: string;
  tone: "good" | "warn" | "info";
  title: string;
  body: string;
};

export type CategorySpend = {
  categoryId: string;
  name: string;
  kind: CategoryKind;
  group: string;
  amount: number;
  budget: number | null;
};

export type ProjectionPoint = {
  date: string;
  balance: number;
  delta: number;
};

export type UpcomingItem = {
  date: string;
  name: string;
  amount: number;
  direction: Direction;
  source: "recurring" | "planned";
};

export type GoalPace = "done" | "on-track" | "behind" | "overdue" | "no-deadline";

export type GoalView = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string | null;
  ratio: number;
  remaining: number;
  weeklyNeeded: number | null;
  pace: GoalPace;
  note: string;
};

export type ChallengeStatus = "available" | "active" | "done" | "expired";

export type ChallengeView = {
  id: string | null;
  code: string;
  title: string;
  description: string;
  xp: number;
  status: ChallengeStatus;
  current: number;
  target: number;
  ratio: number;
  unit: "days" | "count" | "money";
  endsOn: string | null;
  detail: string;
};

export type FinanceView = {
  today: string;
  monthLabel: string;
  yearMonth: string;
  available: number;
  invested: number;
  cardBalance: number;
  netWorth: number;
  streak: number;
  xp: number;
  level: { level: number; name: string; into: number; span: number };
  pulse: string;
  tip: { title: string; body: string };
  month: {
    income: number;
    expense: number;
    saved: number;
    dayOfMonth: number;
    daysInMonth: number;
    paceExpense: number;
    referenceIncome: number;
    byCategory: CategorySpend[];
  };
  projection: ProjectionPoint[];
  monthEndBalance: number;
  lowest: { date: string; balance: number };
  firstNegative: { date: string; balance: number } | null;
  upcoming: UpcomingItem[];
  insights: Insight[];
  goals: GoalView[];
  challenges: ChallengeView[];
  firstWeek: { active: boolean; items: { id: string; label: string; done: boolean }[] };
  spendPlan: SpendPlan;
};

export type PublicAccount = EngineAccount & { color: string };
export type PublicCategory = EngineCategory & { icon: string };
export type PublicTx = EngineTx;
export type PublicRecurring = EngineRecurring & { id: string; categoryId: string };
export type PublicGoal = EngineGoal;
export type PublicBudget = EngineBudget;
export type PublicChallenge = EngineChallenge;

export type FinanceContext = {
  version: 1;
  intent: "organize" | "breathe" | "reserve" | "debt";
  incomeSource: "salary" | "variable" | "mixed" | "none";
  fixedMonthly: number;
  savingsBalance: number | null;
  cardDebt: number | null;
  reserveTarget: number | null;
};

export type PublicProfile = {
  id: string;
  displayName: string;
  monthlyIncome: number;
  payday: number;
  currency: string;
  timezone: string;
  createdOn: string;
  context: FinanceContext | null;
};

export type FinanceSnapshot =
  | { needsOnboarding: true }
  | {
      needsOnboarding: false;
      profile: PublicProfile;
      accounts: PublicAccount[];
      categories: PublicCategory[];
      transactions: PublicTx[];
      recurring: PublicRecurring[];
      goals: PublicGoal[];
      budgets: PublicBudget[];
      challenges: PublicChallenge[];
      view: FinanceView;
    };
