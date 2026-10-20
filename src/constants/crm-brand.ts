/** Copy / nav do produto OMNI CRM (família OMNI, isolado do Business). */
export const CRM_COPY = {
  productName: "OMNI CRM",
  productTagline: "Pipeline e conversão de clientes",
  holdingName: "OMNI",
  homeHint: "Como está o seu funil hoje?",
} as const;

export const CRM_NAV = [
  { href: "/crm", label: "Início", exact: true as const },
  { href: "/crm/norte", label: "Norte", exact: false as const },
  { href: "/crm/mensagens", label: "Mensagens", exact: false as const },
  { href: "/crm/pipeline", label: "Pipeline", exact: false as const },
  { href: "/crm/contatos", label: "Contatos", exact: false as const },
  { href: "/crm/configuracoes", label: "Configurações", exact: false as const },
] as const;

/** Estágios padrão — freela sites / fluxos / softwares. */
export const CRM_DEFAULT_STAGES = [
  { slug: "lead", label: "A converter", sortOrder: 10, isWon: false, isLost: false },
  { slug: "qualified", label: "Qualificação", sortOrder: 20, isWon: false, isLost: false },
  { slug: "negotiation", label: "Negociação", sortOrder: 30, isWon: false, isLost: false },
  { slug: "won", label: "Fechado", sortOrder: 40, isWon: true, isLost: false },
  { slug: "lost", label: "Perdido", sortOrder: 50, isWon: false, isLost: true },
] as const;

/** Dica curta no kanban — onde colocar cada lead. */
export const CRM_STAGE_HINTS: Record<(typeof CRM_DEFAULT_STAGES)[number]["slug"], string> = {
  lead: "Ainda não abordei — falta o 1º contato.",
  qualified: "Respondeu; estou validando fit (orçamento, prazo, escopo).",
  negotiation: "Proposta ou termos em aberto; esperando retorno.",
  won: "Fechou. Cliente ou parceria convertida.",
  lost: "Não vai acontecer (agora).",
};

export const CRM_TEMPERATURES = [
  "alert",
  "hot",
  "warm",
  "cold",
  "neutral",
  "won",
  "lost",
] as const;

export type CrmTemperature = (typeof CRM_TEMPERATURES)[number];

export const CRM_TEMPERATURE_META: Record<
  CrmTemperature,
  { label: string; hint: string; card: string; badge: string; bar: string }
> = {
  alert: {
    label: "Alerta",
    hint: "Cobrar agora — ticket ou follow-up em risco.",
    card: "border-amber-400/80 bg-amber-500/15 shadow-[0_0_18px_rgba(245,158,11,0.18)]",
    badge: "bg-amber-400 text-black",
    bar: "bg-amber-400",
  },
  hot: {
    label: "Quente",
    hint: "Em movimento, boa chance de fechar.",
    card: "border-orange-400/70 bg-orange-500/15",
    badge: "bg-orange-500 text-white",
    bar: "bg-orange-500",
  },
  warm: {
    label: "Morno",
    hint: "Aguardando — sem urgência extrema.",
    card: "border-yellow-400/45 bg-yellow-500/10",
    badge: "bg-yellow-400 text-black",
    bar: "bg-yellow-400",
  },
  cold: {
    label: "Frio",
    hint: "Ainda não abordei ou esfriou.",
    card: "border-sky-500/35 bg-sky-950/50",
    badge: "bg-sky-800 text-sky-100",
    bar: "bg-sky-400",
  },
  neutral: {
    label: "Neutro",
    hint: "Sem temperatura definida.",
    card: "border-white/15 bg-[#1a1c24]",
    badge: "bg-white/10 text-[#A0A0A0]",
    bar: "bg-white/35",
  },
  won: {
    label: "Fechado",
    hint: "Convertido.",
    card: "border-emerald-400/55 bg-emerald-500/12",
    badge: "bg-emerald-500 text-white",
    bar: "bg-emerald-400",
  },
  lost: {
    label: "Perdido",
    hint: "Não vai rolar (agora).",
    card: "border-red-900/50 bg-zinc-950/70",
    badge: "bg-zinc-700 text-zinc-200",
    bar: "bg-red-800",
  },
};

export const CRM_STAGE_COLUMN_UI: Record<string, string> = {
  lead: "border-sky-500/30 bg-sky-950/25",
  qualified: "border-yellow-500/30 bg-yellow-950/20",
  negotiation: "border-orange-500/35 bg-orange-950/25",
  won: "border-emerald-500/35 bg-emerald-950/20",
  lost: "border-zinc-600/40 bg-zinc-950/50",
};

export const CRM_STAGE_HEADER_UI: Record<string, string> = {
  lead: "text-sky-200",
  qualified: "text-yellow-200",
  negotiation: "text-orange-200",
  won: "text-emerald-200",
  lost: "text-zinc-300",
};

export const CRM_MESSAGE_KINDS = [
  { slug: "pitch_inicial", label: "Pitch inicial" },
  { slug: "follow_up", label: "Follow-up" },
  { slug: "qualificacao", label: "Qualificação" },
  { slug: "carinho", label: "Carinho / cliente" },
  { slug: "outro", label: "Outro" },
] as const;

export type CrmMessageKind = (typeof CRM_MESSAGE_KINDS)[number]["slug"];
export const CRM_MESSAGE_KIND_SLUGS = CRM_MESSAGE_KINDS.map((k) => k.slug) as [
  CrmMessageKind,
  ...CrmMessageKind[],
];

export const CRM_MESSAGE_STATUSES = ["scheduled", "draft", "sent", "cancelled"] as const;
export type CrmMessageStatus = (typeof CRM_MESSAGE_STATUSES)[number];
