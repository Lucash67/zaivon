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
    declaredAmount: 20,
    source: "Nota 03 de 28/10/2026",
    note: (row) => {
      const informed = row.informedNotSaleAmount > 0
        ? ` Compromissos informados que não são venda: R$ ${row.informedNotSaleAmount.toFixed(2).replace(".", ",")}.`
        : "";
      return `O cadastro em aberto soma R$ ${row.liveOpenAmount.toFixed(2).replace(".", ",")}. A referência informada é R$ 20.${informed} A diferença não é cobrança nova.`;
    },
  },
  {
    id: "henrique-nota-2810",
    person: "Henrique",
    match: (person) => /^henrique\b/i.test(person),
    declaredAmount: 85,
    source: "Nota 03 de 28/10/2026",
    note: () =>
      "Compromisso declarado de R$ 85, ainda sem composição integral. A venda aberta e a confirmação fora da cobrança não são somadas a esse valor. O Pix pessoal de R$ 140 em 28/10 não quita o compromisso.",
  },
  {
    id: "mikelly-nota-2710",
    person: "Mikelly/Michele",
    match: (person) => /mikelly|michele/i.test(person),
    declaredAmount: null,
    source: "Pendência de R$ 2 em 27/10 e baixa de 14/10",
    note: (row) =>
      `Cobrável em aberto: R$ ${row.liveOpenAmount.toFixed(2).replace(".", ",")}. A perda de crédito de R$ ${row.lossAmount.toFixed(2).replace(".", ",")} permanece classificada e fora dessa soma. A diferença histórica de R$ 2 continua sem comprovação.`,
  },
];

function openAmount(debts: Debt[], match: (person: string) => boolean, status: Debt["status"]): number {
  return round2(
    debts
      .filter((debt) => debt.status === status && !debt.referenceOnly && match(debt.person))
      .reduce((sum, debt) => sum + debt.amount - debt.paid, 0),
  );
}

export function collectibleTotal(debts: Debt[]): number {
  return round2(debts.filter((debt) => debt.status === "open" && !debt.referenceOnly).reduce((sum, debt) => sum + debt.amount - debt.paid, 0));
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
