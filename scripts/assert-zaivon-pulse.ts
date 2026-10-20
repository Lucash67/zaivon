/**
 * Assert ZAIVON Pulse v1 — mapeamento canônico + insights.
 * Uso: pnpm tsx scripts/assert-zaivon-pulse.ts
 */
import "./load-env";
import { buildZaivonPulse } from "../src/lib/zaivon-pulse";
import { getDiaryEntry } from "../src/lib/diary-service";
import { CLOSING_2026_10_16, CLOSING_2026_10_19 } from "../src/lib/finance/day-closing";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`✓ ${label}`);
}

async function main() {
  // Cenário: dayClosing 19/10 (depósito realizado)
  const p19 = buildZaivonPulse({
    focusDate: "2026-10-19",
    isToday: false,
    diary: { dayClosing: CLOSING_2026_10_19 } as never,
  });
  assert(p19.source === "dayClosing", "19 source dayClosing");
  assert(p19.metrics.competenceRevenue === 170, "19 fat 170");
  assert(p19.metrics.competenceProfit === 60, "19 lucro 60");
  assert(p19.metrics.cashIn === 118, "19 caixa 118");
  assert(p19.metrics.newCredit === 52, "19 fiados 52");
  assert(p19.insightKind === "positivo", "19 insight positivo (fiados 30%<35%, sem divergência)");
  assert(!p19.periodLabel.toLowerCase().includes("hoje"), "19 não é hoje");

  // 16/10 provisional + sandwich diverged
  const p16 = buildZaivonPulse({
    focusDate: "2026-10-16",
    isToday: false,
    diary: { dayClosing: CLOSING_2026_10_16 } as never,
  });
  assert(p16.metrics.competenceRevenue === 168, "16 fat 168");
  assert(p16.metrics.cashIn === 207, "16 caixa 207");
  assert(p16.metrics.newCredit === 14, "16 fiados 14");
  assert(p16.competenceProvisional, "16 provisional");
  assert(p16.insightKind === "divergencia", "16 divergência sanduíches");

  // Sem vendas
  const zero = buildZaivonPulse({
    focusDate: "2026-10-20",
    isToday: true,
    fallback: { revenue: 0, profit: 0, cashIn: 0, newCredit: 0 },
  });
  assert(zero.insightKind === "sem-vendas", "zero → sem-vendas");
  assert(zero.source === "metrics", "zero source metrics");

  // Negativo
  const neg = buildZaivonPulse({
    focusDate: "2026-10-20",
    isToday: true,
    fallback: { revenue: 90, profit: -20, cashIn: 90, newCredit: 0 },
  });
  assert(neg.insightKind === "negativo", "lucro negativo");

  // Incompleto
  const inc = buildZaivonPulse({
    focusDate: "2026-10-20",
    isToday: true,
    fallback: { revenue: 115, profit: 0, cashIn: 115, newCredit: null },
  });
  // newCredit null via incomplete path — force nulls
  const inc2 = buildZaivonPulse({ focusDate: "2026-10-20", isToday: true });
  assert(inc2.insightKind === "incompleto", "sem dados → incompleto");

  // Persistido 19/10
  const diary = await getDiaryEntry("salgados", "2026-10-19");
  assert(!!diary?.dayClosing, "diário 19 com dayClosing");
  const live = buildZaivonPulse({
    focusDate: "2026-10-19",
    isToday: false,
    diary,
  });
  assert(live.metrics.cashIn === 118, "live caixa 118");
  assert(live.metrics.competenceProfit === 60, "live lucro 60");
  assert(Math.abs((live.metrics.newCredit ?? 0) - 52) < 0.01, "live fiados 52");

  // Sem fictícios
  const blob = JSON.stringify(live);
  assert(!/fictíc|demonstrativ|laborat/i.test(blob), "sem copy de laboratório");

  void inc;
  console.log("ASSERT_PULSE_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
