"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { OMNI_HUB_PATH, OMNI_PRODUCTS } from "@/constants/omni-products";
import { cn } from "@/lib/utils";

/**
 * Seletor discreto: produto atual + volta ao OMNI Hub.
 * Usado no chrome do Business, Schedule e CRM.
 */
export function ProductSwitcher({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const current = pathname.startsWith("/crm")
    ? OMNI_PRODUCTS.find((p) => p.id === "crm")
    : pathname.startsWith("/schedule")
      ? OMNI_PRODUCTS.find((p) => p.id === "schedule")
      : OMNI_PRODUCTS.find((p) => p.id === "business");

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Link
        href={OMNI_HUB_PATH}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-z-primary/25 bg-z-primary/10 px-2 py-1.5 text-[11px] font-semibold text-z-lime-300 transition hover:border-z-primary/45 hover:bg-z-primary/15 hover:text-white",
          compact && "px-2 py-1",
        )}
        title="Voltar ao ZAIVON Hub"
      >
        <LayoutGrid className="h-3 w-3 shrink-0" />
        {!compact && <span>Hub</span>}
      </Link>
      {current && !compact && (
        <span className="hidden truncate text-[10px] text-text-muted sm:inline">
          {current.shortName}
        </span>
      )}
    </div>
  );
}
