import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function toDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return parseISO(input);
  return new Date(input);
}

/**
 * Modelo único do rascunho diário (operação Salgados).
 * A data não entra no texto: vem da coluna / noteDate.
 */
export function buildWeekdayDraftTemplate(_input: string | Date = new Date()): string {
  return `Encomendados hoje:

-  Mistão frito
-  Carne forno
-  Croissant
-  Mistão forno
-  Pão de Queijo

Total: unidades (R$)

Separados para o trabalho do Henrique

-  Mistão frito
-  Mistão forno
-  Carne forno
- Croissant

Total: unidades
Total vendidos: Todos (R$)

Separados para a Unifor & Acal:

-  Mistão frito
-  Carne forno
-  Croissant
-  Mistão forno
-  Pão de Queijo

Total: 17 unidades

—— Preencher no fim do dia ——

Lista de vendas na Unifor & Acal:

1 - 
2 - 
3 - 
4 - 
...

Total: … salgados | R$…

Pendências para quitar em aberto:
- Nome da pessoa (data em que pegou fiado): 

Perdas:
- 

Pegos fiados:
- 

Vendidos em espécie:
- 

OBS:

- 

Custo, Bonificação, Faturamento e Lucro

Custo total dos salgados: R$
Meu custo total: R$
Custo de Terceiros: R$
Bonificação: R$

Faturamento total esperado: R$110 | ... total esperado + quitações: R$
Faturamento total real (do dia + quitação): R$
Faturamento total real do dia (somente desse dia): R$

Lucro total esperado: R$
Lucro total real: R$

Cofrinho dos lucros:
- Cofrinho até aqui na teoria: R$ (IA calcula)
- Cofrinho até aqui na prática: R$ (com rendimento — conferir extrato)
`;
}

/** Título dos blocos diários. A data não vai no título — fica na coluna. */
export function officialDraftNoteTitle(_date: string | Date): string {
  return "Salgados";
}

/**
 * A partir desta data o quadro nasce vazio.
 * O carregamento das notas não volta a criar o rascunho automático.
 */
export const SEEDED_NOTE_CUTOFF = "2026-10-27";

/** Rascunho vazio ou modelo oficial colocado sozinho numa data futura. */
export function isSeededFutureNote(note: {
  title?: string | null;
  body?: string | null;
  noteDate?: string | null;
}): boolean {
  if (!note.noteDate || note.noteDate < SEEDED_NOTE_CUTOFF) return false;
  const title = (note.title ?? "").trim();
  const body = (note.body ?? "").replace(/\r\n/g, "\n").trim();
  const blankTitle = title === "" || title === officialDraftNoteTitle(note.noteDate);
  if (body.length === 0 && blankTitle) return true;
  const template = buildWeekdayDraftTemplate().replace(/\r\n/g, "\n").trim();
  return blankTitle && body === template;
}

/** Detecta se a nota já é o rascunho oficial daquele dia (idempotência). */
export function isOfficialDraftNote(
  note: { title?: string | null; noteDate?: string | null },
  date: string,
): boolean {
  if (note.noteDate !== date) return false;
  const title = (note.title ?? "").toLowerCase();
  return title.includes("rascunho oficial") || title.startsWith("rascunho ");
}

/** Datas da semana cuja segunda-feira é `weekStart` (seg–dom). */
export function operationalWeekDates(weekStart: string): string[] {
  const start = parseISO(weekStart);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(format(d, "yyyy-MM-dd"));
  }
  return dates;
}

/** Todos os dias de um ano civil. A data fica na coluna, não no texto. */
export function operationalDatesOfYear(year: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  while (cursor <= end) {
    dates.push(format(cursor, "yyyy-MM-dd"));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/** Remove a data digitada no topo do bloco. A data oficial é a da coluna. */
export function stripLeadingDraftDate(body: string): string {
  const lines = body.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i += 1;
  if (i >= lines.length) return body;
  if (!/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(lines[i].trim())) return body;
  lines.splice(i, 1);
  if (lines[i] === "") lines.splice(i, 1);
  return lines.join("\n");
}

export function weekdayShortLabel(date: string | Date): string {
  const d = toDate(date);
  const raw = format(d, "EEEE", { locale: ptBR }).replace("-feira", "");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
