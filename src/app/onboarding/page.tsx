"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, LayoutGrid, Sparkles } from "lucide-react";
import { ZaivonLogo } from "@/components/hub/zaivon-logo";
import { useSessionUser } from "@/hooks/use-session-user";
import { ZAIVON_HUB_PATH } from "@/constants/zaivon-products";
import { ZAIVON_ONBOARDING_PATH } from "@/lib/zaivon-onboarding";

const STEPS = [
  {
    title: "Conheça a ZAIVON",
    body: "Ecossistema de produtos para organizar e fazer o negócio evoluir.",
  },
  {
    title: "Crie ou entre na sua conta",
    body: "Uma conta ZAIVON dá acesso aos produtos autorizados do ecossistema.",
  },
  {
    title: "Escolha o sistema",
    body: "No Hub você seleciona Business, Schedule ou futuros produtos.",
  },
] as const;

/**
 * Landing pública — leads e visitantes.
 * Autenticados são enviados ao Hub.
 */
export default function PublicOnboardingPage() {
  const router = useRouter();
  const { data: user, isFetched } = useSessionUser();

  useEffect(() => {
    if (!isFetched) return;
    if (user?.id && user.id !== "local") {
      router.replace(ZAIVON_HUB_PATH);
    }
  }, [isFetched, user?.id, router]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060c] text-[#F5F6FA]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgb(var(--z-primary-rgb)/0.22),_transparent_50%),radial-gradient(ellipse_at_bottom_left,_rgb(var(--z-emerald-rgb)/0.12),_transparent_45%)]"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <Link href={ZAIVON_ONBOARDING_PATH} aria-label="ZAIVON">
          <ZaivonLogo height={44} className="max-w-[160px] sm:max-w-[200px]" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-xl px-3 py-2 text-sm font-medium text-[#A3A3A3] transition hover:bg-white/5 hover:text-white sm:px-4"
          >
            Entrar
          </Link>
          <Link
            href="/login?mode=register"
            className="rounded-xl bg-gradient-to-r from-z-primary to-z-emerald px-3 py-2 text-sm font-semibold text-brand-on shadow-[0_8px_24px_rgb(var(--z-primary-rgb)/0.35)] transition hover:brightness-110 sm:px-4"
          >
            Criar conta
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-lg flex-col px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-z-primary">
          ZAIVON · Ecossistema
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Bem-vindo à ZAIVON
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3] sm:text-[15px]">
          Porta de entrada para quem chega de qualquer canal. Conheça o ecossistema,
          crie sua conta e escolha o produto certo para o seu momento.
        </p>

        <ul className="mt-8 space-y-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-z-primary/15 text-sm font-bold text-z-lime-300">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#A3A3A3]">{step.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-z-primary/25 bg-z-primary/10 px-3 py-1 text-[11px] font-medium text-z-lime-300">
            <LayoutGrid className="h-3 w-3" />
            Hub
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-z-primary/25 bg-z-primary/10 px-3 py-1 text-[11px] font-medium text-z-lime-300">
            <Sparkles className="h-3 w-3" />
            Business
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-z-emerald/25 bg-z-emerald/10 px-3 py-1 text-[11px] font-medium text-[#7FE6C8]">
            <CalendarDays className="h-3 w-3" />
            Schedule
          </span>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login?mode=register"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-z-primary to-z-emerald px-5 py-4 text-sm font-semibold text-brand-on shadow-[0_12px_40px_rgb(var(--z-primary-rgb)/0.35)] transition hover:brightness-110"
          >
            Criar conta
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-semibold text-white transition hover:border-z-primary/40 hover:bg-z-primary/10"
          >
            Já tenho conta — Entrar
          </Link>
        </div>
      </main>
    </div>
  );
}
