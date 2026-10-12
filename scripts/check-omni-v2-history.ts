/** Confere meses anteriores e a prévia do rascunho (não grava nada). */
import "./load-env";
import { getOmniData, previewDraft } from "../src/lib/omni/omni-service";
import { monthSummary } from "../src/lib/omni/finance/month";

async function main() {

  for (const m of ["2026-10", "2026-09", "2026-08", "2026-07"]) {
    const o = await getOmniData(m);
    const s = monthSummary(o.days, o.settlements, o.plan);
    const withSales = o.days.filter((d) => d.registeredSales?.length).length;
    console.log(m, o.plan.label, `dias ${o.days.length}`, `lucro ${s.diaryProfit}`, `banco ${s.bank}`, `meta ${o.plan.goal}`, `dias c/ vendas ${withSales}`);
    if (m === "2026-10") console.log("meses:", o.availableMonths.map((x) => x.label).join(", "));
  }

  const draft = `Encomendados hoje:
- 10 Mistão frito
- 8 Coxinha

Lista de vendas na Unifor & Acal:
1 - Ana Teste: 2 salgados | Pix | R$10
2 - Bruno Teste: 1 salgado | fiado

Perdas:
- 1 coxinha

Custo, Bonificação, Faturamento e Lucro
Custo total dos salgados: R$60
Meu custo total: R$40
Custo de Terceiros: R$20
Bonificação: R$0
Faturamento total real (do dia + quitação): R$95
Faturamento total real do dia (somente desse dia): R$85
Lucro total real: R$55

Cofrinho dos lucros:
- Cofrinho até aqui na teoria: R$ 4.400,00
- Cofrinho até aqui na prática: R$ 4.431,20`;
  const p = await previewDraft(draft, "2026-10-13");
  console.log(JSON.stringify({ financials: p.financials, computedProfit: p.computedProfit, sales: p.sales.length, errors: p.errors, warnings: p.warnings }, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
