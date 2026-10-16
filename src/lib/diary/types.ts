import { z } from "zod";
import type { DayClosingFinance } from "@/lib/finance/day-closing";

/** Versão do schema — incrementar em mudanças breaking para IA futura. */
export const DIARY_SCHEMA_VERSION = 2;

export const diaryProductLineSchema = z.object({
  name: z.string(),
  quantity: z.number().int().min(0),
});

export const diaryFatherSaleSchema = z.object({
  units: z.number().int().min(0),
  amount: z.number().min(0),
  buyerName: z.string().optional(),
});

export const diaryProductHypothesisSchema = z.object({
  flavor: z.string(),
  hypothesis: z.string(),
  /** null = aguardando confirmação com mais dias de dados */
  confirmed: z.boolean().nullable().default(null),
});

export const diarySuggestedActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["planned", "in_progress", "done"]).default("planned"),
});

export const operationalDiaryEntrySchema = z.object({
  /** Aceita v1 (legado) e v2 (5 dimensões em dayClosing). */
  version: z.union([z.literal(1), z.literal(2)]).default(DIARY_SCHEMA_VERSION),
  businessId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dailyGoalUnits: z.number().int().min(0).optional(),
  purchase: z
    .object({
      totalUnits: z.number().int().min(0),
      investment: z.number().min(0),
      products: z.array(diaryProductLineSchema),
    })
    .optional(),
  sales: z
    .object({
      paidCount: z.number().int().min(0).optional(),
      creditCount: z.number().int().min(0).optional(),
      fatherSale: diaryFatherSaleSchema.optional(),
    })
    .optional(),
  revenue: z.object({
    /** Caixa do dia (vendas recebidas + quitações antigas + outras entradas). */
    received: z.number().min(0),
    pending: z.number().min(0).default(0),
    /** Preferir faturamento por competência quando dayClosing existir. */
    total: z.number().min(0),
  }),
  /**
   * Resultado gerencial de caixa (caixa − meu custo), histórico.
   * Com dayClosing, use competenceProfit / cashManagementResult.
   */
  profit: z.number(),
  /** Receita extra do dia fora das vendas (ex.: bonificação do Henrique). Soma ao lucro total. */
  bonusIncome: z.number().min(0).optional(),
  bonusIncomeDescription: z.string().optional(),
  quantitySold: z.number().int().min(0),
  quantityLost: z.number().int().min(0).default(0),
  lossReason: z.string().optional(),
  observations: z.string().optional(),
  manualInsights: z.string().optional(),
  lessonsLearned: z.string().optional(),
  commercialIntelligence: z
    .object({
      whatWeLearnedToday: z.array(z.string()),
      conclusion: z.string().optional(),
    })
    .optional(),
  suggestedActions: z.array(diarySuggestedActionSchema).optional(),
  productHypotheses: z.array(diaryProductHypothesisSchema).optional(),
  tags: z.array(z.string()).optional(),
  /**
   * Método financeiro permanente (5 dimensões).
   * Persistido em narrative.dayClosing — não altera colunas legadas.
   */
  dayClosing: z.custom<DayClosingFinance>().optional(),
});

export type OperationalDiaryEntry = z.infer<typeof operationalDiaryEntrySchema>;

export const ENTITY_TYPE = "operational_diary";

export function diaryEntityId(businessId: string, date: string): string {
  return `${businessId}:${date}`;
}

/** Lucro total do dia = lucro dos salgados + bonificação/receita extra (quando houver). */
export function deriveDiaryTotalProfit(
  entry: Pick<OperationalDiaryEntry, "profit" | "bonusIncome">,
): number {
  return Math.round((entry.profit + (entry.bonusIncome ?? 0)) * 100) / 100;
}

export function parseDiaryEntityId(entityId: string): { businessId: string; date: string } | null {
  const idx = entityId.indexOf(":");
  if (idx <= 0) return null;
  return { businessId: entityId.slice(0, idx), date: entityId.slice(idx + 1) };
}
