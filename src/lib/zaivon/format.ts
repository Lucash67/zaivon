const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (n: number) => brl.format(n).replace(/\u00a0/g, " ");
export const moneyShort = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
export const pctFmt = (n: number, signed = true) =>
  `${signed && n > 0 ? "+" : ""}${(n * 100).toFixed(1).replace(".", ",")}%`;

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const ddmmyyyy = (iso: string) => `${ddmm(iso)}/${iso.slice(0, 4)}`;
export const weekday = (iso: string) => WD[new Date(iso + "T12:00:00Z").getUTCDay()];
export const dayLabel = (iso: string) => `${weekday(iso)} ${ddmm(iso)}`;

/** "4.374,55" → 4374.55 ; "96" → 96 */
export const parseBrNumber = (s: string) => {
  const t = s.trim();
  const clean = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
};
