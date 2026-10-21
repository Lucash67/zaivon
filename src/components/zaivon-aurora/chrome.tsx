"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Boxes, ChevronDown, Eye, EyeOff, HandCoins, History, LineChart, ShieldCheck, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuroraPrivacy } from "@/components/zaivon-aurora/privacy";
import { ChannelSwitch } from "@/components/zaivon-aurora/channel";

export const NAV_ITEMS = [
  { id: "inicio", label: "Pulse do dia", icon: Sparkles },
  { id: "operacao", label: "Operação", icon: Boxes },
  { id: "historico", label: "Linha do tempo", icon: History },
  { id: "fiados", label: "Fiados", icon: HandCoins },
  { id: "notas", label: "Integridade", icon: ShieldCheck },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "analise", label: "Análises", icon: LineChart },
] as const;

function useScrollSpy() {
  const [active, setActive] = useState("inicio");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    for (const { id } of NAV_ITEMS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return active;
}

export function AuroraField() {
  return (
    <div className="aurora-field" aria-hidden="true">
      <div className="aurora-blob aurora-blob--lime" />
      <div className="aurora-blob aurora-blob--cyan" />
      <div className="aurora-blob aurora-blob--azure" />
    </div>
  );
}

export function Reveal({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return <div className={cn("reveal", visible && "reveal-visible")}>{children}</div>;
}

export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass overflow-hidden rounded-xl">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-xs font-semibold">
        <span>{title}</span>
        <ChevronDown className={cn("size-3.5 text-aur-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div>{children}</div> : null}
    </div>
  );
}

export function Rail() {
  const active = useScrollSpy();
  return (
    <aside className="sticky top-0 z-10 hidden h-screen w-20 shrink-0 flex-col items-center border-r border-aur-line/60 py-6 lg:flex">
      <a href="#inicio" aria-label="ZAIVON — voltar ao início" className="grid size-11 place-items-center rounded-2xl bg-aur-lime font-display text-xl font-bold text-aur-ink shadow-[0_0_28px_-6px_oklch(var(--aur-lime))]">
        Z
      </a>
      <nav className="mt-10 flex flex-1 flex-col gap-1.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <a key={id} href={`#${id}`} aria-label={label} className={cn("group relative grid size-11 place-items-center rounded-xl text-aur-muted hover:bg-aur-panel2 hover:text-aur-fg", active === id && "bg-aur-lime/12 text-aur-lime")}>
            <Icon className="size-4" />
            <span className="pointer-events-none absolute left-full ml-3 rounded-lg border border-aur-line bg-aur-panel3 px-2.5 py-1.5 text-[11px] whitespace-nowrap text-aur-fg opacity-0 group-hover:opacity-100">
              {label}
            </span>
          </a>
        ))}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const active = useScrollSpy();
  return (
    <nav className="scrollbar-slim -mx-1 flex gap-2 overflow-x-auto pb-1">
      {NAV_ITEMS.map(({ id, label }) => (
        <a key={id} href={`#${id}`} className={cn("shrink-0 rounded-full border border-aur-line/70 bg-aur-panel/70 px-3.5 py-1.5 text-xs text-aur-muted", active === id && "border-aur-lime/50 bg-aur-lime/12 font-semibold text-aur-lime")}>
          {label}
        </a>
      ))}
    </nav>
  );
}

export function TopBar({ name, homologated }: { name: string; homologated: boolean }) {
  const { hidden, toggle } = useAuroraPrivacy();
  const initials = name.slice(0, 1).toUpperCase() || "Z";
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-aur-line/50 bg-aur-bg/70 px-4 py-3 backdrop-blur-xl sm:px-8">
      <p className="truncate text-xs text-aur-muted">
        <strong className="font-display text-aur-fg">ZAIVON</strong>
        <span className="mx-1.5">/</span> Business <span className="mx-1.5">/</span>
        <span className="hidden sm:inline">Visão operacional</span>
      </p>
      <div className="flex items-center gap-2.5">
        <ChannelSwitch className="hidden lg:inline-flex" />
        {homologated ? (
          <span className="hidden rounded-full border border-aur-emerald/30 bg-aur-emerald/10 px-3 py-1.5 text-[11px] font-semibold text-aur-emerald md:inline-flex">
            Fechamento canônico
          </span>
        ) : null}
        <button type="button" onClick={toggle} aria-pressed={!hidden} className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium">
          {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          <span className="hidden sm:inline">{hidden ? "Revelar valores" : "Ocultar valores"}</span>
        </button>
        <span className="grid size-9 place-items-center rounded-full border border-aur-lime/30 bg-aur-lime/12 text-sm font-bold text-aur-lime">{initials}</span>
      </div>
    </header>
  );
}
