import type { LucideIcon } from "lucide-react";
import { CalendarDays, Lightbulb, LineChart, SunMedium, Target, Trophy } from "lucide-react";

export const FINANCE_COPY = {
  productName: "ZAIVON Finance",
  productTagline: "Seu dinheiro, em dias",
  holdingName: "ZAIVON",
} as const;

export type FinanceNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

export const FINANCE_NAV: FinanceNavItem[] = [
  { href: "/finance", label: "Hoje", icon: SunMedium, exact: true },
  { href: "/finance/mes", label: "Mês", icon: CalendarDays },
  { href: "/finance/projecoes", label: "Projeções", icon: LineChart },
  { href: "/finance/metas", label: "Metas", icon: Target },
  { href: "/finance/insights", label: "Insights", icon: Lightbulb },
  { href: "/finance/desafios", label: "Desafios", icon: Trophy },
];

export const FINANCE_MOBILE_PRIMARY = [
  FINANCE_NAV[0],
  FINANCE_NAV[1],
  FINANCE_NAV[2],
] as const;

export const FINANCE_PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/finance": { title: "Hoje", subtitle: "Como está o seu dinheiro agora." },
  "/finance/mes": { title: "Mês", subtitle: "O que entrou, o que saiu e o teto de cada categoria." },
  "/finance/projecoes": {
    title: "Projeções",
    subtitle: "O gasto do mês, semana a semana, e o caixa dos próximos 90 dias.",
  },
  "/finance/metas": { title: "Metas", subtitle: "Um número, uma data, um ritmo por semana." },
  "/finance/insights": { title: "Insights", subtitle: "Leituras do seu mês, sem planilha." },
  "/finance/desafios": { title: "Desafios", subtitle: "Pequenos compromissos que seguram o hábito." },
};

export function isFinanceNavActive(pathname: string, item: FinanceNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
