/** Datas de calendário em `YYYY-MM-DD`, sem deslocar por fuso na conta. */

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86_400_000);
}

/** `month` é 1–12. Dia 31 em fevereiro vira o último dia do mês. */
export function clampDay(year: number, month: number, day: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const d = Math.min(Math.max(day, 1), last);
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function yearMonth(iso: string): string {
  return iso.slice(0, 7);
}

/** Segunda-feira da semana que contém `iso`. */
export function weekStartMonday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return addDays(iso, delta);
}

export function isMonday(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1;
}

export type MonthWeek = {
  start: string;
  end: string;
};

/** Semanas de segunda a domingo que tocam o mês de `iso`. */
export function monthWeeks(iso: string): MonthWeek[] {
  const start = monthStart(iso);
  const end = monthEnd(iso);
  const weeks: MonthWeek[] = [];
  let cursor = weekStartMonday(start);
  while (cursor <= end) {
    weeks.push({ start: cursor, end: addDays(cursor, 6) });
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function monthEnd(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return clampDay(y, m, 31);
}

export function paydayOnOrAfter(today: string, payday: number): string {
  const [y, m] = today.split("-").map(Number);
  const thisMonth = clampDay(y, m, payday);
  if (thisMonth >= today) return thisMonth;
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  return clampDay(nextYear, nextMonth, payday);
}

export function formatShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function monthLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function todayInTimeZone(timeZone: string, now = new Date()): string {
  const zone = timeZone || "America/Fortaleza";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Fortaleza",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  }
}
