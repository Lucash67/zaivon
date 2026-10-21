"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, MoreHorizontal, Plus, Wallet, X } from "lucide-react";
import { ProductSwitcher } from "@/components/hub/product-switcher";
import { FinanceComposer } from "@/components/finance/composer";
import { FinanceOnboarding } from "@/components/finance/onboarding";
import { useFinance } from "@/components/finance/finance-provider";
import {
  FINANCE_COPY,
  FINANCE_MOBILE_PRIMARY,
  FINANCE_NAV,
  FINANCE_PAGE_META,
  isFinanceNavActive,
} from "@/constants/finance-brand";
import { cn } from "@/lib/utils";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="ZAIVON Finance">
      {FINANCE_NAV.map((item) => {
        const active = isFinanceNavActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
              active ? "bg-[#B7FF3C]/15 text-[#F7F9FC]" : "text-[#93A0B1] hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className={cn("h-4 w-4", active && "text-[#B7FF3C]")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function FinanceGate({ children }: { children: React.ReactNode }) {
  const { snapshot, loading, error, reload, diagnosisOpen } = useFinance();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0D12] text-[#93A0B1]">
        Abrindo seu Finance…
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0A0D12] px-6 text-center text-[#F7F9FC]">
        <p>{error || "Não consegui abrir o Finance."}</p>
        <button type="button" onClick={reload} className="rounded-2xl bg-[#B7FF3C] px-4 py-2 text-sm font-semibold text-[#07110A]">
          Tentar de novo
        </button>
      </div>
    );
  }

  if (snapshot.needsOnboarding || diagnosisOpen) {
    return <FinanceOnboarding mode={snapshot.needsOnboarding ? "create" : "apply"} />;
  }
  return <FinanceShell>{children}</FinanceShell>;
}

function FinanceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { snapshot, openComposer, composer } = useFinance();
  const [moreOpen, setMoreOpen] = useState(false);
  const meta = FINANCE_PAGE_META[pathname] ?? FINANCE_PAGE_META["/finance"];
  const level = snapshot && !snapshot.needsOnboarding ? snapshot.view.level : null;
  const streak = snapshot && !snapshot.needsOnboarding ? snapshot.view.streak : 0;

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#0A0D12] text-[#F7F9FC]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-[#0A0D12] lg:flex">
        <div className="px-4 py-5">
          <Link href="/finance" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#B7FF3C] text-[#07110A]">
              <Wallet className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[11px] font-semibold tracking-[0.18em]">{FINANCE_COPY.holdingName}</span>
              <span className="block text-[11px] font-semibold tracking-[0.14em] text-[#B7FF3C]">FINANCE</span>
            </span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <NavLinks />
        </div>
        <div className="space-y-3 px-4 py-4">
          {level ? (
            <p className="text-xs text-[#93A0B1]">
              Nível {level.level} · {level.name}
            </p>
          ) : null}
          <ProductSwitcher />
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0A0D12]/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2 lg:hidden">
              <ProductSwitcher compact />
            </div>
            <h1 className="truncate text-lg font-semibold">{meta.title}</h1>
            <p className="hidden truncate text-xs text-[#93A0B1] sm:block">{meta.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#B7FF3C]/30 bg-[#B7FF3C]/10 px-2.5 py-1 text-xs font-semibold text-[#B7FF3C]">
                <Flame className="h-3.5 w-3.5" />
                {streak}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => openComposer()}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-[#B7FF3C] px-3 py-2 text-sm font-semibold text-[#07110A]"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Lançar</span>
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-5 pb-28 lg:px-8 lg:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#0A0D12]/95 px-2 py-2 backdrop-blur lg:hidden" aria-label="Finance móvel">
        <div className="grid grid-cols-5 items-end">
          {FINANCE_MOBILE_PRIMARY.slice(0, 2).map((item) => {
            const active = isFinanceNavActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={cn("flex flex-col items-center gap-1 py-1 text-[10px]", active ? "text-[#B7FF3C]" : "text-[#93A0B1]")}>
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <button type="button" onClick={() => openComposer()} className="flex flex-col items-center" aria-label="Lançar">
            <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#B7FF3C] text-[#07110A] shadow-lg">
              <Plus className="h-5 w-5" />
            </span>
          </button>
          {FINANCE_MOBILE_PRIMARY.slice(2).map((item) => {
            const active = isFinanceNavActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={cn("flex flex-col items-center gap-1 py-1 text-[10px]", active ? "text-[#B7FF3C]" : "text-[#93A0B1]")}>
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-1 py-1 text-[10px] text-[#93A0B1]">
            <MoreHorizontal className="h-5 w-5" />
            Mais
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/70" aria-label="Fechar menu" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-white/10 bg-[#120F0C] p-4 pb-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Mais</p>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Fechar">
                <X className="h-4 w-4 text-[#93A0B1]" />
              </button>
            </div>
            <NavLinks onNavigate={() => setMoreOpen(false)} />
            <div className="mt-4">
              <ProductSwitcher />
            </div>
          </div>
        </div>
      ) : null}

      {composer ? <FinanceComposer key={composer.token} /> : null}
    </div>
  );
}
