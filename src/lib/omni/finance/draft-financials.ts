import { parseMoney } from "./parser";

/** Números do bloco "Custo, Bonificação, Faturamento e Lucro" do rascunho. */
export interface DraftFinancials {
  totalCost: number | null;
  ownCost: number | null;
  thirdPartyCost: number | null;
  bonus: number | null;
  /** Faturamento real do dia + quitações (tudo que entrou no caixa). */
  cashIn: number | null;
  /** Faturamento real só das vendas do dia. */
  dayOnly: number | null;
  profit: number | null;
  cofrinho: number | null;
  losses: number | null;
}

const MONEY = String.raw`R\$\s*([\d.]+(?:,\d{1,2})?)`;

function pick(text: string, ...patterns: string[]): number | null {
  for (const p of patterns) {
    const m = text.match(new RegExp(p + String.raw`[^:\n]*:\s*` + MONEY, "i"));
    if (m) return parseMoney(m[1]!);
  }
  return null;
}

/** Soma as unidades listadas logo abaixo de "Perdas:" (ou "Perdas: 2 unidades" na mesma linha). */
function parseLosses(text: string): number | null {
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => /^\s*perdas\b/i.test(l));
  if (i < 0) return null;
  const inline = lines[i]!.match(/:\s*(\d+)/);
  if (inline) return Number(inline[1]);
  let total = 0;
  for (const raw of lines.slice(i + 1)) {
    const l = raw.trim();
    if (!l.startsWith("-")) break;
    const n = l.match(/^-\s*(\d+)/);
    if (n) total += Number(n[1]);
  }
  return total;
}

export function parseDraftFinancials(text: string): DraftFinancials {
  return {
    totalCost: pick(text, String.raw`Custo total dos salgados`),
    ownCost: pick(text, String.raw`Meu custo total`),
    thirdPartyCost: pick(text, String.raw`Custo de terceiros`),
    bonus: pick(text, String.raw`Bonifica[cç][ãa]o(?!,)`),
    cashIn: pick(text, String.raw`Faturamento total (?:real|entregue)[^:\n]*quita`),
    dayOnly: pick(text, String.raw`Faturamento total real do dia`),
    profit: pick(text, String.raw`Lucro total real`),
    cofrinho: pick(text, String.raw`Cofrinho[^:\n]*pr[áa]tica`, String.raw`Cofrinho(?![^:\n]*teoria)`),
    losses: parseLosses(text),
  };
}
