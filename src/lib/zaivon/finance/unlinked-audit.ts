/** Datas cuja exposição sem vínculo foi conferida item a item. Não grava nada no banco. */
export const AUDITED_UNLINKED_DATES = new Set(["2026-10-30"]);

export type UnlinkedAuditMark = "conferido" | "sujeito-a-auditoria";

export function unlinkedAuditMark(date: string): UnlinkedAuditMark {
  return AUDITED_UNLINKED_DATES.has(date) ? "conferido" : "sujeito-a-auditoria";
}

export interface UnlinkedAuditInput {
  date: string;
  quantity: number;
  commercialValue: number | null;
  status: string;
}

export interface UnlinkedAuditSummary {
  investigationCommercial: number;
  auditedUnits: number;
  auditedCommercial: number;
  pendingAuditUnits: number;
  pendingAuditCommercial: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Separa o total histórico aberto. Ocorrência fechada não entra em nenhum dos dois lados. */
export function summarizeUnlinkedAudit(occurrences: UnlinkedAuditInput[]): UnlinkedAuditSummary {
  const open = occurrences.filter((row) => row.status === "open");
  const audited = open.filter((row) => unlinkedAuditMark(row.date) === "conferido");
  const pending = open.filter((row) => unlinkedAuditMark(row.date) === "sujeito-a-auditoria");
  const units = (rows: UnlinkedAuditInput[]) => rows.reduce((sum, row) => sum + row.quantity, 0);
  const commercial = (rows: UnlinkedAuditInput[]) =>
    round2(rows.reduce((sum, row) => sum + (row.commercialValue ?? 0), 0));
  const auditedCommercial = commercial(audited);
  const pendingAuditCommercial = commercial(pending);
  return {
    investigationCommercial: round2(auditedCommercial + pendingAuditCommercial),
    auditedUnits: units(audited),
    auditedCommercial,
    pendingAuditUnits: units(pending),
    pendingAuditCommercial,
  };
}
