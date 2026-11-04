/** Saldo informado lido dos metadados. Não cria movimento. */

export interface InformedMovement {
  date: string;
  bookAfter: number;
  informed: number | null;
}

export interface GapPart {
  date: string;
  amount: number;
  origin: "nao-identificada";
}

export function readInformedBalance(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const row = metadata as Record<string, unknown>;
  const value = row.informedBalance ?? row.informedBankBalance;
  return typeof value === "number" && Number.isFinite(value) ? roundMoney(value) : null;
}

export function readBookBalance(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>).bookBalance;
  return typeof value === "number" && Number.isFinite(value) ? roundMoney(value) : null;
}

/**
 * Ordem de leitura. No mesmo dia, o saldo contábil gravado no metadado
 * prevalece sobre a ordem de gravação. Não reordena o que está no banco.
 */
export function orderVaultRowsForPresentation<T extends { date: string; metadata: unknown }>(rows: readonly T[]): T[] {
  return rows
    .map((row, sequence) => ({ row, sequence }))
    .sort((a, b) => {
      const byDate = a.row.date.localeCompare(b.row.date);
      if (byDate !== 0) return byDate;
      const bookA = readBookBalance(a.row.metadata);
      const bookB = readBookBalance(b.row.metadata);
      if (bookA != null && bookB != null && Math.abs(bookA - bookB) >= 0.01) return bookA - bookB;
      return a.sequence - b.sequence;
    })
    .map((item) => item.row);
}

export function readResponsiblePayment(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>).paymentInformed;
  return typeof value === "number" && Number.isFinite(value) ? roundMoney(value) : null;
}

export function informedGapParts(rows: InformedMovement[]): GapPart[] {
  const parts: GapPart[] = [];
  let previousGap = 0;
  for (const row of rows) {
    if (row.informed == null) continue;
    const gap = roundMoney(row.informed - row.bookAfter);
    const incremental = roundMoney(gap - previousGap);
    if (Math.abs(incremental) >= 0.01) {
      parts.push({ date: row.date, amount: incremental, origin: "nao-identificada" });
    }
    previousGap = gap;
  }
  return parts;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
