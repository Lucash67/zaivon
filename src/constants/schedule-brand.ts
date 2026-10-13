import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CalendarPlus,
  Clock,
  Home,
  Scissors,
  Settings,
  UserRound,
  Users,
} from "lucide-react";

/** Copy / nav do produto ZAIVON Schedule (família ZAIVON, produto distinto do Business). */
export const SCHEDULE_COPY = {
  productName: "ZAIVON Schedule",
  productTagline: "Agenda e atendimento",
  holdingName: "ZAIVON",
  homeHint: "O que está acontecendo hoje?",
} as const;

export type ScheduleNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

export const SCHEDULE_NAV: ScheduleNavItem[] = [
  { href: "/schedule", label: "Home", icon: Home, exact: true },
  { href: "/schedule/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/schedule/agenda/novo", label: "Novo Agendamento", icon: CalendarPlus },
  { href: "/schedule/clientes", label: "Clientes", icon: Users },
  { href: "/schedule/servicos", label: "Serviços", icon: Scissors },
  { href: "/schedule/equipe", label: "Equipe", icon: UserRound },
  { href: "/schedule/disponibilidade", label: "Disponibilidade", icon: Clock },
  { href: "/schedule/configuracoes", label: "Configurações", icon: Settings },
];

export const SCHEDULE_MOBILE_PRIMARY: ScheduleNavItem[] = [
  { href: "/schedule", label: "Home", icon: Home, exact: true },
  { href: "/schedule/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/schedule/clientes", label: "Clientes", icon: Users },
];

export const SCHEDULE_MOBILE_MORE = SCHEDULE_NAV.filter(
  (item) =>
    item.href !== "/schedule" &&
    item.href !== "/schedule/agenda" &&
    item.href !== "/schedule/agenda/novo" &&
    item.href !== "/schedule/clientes",
);

export const SCHEDULE_PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  "/schedule": { title: "Home", subtitle: "Central operacional do dia." },
  "/schedule/agenda": {
    title: "Agenda",
    subtitle: "Visualize e gerencie os agendamentos.",
  },
  "/schedule/agenda/novo": {
    title: "Novo agendamento",
    subtitle: "Preencha os detalhes para criar um novo agendamento.",
  },
  "/schedule/clientes": { title: "Clientes", subtitle: "Clientes da organização." },
  "/schedule/servicos": { title: "Serviços", subtitle: "Catálogo de serviços." },
  "/schedule/equipe": { title: "Equipe", subtitle: "Profissionais do estabelecimento." },
  "/schedule/disponibilidade": {
    title: "Disponibilidade",
    subtitle: "Horários, exceções e bloqueios.",
  },
  "/schedule/configuracoes": {
    title: "Configurações",
    subtitle: "Estabelecimento, vertical e fuso.",
  },
};

export function isScheduleNavActive(pathname: string, item: ScheduleNavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (item.href === "/schedule/agenda") {
    return (
      pathname === "/schedule/agenda" ||
      (pathname.startsWith("/schedule/agenda/") && !pathname.startsWith("/schedule/agenda/novo"))
    );
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function schedulePageMeta(pathname: string) {
  if (SCHEDULE_PAGE_META[pathname]) return SCHEDULE_PAGE_META[pathname];
  const match = Object.keys(SCHEDULE_PAGE_META)
    .filter((key) => key !== "/schedule" && pathname.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return match ? SCHEDULE_PAGE_META[match] : { title: SCHEDULE_COPY.productName };
}
