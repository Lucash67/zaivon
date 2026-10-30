/** Contagem exigida na entrada quando já existe saldo. Não altera o saldo para o valor contado. */

export function applyStockQuantity(current: number, type: string, quantity: number): number {
  if (type === "entry") return current + quantity;
  if (type === "exit") return Math.max(0, current - quantity);
  return quantity;
}

export function informedPhysicalFromText(summary: string): number | null {
  if (/f[ií]sico informado:\s*zero\b/i.test(summary)) return 0;
  const match = summary.match(/f[ií]sico informado:\s*(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

export function entryReasonWithCount(input: {
  currentStock: number;
  type: string;
  reason: string | null;
  physicalCount: unknown;
}): { ok: true; reason: string | null } | { ok: false; message: string } {
  if (input.type !== "entry" || input.currentStock <= 0) return { ok: true, reason: input.reason };
  if (input.physicalCount === undefined || input.physicalCount === null || input.physicalCount === "") {
    return { ok: false, message: "Informe a contagem física antes de dar entrada sobre um saldo existente." };
  }
  const count = Number(input.physicalCount);
  if (!Number.isInteger(count) || count < 0) {
    return { ok: false, message: "A contagem física precisa ser um número inteiro a partir de zero." };
  }
  const prefix = `CONTAGEM-FISICA:${count}`;
  const base = (input.reason ?? "").trim();
  return { ok: true, reason: base ? `${prefix}. ${base}` : prefix };
}
