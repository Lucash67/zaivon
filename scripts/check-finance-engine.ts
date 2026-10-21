/**
 * Confere o motor do ZAIVON Finance sem banco.
 *   npx tsx scripts/check-finance-engine.ts
 */
import { buildDiagnosisPlan, diagnosisInputFromDraft, emptyFixed } from "../src/lib/personal-finance/diagnosis";
import { paydayOnOrAfter } from "../src/lib/personal-finance/dates";
import { buildFinanceView, loggingStreak } from "../src/lib/personal-finance/engine";
import { buildSpendPlan, splitExact } from "../src/lib/personal-finance/spend-plan";
import type { EngineAccount, EngineCategory, EngineRecurring, EngineTx } from "../src/lib/personal-finance/types";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const categories: EngineCategory[] = [
  { id: "cat-sal", name: "Salário", kind: "income", group: "Renda" },
  { id: "cat-mor", name: "Moradia", kind: "expense", group: "Casa" },
  { id: "cat-del", name: "Delivery", kind: "expense", group: "Comida" },
  { id: "cat-res", name: "Reserva", kind: "reserve", group: "Futuro" },
];

const account: EngineAccount = { id: "acc", name: "Conta", kind: "checking", balance: 1000 };

const rent: EngineRecurring = {
  id: "rent",
  accountId: "acc",
  direction: "out",
  amount: 500,
  name: "Aluguel",
  cadence: "monthly",
  dayOfMonth: 10,
  nextOn: "2026-10-10",
  active: true,
};

const view = buildFinanceView({
  today: "2026-10-01",
  monthlyIncome: 3000,
  createdOn: "2026-10-01",
  accounts: [account],
  categories,
  transactions: [],
  recurring: [rent],
  goals: [],
  budgets: [],
  challenges: [],
  monthSpendTarget: null,
  weekSpends: [],
});

const oct10 = view.projection.find((point) => point.date === "2026-10-10");
const nov10 = view.projection.find((point) => point.date === "2026-11-10");
const dec10 = view.projection.find((point) => point.date === "2026-12-10");
assert(oct10?.balance === 500, `outubro deveria fechar o aluguel em 500, veio ${oct10?.balance}`);
assert(nov10?.balance === 0, `novembro deveria ir a 0, veio ${nov10?.balance}`);
assert(dec10?.balance === -500, `dezembro deveria ir a -500, veio ${dec10?.balance}`);
assert(view.firstNegative?.date === "2026-12-10", "o terceiro aluguel é o primeiro negativo");
assert(paydayOnOrAfter("2026-10-20", 5) === "2026-11-05", "dia 5 já passou em outubro");
assert(paydayOnOrAfter("2026-02-01", 31) === "2026-02-28", "dia 31 em fevereiro vai para 28");

const txs: EngineTx[] = [
  { id: "1", accountId: "acc", categoryId: "cat-del", goalId: null, direction: "out", amount: 80, occurredOn: "2026-10-01", description: "janta" },
  { id: "2", accountId: "acc", categoryId: "cat-del", goalId: null, direction: "out", amount: 40, occurredOn: "2026-10-02", description: "" },
  { id: "3", accountId: "acc", categoryId: "cat-res", goalId: null, direction: "save", amount: 300, occurredOn: "2026-10-02", description: "reserva" },
];

assert(loggingStreak(txs.map((tx) => tx.occurredOn), "2026-10-02") === 2, "streak de dois dias");
assert(loggingStreak(["2026-10-01"], "2026-10-03") === 0, "buraco quebra a sequência");

const busy = buildFinanceView({
  today: "2026-10-03",
  monthlyIncome: 1000,
  createdOn: "2026-10-01",
  accounts: [{ ...account, balance: 880 }],
  categories,
  transactions: txs,
  recurring: [],
  goals: [
    {
      id: "g",
      name: "Viagem",
      target: 1000,
      current: 300,
      deadline: "2026-10-16",
      status: "active",
      createdOn: "2026-10-01",
    },
  ],
  budgets: [],
  challenges: [{ id: "c", code: "nomeie", target: 10, startsOn: "2026-10-01", endsOn: "2026-10-31" }],
  monthSpendTarget: null,
  weekSpends: [],
});

assert(busy.month.expense === 120, `gasto do mês deveria ser 120, veio ${busy.month.expense}`);
assert(busy.month.saved === 300, "guardar não entra como gasto");
assert(busy.insights.some((item) => item.id === "pace"), "ritmo acima da renda gera insight");
assert(busy.goals[0]?.pace === "behind" || busy.goals[0]?.pace === "on-track", "meta tem leitura de ritmo");
assert(busy.challenges.find((item) => item.code === "nomeie")?.current === 2, "dois lançamentos têm nome");
assert(busy.firstWeek.active, "primeira semana segue aberta");

const overdue = buildFinanceView({
  today: "2026-10-20",
  monthlyIncome: 0,
  createdOn: "2026-10-01",
  accounts: [account],
  categories,
  transactions: [],
  recurring: [{ ...rent, nextOn: "2026-10-10" }],
  goals: [],
  budgets: [],
  challenges: [],
  monthSpendTarget: null,
  weekSpends: [],
});
const todayPoint = overdue.projection[0];
assert(todayPoint.balance === 500, `aluguel atrasado cai hoje, veio ${todayPoint.balance}`);

const parts = splitExact(100, 3);
assert(Math.round(parts.reduce((sum, part) => sum + part, 0) * 100) === 10000, "a soma das cotas é exata");

const plan = buildSpendPlan({
  today: "2026-10-20",
  target: 2000,
  expenses: [
    { occurredOn: "2026-10-02", amount: 200 },
    { occurredOn: "2026-10-08", amount: 400 },
    { occurredOn: "2026-10-15", amount: 400 },
  ],
  declared: [{ weekStart: "2026-10-19", amount: 500 }],
});
assert(plan.spent === 1500, `gasto conhecido deveria ser 1500, veio ${plan.spent}`);
assert(plan.nextWeekCount === 1, "outubro de 2026 ainda tem uma semana");
assert(plan.perNextWeek === 500, `a próxima semana deveria caber 500, veio ${plan.perNextWeek}`);
assert(plan.finalIfFollow === 2000, "seguir a cota fecha exatamente no alvo");
assert(plan.paceFinal === 2000 && plan.verdict === "hit", "repetir a semana bate o mês");

const over = buildSpendPlan({
  today: "2026-10-20",
  target: 2000,
  expenses: [
    { occurredOn: "2026-10-02", amount: 200 },
    { occurredOn: "2026-10-08", amount: 400 },
    { occurredOn: "2026-10-15", amount: 400 },
  ],
  declared: [{ weekStart: "2026-10-19", amount: 800 }],
});
assert(over.verdict === "over", "repetir 800 passa do alvo");
assert(over.paceFinal === 2600, `ritmo deveria fechar em 2600, veio ${over.paceFinal}`);
assert(over.perNextWeek === 200, `para bater, a próxima fica em 200, veio ${over.perNextWeek}`);

const diagnosis = buildDiagnosisPlan(
  diagnosisInputFromDraft({
    displayName: "Ana",
    intent: "reserve",
    incomeSource: "salary",
    income: "3.500,00",
    payday: "5",
    fixed: { ...emptyFixed(), housing: "1200", bills: "300" },
    accountName: "Conta",
    openingBalance: "420",
    trackSavings: true,
    savingsBalance: "800",
    trackCard: true,
    cardDebt: "250",
    trackReserve: true,
    reserveTarget: "5000",
  }),
);
assert(diagnosis.spendTarget === 1500, "compromissos somam o gasto fixo");
assert(diagnosis.recurring.length === 3, "renda e dois compromissos viram recorrência");
assert(diagnosis.accounts.some((account) => account.kind === "credit" && account.balance === -250), "cartão entra negativo");
assert(diagnosis.goal?.target === 5000 && diagnosis.goal.current === 800, "meta nasce com o que já está separado");
assert(diagnosis.reading.length >= 5, "a leitura explica o que foi absorvido");

console.log("finance engine ok");
