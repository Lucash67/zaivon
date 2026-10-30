// Tipos do domínio da ZAIVON v2. Montados a partir das tabelas do Supabase
// (operation_days, diary_entries, daily_purchases, sales, clients) + metadados do dia.

export type Channel = "acal" | "unifor" | "meia_sola" | "henrique";
export type ProductId = "salgado" | "sanduiche";
export type PaymentMethod = "pix" | "card" | "cash";

/** Destino de cada unidade que saiu no dia. */
export type LineStatus = "paid" | "fiado" | "parceiro" | "investigar" | "perda" | "sobra";

export interface Product {
  id: ProductId;
  name: string;
  category: string;
  /** Preço por canal (um produto, vários preços). */
  prices: Partial<Record<Channel, number>> & { default: number };
  cost: number;
}

export interface ChannelInfo {
  id: Channel;
  name: string;
  kind: "direta" | "parceiro" | "especial";
}

export interface SaleLine {
  id: string;
  product: ProductId;
  channel: Channel;
  status: LineStatus;
  qty: number;
  unitPrice: number;
  person?: string | undefined;
  time?: string | undefined;
  payment?: PaymentMethod | undefined;
}

/** Quitação: dinheiro de dia anterior que entrou em `paidDate`. */
export interface Settlement {
  id: string;
  person: string;
  originDate: string;
  paidDate: string;
  amount: number;
  note?: string | undefined;
}

export type DebtType = "fiado" | "parceiro" | "investigacao";

export interface Debt {
  id: string;
  person: string;
  type: DebtType;
  originDate: string;
  amount: number;
  paid: number;
  description: string;
  status: "open" | "paid" | "loss";
  /**
   * Se definido, a cobrança não deve aparecer como “Cobrar agora” até esta data
   * (ex.: acordo Ana Laura até o pagamento salarial de novembro).
   */
  deferredUntil?: string | undefined;
  /** Compromisso informado que o próprio texto exclui de venda e de cobrança. */
  referenceOnly?: boolean | undefined;
}

export type ClosureStatus = "closed" | "closed_with_note" | "draft" | "summary" | "open";

/** operation_days + diary_entries + daily_purchases. */
export interface OperationDay {
  date: string; // aaaa-mm-dd
  /** Recebido do dia já consolidado (dias registrados só por resumo). */
  receivedBase: number;
  ownCost: number;
  thirdPartyCost: number;
  bonus: number;
  bonusNote?: string | undefined;
  purchaseUnits?: number | undefined;
  purchaseCost?: number | undefined;
  /** Unidades disponíveis para o batimento físico (compra + sobras anteriores). */
  available?: number | undefined;
  soldUnits: number;
  lostUnits: number;
  /** Saldo do razão no fechamento. O saldo informado fica nos metadados do depósito. */
  cofrinhoEnd: number | null;
  /** Pendente gravado no diário. Não muda quando uma venda é quitada depois. */
  snapshotPending?: number;
  /** Saídas de estoque sem venda. Ficam fora da competência. */
  unlinkedUnits?: number;
  lines: SaleLine[];
  closure: ClosureStatus;
  closureNote?: string | undefined;
  observations?: string | undefined;
  /** Vendas gravadas no sistema para o dia (informativo; o financeiro vem do diário). */
  registeredSales?: RegisteredSale[] | undefined;
  /** Quando o diário tem dayClosing v2 — faturamento por competência. */
  competenceRevenue?: number | undefined;
  competenceProfit?: number | undefined;
  /** confirmed = auditado; provisional = há Δ (não somar como definitivo no mês). */
  competenceStatus?: "confirmed" | "provisional" | undefined;
  newCredit?: number | undefined;
  /** Snapshot completo das 5 dimensões (conciliação / UI). */
  dayClosing?: import("@/lib/finance/day-closing").DayClosingFinance | undefined;
}

export interface RegisteredSale {
  id: string;
  time: string;
  person: string;
  description: string;
  qty: number;
  amount: number;
  status: "paid" | "pending" | "partial";
  /** Ausente nas vendas antigas: a lista continua mostrando o turno. */
  timeConfidence?: "comprovado" | "estimado" | "nao-informado";
  /** Recebimento sem item. Não entra na soma de unidades. */
  receiptWithoutComposition?: boolean;
}

/** Dias anteriores usados só para tendência (lucro final por dia útil). */
export interface HistoryDay {
  date: string;
  profit: number;
  bonus: number;
}

export interface MonthPlan {
  month: string; // aaaa-mm
  label: string;
  goal: number;
  dailyTarget: number;
  holidays: string[];
  practicalAtStart: number;
  /** Banco do mês conferido por extrato, para meses sem cofrinho diário. */
  bankDeposited?: number | undefined;
  /** Mês sem plano cadastrado: meta = realizado. */
  historical?: boolean | undefined;
  scenarios: { conservative: number; ambitious: number };
  indicators: {
    profitPerDay: number;
    unitsPerDay: [number, number];
    ownCapitalPerDay: [number, number];
    thirdPartyMaxPerDay: number;
    maxLossesPerDay: number;
  };
}

export interface PreviousMonthStats {
  month: string;
  label: string;
  avgCashPerDay: number;
  avgOwnCostPerDay: number;
}

export interface VaultMovementView {
  id: string;
  date: string;
  type: string;
  effect: "credit" | "debit";
  amount: number;
  description: string;
  balanceAfter: number;
  informedBalance?: number | null;
  responsiblePayment?: number | null;
}

export interface VaultGapPart {
  date: string;
  amount: number;
  origin: "nao-identificada";
}

/** Saldo atual do cofrinho, calculado por movimentações. Independente do fechamento do dia. */
export interface VaultSnapshot {
  accountName: string;
  balance: number;
  asOf: string | null;
  informedBalance: number | null;
  reconciliationGap: number | null;
  gapParts: VaultGapPart[];
  movements: VaultMovementView[];
}

export interface StockInvestigation {
  id: string;
  date: string;
  quantity: number | null;
  summary: string;
}

export interface StockReading {
  productId: string;
  name: string;
  bookQuantity: number;
  openInvestigations: StockInvestigation[];
}

/** Referência declarada. A diferença não vira cobrança. */
export interface DeclaredDebtReference {
  id: string;
  person: string;
  declaredAmount: number | null;
  liveOpenAmount: number;
  lossAmount: number;
  nonReceivableAmount: number;
  unreconciledNote: string;
  source: string;
}

/** Tudo que as telas da ZAIVON v2 precisam, entregue por GET /api/zaivon. */
export interface ZaivonData {
  plan: MonthPlan;
  days: OperationDay[];
  debts: Debt[];
  settlements: Settlement[];
  previousHistory: HistoryDay[];
  previousMonth: PreviousMonthStats;
  /** Hoje no fuso de Fortaleza (aaaa-mm-dd). */
  today: string;
  /** Meses com dados no diário, do mais recente ao mais antigo. */
  availableMonths: { month: string; label: string }[];
  /** Razão do cofrinho. O saldo do dia fechado continua em `days[].cofrinhoEnd`. */
  vault: VaultSnapshot;
  stockReadings?: StockReading[];
  declaredReferences?: DeclaredDebtReference[];
}
