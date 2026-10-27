import { Info as InfoIcon, CheckCircle2, AlertTriangle, CircleDashed } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Check } from "@/lib/zaivon/finance/day";
import type { RegisteredSale } from "@/lib/zaivon/types";
import { formatSaleShift } from "@/lib/sale-shift";
import { useScreenHideMoney } from "@/components/zaivon-v2/hide-money";

export type Tone = "ok" | "pending" | "info" | "alert" | "third" | "neutral";

export const toneText: Record<Tone, string> = {
  ok: "text-o-ok",
  pending: "text-o-pending",
  info: "text-o-info",
  alert: "text-o-alert",
  third: "text-o-third",
  neutral: "text-o-foreground",
};
export const toneBg: Record<Tone, string> = {
  ok: "bg-o-ok/12 text-o-ok",
  pending: "bg-o-pending/12 text-o-pending",
  info: "bg-o-info/12 text-o-info",
  alert: "bg-o-alert/12 text-o-alert",
  third: "bg-o-third/12 text-o-third",
  neutral: "bg-o-muted text-o-muted-foreground",
};

export function Info({ formula }: { formula: string }) {
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-label={`Fórmula: ${formula}`} className="inline-flex text-o-muted-foreground hover:text-o-foreground">
        <InfoIcon className="size-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-max max-w-xs -translate-x-1/2 rounded-lg bg-o-popover px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-o-foreground opacity-0 shadow-xl ring-1 ring-black/20 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {formula}
      </span>
    </span>
  );
}

export function Panel({ title, action, children, className, subtitle }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border bg-o-card p-4 md:p-5", className)}>
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-o-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, explain, formula, tone = "neutral", big }: { label: string; value: string; explain?: string | undefined; formula?: string | undefined; tone?: Tone; big?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-2xl border bg-o-card p-4", big && "md:p-6")}>
      <div className="flex items-center gap-1.5">
        <span className="eyebrow">{label}</span>
        {formula && <Info formula={formula} />}
      </div>
      <div className={cn("num mt-1 font-display font-semibold", big ? "text-4xl md:text-5xl" : "text-2xl", toneText[tone])}>{value}</div>
      {explain && <p className="num mt-1 text-xs text-o-muted-foreground">{explain}</p>}
    </div>
  );
}

export function PageHeader({ title, question, right }: { title: string; question: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-o-muted-foreground">{question}</p>
      </div>
      {right}
    </div>
  );
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", toneBg[tone])}>{children}</span>;
}

export function CheckRow({ c }: { c: Check }) {
  const Icon = c.ok == null ? CircleDashed : c.ok ? CheckCircle2 : AlertTriangle;
  const tone = c.ok == null ? "text-o-muted-foreground" : c.ok ? "text-o-ok" : "text-o-alert";
  const statusLabel = c.ok == null ? "parcial / pendente" : c.ok ? "OK" : "não bateu";
  return (
    <div className="flex gap-3 rounded-xl bg-o-surface p-3">
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone)} aria-hidden />
      <div className="min-w-0">
        <div className="text-sm font-semibold">
          {c.label} <span className={cn("ml-1 text-xs", tone)}>{statusLabel}</span>
        </div>
        <p className="num text-xs text-o-muted-foreground">{c.detail}</p>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed p-6 text-center text-sm text-o-muted-foreground">{children}</div>;
}

export function Progress({ value, tone = "info" }: { value: number; tone?: Tone }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-o-muted" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full", { ok: "bg-o-ok", pending: "bg-o-pending", info: "bg-o-info", alert: "bg-o-alert", third: "bg-o-third", neutral: "bg-o-foreground" }[tone])} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

const SALE_STATUS: Record<RegisteredSale["status"], [string, Tone]> = {
  paid: ["pago", "ok"],
  pending: ["pendente", "pending"],
  partial: ["parcial", "pending"],
};

export function RegisteredSalesList({
  sales,
  dayClosing,
}: {
  sales?: RegisteredSale[] | undefined;
  dayClosing?: import("@/lib/finance/day-closing").DayClosingFinance | null | undefined;
}) {
  const { money } = useScreenHideMoney();
  if (!sales?.length) return <p className="text-xs text-o-muted-foreground">Nenhuma venda gravada individualmente neste dia.</p>;
  const units = sales.reduce((s, x) => s + (x.receiptWithoutComposition ? 0 : x.qty), 0);
  const receipts = sales.filter((s) => s.receiptWithoutComposition).length;
  const total = sales.reduce((s, x) => s + x.amount, 0);
  const paid = sales.filter((s) => s.status === "paid").reduce((s, x) => s + x.amount, 0);
  const pending = sales.filter((s) => s.status !== "paid").reduce((s, x) => s + x.amount, 0);
  const competence = dayClosing?.competenceRevenue;
  const salesReceived = dayClosing?.cash.salesReceived;
  return (
    <div>
      <p className="num mb-1 text-xs text-o-muted-foreground">
        {sales.length} registros · {units} un{receipts > 0 ? " com produto" : ""} · cadastrado {money(total)}
        {receipts > 0 ? ` · ${receipts} recebimentos sem composição, fora da contagem de unidades` : ""}
        {` · pagos ${money(paid)} · pendentes/perda ${money(pending)}`}
      </p>
      {(salesReceived != null || competence != null) && (
        <p className="mb-2 text-xs text-o-muted-foreground">
          Leitura canônica:{" "}
          {salesReceived != null && <>vendas no caixa {money(salesReceived)}</>}
          {salesReceived != null && competence != null && " · "}
          {competence != null && <>competência provisória {money(competence)}</>}
          {`. O total cadastrado (${money(total)}) inclui fiados e perdas — não é entrada no caixa.`}
        </p>
      )}
      <ul className="grid max-h-80 gap-1.5 overflow-y-auto">
        {sales.map((s) => {
          const [label, tone] = SALE_STATUS[s.status];
          return (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-o-surface px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="text-xs text-o-muted-foreground">
                  {s.timeConfidence === "nao-informado"
                    ? "horário não informado"
                    : s.timeConfidence === "comprovado"
                      ? s.time
                      : s.timeConfidence === "estimado"
                        ? `${s.time} estimado`
                        : formatSaleShift(s.time)}
                </span>{" "}
                · {s.person} · {s.description}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="num">{money(s.amount)}</span>
                <Pill tone={tone}>{label}</Pill>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const chartAxis = { stroke: "var(--color-muted-foreground)", fontSize: 12 };
export const chartTooltip = {
  contentStyle: { background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12, color: "var(--color-foreground)" },
};
