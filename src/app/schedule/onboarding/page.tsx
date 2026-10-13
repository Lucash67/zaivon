import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { ZAIVON_HUB_PATH } from "@/constants/zaivon-products";

/** Gate da Fase 1 — wizard completo entra na Fase 2. Não cria organização. */
export default function ScheduleOnboardingGatePage() {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#151922] px-5 py-10 sm:px-8">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C3CFF] to-[#0CD4FF] text-white">
        <CalendarDays className="h-7 w-7" />
      </span>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-[#7C3CFF]">
        Configuração
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        Vamos configurar seu ZAIVON Schedule
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[#A0A0A0]">
        O estabelecimento ainda não foi configurado. O passo a passo (negócio, serviços,
        equipe, disponibilidade e link público) entra na próxima entrega — nada é criado
        automaticamente.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={ZAIVON_HUB_PATH}
          className="inline-flex h-11 items-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-white hover:bg-white/5"
        >
          Voltar ao Hub
        </Link>
      </div>
    </div>
  );
}
