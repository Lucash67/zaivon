import type { Debt } from "@/lib/zaivon/types";

export interface DebtConfirmation {
  person: string;
  amount: number;
  receivable: boolean;
}

export interface DeclaredReference {
  id: string;
  person: string;
  declaredAmount: number | null;
  liveOpenAmount: number;
  lossAmount: number;
  nonReceivableAmount: number;
  /** Diferença exibida só quando não parece uma cobrança faltante. */
  unreconciledNote: string;
  source: string;
}

const DECLARATIONS: Array<{
  id: string;
  person: string;
  match: (person: string) => boolean;
  declaredAmount: number | null;
  source: string;
  note: (row: Omit<DeclaredReference, "unreconciledNote" | "source"> & { informedNotSaleAmount: number }) => string;
}> = [
  {
    id: "joao-lucas-nota-2810",
    person: "João Lucas",
    match: (person) => /jo[aã]o lucas/i.test(person),
    declaredAmount: 30,
    source: "Confirmação de 29/10/2026 mais o fiado novo de 30/10/2026",
    note: (row) => {
      const informed = row.informedNotSaleAmount > 0
        ? ` Há R$ ${brMoney(row.informedNotSaleAmount)} informados que não são venda e ficam fora do saldo.`
        : "";
      return `Saldo ativo confirmado: R$ 30,00. A confirmação anterior era R$ 25,00, sendo R$ 20 anteriores e R$ 5 de 29/10, com promessa em 30/10/2026 e sem pagamento. O fiado de 30/10 soma R$ 5,00, sem outro acréscimo de R$ 25,00. O cadastro em aberto soma R$ ${brMoney(row.liveOpenAmount)}.${informed}`;
    },
  },
  {
    id: "henrique-nota-2810",
    person: "Henrique",
    match: (person) => /^henrique\b/i.test(person),
    declaredAmount: 85,
    source: "Nota 03 de 28/10/2026",
    note: (row) =>
      `Cobrança encerrada por decisão do responsável. O histórico consolidado é R$ 85, com R$ 15 recebidos e R$ 70 de inadimplência. Desses R$ 70, R$ 20 já estavam baixados no recebível e R$ 50 são a parte histórica sem recebível, sem venda nova e sem saída de caixa. O saldo em aberto na cobrança é R$ ${brMoney(row.liveOpenAmount)}. A confirmação fora da cobrança permanece separada.`,
  },
  {
    id: "mikelly-nota-2710",
    person: "Mikelly",
    match: (person) => /mikelly/i.test(person),
    declaredAmount: 82,
    source: "WhatsApp de 29/10/2026 mais o fiado novo de 30/10/2026",
    note: (row) => {
      const declared = 82;
      const gap = round2(declared - row.liveOpenAmount);
      const gapText = gap > 0
        ? `Ainda faltam R$ ${brMoney(gap)} para o saldo confirmado.`
        : gap < 0
          ? `O cadastro supera o declarado em R$ ${brMoney(-gap)} e não foi reduzido.`
          : "O cadastro em aberto coincide com o declarado.";
      return `Saldo ativo confirmado: R$ 82,00. A confirmação anterior era R$ 77,00, com promessa em 30/10/2026 e sem pagamento. Esse valor de R$ 77,00 é a cobrança, não um acréscimo sobre ela. O fiado de 30/10 soma R$ 5,00. O cadastro em aberto soma R$ ${brMoney(row.liveOpenAmount)}. ${gapText} Composição provável e não confirmada da base: 11 sanduíches da Acal × R$ 7,00. A perda classificada de R$ ${brMoney(row.lossAmount)} permanece baixada. A diferença histórica de R$ 2 continua sem comprovação.`;
    },
  },
];

function brMoney(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function openAmount(debts: Debt[], match: (person: string) => boolean, status: Debt["status"]): number {
  return round2(
    debts
      .filter((debt) => debt.status === status && !debt.referenceOnly && !debt.reviewOnly && match(debt.person))
      .reduce((sum, debt) => sum + debt.amount - debt.paid, 0),
  );
}

export function collectibleTotal(debts: Debt[]): number {
  return round2(debts.filter((debt) => debt.status === "open" && !debt.referenceOnly && !debt.reviewOnly).reduce((sum, debt) => sum + debt.amount - debt.paid, 0));
}

export function lossTotal(debts: Debt[]): number {
  return round2(debts.filter((debt) => debt.status === "loss").reduce((sum, debt) => sum + debt.amount - debt.paid, 0));
}

export function buildDeclaredReferences(debts: Debt[], confirmations: DebtConfirmation[] = []): DeclaredReference[] {
  return DECLARATIONS.map((declaration) => {
    const liveOpenAmount = openAmount(debts, declaration.match, "open");
    const lossAmount = openAmount(debts, declaration.match, "loss");
    const nonReceivableAmount = round2(
      confirmations
        .filter((item) => !item.receivable && declaration.match(item.person))
        .reduce((sum, item) => sum + item.amount, 0),
    );
    const informedNotSaleAmount = round2(
      debts
        .filter((debt) => debt.referenceOnly && declaration.match(debt.person))
        .reduce((sum, debt) => sum + debt.amount - debt.paid, 0),
    );
    const row = {
      id: declaration.id,
      person: declaration.person,
      declaredAmount: declaration.declaredAmount,
      liveOpenAmount,
      lossAmount,
      nonReceivableAmount,
      informedNotSaleAmount,
    };
    return { ...row, source: declaration.source, unreconciledNote: declaration.note(row) };
  });
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
