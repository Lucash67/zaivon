import { BRIGADEIROS_BUSINESS_ID, SALGADOS_BUSINESS_ID } from "@/lib/business-units";

/**
 * Assets de marca ZAIVON Vertex. PNG transparente oficial (arte de referência);
 * trocar pelo SVG vetorial quando o arquivo definitivo existir.
 */
export const HUB_BRAND_ASSETS = {
  favicon: "/brand/zaivon-icon-64.png",
  favicon32: "/brand/zaivon-icon-32.png",
  appleTouch: "/brand/zaivon-icon-180.png",
  monogram: "/brand/zaivon-monogram.png",
  /** Monograma + "ZAIVON" em branco — somente sobre fundo escuro. */
  wordmarkOnDark: "/brand/zaivon-wordmark.png",
  /** Só o lettering "ZAIVON" (recortado do wordmark oficial). */
  wordtypeLight: "/brand/zaivon-wordtype-light.png",
  wordtypeDark: "/brand/zaivon-wordtype-dark.png",
} as const;

/**
 * Paleta ZAIVON Obsidian Lime (hex) para lugares que não aceitam variável CSS
 * (atributos SVG, gráficos). Em CSS/classes use os tokens --z-* / z-*.
 * `yellow` / `purple` / `secondary` / `cyan` são nomes legados = papéis da marca antiga.
 */
export const HUB_COLORS = {
  black: "#05070B",
  /** Cor principal (Lime 500) — alias legado `yellow`. */
  yellow: "#B7FF3C",
  secondary: "#2ED3A7",
  purple: "#B7FF3C",
  blue: "#3DA5FF",
  cyan: "#2ED3A7",
  mintLight: "#DCFF98",
  white: "#F7F9FC",
  surface: "#10141B",
  gray: {
    400: "#C8D0DB",
    500: "#93A0B1",
    600: "#6F7B8C",
    700: "#202734",
    800: "#151A22",
    900: "#0A0D12",
  },
} as const;

export type HubEnterpriseStatus = "active" | "coming_soon";

/** Workspaces exibidos na landing — mapeiam para business_id existentes. */
export interface HubEnterprise {
  id: string;
  index: string;
  name: string;
  description: string;
  status: HubEnterpriseStatus;
}

export const HUB_ENTERPRISES: HubEnterprise[] = [
  {
    id: SALGADOS_BUSINESS_ID,
    index: "01",
    name: "Salgados",
    description: "Operação de salgados",
    status: "active",
  },
  {
    id: BRIGADEIROS_BUSINESS_ID,
    index: "02",
    name: "Brigadeiros",
    description: "Doces e confeitaria",
    status: "active",
  },
];

export const HUB_VALUE_PROPS = [
  {
    title: "Conexão",
    description: "Tudo centralizado — operação e decisões no mesmo lugar.",
  },
  {
    title: "Organização",
    description: "Registros e indicadores claros, no ritmo do dia a dia.",
  },
  {
    title: "Inteligência",
    description: "Dados que ajudam a decidir com segurança.",
  },
  {
    title: "Evolução",
    description: "Uma marca expansível: Business hoje, novas soluções depois.",
  },
] as const;

/**
 * Arquitetura de marca (oficial):
 *
 *   ZAIVON            = marca-mãe / ecossistema / plataforma
 *   ZAIVON Business   = produto de gestão (este app em produção)
 *   Schedule / CRM    = produtos independentes, ainda não migrados para a marca ZAIVON
 *
 * Telas globais (login, auth, conta) priorizam a marca ZAIVON.
 * O chrome interno do app identifica o produto ZAIVON Business.
 * Identificadores técnicos (rotas, cookies, chaves "omni") não mudam.
 */
export const HUB_COPY = {
  holdingName: "ZAIVON",
  holdingTagline: "Intelligence moves forward.",
  productName: "ZAIVON Business",
  productTagline: "Gestão da operação",
  brandName: "ZAIVON",
  heroTitle: "Conecte. Organize.",
  heroHighlight: "Evolua.",
  heroTagline: "ZAIVON · Ecossistema",
  heroDescription:
    "A ZAIVON é a plataforma. ZAIVON Business cuida da gestão da operação — e o ecossistema cresce com novas soluções.",
  enterprisesHeading: "Operações ativas",
  footerSlogan: "Uma marca. Várias soluções. Seu negócio no centro.",
  footerLegacy: "Inteligência, controle e evolução para o seu negócio.",
  authWelcome: "Bem-vindo de volta",
  authSubtitle: "Entre na ZAIVON — seu ecossistema de produtos.",
} as const;
