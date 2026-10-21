import type { AccountKind, CategoryKind } from "@/lib/personal-finance/types";

export const DEFAULT_CATEGORIES: {
  name: string;
  kind: CategoryKind;
  group: string;
  icon: string;
}[] = [
  { name: "Salário", kind: "income", group: "Renda", icon: "wallet" },
  { name: "Extra", kind: "income", group: "Renda", icon: "spark" },
  { name: "Moradia", kind: "expense", group: "Casa", icon: "home" },
  { name: "Contas", kind: "expense", group: "Casa", icon: "zap" },
  { name: "Mercado", kind: "expense", group: "Comida", icon: "cart" },
  { name: "Restaurante", kind: "expense", group: "Comida", icon: "utensils" },
  { name: "Delivery", kind: "expense", group: "Comida", icon: "bike" },
  { name: "Transporte", kind: "expense", group: "Rua", icon: "car" },
  { name: "Saúde", kind: "expense", group: "Pessoal", icon: "heart" },
  { name: "Lazer", kind: "expense", group: "Pessoal", icon: "smile" },
  { name: "Assinaturas", kind: "expense", group: "Pessoal", icon: "repeat" },
  { name: "Compras", kind: "expense", group: "Pessoal", icon: "bag" },
  { name: "Reserva", kind: "reserve", group: "Futuro", icon: "piggy" },
];

export const CHALLENGE_CATALOG = [
  {
    code: "sete-dias",
    title: "7 dias no controle",
    description: "Lance pelo menos um movimento por dia, sete dias seguidos.",
    metric: "streak",
    defaultTarget: 7,
    windowDays: 14,
    xp: 80,
    unit: "days",
  },
  {
    code: "dez-por-cento",
    title: "Guarde 10%",
    description: "Separe 10% da renda deste mês antes de o resto ir embora.",
    metric: "save_amount",
    defaultTarget: 0,
    windowDays: 31,
    xp: 100,
    unit: "money",
  },
  {
    code: "sem-delivery",
    title: "Semana sem delivery",
    description: "Sete dias seguidos sem nenhum lançamento em Delivery.",
    metric: "clean_category",
    categoryName: "Delivery",
    defaultTarget: 7,
    windowDays: 14,
    xp: 60,
    unit: "days",
  },
  {
    code: "nomeie",
    title: "Dê nome ao dinheiro",
    description: "Dez lançamentos com uma descrição de verdade, não só a categoria.",
    metric: "named",
    defaultTarget: 10,
    windowDays: 30,
    xp: 40,
    unit: "count",
  },
] as const;

export type ChallengeCode = (typeof CHALLENGE_CATALOG)[number]["code"];

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  checking: "Conta",
  savings: "Poupança",
  cash: "Carteira",
  credit: "Cartão",
  investment: "Investimento",
};

export const ACCOUNT_KIND_HINT: Record<AccountKind, string> = {
  checking: "Onde o salário cai e as contas saem.",
  savings: "Dinheiro parado, ainda disponível.",
  cash: "O que está na carteira.",
  credit: "Coloque o que está devendo com sinal negativo. Ex.: -850.",
  investment: "Reserva que não entra no disponível do dia a dia.",
};

export const TIPS: { title: string; body: string }[] = [
  {
    title: "Pague-se primeiro",
    body: "No dia em que a renda cai, separe a reserva antes de decidir o resto. O que sobra é o que pode ser gasto.",
  },
  {
    title: "Três meses de paz",
    body: "Uma reserva de emergência cobre uns três meses do que é fixo: moradia, contas e comida. O resto espera.",
  },
  {
    title: "Delivery é um hábito, não um item",
    body: "Some o delivery do mês. Se assustar, o desafio de uma semana sem ele devolve o número para o lugar.",
  },
  {
    title: "Assinatura esquecida",
    body: "Abra Assinaturas e cancele uma que você não usou nos últimos 30 dias. É o corte mais fácil que existe.",
  },
  {
    title: "Nome no lançamento",
    body: "“Mercado” não explica nada. “Feira de sábado” explica. Daqui a um mês você agradece o detalhe.",
  },
  {
    title: "Teto antes do desejo",
    body: "Defina o teto da categoria no começo do mês, não quando ela já estourou. O teto é uma decisão, não um susto.",
  },
  {
    title: "Dia de olhar",
    body: "Um dia fixo por semana, dez minutos. Olhe o que saiu, o que vem e se a meta ainda cabe. Sem planilha nova.",
  },
  {
    title: "Renda variável",
    body: "Se o mês oscila, use a média dos últimos três como renda prevista. Projeção com número otimista mente.",
  },
  {
    title: "Cartão não é saldo",
    body: "Limite disponível não é dinheiro seu. No cartão, registre o que está devendo — o número negativo é o honesto.",
  },
  {
    title: "Meta com data",
    body: "Meta sem prazo vira desejo. Coloque uma data e o Finance diz quanto por semana falta separar.",
  },
  {
    title: "Conta no vermelho à frente",
    body: "Se a projeção cruza zero, o problema não é o dia do estouro. É o compromisso que já está marcado antes dele.",
  },
  {
    title: "Pequeno e repetido",
    body: "Guardar um pouco todo mês vence o plano de guardar muito “quando sobrar”. Sobra quase nunca é um evento.",
  },
];
