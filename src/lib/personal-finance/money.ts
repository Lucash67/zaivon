/** Aceita 1500,50 / 1.500,50 / 1500.50. */
export function parseMoney(input: string, options?: { allowNegative?: boolean }): number | null {
  const trimmed = input.trim().replace(/\s/g, "");
  if (!trimmed) return null;
  const negative = trimmed.startsWith("-");
  if (negative && !options?.allowNegative) return null;
  const raw = negative ? trimmed.slice(1) : trimmed;
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const signed = negative ? -value : value;
  return Math.round(signed * 100) / 100;
}
