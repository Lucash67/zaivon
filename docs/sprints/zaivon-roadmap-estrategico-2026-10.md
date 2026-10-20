# ZAIVON — Roadmap estratégico (Out/2026)

Registrado no módulo **Ideias** (`/ideias`) em 19/10/2026.  
Escopo desta etapa: **planejamento + cadastro no backlog** — sem implementação nem alteração de dados financeiros.

## Ordem recomendada

| # | Iniciativa | ROADMAP_ID | Esforço | Impacto | Por quê nesta ordem |
|---|---|---|---|---|---|
| 1 | Importador inteligente de fechamentos | ZV2-IMP-01 | M | Alto | Já existe `day-registration` + `CLOSING_*` + scripts; fecha o loop ChatGPT→ZAIVON rápido |
| 2 | Perdas / antifraude | ZV2-LOSS-01 | M | Alto | Histórico parcial já em `lossSaleIds` / `dayClosing.losses*`; KPI e estados faltam |
| 3 | Mercado Pago + conciliação | ZV2-MP-01 | A | Muito alto | Maior automação, mas depende de POC OAuth/API vs CSV |

Preferência do usuário alinhada. Alternativa só se a POC MP (Fase 0) for trivial e liberar dados para o importador — improvável no curto prazo.

## Reuso existente

- **Fechamentos / 5 dimensões:** `src/lib/finance/day-closing.ts`, painéis v2 (`hoje`, `dinheiro`, `DayReconciliationPanel`)
- **Registro do dia:** `src/lib/day-registration/*`, `scripts/register-day-*.ts`, tela ZAIVON `registrar` (preview/commit)
- **Perdas / inadimplência:** `lossSaleIds`, `markDebtAsLoss`, `quantityLost`, `historicalWriteOffs`, `operationalAudit`
- **Fiados / quitações:** `registerPayment`, settlements, debts
- **Ideias:** `/ideias`, `idea_items`, API `/api/ideias`

## Mercado Pago — viabilidade (docs oficiais)

**Possível:** `GET /v1/payments/search` (12 meses), detalhe por id, OAuth, webhooks para pagamentos da integração, relatórios de dinheiro em conta / settlements, cobranças com `external_reference` (origem por QR/local).

**Limitação crítica:** Pix recebido **direto na chave** (sem criar payment/order pelo app) pode **não** aparecer como Payment de checkout. Comprovar com Access Token da conta real antes de comprometer o roadmap. Fallback: CSV/extrato oficial + mesmo motor de conciliação.

**Nunca:** senha bancária, tokens no frontend, transferências automáticas, classificar sugestão como venda definitiva.

## Arquitetura alvo (visão)

```
[ChatGPT Modelo B] ──cola──► Importador ──► dayClosing + sales + settlements + losses
                                      ▲
[MP API ou CSV] ──► Inbox conciliação ─┴─► sugestões produto/local (confirmação humana)
                                      │
                              Perdas KPI ◄── Δ estoque × justificado
```

Cada módulo permanece usável sozinho (importador sem MP; perdas sem MP).

## Próximas decisões (dependem do Lucas)

1. Autorizar MVP do **Importador** (schema Modelo B + UI colar/prévia) na próxima sprint.
2. Confirmar se POC Mercado Pago será com **OAuth read-only** ou começar só com **CSV**.
3. Validar números históricos de perdas 13/10 (7×R$5) vs o que já está no `dayClosing` antes de qualquer seed de perdas.
4. Não conectar conta MP de produção até o go/no-go da Fase 0.

## Referências no app

Ver entradas pinned em `/ideias` com títulos contendo “Importador inteligente”, “Controle de perdas” e “Integração Mercado Pago”.
