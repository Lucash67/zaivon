"use client";

import { Suspense } from "react";
import { HubAuthForm } from "@/components/hub/hub-auth-form";

function AuthFormSkeleton() {
  return (
    <div className="w-full max-w-[400px] animate-pulse space-y-4 rounded-3xl border border-z-primary/10 bg-[#0a0a0a]/80 p-6">
      <div className="h-7 w-28 rounded-lg bg-z-primary/10" />
      <div className="h-4 w-40 rounded bg-white/5" />
      <div className="h-10 rounded-xl bg-white/5" />
      <div className="h-10 rounded-xl bg-white/5" />
      <div className="h-11 rounded-xl bg-z-primary/15" />
    </div>
  );
}

export function HubAuthPanel() {
  return (
    <div className="relative flex h-full min-h-[55vh] flex-col items-center justify-center px-5 py-8 sm:px-8 lg:min-h-0 lg:py-6">
      <Suspense fallback={<AuthFormSkeleton />}>
        <HubAuthForm compact />
      </Suspense>
    </div>
  );
}
