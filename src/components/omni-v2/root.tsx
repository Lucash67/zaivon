"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { AppShell } from "@/components/layout/app-shell";
import { OmniProvider } from "@/components/omni-v2/store";
import { OmniFrame } from "@/components/omni-v2/app-shell";
import { OMNI_V2_NAV } from "@/constants/navigation";
import { resolveTheme } from "@/lib/theme-config";
import { cn } from "@/lib/utils";

export function OmniRoot({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { theme } = useTheme();
  const light = resolveTheme(theme) === "light";
  const page = OMNI_V2_NAV.find((n) => n.href === path)?.label ?? "Hoje";

  return (
    <AppShell title={`OMNI v2 · ${page}`} subtitle="Operação diária: lucro, cofrinho, pendências e meta">
      <div
        className={cn(
          "omni2 -m-3 min-h-[calc(100dvh-56px)] bg-o-background font-omni text-o-foreground sm:-m-5 lg:-m-6 lg:min-h-[calc(100dvh-64px)]",
          light && "omni2-light",
        )}
      >
        <OmniProvider>
          <OmniFrame>{children}</OmniFrame>
        </OmniProvider>
      </div>
    </AppShell>
  );
}
