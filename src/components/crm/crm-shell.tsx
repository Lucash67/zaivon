"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Kanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { CRM_COPY, CRM_NAV } from "@/constants/crm-brand";
import { ProductSwitcher } from "@/components/hub/product-switcher";

export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0b0c14] text-[#F5F6FA]">
      <header className="sticky top-0 z-30 border-b border-emerald-500/15 bg-[#0b0c14]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/crm" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-[#0CD4FF] text-white shadow-[0_0_20px_rgba(16,185,129,0.35)]">
              <Kanban className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight">
                {CRM_COPY.productName}
              </span>
              <span className="block truncate text-[11px] text-[#A0A0A0]">
                {CRM_COPY.productTagline} · {CRM_COPY.holdingName}
              </span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ProductSwitcher />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2 scrollbar-none">
          {CRM_NAV.map((item) => {
            const active =
              "exact" in item && item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-emerald-500/20 text-white"
                    : "text-[#A0A0A0] hover:bg-white/5 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 pb-24 sm:py-6">{children}</main>
    </div>
  );
}
