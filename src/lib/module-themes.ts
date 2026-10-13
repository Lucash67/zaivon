/** Cores de contexto por módulo — DNA visual ZAIVON. */
export type ModuleTheme = "dashboard" | "finance" | "goals" | "alerts" | "operations" | "clients" | "reports" | "performance";

export const MODULE_THEMES: Record<
  ModuleTheme,
  { accent: string; accentDim: string; border: string; label: string }
> = {
  dashboard: {
    accent: "text-z-primary",
    accentDim: "bg-z-primary/10",
    border: "border-z-primary/20",
    label: "Dashboard",
  },
  finance: {
    accent: "text-brand-green",
    accentDim: "bg-brand-green/10",
    border: "border-brand-green/20",
    label: "Financeiro",
  },
  goals: {
    accent: "text-z-emerald",
    accentDim: "bg-z-emerald/10",
    border: "border-z-emerald/20",
    label: "Metas",
  },
  alerts: {
    accent: "text-z-primary",
    accentDim: "bg-z-primary/10",
    border: "border-z-primary/20",
    label: "Alertas",
  },
  operations: {
    accent: "text-z-info",
    accentDim: "bg-z-info/10",
    border: "border-z-info/20",
    label: "Operações",
  },
  clients: {
    accent: "text-z-emerald",
    accentDim: "bg-z-emerald/10",
    border: "border-z-emerald/20",
    label: "Clientes",
  },
  reports: {
    accent: "text-z-info",
    accentDim: "bg-z-info/10",
    border: "border-z-info/20",
    label: "Relatórios",
  },
  performance: {
    accent: "text-z-primary",
    accentDim: "bg-z-primary/10",
    border: "border-z-primary/20",
    label: "Desempenho",
  },
};
