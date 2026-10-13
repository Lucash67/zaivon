import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sora)", "Sora", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "Sora", "system-ui", "sans-serif"],
        omni: ["var(--font-manrope)", "Manrope", "system-ui", "sans-serif"],
      },
      opacity: {
        12: "0.12",
        14: "0.14",
      },
      colors: {
        /* OMNI v2 (/v2): variáveis definidas só dentro de .omni2 em globals.css. */
        o: {
          background: "oklch(var(--o-background) / <alpha-value>)",
          foreground: "oklch(var(--o-foreground) / <alpha-value>)",
          card: "oklch(var(--o-card) / <alpha-value>)",
          "card-foreground": "oklch(var(--o-foreground) / <alpha-value>)",
          popover: "oklch(var(--o-popover) / <alpha-value>)",
          "popover-foreground": "oklch(var(--o-foreground) / <alpha-value>)",
          primary: "oklch(var(--o-primary) / <alpha-value>)",
          "primary-foreground": "oklch(var(--o-primary-foreground) / <alpha-value>)",
          secondary: "oklch(var(--o-muted) / <alpha-value>)",
          "secondary-foreground": "oklch(var(--o-foreground) / <alpha-value>)",
          muted: "oklch(var(--o-muted) / <alpha-value>)",
          "muted-foreground": "oklch(var(--o-muted-foreground) / <alpha-value>)",
          accent: "oklch(var(--o-accent) / <alpha-value>)",
          "accent-foreground": "oklch(var(--o-foreground) / <alpha-value>)",
          destructive: "oklch(var(--o-alert) / <alpha-value>)",
          surface: "oklch(var(--o-surface) / <alpha-value>)",
          ok: "oklch(var(--o-ok) / <alpha-value>)",
          pending: "oklch(var(--o-pending) / <alpha-value>)",
          info: "oklch(var(--o-info) / <alpha-value>)",
          alert: "oklch(var(--o-alert) / <alpha-value>)",
          third: "oklch(var(--o-third) / <alpha-value>)",
          ring: "oklch(var(--o-primary) / <alpha-value>)",
          sidebar: "oklch(var(--o-sidebar) / <alpha-value>)",
          "sidebar-foreground": "oklch(var(--o-sidebar-foreground) / <alpha-value>)",
          "sidebar-accent": "var(--o-sidebar-accent)",
          "sidebar-accent-foreground": "oklch(var(--o-foreground) / <alpha-value>)",
          border: "var(--o-border)",
          input: "var(--o-input)",
        },
        /* ZAIVON Obsidian Lime — canais por tema em globals.css (--z-*-rgb). */
        z: {
          primary: "rgb(var(--z-primary-rgb) / <alpha-value>)",
          "primary-foreground": "var(--z-primary-foreground)",
          emerald: "rgb(var(--z-emerald-rgb) / <alpha-value>)",
          info: "rgb(var(--z-info-rgb) / <alpha-value>)",
          success: "rgb(var(--z-success-rgb) / <alpha-value>)",
          warning: "rgb(var(--z-warning-rgb) / <alpha-value>)",
          danger: "rgb(var(--z-danger-rgb) / <alpha-value>)",
          "lime-300": "#DCFF98",
          "lime-400": "#C9FF69",
          "lime-500": "#B7FF3C",
          "lime-600": "#9DE51E",
          "lime-700": "#7EB710",
          "bg-deep": "var(--z-bg-deep)",
          "bg-app": "var(--z-bg-app)",
        },
        /* Nomes legados (yellow/orange = cor principal) mantidos como aliases dos tokens ZAIVON. */
        brand: {
          orange: "rgb(var(--z-primary-rgb) / <alpha-value>)",
          yellow: "rgb(var(--z-primary-rgb) / <alpha-value>)",
          secondary: "rgb(var(--z-emerald-rgb) / <alpha-value>)",
          on: "var(--brand-on-accent)",
          green: "rgb(var(--z-success-rgb) / <alpha-value>)",
          red: "rgb(var(--z-danger-rgb) / <alpha-value>)",
        },
        surface: {
          base: "var(--surface-base)",
          elevated: "var(--surface-elevated)",
          card: "var(--surface-card)",
          border: "var(--surface-border)",
          hover: "var(--surface-hover)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          label: "var(--text-label)",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        glow: "var(--shadow-glow)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        celebrate: "celebrate 0.6s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        celebrate: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
