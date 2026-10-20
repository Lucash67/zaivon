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
  /** Crédito/outras entradas já no caixa (ex.: R$19 sem origem classificada). */
  otherInflows: number;
  cashIn: number;
  ownCost: number;
  thirdPartyCost: number;
  economicCost: number;
  bonus: number;
  /** Resultado gerencial de caixa (caixa − meu custo), sem bônus. */
  operationalProfit: number;
  /** Resultado gerencial de caixa + bonificação − (já embutido no profit legado). */
  profit: number;
  /** Faturamento por competência (vendas do dia, incl. fiados/parceiro/investigar). */
  competenceRevenue: number;
  /** Lucro pessoal por competência = faturamento − meu custo. */
  competenceProfit: number;
  /** confirmed = auditado; provisional = Δ pendente (não tratar como definitivo). */
  competenceStatus: "confirmed" | "provisional";
  /** Fiados novos do dia (valor). */
  newCredit: number;
}

/**
 * Indicadores do dia.
 * Quando há dayClosing v2, ele é a fonte canônica das 5 dimensões
 * (inclui otherInflows no caixa — não recalcular só com vendas + quitações).
 */
export function dayFinance(day: OperationDay, settlements: Settlement[]): DayFinance {
  const dc = day.dayClosing;
  if (dc) {
    const cashIn = dc.cash.cashIn;
    const ownCost = dc.costs.ownCost;
    const operationalProfit = dc.cashManagementResult;
    return {
      received: dc.cash.salesReceived,
      settlements: dc.cash.priorSettlements,
      otherInflows: dc.cash.otherInflows,
      cashIn,
      ownCost,
      thirdPartyCost: dc.costs.thirdPartyCost,
      economicCost: round2(dc.costs.ownCost + dc.costs.thirdPartyCost),
      bonus: day.bonus,
      operationalProfit,
      profit: round2(operationalProfit + day.bonus),
      competenceRevenue: dc.competenceRevenue,
      competenceProfit: dc.competenceProfit,
      competenceStatus: dc.competenceStatus,
      newCredit: dc.newCredit,
    };
  }

  const received = receivedSameDay(day);
  const q = settlementsOn(day.date, settlements);
  const otherInflows = 0;
  const cashIn = round2(received + q + otherInflows);
  const newCredit =
    day.newCredit ??
    sumLines(day.lines, (l) => l.status === "fiado" || l.status === "parceiro" || l.status === "investigar");
  const competenceRevenue = day.competenceRevenue ?? round2(received + newCredit);
  const competenceProfit = day.competenceProfit ?? round2(competenceRevenue - day.ownCost);
  const competenceStatus = day.competenceStatus ?? "confirmed";
  return {
    received,
    settlements: q,
    otherInflows,
    cashIn,
    ownCost: day.ownCost,
    thirdPartyCost: day.thirdPartyCost,
    economicCost: round2(day.ownCost + day.thirdPartyCost),
    bonus: day.bonus,
    operationalProfit: round2(cashIn - day.ownCost),
    profit: round2(cashIn + day.bonus - day.ownCost),
    competenceRevenue,
    competenceProfit,
    competenceStatus,
    newCredit,
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

/**
 * Batimento do cofrinho:
 * saldo final − (abertura + depósito − retirada + rendimento declarado).
 * Com dayClosing, usa a abertura/depósito do snapshot — NÃO comparar com
 * resultado de caixa nem lucro por competência (isso inventa Δ falso, ex. R$15,38).
 */
export function impliedYield(
  day: OperationDay,
  days: OperationDay[],
  settlements: Settlement[],
  plan: MonthPlan,
): number | null {
  if (day.cofrinhoEnd == null) return null;
  const dc = day.dayClosing;
  if (dc?.piggyBank) {
    const expectedClose = round2(
      dc.piggyBank.openingBalance +
        dc.piggyBank.deposit -
        (dc.piggyBank.withdrawal ?? 0) +
        (dc.piggyBank.bankYield ?? 0),
    );
    return round2(day.cofrinhoEnd - expectedClose);
  }
  const delta = day.cofrinhoEnd - previousCofrinho(day, days, plan);
  return round2(delta - dayFinance(day, settlements).operationalProfit);
}

export function dayChecks(
  day: OperationDay,
  days: OperationDay[],
  settlements: Settlement[],
  plan: MonthPlan,
): Check[] {
  const o = dayOutflow(day);
  const hasLines = day.lines.length > 0;
  const dc = day.dayClosing;
  const audit = dc?.operationalAudit;

  let fis: Check;
  if (hasLines && day.available != null) {
    fis = {
      id: "fisico",
      label: "Batimento físico",
      ok: day.available === o.totalUnits,
      detail: `${day.available} disponíveis = ${o.units.paid} pagos + ${o.units.fiado} fiados + ${o.units.parceiro} parceiro + ${o.units.investigar} não identificados + ${o.units.perda} perdas + ${o.units.sobra} sobras${day.available === o.totalUnits ? "" : ` (soma ${o.totalUnits})`}`,
    };
  } else if (audit?.salgados) {
    const s = audit.salgados;
    const sum = s.paidUnits + s.lostUnits;
    const salgadosOk = s.status === "ok" && s.initial === sum && s.final === 0;
    const sand = audit.sandwiches;
    const sandNote = sand
      ? ` Sanduíches: ${sand.status === "pending" ? "PENDENTE" : sand.status} — inicial ${sand.initial} · consumo próprio ${sand.ownConsumption} · contagem ${sand.countedAt ?? "—"} = ${sand.counted}${sand.note ? ` (${sand.note})` : ""}.`
      : "";
    fis = {
      id: "fisico",
      label: "Batimento físico (resumo)",
      // Só OK pleno se salgados batem E sanduíches não estão pendentes.
      ok: salgadosOk && sand?.status !== "pending" ? true : salgadosOk && sand?.status === "pending" ? null : false,
      detail: `Salgados ${salgadosOk ? "OK" : "divergente"}: inicial ${s.initial} = ${s.paidUnits} pagos + ${s.lostUnits} perda → final ${s.final}.${sandNote}`,
    };
  } else {
    fis = {
      id: "fisico",
      label: "Batimento físico",
      ok: null,
      detail: dc
        ? `Sem linhas unitárias nem operationalAudit. Estoque remanescente (dayClosing): ${dc.stockRemainingUnits} un · perdas ${dc.lossesUnits} un.`
        : "Dia registrado só por resumo — faltam linhas de saída (paid/fiado/perda) para batimento físico.",
    };
  }

  const rhs = round2(o.received + o.fiado + o.parceiro + o.investigar + o.perda);
  let fin: Check;
  if (hasLines) {
    fin = {
      id: "financeiro",
      label: "Batimento financeiro",
      ok: Math.abs(o.potential - rhs) < 0.01,
      detail: `Potencial ${o.potential} = ${o.received} recebido + ${round2(o.fiado + o.parceiro)} a receber + ${o.investigar} investigação + ${o.perda} perdas`,
    };
  } else if (dc) {
    const parts = round2(dc.cash.salesReceived + dc.cash.priorSettlements + dc.cash.otherInflows);
    const cashOk = Math.abs(dc.cash.cashIn - parts) < 0.01;
    const sandPending = audit?.sandwiches?.status === "pending";
    fin = {
      id: "financeiro",
      label: sandPending ? "Batimento financeiro (caixa)" : "Batimento financeiro",
      ok: cashOk && !sandPending ? true : cashOk && sandPending ? null : false,
      detail: cashOk
        ? `Caixa R$ ${dc.cash.cashIn.toFixed(2)} = vendas ${dc.cash.salesReceived.toFixed(2)} + quitações ${dc.cash.priorSettlements.toFixed(2)} + outras ${dc.cash.otherInflows.toFixed(2)}.${
            sandPending
              ? " Sanduíches anônimos ainda sem conciliação — não OK pleno."
              : ""
          }`
        : `Caixa dayClosing R$ ${dc.cash.cashIn.toFixed(2)} ≠ soma partes R$ ${parts.toFixed(2)}.`,
    };
  } else {
    fin = {
      id: "financeiro",
      label: "Batimento financeiro",
      ok: null,
      detail: "Sem saídas detalhadas — faltam linhas de venda para batimento financeiro por composição.",
    };
  }

  const y = impliedYield(day, days, settlements, plan);
  const piggy = dc?.piggyBank;
  const cof: Check =
    y == null
      ? { id: "cofrinho", label: "Batimento do cofrinho", ok: null, detail: "Cofrinho do dia não informado." }
      : {
          id: "cofrinho",
          label: "Batimento do cofrinho",
          ok: y >= -0.5 && y <= COFRINHO_TOLERANCE,
          detail:
            Math.abs(y) < 0.01 && piggy
              ? `Saldo ${piggy.closingBalance.toFixed(2).replace(".", ",")} = abertura ${piggy.openingBalance.toFixed(2).replace(".", ",")} + depósito ${piggy.deposit.toFixed(2).replace(".", ",")} − retirada ${(piggy.withdrawal ?? 0).toFixed(2).replace(".", ",")} + rendimento ${(piggy.bankYield ?? 0).toFixed(2).replace(".", ",")} (batimento OK; depósito único). Não comparar com resultado de caixa.`
              : piggy
                ? `Saldo informado − (abertura + depósito − retirada + rendimento) = R$ ${y.toFixed(2).replace(".", ",")} (tol. R$ ${COFRINHO_TOLERANCE}). Não comparar com resultado de caixa nem lucro por competência.`
                : `Variação − resultado de caixa = R$ ${y.toFixed(2).replace(".", ",")} (tol. R$ ${COFRINHO_TOLERANCE}).`,
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
