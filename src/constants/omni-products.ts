import {
  BriefcaseBusiness,
  CalendarDays,
  Kanban,
  type LucideIcon,
} from "lucide-react";

export type OmniProductId = "business" | "schedule" | "crm";

export type OmniProductStatus = "available" | "coming_soon";

export interface OmniProduct {
  id: OmniProductId;
  name: string;
  shortName: string;
  description: string;
  highlights: string[];
  href: string;
  cta: string;
  status: OmniProductStatus;
  icon: LucideIcon;
  /** Accent hint for card differentiation (same OMNI DNA). */
  accent: "purple" | "cyan" | "emerald";
}

/**
 * Catálogo de produtos do ecossistema ZAIVON.
 * Expandível — Hub renderiza a partir desta lista.
 * `available` hoje = todos os usuários autenticados (sem planos).
 */
export const OMNI_PRODUCTS: OmniProduct[] = [
  {
    id: "business",
    name: "ZAIVON Business",
    shortName: "Business",
    description: "Gestão, operação e resultados do negócio.",
    highlights: ["Vendas", "Financeiro", "Estoque", "Clientes", "Indicadores"],
    href: "/",
    cta: "Acessar Business",
    status: "available",
    icon: BriefcaseBusiness,
    accent: "purple",
  },
  {
    id: "schedule",
    name: "OMNI Schedule",
    shortName: "Schedule",
    description: "Agenda, clientes, serviços e atendimentos.",
    highlights: ["Agenda", "Clientes", "Serviços", "Equipe"],
    href: "/schedule",
    cta: "Acessar Schedule",
    status: "available",
    icon: CalendarDays,
    accent: "cyan",
  },
  {
    id: "crm",
    name: "OMNI CRM",
    shortName: "CRM",
    description: "Pipeline, leads e conversão de clientes.",
    highlights: ["Pipeline", "Contatos", "Negócios", "Funil"],
    href: "/crm",
    cta: "Acessar CRM",
    status: "available",
    icon: Kanban,
    accent: "emerald",
  },
];

export const OMNI_HUB_PATH = "/hub";

export function listAvailableProducts(
  products: OmniProduct[] = OMNI_PRODUCTS,
): OmniProduct[] {
  return products.filter((p) => p.status === "available");
}
