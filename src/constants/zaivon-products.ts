import {
  BriefcaseBusiness,
  CalendarDays,
  Kanban,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type ZaivonProductId = "business" | "schedule" | "crm" | "finance";

export type ZaivonProductStatus = "available" | "coming_soon";

export interface ZaivonProduct {
  id: ZaivonProductId;
  name: string;
  shortName: string;
  description: string;
  highlights: string[];
  href: string;
  cta: string;
  status: ZaivonProductStatus;
  icon: LucideIcon;
  /** Accent hint for card differentiation (same ZAIVON DNA). */
  accent: "purple" | "cyan" | "emerald" | "amber";
}

/**
 * Catálogo de produtos do ecossistema ZAIVON.
 * Expandível — Hub renderiza a partir desta lista.
 * `available` hoje = todos os usuários autenticados (sem planos).
 */
export const ZAIVON_PRODUCTS: ZaivonProduct[] = [
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
    name: "ZAIVON Schedule",
    shortName: "Schedule",
    description: "Agenda, clientes, serviços e atendimentos.",
    highlights: ["Agenda", "Clientes", "Serviços", "Equipe"],
    href: "/schedule",
    cta: "Acessar Schedule",
    status: "coming_soon",
    icon: CalendarDays,
    accent: "cyan",
  },
  {
    id: "crm",
    name: "ZAIVON CRM",
    shortName: "CRM",
    description: "Pipeline, leads e conversão de clientes.",
    highlights: ["Pipeline", "Contatos", "Negócios", "Funil"],
    href: "/crm",
    cta: "Acessar CRM",
    status: "coming_soon",
    icon: Kanban,
    accent: "emerald",
  },
  {
    id: "finance",
    name: "ZAIVON Finance",
    shortName: "Finance",
    description: "Controle pessoal, previsão de caixa, metas e desafios.",
    highlights: ["Caixa", "Projeções", "Metas", "Desafios"],
    href: "/finance",
    cta: "Acessar Finance",
    status: "available",
    icon: Wallet,
    accent: "amber",
  },
];

export const ZAIVON_HUB_PATH = "/hub";

/** Aviso único enquanto Schedule e CRM ficam fora do ar. */
export const ZAIVON_IN_DEVELOPMENT_NOTICE =
  "Em desenvolvimento. Logo mais entra no ar.";

export function listAvailableProducts(
  products: ZaivonProduct[] = ZAIVON_PRODUCTS,
): ZaivonProduct[] {
  return products.filter((p) => p.status === "available");
}
