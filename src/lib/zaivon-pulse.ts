/**
 * ZAIVON Pulse v1.0 — leitura emocional + indicadores canônicos.
 * Não recalcula finanças: só mapeia dayClosing / diário / métricas já existentes.
 */
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DayClosingFinance } from "@/lib/finance/day-closing";
import type { OperationalDiaryEntry } from "@/lib/diary/types";

export type PulseTone = "green" | "amber" | "blue" | "neutral";

export type PulseInsightKind =
  | "positivo"
  | "recorde"
  | "sem-vendas"
  | "fiados"
  | "negativo"
  | "divergencia"
  | "incompleto";

export interface ZaivonPulseMetrics {
  /** Faturamento por competência (ou total do diário). */
  competenceRevenue: number | null;
  /** Lucro pessoal por competência. */
  competenceProfit: number | null;
  /** Caixa recebido (entradas reais). */
  cashIn: number | null;
  /** Fiados novos do período (reconhecidos, não recebidos). */
  newCredit: number | null;
}

export interface ZaivonPulseView {
  metrics: ZaivonPulseMetrics;
  description: string;
  insightKind: PulseInsightKind;
  insightTitle: string;
  insightMessage: string;
  tone: PulseTone;
  closingStatus: string;
  updateLabel: string;
  periodLabel: string;
  source: "dayClosing" | "diary" | "metrics";
  competenceProvisional: boolean;
  /** Neste dia, competenceProfit não é lucro pessoal definitivo. */
  personalProfitPending: boolean;
}

export interface BuildZaivonPulseInput {
  /** Data de foco yyyy-MM-dd. */
  focusDate: string;
  /** true se o foco é o dia civil de hoje. */
  isToday: boolean;
  diary?: OperationalDiaryEntry | null;
  /**
   * Fallback quando não há dayClosing/diário (visão geral / range).
   * Já calculados pela dashboard — não recalcular aqui.
   */
  fallback?: {
    revenue: number;
    profit: number;
    cashIn?: number | null;
    newCredit?: number | null;
  } | null;
  /** Recorde confirmado (opcional; vem de comparação histórica externa). */
  isRecord?: boolean;
}

const INSIGHT_COPY: Record<
  PulseInsightKind,
  { description: string; message: string; tone: PulseTone }
> = {
  positivo: {
    description: "Seu trabalho de hoje está construindo os resultados de amanhã.",
    message: "Que baita desempenho! Mais um dia transformando trabalho em crescimento real.",
    tone: "green",
  },
  recorde: {
    description: "Hoje seus resultados ganharam um capítulo especial.",
    message: "Você acaba de bater um recorde confirmado! Esse resultado merece comemoração.",
    tone: "green",
  },
  "sem-vendas": {
    description: "Um novo dia começa com novas possibilidades.",
    message: "O dia está começando. A primeira venda é o primeiro passo para o resultado de hoje.",
    tone: "neutral",
  },
  fiados: {
    description: "Há vendas registradas, mas o caixa ainda precisa acompanhar.",
    message:
      "Parte relevante do faturamento ainda está em fiados. Vale acompanhar os recebimentos sem confundir venda com dinheiro em caixa.",
    tone: "amber",
  },
  negativo: {
    description: "Nem todos os dias seguem o mesmo ritmo.",
    message:
      "Hoje o resultado ficou abaixo do custo próprio. Confira o que pesou no desempenho antes de planejar o próximo dia.",
    tone: "amber",
  },
  divergencia: {
    description: "Os números de hoje precisam de uma conferência.",
    message:
      "Existe uma divergência registrada na operação. Antes de celebrar o resultado, vale verificar as retiradas e os pagamentos.",
    tone: "amber",
  },
  incompleto: {
    description: "Seu dia ainda está tomando forma.",
    message:
      "Há informações pendentes de apuração. Quando a conciliação avançar, seu panorama ficará mais completo.",
    tone: "blue",
  },
};

function formatPeriodLabel(focusDate: string, isToday: boolean): string {
  const pretty = format(parseISO(focusDate), "d MMM yyyy", { locale: ptBR });
  if (isToday) return `Hoje · ${pretty}`;
  return pretty;
}

function hasDivergence(dc: DayClosingFinance): boolean {
  const sandwiches = dc.operationalAudit?.sandwiches?.status;
  const salgados = dc.operationalAudit?.salgados?.status;
  if (sandwiches === "diverged" || sandwiches === "pending") return true;
  if (salgados === "diverged" || salgados === "pending") return true;
  // Variação bancária do cofrinho (ex.: Δ R$2,09) NÃO é divergência operacional do Pulse.
  const notes = dc.reconciliation.notes
    .filter((n) => !/^DIVERGENTE cofrinho:/i.test(n))
    .join(" ");
  if (/divergência operacional|conciliação pendente|retiradas/i.test(notes)) return true;
  return false;
}

function resolveClosingStatus(dc: DayClosingFinance | null | undefined, kind: PulseInsightKind): string {
  if (kind === "sem-vendas") return "Sem movimentações registradas";
  if (kind === "incompleto") return "Dados parciais";
  if (kind === "divergencia") return "Conciliação pendente";
  if (!dc) return "Leitura do painel";
  if (dc.competenceStatus === "provisional") return "Fechamento parcial";
  if (hasDivergence(dc)) return "Conciliação pendente";
  return "Fechamento final · conciliado";
}

function resolveUpdateLabel(
  dc: DayClosingFinance | null | undefined,
  kind: PulseInsightKind,
  isToday: boolean,
): string {
  if (kind === "divergencia") return "Divergência identificada";
  if (kind === "fiados") return "Atenção aos recebimentos";
  if (kind === "incompleto") return "Indicadores indisponíveis identificados";
  if (kind === "sem-vendas") return isToday ? "Aguardando primeira venda" : "Sem movimentações no dia";
  if (kind === "recorde") return "Comparação histórica validada";
  if (dc?.competenceStatus === "provisional") return "Competência provisória";
  if (isToday) return "Movimentações em andamento";
  return "Dados do fechamento";
}

function pickInsightKind(input: {
  metrics: ZaivonPulseMetrics;
  dc: DayClosingFinance | null | undefined;
  isRecord?: boolean;
}): PulseInsightKind {
  const { metrics, dc, isRecord } = input;
  const { competenceRevenue, competenceProfit, cashIn, newCredit } = metrics;

  const anyNull =
    competenceRevenue == null ||
    competenceProfit == null ||
    cashIn == null ||
    newCredit == null;
  if (anyNull) return "incompleto";

  if (competenceRevenue === 0 && competenceProfit === 0 && cashIn === 0 && newCredit === 0) {
    return "sem-vendas";
  }

  if (dc && hasDivergence(dc)) return "divergencia";

  if (competenceProfit < 0) return "negativo";

  if (
    newCredit > 0 &&
    competenceRevenue > 0 &&
    newCredit / competenceRevenue >= 0.35
  ) {
    return "fiados";
  }

  if (isRecord && competenceProfit > 0) return "recorde";

  return "positivo";
}

function fromDayClosing(dc: DayClosingFinance): ZaivonPulseMetrics {
  return {
    competenceRevenue: dc.competenceRevenue,
    competenceProfit: dc.competenceProfit,
    cashIn: dc.cash.cashIn,
    newCredit: dc.newCredit,
  };
}

function fromDiary(diary: OperationalDiaryEntry): ZaivonPulseMetrics {
  return {
    competenceRevenue: diary.revenue?.total ?? null,
    competenceProfit: diary.profit ?? null,
    cashIn: diary.revenue?.received ?? null,
    newCredit: diary.revenue?.pending ?? null,
  };
}

/**
 * Constrói o estado do Pulse a partir de fontes canônicas.
 * Preferência: dayClosing → diário → fallback de métricas da dashboard.
 */
export function buildZaivonPulse(input: BuildZaivonPulseInput): ZaivonPulseView {
  const dc = input.diary?.dayClosing ?? null;
  let metrics: ZaivonPulseMetrics;
  let source: ZaivonPulseView["source"];

  if (dc) {
    metrics = fromDayClosing(dc);
    source = "dayClosing";
  } else if (input.diary?.revenue) {
    metrics = fromDiary(input.diary);
    source = "diary";
  } else if (input.fallback) {
    metrics = {
      competenceRevenue: input.fallback.revenue,
      competenceProfit: input.fallback.profit,
      cashIn: input.fallback.cashIn ?? input.fallback.revenue,
      newCredit: input.fallback.newCredit ?? 0,
    };
    source = "metrics";
  } else {
    metrics = {
      competenceRevenue: null,
      competenceProfit: null,
      cashIn: null,
      newCredit: null,
    };
    source = "metrics";
  }

  const insightKind = pickInsightKind({ metrics, dc, isRecord: input.isRecord });
  const copy = INSIGHT_COPY[insightKind];

  return {
    metrics,
    description: copy.description,
    insightKind,
    insightTitle: "INSIGHT DO DIA",
    insightMessage: copy.message,
    tone: copy.tone,
    closingStatus: resolveClosingStatus(dc, insightKind),
    updateLabel: resolveUpdateLabel(dc, insightKind, input.isToday),
    periodLabel: formatPeriodLabel(input.focusDate, input.isToday),
    source,
    competenceProvisional: dc?.competenceStatus === "provisional",
    personalProfitPending: dc?.definitivePersonalProfit === "pending",
  };
}

export const PULSE_METRIC_META = [
  {
    key: "competenceRevenue" as const,
    symbol: "◈",
    label: "Faturamento",
    sub: "Vendas por competência",
    accent: "#b7ff3c",
  },
  {
    key: "competenceProfit" as const,
    symbol: "↗",
    label: "Lucro pessoal",
    sub: "Resultado por competência",
    accent: "#2ed3a7",
  },
  {
    key: "cashIn" as const,
    symbol: "▣",
    label: "Caixa recebido",
    sub: "Entradas reais do dia",
    accent: "#f4f7fa",
  },
  {
    key: "newCredit" as const,
    symbol: "◷",
    label: "Fiados do dia",
    sub: "Reconhecidos, não recebidos",
    accent: "#f4bc6a",
  },
] as const;

export const PULSE_TONE_STYLES: Record<
  PulseTone,
  { bg: string; border: string; accent: string }
> = {
  green: { bg: "linear-gradient(95deg,#1e2d22,#19251e 85%)", border: "#3b5940", accent: "#b7ff3c" },
  amber: { bg: "linear-gradient(95deg,#2c251d,#241e18 85%)", border: "#645034", accent: "#f4bc6a" },
  blue: { bg: "linear-gradient(95deg,#1c2833,#18222c 85%)", border: "#355573", accent: "#3da5ff" },
  neutral: { bg: "linear-gradient(95deg,#202832,#1a2028 85%)", border: "#3a4653", accent: "#cbd3dd" },
};
