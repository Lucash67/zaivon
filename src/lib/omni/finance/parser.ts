import type { Channel, ProductId } from "@/lib/omni/types";

/** "4.374,55" → 4374.55 ; "96" → 96 */
export function parseMoney(s: string): number {
  const clean = s.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

export type DraftLineKind = "sale" | "settlement" | "ignore";

export interface DraftSaleLine {
  raw: string;
  time: string;
  person: string;
  qty: number;
  product: ProductId;
  channel: Channel;
  amount: number;
  kind: DraftLineKind;
}

export interface DraftPerson {
  person: string;
  amount: number;
  origin?: string | undefined;
  note?: string | undefined;
}

export interface ParsedDraft {
  purchaseUnits: number | null;
  purchaseCost: number | null;
  lines: DraftSaleLine[];
  settlements: DraftPerson[];
  fiados: DraftPerson[];
  losses: number | null;
  ownCost: number | null;
  thirdPartyCost: number | null;
  bonus: number | null;
  cashIn: number | null;
  profit: number | null;
  cofrinho: number | null;
  warnings: string[];
}

const SALE_RE =
  /^(?:\d+\.\s*)?(\d{1,2}:\d{2})\s*[—–-]\s*(.+?)\s*[—–-]\s*(\d+)\s*(salgados?|sandu[ií]ches?(?:\s+naturais?)?.*?)\s*[—–-]\s*R\$\s*([\d.,]+)/i;

const num = (re: RegExp, text: string): number | null => {
  const m = text.match(re);
  return m ? parseMoney(m[1]!) : null;
};

/** Pessoas no formato "Nome (dd/mm): R$5" ou "Nome: R$7 - ..." */
function parsePeople(segment: string): DraftPerson[] {
  const out: DraftPerson[] = [];
  const re = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .']+?)\s*(?:\((\d{2}\/\d{2})\))?\s*:\s*R\$\s*([\d.,]+)([^\n·;]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(segment))) {
    const note = m[4]?.replace(/✅/g, "").replace(/^[\s-]+/, "").trim();
    out.push({ person: m[1]!.trim(), amount: parseMoney(m[3]!), ...(m[2] ? { origin: m[2] } : {}), ...(note ? { note } : {}) });
  }
  return out;
}

function section(text: string, startRe: RegExp, stopRe: RegExp): string {
  const i = text.search(startRe);
  if (i < 0) return "";
  const rest = text.slice(i).replace(startRe, "");
  const j = rest.search(stopRe);
  return j < 0 ? rest : rest.slice(0, j);
}

const STOP = /\n\s*(?:Pegos fiados|Fiados acumulados|Vendidos em esp[eé]cie|Perdas|Custo,|Custo total|Quita[cç][õo]es)/i;

export function parseDraft(text: string): ParsedDraft {
  const warnings: string[] = [];
  const purchase = text.match(/Total Encomendado:\s*(\d+)\s*unidades?\s*>\s*R\$\s*([\d.,]+)/i);
  const lines: DraftSaleLine[] = [];
  const settlementNames = new Set<string>();

  const settlements = parsePeople(section(text, /Quita[cç][õo]es dos fiados:?/i, STOP));
  settlements.forEach((s) => settlementNames.add(s.person.toLowerCase().split(" ")[0]!));
  const fiados = parsePeople(section(text, /Pegos fiados de hoje:?/i, STOP));

  for (const raw of text.split(/\r?\n/)) {
    const m = raw.trim().match(SALE_RE);
    if (!m) continue;
    const [, time, person, qty, prod, amount] = m as unknown as string[];
    const product: ProductId = /sandu/i.test(prod!) ? "sanduiche" : "salgado";
    const channel: Channel = /unifor/i.test(raw) ? "unifor" : /meia\s*sola/i.test(raw) ? "meia_sola" : "acal";
    const first = person!.toLowerCase().split(" ")[0]!;
    lines.push({
      raw: raw.trim(),
      time: time!,
      person: person!.trim(),
      qty: Number(qty),
      product,
      channel,
      amount: parseMoney(amount!),
      // Sugestão: quem aparece nas quitações provavelmente está pagando dia anterior.
      kind: settlementNames.has(first) ? "settlement" : "sale",
    });
  }
  if (!lines.length) warnings.push("Nenhuma linha de venda reconhecida no histórico.");

  const result: ParsedDraft = {
    purchaseUnits: purchase ? Number(purchase[1]) : null,
    purchaseCost: purchase ? parseMoney(purchase[2]!) : null,
    lines,
    settlements,
    fiados,
    losses: num(/Perdas[^:\n]*:\s*(\d+)/i, text),
    ownCost: num(/Meu custo total:\s*R\$\s*([\d.,]+)/i, text),
    thirdPartyCost: num(/Custo de Terceiros:\s*R\$\s*([\d.,]+)/i, text),
    bonus: num(/Bonifica[cç][ãa]o:\s*R\$\s*([\d.,]+)/i, text),
    cashIn: num(/quita[cç][õo]es:\s*R\$\s*([\d.,]+)/i, text),
    profit: num(/Lucro total real:\s*R\$\s*([\d.,]+)/i, text),
    cofrinho: num(/Cofrinho[^:\n]*:\s*R\$\s*([\d.,]+)/i, text),
    warnings,
  };
  if (result.ownCost == null) warnings.push("“Meu custo total” não encontrado — o lucro ficará a revisar.");
  if (result.cofrinho == null) warnings.push("Cofrinho do dia não encontrado.");
  return result;
}

export const SAMPLE_DRAFT = `Total Encomendado: 31 unidades > R$96 de custo
9 mistao frito / 6 coxinhas / 8 queijo frito / 8 frango com catupiry
Unifor: 17 unidades · Vendidos: 17 · Sobrou: 0
Acal: 14 unidades

Histórico de vendas
1. 08:49 — Mikaelly Silva — 1 salgado — R$5
2. 09:15 — João Victor — 1 salgado — R$5
3. 10:02 — Joao Guilherme Da Silva Lima — 2 sanduíches naturais Acal — R$14
4. 10:40 — Lara Souza — 3 salgados — R$15
5. 11:05 — Maria Clara — 1 sanduíche natural Acal — R$7

Quitações dos fiados: João Victor (07/10): R$5 ✅ · Rian Nestor (07/10): R$5 ✅
Pegos fiados de hoje: Maria Mikelly: R$7 - 1 Sanduíche · Ana Laura: R$7 - 1 Sanduíche
Fiados acumulados: Maria Mikelly R$36
Vendidos em espécie: Maria Clara: R$100 > Mandei R$93
Perdas (Salgados): 0 unidades
Custo, Bonificação, Faturamento e Lucro
Custo total dos Salgados: R$96 · Meu custo total: R$64 · Custo de Terceiros: R$60,50 · Bonificação: R$0
Faturamento total entregue do dia + quitações: R$214
Lucro total real: R$150
Cofrinho até aqui na prática: R$4.374,55`;
