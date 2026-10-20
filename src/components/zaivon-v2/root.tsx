"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { AppShell } from "@/components/layout/app-shell";
import { ZaivonProvider } from "@/components/zaivon-v2/store";
import { ZaivonFrame } from "@/components/zaivon-v2/app-shell";
import { ZAIVON_V2_NAV } from "@/constants/navigation";
import { resolveTheme } from "@/lib/theme-config";
import { cn } from "@/lib/utils";

export function ZaivonRoot({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { theme } = useTheme();
  const light = resolveTheme(theme) === "light";
  const page = ZAIVON_V2_NAV.find((n) => n.href === path)?.label ?? "Hoje";

  return (
    <AppShell title={`ZAIVON v2 · ${page}`} subtitle="5 dimensões: faturamento · caixa · competência · resultado caixa · cofrinho">
      <div
        className={cn(
          "zaivon2 -m-3 min-h-[calc(100dvh-56px)] bg-o-background font-sans text-o-foreground sm:-m-5 lg:-m-6 lg:min-h-[calc(100dvh-64px)]",
          light && "zaivon2-light",
        )}
      >
        <ZaivonProvider>
          <ZaivonFrame>{children}</ZaivonFrame>
        </ZaivonProvider>
      </div>
    </AppShell>
  );
}
