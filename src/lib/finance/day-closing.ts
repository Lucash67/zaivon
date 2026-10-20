/**
 * Método financeiro permanente do ZAIVON — cinco dimensões separadas.
 * Não força indicadores a coincidir: a conciliação explica as diferenças.
 */

export interface DayClosingCosts {
  ownCost: number;
  thirdPartyCost: number;
  totalNewCost: number;
  /** Datas/valores de pagamento de custo, quando conhecidos. */
  ownCostPaymentDates?: Array<{ date: string; amount: number; note?: string }>;
}

export interface DayClosingCashBreakdown {
  /** Recebimentos de vendas do próprio dia. */
  salesReceived: number;
  /** Quitações de dívidas de dias anteriores que entraram neste dia. */
  priorSettlements: number;
  /** Outras entradas já no caixa (bonificação, crédito sem origem classificada, etc.). */
  otherInflows: number;
  /** Total efetivo no caixa/banco. */
  cashIn: number;
}

export interface DayClosingCofrinho {
  openingBalance: number;
  deposit: number;
  withdrawal: number;
  bankYield: number;
  closingBalance: number;
}

export interface DayClosingReconciliation {
  /** Faturamento − caixa = (fiados novos) − (quitações antigas) ± outros. */
  competenceMinusCash: number;
  /** Lucro competência − resultado caixa (= mesma diferença, se custo próprio igual). */
  competenceProfitMinusCashResult: number;
  /** Depósito no cofrinho − resultado caixa (deve ser 0 se depositou o gerencial). */
  depositMinusCashResult: number;
  notes: string[];
}

/** Duas leituras de competência quando o diário e as sales divergem (ex.: 09/10). */
export interface ProvisionalCompetencePair {
  /** Lucro provisório a partir do total do diário. */
  fromDiary: { revenue: number; profit: number; formula: string };
  /** Resultado a partir da Σ sales identificadas no banco. */
  fromIdentifiedSales: { revenue: number; profit: number; formula: string };
  /** Diário − sales (ex.: R$15). */
  gap: number;
  status: "provisional";
}

/** Reconstrução de caixa na data do fechamento (não usar status atuais como histórico). */
export interface CashAtCloseReconstruction {
  diaryCash: number;
  /** Vendas do dia que já estavam pagas no encerramento. */
  daySalesPaidAtClose: number;
  priorSettlements: number;
  /** daySalesPaidAtClose + priorSettlements (+ otherInflows quando houver). */
  reconstructedCash: number;
  /**
   * Soma enganosa se lida hoje: inclui quitações posteriores
   * (ex.: Vanderson R$7 quitado em 13/10).
   */
  currentPaidSnapshot: number;
  gaps: string[];
}

/** Snapshot completo de um dia fechado nas 5 dimensões. */
export interface DayClosingFinance {
  date: string;
  /**
   * confirmed = competência auditada e conciliada.
   * provisional = há Δ não conciliado; ver provisionalCompetence (não tratar competenceProfit como definitivo).
   */
  competenceStatus: "confirmed" | "provisional";
  /** 1) Faturamento por competência (vendas do dia, incl. fiados). */
  competenceRevenue: number;
  /** 2) Caixa. */
  cash: DayClosingCashBreakdown;
  /** 3) Lucro pessoal por competência = faturamento − meu custo. */
  competenceProfit: number;
  /** 4) Resultado gerencial de caixa = caixa − meu custo. */
  cashManagementResult: number;
  costs: DayClosingCosts;
  newCredit: number;
  lossesAmount: number;
  lossesUnits: number;
  stockRemainingUnits: number;
  /** 5) Cofrinho. */
  piggyBank: DayClosingCofrinho;
  reconciliation: DayClosingReconciliation;
  /** Presente quando competenceStatus === 'provisional'. */
  provisionalCompetence?: ProvisionalCompetencePair;
  /** Reconstrução histórica do caixa (quando investigada). */
  cashAtClose?: CashAtCloseReconstruction;
  /**
   * Baixas históricas (lossSaleIds) — ocorrência ≠ reconhecimento ≠ data de baixa.
   * Não somar em lossesAmount / operational_losses do dia.
   */
  historicalWriteOffs?: Array<{
    saleId: string;
    amount: number;
    occurrenceDate: string;
    writeOffDate: string;
    classification: string;
    note: string;
  }>;
  /**
   * Batimento operacional por resumo (quando não há lines[] unitárias).
   * Permite distinguir salgados conciliados de sanduíches ainda pendentes.
   */
  operationalAudit?: {
    salgados?: {
      initial: number;
      paidUnits: number;
      lostUnits: number;
      final: number;
      status: "ok" | "pending" | "diverged";
      note?: string;
    };
    sandwiches?: {
      initial: number;
      ownConsumption: number;
      countedAt?: string;
      counted: number;
      status: "ok" | "pending" | "diverged";
      note?: string;
    };
  };
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Constrói e concilia as cinco dimensões a partir dos inputs confirmados. */
export function buildDayClosing(input: {
  date: string;
  competenceRevenue: number;
  salesReceived: number;
  priorSettlements: number;
  otherInflows?: number;
  ownCost: number;
  thirdPartyCost: number;
  newCredit: number;
  lossesAmount: number;
  lossesUnits: number;
  stockRemainingUnits: number;
  piggyOpening: number;
  piggyDeposit: number;
  piggyWithdrawal?: number;
  bankYield: number;
  piggyClosing: number;
  ownCostPaymentDates?: DayClosingCosts["ownCostPaymentDates"];
  extraNotes?: string[];
  competenceStatus?: "confirmed" | "provisional";
  provisionalCompetence?: ProvisionalCompetencePair;
  cashAtClose?: CashAtCloseReconstruction;
  historicalWriteOffs?: DayClosingFinance["historicalWriteOffs"];
  operationalAudit?: DayClosingFinance["operationalAudit"];
}): DayClosingFinance {
  const otherInflows = input.otherInflows ?? 0;
  const cashIn = roundMoney(input.salesReceived + input.priorSettlements + otherInflows);
  const totalNewCost = roundMoney(input.ownCost + input.thirdPartyCost);
  const competenceProfit = roundMoney(input.competenceRevenue - input.ownCost);
  const cashManagementResult = roundMoney(cashIn - input.ownCost);
  const competenceMinusCash = roundMoney(input.competenceRevenue - cashIn);
  const competenceProfitMinusCashResult = roundMoney(competenceProfit - cashManagementResult);
  const depositMinusCashResult = roundMoney(input.piggyDeposit - cashManagementResult);
  const expectedClosing = roundMoney(
    input.piggyOpening + input.piggyDeposit - (input.piggyWithdrawal ?? 0) + input.bankYield,
  );
  const competenceStatus = input.competenceStatus ?? "confirmed";

  const notes: string[] = [
    ...(input.extraNotes ?? []),
    `Faturamento ${input.competenceRevenue} − caixa ${cashIn} = ${competenceMinusCash} (= fiados novos ${input.newCredit} − quitações antigas ${input.priorSettlements}${otherInflows ? ` ± outras ${otherInflows}` : ""}).`,
    `Lucro competência ${competenceProfit} − resultado caixa ${cashManagementResult} = ${competenceProfitMinusCashResult}.`,
    `Depósito cofrinho ${input.piggyDeposit} − resultado caixa ${cashManagementResult} = ${depositMinusCashResult} (não há transferência automática do lucro por competência).`,
  ];
  if (competenceStatus === "provisional") {
    notes.unshift(
      "ATENÇÃO: competência PROVISÓRIA — não tratar competenceProfit como definitivamente confirmado até conciliar o Δ diário×sales.",
    );
  }
  if (Math.abs(expectedClosing - input.piggyClosing) > 0.001) {
    notes.push(
      `DIVERGENTE cofrinho: ${input.piggyOpening} + ${input.piggyDeposit} − ${input.piggyWithdrawal ?? 0} + ${input.bankYield} = ${expectedClosing} ≠ saldo informado ${input.piggyClosing}.`,
    );
  }

  return {
    date: input.date,
    competenceStatus,
    competenceRevenue: input.competenceRevenue,
    cash: {
      salesReceived: input.salesReceived,
      priorSettlements: input.priorSettlements,
      otherInflows,
      cashIn,
    },
    competenceProfit,
    cashManagementResult,
    costs: {
      ownCost: input.ownCost,
      thirdPartyCost: input.thirdPartyCost,
      totalNewCost,
      ownCostPaymentDates: input.ownCostPaymentDates,
    },
    newCredit: input.newCredit,
    lossesAmount: input.lossesAmount,
    lossesUnits: input.lossesUnits,
    stockRemainingUnits: input.stockRemainingUnits,
    piggyBank: {
      openingBalance: input.piggyOpening,
      deposit: input.piggyDeposit,
      withdrawal: input.piggyWithdrawal ?? 0,
      bankYield: input.bankYield,
      closingBalance: input.piggyClosing,
    },
    reconciliation: {
      competenceMinusCash,
      competenceProfitMinusCashResult,
      depositMinusCashResult,
      notes,
    },
    provisionalCompetence: input.provisionalCompetence,
    cashAtClose: input.cashAtClose,
    historicalWriteOffs: input.historicalWriteOffs,
    operationalAudit: input.operationalAudit,
  };
}

/**
 * Fechamento 13/10/2026 — corrigido após auditoria cruzada.
 * Salgados: 30 disponíveis = 27 vendidos + 3 perdidos.
 * Venda Henrique R$20 (4 salgados) preservada na competência; caixa do dia permanece R$143
 * (quitação só em 14/10). Fiados novos do dia na competência: Mikelly R$7 + Henrique R$20 = R$27.
 */
export const CLOSING_2026_10_13 = buildDayClosing({
  date: "2026-10-13",
  competenceStatus: "confirmed",
  competenceRevenue: 163,
  salesReceived: 136,
  priorSettlements: 7,
  ownCost: 36,
  thirdPartyCost: 74,
  newCredit: 27,
  lossesAmount: 15,
  lossesUnits: 3,
  stockRemainingUnits: 4,
  piggyOpening: 4374.55,
  piggyDeposit: 107,
  bankYield: 1.94,
  piggyClosing: 4483.49,
  ownCostPaymentDates: [
    { date: "2026-10-13", amount: 36, note: "Custo próprio do dia (salgados + sanduíches)." },
  ],
  extraNotes: [
    "Salgados: 30 disponíveis = 27 vendidos + 3 perdidos (antes quantity_lost=7; 4 un. reclassificadas como venda Henrique R$20).",
    "Henrique R$20 (4 salgados) na competência 13/10; quitação em 14/10 — não entra no caixa 13/10.",
    "Caixa R$143 = vendas do dia R$136 + quitação Vanderson R$7 (fiado 09/10).",
    "Espécie R$15 (Jackson, Cassiano, André Lima) = troca de meio via Pix Henrique, já no caixa.",
    "Depósito cofrinho = resultado gerencial de caixa R$107 (não o lucro por competência R$127).",
    "Ajuste posterior: dayClosing v2 e perdas 7→3 em 15/10/2026 (auditoria); venda Henrique criada em 16/10 sem duplicar recebimento.",
  ],
});

/**
 * Fechamento 09/10/2026 — caixa/cofrinho confirmados; competência PROVISÓRIA (Δ R$15).
 *
 * competenceRevenue/Profit no snapshot = vendas identificadas (269 → 205), NÃO o 220 do diário.
 * Os dois lucros provisórios ficam em provisionalCompetence.
 *
 * Reconstrução na data do fechamento (não usar status atuais):
 *   pending no encerramento = 70 (Laura 7 + Mikelly 7 + Vanderson 7 + Meia 32 + NI 17)
 *   day paid at close = 269 − 70 = 199
 *   quitações antigas = 20 → caixa reconstruído = 219
 *   diário caixa = 214 (= 194 dia + 20) → Δ R$5 ainda PENDENTE
 *   “paid atual” 206 = 199 + Vanderson 7 (quitado só em 13/10) — não é histórico de 09/10
 */
export const CLOSING_2026_10_09 = buildDayClosing({
  date: "2026-10-09",
  competenceStatus: "provisional",
  /** Working figure = sales identificadas; NÃO confirmar 284/220. */
  competenceRevenue: 269,
  salesReceived: 194,
  priorSettlements: 20,
  ownCost: 64,
  thirdPartyCost: 32,
  newCredit: 70,
  lossesAmount: 0,
  lossesUnits: 0,
  stockRemainingUnits: 0,
  piggyOpening: 4222.65,
  piggyDeposit: 150,
  bankYield: 1.9,
  piggyClosing: 4374.55,
  ownCostPaymentDates: [
    {
      date: "2026-10-09",
      amount: 64,
      note: "Custo próprio do dia (compra salgados; sanduíches desconsiderados na nota de terceiros).",
    },
  ],
  provisionalCompetence: {
    status: "provisional",
    fromDiary: {
      revenue: 284,
      profit: 220,
      formula: "Diário original: revenue.total 284 − ownCost 64 = 220 (PROVISÓRIO — Δ R$15 vs sales)",
    },
    fromIdentifiedSales: {
      revenue: 269,
      profit: 205,
      formula: "Σ sales sale_date=2026-10-09 = 269 − ownCost 64 = 205",
    },
    gap: 15,
  },
  cashAtClose: {
    diaryCash: 214,
    daySalesPaidAtClose: 199,
    priorSettlements: 20,
    reconstructedCash: 219,
    currentPaidSnapshot: 206,
    gaps: [
      "Diário: caixa 214 = vendas do dia 194 + quitações 20 (texto do fechamento).",
      "No encerramento 09/10: pending 70 → day paid = 269 − 70 = 199 (Vanderson ainda pending).",
      "Caixa reconstruído na data = 199 + 20 = 219 ≠ diário 214 (Δ R$5 PENDENTE).",
      "Snapshot atual paid=206 = 199 + Vanderson R$7 (settlement_date 13/10) — não usar como histórico de 09/10.",
      "206 + 20 = 226 também é leitura incorreta (mistura status atuais com quitações).",
    ],
  },
  historicalWriteOffs: [
    {
      saleId: "c0274cb3-7f01-4696-aa18-3c7f5349f7e0",
      amount: 32,
      occurrenceDate: "2026-10-09",
      writeOffDate: "2026-10-13",
      classification: "parceiro_a_receber→baixa_lossSaleIds",
      note: "Meia Sola: ocorrência 09/10 como a receber; reconhecimento/baixa em 13/10. NÃO entra em operational_losses nem em quantity_lost de 09/10.",
    },
    {
      saleId: "4d4ed217-fd52-4eb1-b508-62ac08e02942",
      amount: 10,
      occurrenceDate: "2026-10-09",
      writeOffDate: "2026-10-13",
      classification: "investigacao→baixa_lossSaleIds",
      note: "2 salgados NI: ocorrência 09/10; baixa 13/10. Sem operational_losses duplicada.",
    },
    {
      saleId: "26121526-8dbd-439e-acfc-9a97e8f701cf",
      amount: 7,
      occurrenceDate: "2026-10-09",
      writeOffDate: "2026-10-13",
      classification: "investigacao→baixa_lossSaleIds",
      note: "1 sanduíche NI: ocorrência 09/10; baixa 13/10. Sem operational_losses duplicada.",
    },
  ],
  extraNotes: [
    "Caixa/cofrinho/resultado gerencial 150 CONFIRMADOS (método legado do fechamento).",
    "Competência: PROVISÓRIA — lucros 220 (diário) e 205 (sales) apresentados em separado; Δ R$15 explícito.",
    "quantity_lost=0 em 09/10; baixas Meia Sola/NI só em lossSaleIds (ocorrência≠baixa).",
    "Quitações 09/10 R$20: Rian 07/10, Henrique 07/10, JV 08/10, espécie 08/10.",
  ],
});

/** Fechamento canônico de 14/10/2026 (valores confirmados na auditoria). */
export const CLOSING_2026_10_14 = buildDayClosing({
  date: "2026-10-14",
  competenceStatus: "confirmed",
  competenceRevenue: 251,
  salesReceived: 211,
  priorSettlements: 20,
  ownCost: 100,
  thirdPartyCost: 44.4,
  newCredit: 40,
  lossesAmount: 35,
  lossesUnits: 5,
  stockRemainingUnits: 2,
  piggyOpening: 4483.49,
  piggyDeposit: 131,
  bankYield: 3.95,
  piggyClosing: 4618.44,
  ownCostPaymentDates: [
    { date: "2026-10-14", amount: 100, note: "Custo próprio do dia (encomenda + reposição + sanduíches novos)." },
  ],
  extraNotes: [
    "Espécie R$25 convertida em Pix pelo Henrique = troca de meio, não faturamento extra.",
    "Tap to Pay bruto R$5,20 → venda R$5,00 (R$0,20 não gera segunda venda).",
    "Depósito efetivo ao cofrinho = resultado gerencial de caixa (R$131), não o lucro por competência (R$151).",
  ],
});

/**
 * Fechamento 15/10/2026 — caixa/cofrinho/depósito CONFIRMADOS; competência PROVISÓRIA.
 *
 * Confirmados: 27 Pix R$217 · quitações R$25 · fiados novos R$25 · meu custo R$110 ·
 * resultado caixa R$107 · depósito R$107 · cofrinho R$4.725,44 · 0 salgados · 16 sanduíches.
 *
 * Provisórios: faturamento R$198 · lucro competência R$88 · recebimentos estimados do dia R$173.
 * Ressalvas: R$19 crédito sem origem (otherInflows; NÃO criar venda/fiado/perda) ·
 * 2 saídas de sanduíche sem vínculo individual (na receita provisória de R$28, sem venda nominal).
 */
export const CLOSING_2026_10_15 = buildDayClosing({
  date: "2026-10-15",
  competenceStatus: "provisional",
  competenceRevenue: 198,
  salesReceived: 173,
  priorSettlements: 25,
  otherInflows: 19,
  ownCost: 110,
  thirdPartyCost: 0,
  newCredit: 25,
  lossesAmount: 0,
  lossesUnits: 0,
  stockRemainingUnits: 16,
  piggyOpening: 4618.44,
  piggyDeposit: 107,
  bankYield: 0,
  piggyClosing: 4725.44,
  ownCostPaymentDates: [
    {
      date: "2026-10-15",
      amount: 110,
      note: "Custo próprio informado no fechamento (encomenda 34 salgados; sanduíches já em estoque).",
    },
  ],
  provisionalCompetence: {
    status: "provisional",
    fromDiary: {
      revenue: 198,
      profit: 88,
      formula: "Fechamento: salgados 170 + sanduíches provisórios 28 − ownCost 110 = 88 (PROVISÓRIO)",
    },
    fromIdentifiedSales: {
      revenue: 184,
      profit: 74,
      formula: "Salgados 170 + Anderson 2 sanduíches Acal 14 = 184 − ownCost 110 = 74 (sem 2 saídas sanduíche sem vínculo)",
    },
    gap: 14,
  },
  cashAtClose: {
    diaryCash: 217,
    daySalesPaidAtClose: 173,
    priorSettlements: 25,
    reconstructedCash: 217,
    currentPaidSnapshot: 173,
    gaps: [
      "Pix total 217 = vendas estimadas 173 + quitações 25 + crédito sem origem 19.",
      "Crédito R$19: NÃO criar venda, fiado, perda nem segunda entrada bancária.",
      "Quitações 15/10 R$25 já no sistema (Sarah 5 + Anderson 10 + NI 5 + Paulo André 5 de 14/10).",
    ],
  },
  extraNotes: [
    "Status: ENCERRADO COM RESSALVA — competência provisória; caixa/cofrinho confirmados.",
    "HOMOLOGADO 19/10/2026: ownCost 110 · caixa 217 · resultado 107 · otherInflows 19 · depósito 107 · cofrinho 4725,44 — NÃO alterar por sanduíches de 16/10.",
    "27 Pix R$217 confirmados. Suellen 12:36: dois Pix R$5 separados preservados.",
    "Anderson Pix R$24 = quitação R$10 (14/10) + 2 sanduíches Acal R$14 (15/10).",
    "Henrique Pix R$15 inclui espécie NI R$5 (quitação 14/10) — não gerar segundo recebimento.",
    "Sanduíches: redução física 4 (20→16); só Anderson 2 un identificadas; 2 un sem vínculo individual.",
    "Ponte estoque 14→15: fim 14/10 = 2 un · início adotado 15/10 = 20 un (+18) SEM entrada de produção comprovada — NÃO criar compra retroativa.",
    "ownCost 110 = só salgados (34 un). Sanduíches já em estoque — sem reconhecimento de produção neste dia.",
    "João Lucas fiado 13/10 R$5: não duplicar como venda em 15/10.",
    "Depósito cofrinho = resultado gerencial de caixa R$107 (não o lucro por competência R$88).",
    "Não afetar fechamento de 16/10.",
  ],
});

/**
 * Fechamento 16/10/2026 — PARCIALMENTE CONCILIADO (sanduíches aguardam 19/10).
 *
 * Confirmados: caixa R$207 (vendas 154 + quitações 53) · custo salgados R$93,30 ·
 * depósito cofrinho R$127 REALIZADO · saldo R$4.854,52 · salgados 29→0 · 1 perda recuperável R$5.
 *
 * Provisório: competência (sanduíches incompletos) · estoque sanduíches 7 às 16h (Natália incerta).
 * Não forçar resultado caixa (113,70) = depósito (127) — depósito vem da distribuição do acumulado 16–18.
 */
export const CLOSING_2026_10_16 = buildDayClosing({
  date: "2026-10-16",
  competenceStatus: "provisional",
  /** Salgados pagos 140 + sanduíches pagos 14 + fiados novos Ana Laura 14. Perda R$5 fora da receita. */
  competenceRevenue: 168,
  salesReceived: 154,
  priorSettlements: 53,
  otherInflows: 0,
  ownCost: 93.3,
  thirdPartyCost: 0,
  newCredit: 14,
  lossesAmount: 5,
  lossesUnits: 1,
  stockRemainingUnits: 7,
  piggyOpening: 4727.52,
  piggyDeposit: 127,
  bankYield: 0,
  piggyClosing: 4854.52,
  ownCostPaymentDates: [
    {
      date: "2026-10-20",
      amount: 93.3,
      note: "Repasse de custo salgados previsto 20/10. Reserva R$100 (R$93,30 custo + R$6,70 margem). Reconhecimento do custo em 16/10.",
    },
  ],
  provisionalCompetence: {
    status: "provisional",
    fromDiary: {
      revenue: 168,
      profit: 74.7,
      formula: "Salgados pagos 140 + sanduíches pagos 14 + Ana Laura fiados novos 14 − ownCost 93,30 = 74,70 (PROVISÓRIO; sanduíches anônimos fora)",
    },
    fromIdentifiedSales: {
      revenue: 154,
      profit: 60.7,
      formula: "Só vendas pagas identificadas 154 − ownCost 93,30 = 60,70 (sem fiados novos Ana Laura; sem anônimos)",
    },
    gap: 14,
  },
  cashAtClose: {
    diaryCash: 207,
    daySalesPaidAtClose: 154,
    priorSettlements: 53,
    reconstructedCash: 207,
    currentPaidSnapshot: 154,
    gaps: [
      "Caixa 207 = vendas 154 + quitações 53 (Mikelly 43 + Gerb 5 + João Victor 5).",
      "Recebimentos 17/10 (João Lucas 10) e 18/10 (Carlos 10) NÃO entram no caixa de 16/10.",
      "Depósito cofrinho 127 ≠ resultado caixa 113,70 — distribuição do acumulado 16–18, não lucro exclusivo do dia.",
      "Sanduíches: 5–6 retiradas sem pagamento (R$35–42) pendentes até contagem 19/10 — não viram perda ainda.",
      "Natália R$7 (~16h48): pode ser quitação anterior ou nova retirada pós-16h — estoque físico confirmado permanece 7 às 16h.",
      "Abertura cofrinho informada 4727,52 (Δ +2,08 vs fechamento 15/10 4725,44 — não classificado como rendimento separado).",
    ],
  },
  extraNotes: [
    "Status: HOMOLOGADO COM RESSALVAS OPERACIONAIS (19/10/2026) — financeiro conciliado; sanduíches com divergência de período.",
    "FINANCEIRO CONCILIADO: vendas 154 · quitações 53 · caixa 207 · ownCost 93,30 · lucro pessoal pagas 60,70 · resultado caixa 113,70 · competência provisória 168/74,70 · depósito 127 · cofrinho 4854,52.",
    "Salgados: 29 un · Unifor 16 + Acal 13 · final 0 · pagos 28 un R$140 · 1 perda recuperável R$5.",
    "Unifor R$60 = Pix nominais R$35 + repasse Henrique espécie→Pix R$25 (não duplicar faturamento).",
    "Gerb Pix R$10 = venda 16/10 R$5 + quitação 15/10 R$5 (atribuição da conciliação; pode exigir confirmação).",
    "Sanduíches: estoque inicial 16 (de 15/10) · consumo próprio 2 · contagem sex 16h = 7 · pagamentos Letícia+Natália R$14 · Ana Laura fiados R$14 PROVISÓRIOS.",
    "Custo sanduíches: NÃO reapropriar em 16/10. ownCost 15/10 = só salgados; produção/custo do lote recente em 14/10 (e anteriores). Estoque carregado — sem duplicar CMV no ownCost do dia.",
    "Natália R$7 ~16h48: SEM horário físico comprovado — quitação de retirada pré-16h OU nova pós-contagem; estoque 16h permanece 7.",
    "Divergência estoque PERÍODO (sex 16h → seg ~10h): 7→4 = 3 un SEM DATA — não atribuir a 16, 17 ou 19 sem evidência.",
    "Transferência cofrinho R$127 REALIZADA · saldo final R$4.854,52 · reserva custos R$100 separada (prev. 20/10).",
    "Recebimentos 17/10 (João Lucas 10) e 18/10 (Carlos 10) nas datas efetivas — fora do caixa 16/10.",
    "Mikelly R$7 (sanduíche 14/10) baixado por inadimplência (lossSaleIds, writeOff 19/10). Fiado 15/10 R$5 permanece cobrável. NÃO reativar o R$7 baixado.",
  ],
  historicalWriteOffs: [
    {
      saleId: "4834b3a8-fd8b-4876-9354-2ecee94028da",
      amount: 7,
      occurrenceDate: "2026-10-14",
      writeOffDate: "2026-10-19",
      classification: "fiado→inadimplencia_credito_incobravel→lossSaleIds",
      note: "Mikelly: R$50 − R$43 (16/10) = R$7. Distinto da perda salgado NI R$5 de 16/10. Sem impacto em caixa/cofrinho.",
    },
  ],
  operationalAudit: {
    salgados: {
      initial: 29,
      paidUnits: 28,
      lostUnits: 1,
      final: 0,
      status: "ok",
      note: "29 = 28 pagos + 1 perda recuperável (NI). Estoque final 0.",
    },
    sandwiches: {
      initial: 16,
      ownConsumption: 2,
      countedAt: "16:00",
      counted: 7,
      status: "diverged",
      note: "Contagem sex 16h=7; seg 19/10 ~10h=4. Δ3 = divergência de período sem data. Natália físico incerto. Ana Laura R$14 provisório. Não inventar baixas.",
    },
  },
});

/**
 * Fechamento 19/10/2026 — FINANCEIRO CONCILIADO · DEPÓSITO REALIZADO · ressalva variação bancária R$2,09.
 *
 * Disponíveis: 36 salgados + 2 sanduíches novos.
 * Pagos: 22 salgados R$110 + 1 sanduíche R$8 = R$118.
 * Fiados novos: JV R$10 + Mikelly sanduíche NOVO R$7 + Henrique R$35 = R$52.
 * Competência 170 · ownCost 110 · lucro competência 60 · resultado caixa 8 · desembolso 0.
 * 5 salgados NI Acal R$25 potencial — NÃO receita (perda operacional).
 * Henrique R$20 espécie→Pix = conversão de meio, NÃO venda/quitação.
 * Depósito R$118 REALIZADO 19/10 (Mercado Pago). Abertura 4.854,52 + 118 = 4.972,52.
 * Saldo observado captura MP: R$4.974,61. Δ R$2,09 = variação NÃO CLASSIFICADA (não rendimento).
 */
export const CLOSING_2026_10_19 = buildDayClosing({
  date: "2026-10-19",
  competenceStatus: "confirmed",
  competenceRevenue: 170,
  salesReceived: 118,
  priorSettlements: 0,
  otherInflows: 0,
  ownCost: 110,
  thirdPartyCost: 0,
  newCredit: 52,
  lossesAmount: 25,
  lossesUnits: 5,
  /** Salgados final 0; remanescente = sanduíches (4 herdados ± produção do dia = 4). */
  stockRemainingUnits: 4,
  piggyOpening: 4854.52,
  piggyDeposit: 118,
  /** bankYield=0: Δ R$2,09 NÃO é rendimento confirmado — ver notes / DIVERGENTE. */
  bankYield: 0,
  piggyClosing: 4974.61,
  ownCostPaymentDates: [
    {
      date: "2026-10-19",
      amount: 0,
      note: "Desembolso pessoal efetivo R$0. Custo gerencial R$110 reconhecido; pagamento do fornecedor não desembolsado neste dia.",
    },
  ],
  cashAtClose: {
    diaryCash: 118,
    daySalesPaidAtClose: 118,
    priorSettlements: 0,
    reconstructedCash: 118,
    currentPaidSnapshot: 118,
    gaps: [
      "Depósito cofrinho R$118 REALIZADO em 19/10 (Mercado Pago). Abertura 4854,52 + 118 = 4972,52.",
      "Saldo observado captura MP R$4.974,61. Δ R$2,09 = variação bancária NÃO CLASSIFICADA (não bankYield).",
      "Henrique R$20 espécie→Pix: conversão de meio — NÃO entra como venda nem quitação.",
      "5 salgados NI Acal: valor comercial potencial R$25 — NÃO receita; em lossesAmount.",
      "Mikelly fiado R$7 = sanduíche NOVO de 19/10 — distinto do R$7 de 14/10 já em lossSaleIds.",
    ],
  },
  extraNotes: [
    "Status: FINANCEIRO CONCILIADO — DEPÓSITO REALIZADO — RESSALVA DE VARIAÇÃO BANCÁRIA R$2,09.",
    "FINANCEIRO: vendas pagas 118 · fiados novos 52 · competência 170 · ownCost 110 · lucro competência 60 · resultado caixa 8 · desembolso 0.",
    "Cofrinho: abertura 4854,52 + depósito 118 = 4972,52 (aritmética). Observado MP 4974,61. bankYield=0.",
    "Salgados 36: Unifor ini 22 · Acal ini 14 · Unifor manhã 7 pagos · 15 transferidos Unifor→Acal · Acal saídas (pagas + 5 NI) · Gabriela Barreto 1 Unifor · Henrique fiado 7.",
    "Batimento FINANCEIRO unidades: 22 pagos + JV 2 fiado + Henrique 7 fiado + 5 NI = 36. Estoque final salgados 0.",
    "RESSALVA OPERACIONAL: narrativa Acal '16 pagas' + Unifor7 + Gabriela1 = 24; financeiro homologado = 22 pagos. Δ2 documentado sem forçar batimento nem criar vendas.",
    "Sanduíches: 2 novos · 1 pago R$8 · 1 fiado Mikelly R$7. Contagem manhã (antes da produção) = 4 (herança do gap 16→19).",
    "Não reativar Mikelly R$7 inadimplência 14/10 (4834b3a8).",
  ],
  operationalAudit: {
    salgados: {
      initial: 36,
      paidUnits: 22,
      lostUnits: 5,
      final: 0,
      status: "ok",
      note: "22 pagos + 9 fiado (JV2+Henrique7) + 5 NI = 36. Transferência Unifor→Acal 15 un documentada.",
    },
    sandwiches: {
      initial: 4,
      ownConsumption: 0,
      countedAt: "10:00",
      counted: 4,
      status: "ok",
      note: "4 herdados (gap período sex→seg já no 16/10). +2 novos −1 pago −1 fiado Mikelly. Não fechar Δ3 do período anterior aqui.",
    },
  },
});

