"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { BusinessWriteNotice } from "@/components/business/business-write-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBusinessScope } from "@/hooks/use-business-scope";
import { isAllBusinesses, SALGADOS_BUSINESS_ID } from "@/lib/business-units";
import { useBusinessContextStore } from "@/stores/business-context-store";
import { formatCurrency } from "@/lib/utils";
import { formatSaleShift } from "@/lib/sale-shift";
import { buildWeekdayDraftTemplate, type DayRegistrationPreview } from "@/lib/day-registration/types";
import {
  ClipboardPaste,
  FileText,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShoppingCart,
  Users,
  Package,
  BookOpen,
} from "lucide-react";

function PreviewSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-z-primary/15 bg-gradient-to-br from-z-primary/5 via-surface-card to-surface-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-z-primary" />
        <h3 className="label-upper text-z-primary">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function RegistroDiaPage() {
  const { canWrite, writeBlockedMessage, activeBusinessId } = useBusinessScope();
  const setActiveBusiness = useBusinessContextStore((s) => s.setActiveBusiness);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState<DayRegistrationPreview | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAllBusinesses(activeBusinessId)) {
      setActiveBusiness(SALGADOS_BUSINESS_ID);
    }
  }, [activeBusinessId, setActiveBusiness]);

  const parseMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/day-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "parse", draft: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao interpretar rascunho.");
      return json as DayRegistrationPreview;
    },
    onSuccess: (data) => {
      setPreview(data);
      setSuccessMessage(null);
    },
  });

  const commitMutation = useMutation({
    mutationFn: async (plan: DayRegistrationPreview) => {
      const { warnings, errors, productMatches, clientMatches, dayAlreadyRegistered, existingSalesCount, ...planData } =
        plan;
      void warnings;
      void errors;
      void productMatches;
      void clientMatches;
      void dayAlreadyRegistered;
      void existingSalesCount;

      const res = await fetch("/api/day-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "commit", plan: planData }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao registrar dia.");
      return json as { message: string };
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message);
      setPreview(null);
      setDraft("");
      queryClient.invalidateQueries();
      // No celular a confirmação fica no topo, longe do botão: sobe até ela.
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  const hasBlockingErrors = (preview?.errors.length ?? 0) > 0;

  const commitBlockReason = !preview
    ? null
    : hasBlockingErrors
      ? "Corrija os erros do preview antes de registrar."
      : preview.dayAlreadyRegistered
        ? `Dia ${preview.date} já possui ${preview.existingSalesCount} venda(s) registrada(s).`
        : !canWrite
          ? writeBlockedMessage
          : null;

  const canCommit = preview && !commitBlockReason && !commitMutation.isPending;

  return (
    <AppShell
      title="Registro do Dia"
      subtitle="Cole seu rascunho do dia no seu formato habitual"
    >
      {!canWrite && <BusinessWriteNotice message={writeBlockedMessage} />}

      {successMessage && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand-green/30 bg-brand-green/10 p-4 text-sm text-brand-green">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardPaste className="h-4 w-4 text-z-primary" />
              Rascunho do dia
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft(buildWeekdayDraftTemplate(new Date()))}
              disabled={!canWrite}
            >
              <FileText className="mr-1 h-3.5 w-3.5" />
              Carregar modelo
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Cole aqui seu rascunho (Encomendados, lista de vendas...)"
              className="min-h-[240px] font-mono text-base leading-relaxed sm:min-h-[340px] sm:text-xs xl:min-h-[480px]"
            />

            <div className="rounded-lg border border-z-primary/20 bg-z-primary/5 p-3 text-xs text-text-muted">
              <p className="mb-2 font-medium text-z-emerald">Seu formato:</p>
              <p>
                A data é a da coluna em Notas (não escreva no texto) · Encomendados · Henrique · Unifor & Acal · Lista de vendas ·
                Pendências/Espécie/Fiados/Perdas · OBS · Custo/Faturamento/Lucro/Cofrinho
              </p>
              <p className="mt-2 font-medium text-z-emerald">Linha de venda:</p>
              <code className="text-text-secondary">1 - Nome: 1 salgado | Pix | R$5</code>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={() => parseMutation.mutate(draft)}
              disabled={!canWrite || !draft.trim() || parseMutation.isPending}
            >
              <Play className="mr-2 h-4 w-4" />
              {parseMutation.isPending ? "Interpretando..." : "Interpretar rascunho"}
            </Button>

            {parseMutation.isError && (
              <p className="text-sm text-brand-red">
                {parseMutation.error instanceof Error
                  ? parseMutation.error.message
                  : "Erro ao interpretar."}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!preview ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-text-muted">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-z-primary/20 to-z-emerald/15 text-z-primary">
                  <Play className="h-5 w-5" />
                </div>
                Interprete um rascunho para ver o preview antes de registrar.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{preview.date}</Badge>
                <Badge>{preview.businessId}</Badge>
                {preview.dailyGoalUnits !== undefined && (
                  <Badge>Meta {preview.dailyGoalUnits} un.</Badge>
                )}
                {preview.dayAlreadyRegistered && (
                  <Badge className="bg-brand-red/15 text-brand-red">
                    Dia já registrado ({preview.existingSalesCount} vendas)
                  </Badge>
                )}
              </div>

              {(preview.errors.length > 0 || preview.warnings.length > 0) && (
                <div className="space-y-2">
                  {preview.errors.map((msg) => (
                    <div
                      key={msg}
                      className="flex items-start gap-2 rounded-lg border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red"
                    >
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {msg}
                    </div>
                  ))}
                  {preview.warnings.map((msg) => (
                    <div
                      key={msg}
                      className="flex items-start gap-2 rounded-lg border border-z-primary/30 bg-z-primary/10 p-3 text-sm text-[#F5F6FA]/90"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {msg}
                    </div>
                  ))}
                </div>
              )}

              <PreviewSection title="Resumo" icon={BookOpen}>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <p className="rounded-lg border border-z-info/15 bg-z-info/5 px-3 py-2">
                    Receita: <strong className="text-z-info">{formatCurrency(preview.summary.revenue)}</strong>
                  </p>
                  <p className="rounded-lg border border-brand-green/20 bg-brand-green/5 px-3 py-2">
                    Lucro: <strong className="text-brand-green">{formatCurrency(preview.summary.profit)}</strong>
                  </p>
                  <p>
                    Vendidas: <strong>{preview.summary.quantitySold}</strong>
                  </p>
                  <p>
                    Perdidas: <strong>{preview.summary.quantityLost}</strong>
                  </p>
                </div>
              </PreviewSection>

              {preview.purchase && (
                <PreviewSection title="Compra" icon={Package}>
                  <p className="text-sm mb-2">
                    {preview.purchase.totalUnits} un. · {formatCurrency(preview.purchase.investment)}
                  </p>
                  <ul className="space-y-1 text-sm text-text-secondary">
                    {preview.purchase.products.map((p) => (
                      <li key={p.name}>
                        {p.quantity}× {p.name}
                      </li>
                    ))}
                  </ul>
                </PreviewSection>
              )}

              <PreviewSection title={`Vendas (${preview.sales.length})`} icon={ShoppingCart}>
                {/* Sem scroll aninhado no celular: a página inteira rola. */}
                <ul className="space-y-2 text-sm xl:max-h-48 xl:overflow-y-auto">
                  {preview.sales.map((sale, i) => (
                    <li key={`${sale.time}-${sale.clientName}-${i}`} className="border-b border-surface-border pb-2 last:border-0">
                      <span className="text-text-muted">{formatSaleShift(sale.time)}</span> ·{" "}
                      {sale.clientName} ·{" "}
                      {sale.productName}
                      {sale.quantity > 1 ? ` x${sale.quantity}` : ""} · {sale.paymentMethod}
                      {sale.paymentStatus === "pending" && (
                        <Badge className="ml-2 bg-z-warning/15 text-z-warning">pendente</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </PreviewSection>

              <PreviewSection title="Clientes" icon={Users}>
                <ul className="space-y-1 text-sm">
                  {preview.clientMatches.map((c) => (
                    <li key={c.clientName}>
                      {c.clientName}
                      {c.willCreate && (
                        <Badge className="ml-2 bg-z-emerald/15 text-z-emerald">novo</Badge>
                      )}
                      {c.existingClientName && !c.willCreate && (
                        <span className="ml-2 text-text-muted">({c.existingClientName})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </PreviewSection>

              {/* CTA colado no rodapé no celular: registrar sem rolar tudo de volta. */}
              <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 rounded-2xl border border-z-primary/25 bg-surface-base/95 p-2 shadow-[0_8px_32px_rgb(var(--z-primary-rgb)/0.15)] backdrop-blur xl:static xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none xl:backdrop-blur-none">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => preview && canCommit && commitMutation.mutate(preview)}
                  disabled={!canCommit}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {commitMutation.isPending ? "Registrando..." : "Confirmar e registrar dia"}
                </Button>
              </div>

              {commitBlockReason && (
                <p className="text-sm text-z-warning">{commitBlockReason}</p>
              )}

              {commitMutation.isError && (
                <p className="text-sm text-brand-red">
                  {commitMutation.error instanceof Error
                    ? commitMutation.error.message
                    : "Erro ao registrar."}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
