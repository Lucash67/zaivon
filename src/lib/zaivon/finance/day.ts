import type { Debt, MonthPlan, OperationDay, SaleLine, Settlement } from "@/lib/zaivon/types";

export const round2 = (n: number) => Math.round(n * 100) / 100;
const lineValue = (l: SaleLine) => l.qty * l.unitPrice;
const sumLines = (lines: SaleLine[], pred: (l: SaleLine) => boolean) =>
  round2(lines.filter(pred).reduce((s, l) => s + lineValue(l), 0));

/** Quitações que entraram no banco nesta data. */
export function settlementsOn(date: string, settlements: Settlement[]): number {
  return round2(settlements.filter((s) => s.paidDate === date).reduce((s, x) => s + x.amount, 0));
}

/** Recebido do dia: só vendas do próprio dia que entraram. */
export function receivedSameDay(day: OperationDay): number {
  return round2(day.receivedBase + sumLines(day.lines, (l) => l.status === "paid"));
}

export interface DayFinance {
  received: number;
  settlements: number;
  cashIn: number;
  ownCost: number;
  thirdPartyCost: number;
  economicCost: number;
  bonus: number;
  operationalProfit: number;
  profit: number;
}

/** Lucro final = entrada total no caixa + bonificação − meu custo. */
export function dayFinance(day: OperationDay, settlements: Settlement[]): DayFinance {
  const received = receivedSameDay(day);
  const q = settlementsOn(day.date, settlements);
  const cashIn = round2(received + q);
  return {
    received,
    settlements: q,
    cashIn,
    ownCost: day.ownCost,
    thirdPartyCost: day.thirdPartyCost,
    economicCost: round2(day.ownCost + day.thirdPartyCost),
    bonus: day.bonus,
    operationalProfit: round2(cashIn - day.ownCost),
    profit: round2(cashIn + day.bonus - day.ownCost),
  };
}

export interface DayOutflow {
  potential: number;
  received: number;
  fiado: number;
  parceiro: number;
  investigar: number;
  perda: number;
  units: Record<SaleLine["status"], number>;
  totalUnits: number;
}

export function dayOutflow(day: OperationDay): DayOutflow {
  const units = { paid: 0, fiado: 0, parceiro: 0, investigar: 0, perda: 0, sobra: 0 };
  for (const l of day.lines) units[l.status] += l.qty;
  return {
    potential: sumLines(day.lines, (l) => l.status !== "sobra"),
    received: sumLines(day.lines, (l) => l.status === "paid"),
    fiado: sumLines(day.lines, (l) => l.status === "fiado"),
    parceiro: sumLines(day.lines, (l) => l.status === "parceiro"),
    investigar: sumLines(day.lines, (l) => l.status === "investigar"),
    perda: sumLines(day.lines, (l) => l.status === "perda"),
    units,
    totalUnits: Object.values(units).reduce((a, b) => a + b, 0),
  };
}

export interface Check {
  id: "fisico" | "financeiro" | "cofrinho";
  label: string;
  ok: boolean | null; // null = sem dados para conferir
  detail: string;
}

/** Diferença tolerada no batimento do cofrinho. */
export const COFRINHO_TOLERANCE = 5;

export function previousCofrinho(day: OperationDay, days: OperationDay[], plan: MonthPlan): number {
  const prev = [...days]
    .filter((d) => d.date < day.date && d.cofrinhoEnd != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  return prev?.cofrinhoEnd ?? plan.practicalAtStart;
}

/** Rendimento implícito = (cofrinho hoje − ontem) − lucro do dia. */
export function impliedYield(
  day: OperationDay,
  days: OperationDay[],
  settlements: Settlement[],
  plan: MonthPlan,
): number | null {
  if (day.cofrinhoEnd == null) return null;
  const delta = day.cofrinhoEnd - previousCofrinho(day, days, plan);
  return round2(delta - dayFinance(day, settlements).profit);
}

export function dayChecks(
  day: OperationDay,
  days: OperationDay[],
  settlements: Settlement[],
  plan: MonthPlan,
): Check[] {
  const o = dayOutflow(day);
  const hasLines = day.lines.length > 0;
  const fis: Check = hasLines && day.available != null
    ? {
        id: "fisico",
        label: "Batimento físico",
        ok: day.available === o.totalUnits,
        detail: `${day.available} disponíveis = ${o.units.paid} pagos + ${o.units.fiado} fiados + ${o.units.parceiro} parceiro + ${o.units.investigar} não identificados + ${o.units.perda} perdas + ${o.units.sobra} sobras${day.available === o.totalUnits ? "" : ` (soma ${o.totalUnits})`}`,
      }
    : { id: "fisico", label: "Batimento físico", ok: null, detail: "Dia registrado só por resumo." };
  const rhs = round2(o.received + o.fiado + o.parceiro + o.investigar + o.perda);
  const fin: Check = hasLines
    ? {
        id: "financeiro",
        label: "Batimento financeiro",
        ok: Math.abs(o.potential - rhs) < 0.01,
        detail: `Potencial ${o.potential} = ${o.received} recebido + ${round2(o.fiado + o.parceiro)} a receber + ${o.investigar} investigação + ${o.perda} perdas`,
      }
    : { id: "financeiro", label: "Batimento financeiro", ok: null, detail: "Sem saídas detalhadas." };
  const y = impliedYield(day, days, settlements, plan);
  const cof: Check =
    y == null
      ? { id: "cofrinho", label: "Batimento do cofrinho", ok: null, detail: "Cofrinho do dia não informado." }
      : {
          id: "cofrinho",
          label: "Batimento do cofrinho",
          ok: y >= -0.5 && y <= COFRINHO_TOLERANCE,
          detail: `Variação do cofrinho − lucro = R$ ${y.toFixed(2).replace(".", ",")} (rendimento esperado entre R$ 0 e R$ ${COFRINHO_TOLERANCE})`,
        };
  return [fis, fin, cof];
}

/** Recuperação = fiados + parceiros + investigação (somente em aberto). */
export function recovery(debts: Debt[]) {
  const open = debts.filter((d) => d.status === "open");
  const by = (t: Debt["type"]) =>
    round2(open.filter((d) => d.type === t).reduce((s, d) => s + d.amount - d.paid, 0));
  const fiado = by("fiado");
  const parceiro = by("parceiro");
  const investigacao = by("investigacao");
  return {
    fiado,
    parceiro,
    investigacao,
    identified: round2(fiado + parceiro),
    total: round2(fiado + parceiro + investigacao),
  };
}

export function daysOpen(originDate: string, refDate: string): number {
  const a = new Date(originDate + "T12:00:00Z").getTime();
  const b = new Date(refDate + "T12:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}
