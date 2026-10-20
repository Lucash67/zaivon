/**
 * Registra/atualiza as 3 iniciativas estratégicas no módulo Ideias (idempotente).
 * Uso: pnpm tsx scripts/seed-ideias-estrategicas-v2.ts
 *
 * Não altera dados financeiros. Só idea_items.
 */
import "./load-env";
import { eq } from "drizzle-orm";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { users } from "../src/lib/db/postgres/schema";
import { queryAll } from "../src/platform/db/query";
import {
  listIdeaItems,
  upsertIdeaItem,
} from "../src/platform/db/repositories/idea-repository";

type Spec = {
  title: string;
  /** Match titles (case-insensitive) to update instead of duplicating. */
  aliases?: string[];
  kind: "ideia" | "demanda" | "observacao";
  pinned: boolean;
  sortOrder: number;
  body: string;
};

const SPECS: Spec[] = [
  {
    title: "Importador inteligente de fechamentos (modelo oficial ZAIVON)",
    aliases: ["importador inteligente", "importação de fechamento", "modelo oficial fechamento"],
    kind: "demanda",
    pinned: true,
    sortOrder: 10,
    body: `STATUS: Ideia / Em análise · PRIORIDADE: Estratégica (preferência #1 de implementação)
CATEGORIA: Automação / Inteligência / Gestão
ROADMAP_ID: ZV2-IMP-01
DEPENDÊNCIAS: dayClosing v2 · commitDayRegistration · previewDraft/registrar · CLOSING_* constants
RELACIONA: Mercado Pago (ZV2-MP-01) · Perdas (ZV2-LOSS-01)

## Problema
Hoje a conciliação diária é feita no ChatGPT e depois transferida manualmente ao ZAIVON (scripts + conferência). Isso gera retrabalho e risco de duplicação/erro.

## Objetivo
Colar um fechamento no formato oficial (Modelo B estruturado) e, com prévia + confirmação, gravar vendas, fiados, quitações, estoque, custos, perdas, dayClosing (5 dimensões) e cofrinho — sem duplicar e sem forçar igualdade entre grandezas distintas.

## Modelos oficiais
A — Notas (humano, 4 blocos): resumo/estoque · histórico cronológico · financeiro/cofrinho · fiados/perdas/pendências.
B — Importação estruturada (versionado, JSON ou equivalente): version, date, competenceStatus, cash, competence, piggy, sales[], settlements[], credits[], losses[], stock, costs, pendencies, audit.

## Requisitos funcionais
1. Reconhecer Modelo A vs B; validar schema e totais.
2. Prévia completa antes de salvar; confirmação explícita.
3. Idempotência por data+negócio; diff se o dia já existir; trilha de auditoria; reversão segura.
4. Suportar status: preparação · parcial · closed_with_note · conciliado.
5. Preservar 5 dimensões (competência, caixa, lucro competência, resultado caixa, cofrinho) sem forçar igualdade.
6. Exemplo real: 16/10 sanduíches pendentes → manter provisional / operationalAudit.pending.

## Critérios de aceitação (MVP)
- [ ] Schema Modelo B documentado (versão 1).
- [ ] UI colar → validar → prévia → confirmar (Obsidian Lime).
- [ ] Round-trip: exportar CLOSING_2026_10_15/16 → reimportar dry-run sem duplicar.
- [ ] Divergências matemáticas listadas com explicação (não auto-corrigir).
- [ ] Não alterar 15/10 nem 16/10 em produção sem confirmação.

## UX (Obsidian Lime)
Área de colagem · badge do modelo detectado · checklist de validação · cards das 5 dimensões · diffs vs existente · alertas · CTA Confirmar.

## Riscos
Parser ambíguo do Modelo A; duplicação se idempotência falhar; sobrescrita acidental. Mitigar: Modelo B canônico; dry-run; backup lógico por versão.

## Roadmap sugerido
MVP: Modelo B + validação + prévia + commit idempotente para dia novo.
Depois: diff/atualização · gerador ChatGPT do Modelo B · sync Notas (Modelo A).

## Reuso existente
src/lib/day-registration/* · scripts/register-day-*.ts · CLOSING_* em day-closing.ts · zaivon registrar (previewDraft/commitDraft).

Registrado em 19/10/2026 — planejamento apenas; sem implementação nesta etapa.`,
  },
  {
    title: "Controle de perdas e sistema antifraude (retiradas sem pagamento)",
    aliases: ["controle de perdas", "antifraude", "retiradas sem pagamento"],
    kind: "demanda",
    pinned: true,
    sortOrder: 20,
    body: `STATUS: Ideia / Em análise · PRIORIDADE: Alta (preferência #2)
CATEGORIA: Operações / Controladoria / Prevenção de perdas
ROADMAP_ID: ZV2-LOSS-01
DEPENDÊNCIAS: dayClosing.losses* · lossSaleIds · operationalAudit · conciliação estoque×caixa
RELACIONA: Importador (ZV2-IMP-01) · Mercado Pago (ZV2-MP-01)

## Problema
Autosserviço (esp. Acal): retiradas sem pagamento/identificação. Hoje a detecção é manual (estoque × Pix × fiados × espécie).

## Objetivo
Indicador “Retiradas sem pagamento identificado” com ciclo: investigar → perda reconhecida → recuperação opcional, sem apagar o histórico nem duplicar receita.

## Requisitos funcionais
1. Diff unidades físicas vs justificadas (pago + fiado + quitação + espécie convertida).
2. Estados: investigar | perda_reconhecida | recuperada (parcial/total).
3. Campos: data, local (Acal/Unifor/Meia Sola), produto, qtd, valor comercial, notas.
4. Identificar responsável depois; registrar recuperação sem apagar ocorrência.
5. Separar perda anônima de inadimplência de cliente identificado (ex.: Mikelly R$7).
6. Relatórios: dia/semana/mês, acumulado, % sobre retiradas, taxa de recuperação, por local.

## Histórico inicial (verificar no banco antes de importar — NÃO duplicar)
- 13/10/2026: 7 salgados NI — R$ 35 (checar dayClosing 13/10 e 14/10: lossesUnits/Amount).
- 16/10/2026: 1 salgado NI — R$ 5 (já em dayClosing + lossSaleIds).
Acumulado informado: 8 un · R$ 40.

## Antifraude (futuro — sem presumir dolo)
QR por local · registro rápido de retirada · alertas de Δ · padrões · confirmação de Pix. Experiência do cliente primeiro.

## Critérios de aceitação (MVP)
- [ ] Entidade/ocorrência de perda com status e histórico.
- [ ] Dashboard: perdas do dia/mês + acumulado (sem misturar inadimplência).
- [ ] 16/10 R$5 aparece uma única vez; recuperação posterior possível.
- [ ] Filtro por local e período.

## UX
Painel Perdas · timeline da ocorrência · CTA “Identificar / Recuperar” · gráfico tendência.

## Riscos
Falso positivo (Δ ainda em investigação); duplicar com quantityLost. Mitigar: estados explícitos; 1 ocorrência = 1 id.

## Roadmap
MVP: modelo + UI lista/KPI + seed dos históricos já existentes (só leitura/link).
Depois: alertas automáticos pós-fechamento · antifraude QR.

## Reuso
lossSaleIds · markDebtAsLoss · dayClosing.losses* / historicalWriteOffs · operationalAudit.

Registrado em 19/10/2026 — planejamento apenas.`,
  },
  {
    title: "Integração Mercado Pago + conciliação inteligente",
    aliases: [
      "Integrar Mercado Pago (PIX automático)",
      "integrar mercado pago",
      "pix automático",
      "conciliação inteligente",
    ],
    kind: "demanda",
    pinned: true,
    sortOrder: 30,
    body: `STATUS: Ideia / Em análise · PRIORIDADE: Estratégica / Alta (preferência #3 — depende de OAuth/API)
CATEGORIA: Integrações / Automação / Financeiro
ROADMAP_ID: ZV2-MP-01
ATUALIZA: demanda anterior “Integrar Mercado Pago (PIX automático)” (ago/2026, pausada)
DEPENDÊNCIAS: OAuth MP · tokens server-side · motor de combinações · fila de classificação
RELACIONA: Importador (ZV2-IMP-01) · Perdas (ZV2-LOSS-01)

## Problema
Extrato MP → anotar Pix → classificar local/produto/quitação → lançar no ZAIVON. Lento e sujeito a erro.

## Objetivo
Importar recebimentos disponíveis e abrir uma Central de Conciliação com sugestões (nunca confirmação automática).

## Viabilidade (documentação oficial — a validar com conta real)
POSSÍVEL:
- GET /v1/payments/search (últimos 12 meses; filtros status, payment_method_id=pix, datas).
- GET /v1/payments/{id}; OAuth 2.0; webhooks para pagamentos criados via integração.
- Relatórios de dinheiro em conta / settlement reports (movimentações da conta).
- Cobranças com external_reference / QR por local (origem Nível 1).

LIMITAÇÕES / RISCOS:
- Pix pago direto na chave (sem payment/order criado pelo app) pode NÃO aparecer como Payment de checkout — precisa prova com Access Token da conta real.
- Sugestão ≠ venda confirmada (quitação, repasse espécie, agrupamento, renda).
- Não há GPS do pagador nos dados bancários.

FALLBACK: importação CSV/extrato oficial + mesmo motor de conciliação.

## Motor de produtos (preços atuais)
Salgado R$5 · Sanduíche Acal R$7 · Sanduíche Unifor/Meia Sola R$8.
Enumerar combinações inteiras ≥0; multi-hipótese; usuário confirma. Preços configuráveis.

## Origem do local (prioridade)
1) QR/external_reference por canal · 2) histórico do pagador · 3) padrão de valor · 4) fila manual (lote).

## Central de conciliação
Fila: novos Pix · sugestões · status (novo/sugerido/classificado/ignorado) · vínculos a venda/quitação/perda/outra · auditoria. Idempotente vs registros manuais.

## Segurança
OAuth; tokens só no servidor; sem senha bancária; sem transferência/saque automático; sem log de secrets; sem conectar produção nesta etapa.

## Critérios de aceitação (MVP)
- [ ] Doc de viabilidade assinada após teste read-only com sandbox/conta autorizada.
- [ ] Import CSV OU API search → fila sem criar vendas.
- [ ] Motor de combinações com testes unitários (ex.: 12, 15, 24).
- [ ] Classificar 1 Pix como venda/quitação/outra com confirmação.

## UX
Inbox de conciliação · chips de hipótese · atalhos Acal/Unifor/Meia Sola · “Não classificar”.

## Roadmap
Fase 0: POC read-only API vs CSV (decisão go/no-go).
MVP: import + fila + motor + classificação manual.
Depois: OAuth produção · webhooks · QR por local · sugestão de fiados.

Registrado/atualizado em 19/10/2026 — planejamento apenas; sem conectar conta.`,
  },
];

function matches(existingTitle: string, spec: Spec): boolean {
  const t = existingTitle.trim().toLowerCase();
  if (t === spec.title.toLowerCase()) return true;
  return (spec.aliases ?? []).some((a) => t.includes(a.toLowerCase()) || a.toLowerCase().includes(t));
}

async function main() {
  const email = process.env.LBO_OWNER_EMAIL?.trim() || "lucashcampos667@gmail.com";
  const db = await getPostgresDb();
  const rows = await queryAll(
    db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email)),
  );
  const owner = rows[0];
  if (!owner) throw new Error(`Usuário não encontrado: ${email}`);

  const existing = await listIdeaItems(owner.id, { includeArchived: true });
  const results: { op: string; id: string; title: string; bodyLen: number }[] = [];

  for (const spec of SPECS) {
    if (spec.body.length > 8000) {
      throw new Error(`Body > 8000 chars: ${spec.title} (${spec.body.length})`);
    }
    const prior = existing.find(
      (i) => i.status !== "archived" && matches(i.title, spec),
    );
    const item = await upsertIdeaItem(owner.id, {
      id: prior?.id,
      title: spec.title,
      body: spec.body,
      kind: spec.kind,
      status: "open",
      pinned: spec.pinned,
      sortOrder: prior?.sortOrder ?? spec.sortOrder,
    });
    results.push({
      op: prior ? "UPDATE" : "CREATE",
      id: item.id,
      title: item.title,
      bodyLen: item.body.length,
    });
  }

  console.log(JSON.stringify({ owner: owner.email, results }, null, 2));
  console.log("SEED_IDEIAS_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
