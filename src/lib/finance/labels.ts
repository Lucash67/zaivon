/**
 * Nomenclatura canônica do método financeiro ZAIVON (5 dimensões).
 * Use estes rótulos na UI v2; módulos legados devem citar o equivalente legado.
 */

export const FINANCE_LABELS = {
  competenceRevenue: {
    short: "Faturamento (competência)",
    formula: "Vendas do dia reconhecidas na data, incluindo fiados.",
    legacyAliases: ["Receita bruta", "Receita / faturamento", "Gross revenue"],
  },
  cashIn: {
    short: "Entrada no caixa",
    formula: "Recebimentos efetivos: vendas pagas do dia + quitações antigas + outras entradas.",
    legacyAliases: ["Entrada de caixa", "Caixa", "Recebido"],
  },
  competenceProfit: {
    short: "Resultado após desembolso próprio",
    formula: "Faturamento (competência) − desembolso próprio. O custo pago por terceiros fica de fora. Não é depósito no cofrinho.",
    legacyAliases: ["Lucro por competência", "Lucro pessoal"],
  },
  preliminaryEconomicResult: {
    short: "Resultado econômico preliminar",
    formula: "Faturamento (competência) − custo próprio − custo de terceiros. Não é depósito no cofrinho.",
    legacyAliases: [],
  },
  cashManagementResult: {
    short: "Resultado gerencial de caixa",
    formula: "Entrada no caixa − meu custo próprio (± bônus, se houver). É o que tipicamente alimenta o depósito.",
    legacyAliases: ["Resultado de caixa", "Lucro operacional (quando = caixa − custo)", "Lucro do diário"],
  },
  operationalProfitLegacy: {
    short: "Lucro operacional (legado)",
    formula: "Indicador legado do módulo Financeiro — pode misturar margens de produto; não confundir com resultado gerencial de caixa.",
    legacyAliases: ["Lucro operacional", "Operational profit"],
  },
  piggyDeposit: {
    short: "Depósito no cofrinho",
    formula: "Transferência efetiva no dia. Não sai automaticamente do resultado após desembolso próprio nem do resultado econômico preliminar.",
    legacyAliases: ["Depósito", "Transferência"],
  },
  piggyBalance: {
    short: "Saldo do cofrinho",
    formula: "Saldo do razão no fechamento. O valor visto no Mercado Pago pode diferir e essa diferença não é rendimento.",
    legacyAliases: ["Cofrinho", "Banco prático", "Profit bank"],
  },
  bankOfMonth: {
    short: "Banco do mês",
    formula: "Saldo do cofrinho atual − saldo no início do mês (= resultados de caixa + rendimentos).",
    legacyAliases: ["Banco do mês", "Meta no banco"],
  },
} as const;

export type FinanceLabelKey = keyof typeof FINANCE_LABELS;

/** Badge curto para dias com competência provisória. */
export const PROVISIONAL_BADGE = "Provisório";

export const PROVISIONAL_HINT =
  "Competência ainda em conciliação (Δ diário × vendas). Valores históricos permanecem visíveis; não entram nos KPIs mensais confirmados.";
