/**
 * Leitura canônica de 20/10 — não grava.
 * Sem argumentos: fixture do fechamento homologado.
 * Com --live: relê o banco e aplica os mesmos batimentos.
 */
import "./load-env";
import { and, eq } from "drizzle-orm";
import { CLOSING_2026_10_20 } from "../src/lib/finance/day-closing";
import {
  buildOperationalReading,
  type DashboardDayReading,
  type ReadingSale,
  type ReadingSettlement,
} from "../src/lib/finance/operational-reading";
import {
  INITIAL_MONEY_VISIBILITY,
  allMoneyHidden,
  isLegacyVisibilityKey,
  isMoneyHidden,
  maskSensitiveText,
  redactPatrimonyText,
  toggleGlobalMoney,
  toggleScreenMoney,
} from "../src/lib/privacy/money-visibility";
import { getDiaryEntry } from "../src/lib/diary-service";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { toDbBusinessId } from "../src/platform/db/business-id";
import { clients, products, saleItems, sales } from "../src/lib/db/postgres/schema";
import { queryAll } from "../src/platform/db/query";
import { listSettingsMap } from "../src/platform/db/repositories/settings-repository";

const JP = "João Pedro De Souza Pereira Marques";
const RAIMUNDA = "Raimunda Raimunda Sousa";

const FIXTURE_SALES: ReadingSale[] = [
  {
    id: "jp",
    time: "15:51",
    clientName: JP,
    quantity: 2,
    total: 10,
    product: "salgado",
    channel: "Acal",
    paymentStatus: "paid",
    notes:
      "HOMOLOG-2010#19 15:51 Acal 2 salgados R$10. Parte de um Pix de R$15. Inferência aprovada pelo proprietário em 20/10/2026, não confirmada pelo pagador.",
  },
  {
    id: "cicero-a",
    time: "09:00",
    clientName: "Cicero Carlos Azevedo Dos Santos",
    quantity: 1,
    total: 5,
    product: "salgado",
    channel: "Acal",
    paymentStatus: "paid",
    notes: "HOMOLOG-2010#09 09:00 Acal 1 salgado R$5. Primeiro Pix do Cícero. Confirmado.",
  },
  {
    id: "cicero-b",
    time: "09:10",
    clientName: "Cicero Carlos Azevedo Dos Santos",
    quantity: 1,
    total: 5,
    product: "salgado",
    channel: "Acal",
    paymentStatus: "paid",
    notes: "HOMOLOG-2010#11 09:10 Acal 1 salgado R$5. Segundo Pix do Cícero, distinto do das 09:00. Confirmado.",
  },
  {
    id: "resto",
    time: "10:00",
    clientName: "Demais vendas pagas",
    quantity: 24,
    total: 120,
    product: "salgado",
    channel: "Acal",
    paymentStatus: "paid",
    notes: "Agregado de teste das outras vendas pagas. Confirmado.",
  },
  {
    id: "jv",
    time: "16:40",
    clientName: "João Victor dos Santos Carvalho",
    quantity: 1,
    total: 5,
    product: "salgado",
    channel: "Unifor",
    paymentStatus: "pending",
    notes: "Horário não informado na nota 2; 16:40 é âncora técnica do fechamento físico, não a hora da retirada.",
  },
  {
    id: "gabi",
    time: "16:40",
    clientName: "Gabriela Barreto Vasconcelos",
    quantity: 1,
    total: 5,
    product: "salgado",
    channel: "Unifor",
    paymentStatus: "pending",
    notes: "Horário não informado na nota 2; 16:40 é âncora técnica.",
  },
  {
    id: "luiza",
    time: "16:40",
    clientName: "Luiza Marinho",
    quantity: 1,
    total: 8,
    product: "sanduiche",
    channel: "Unifor",
    paymentStatus: "pending",
    notes: "Horário não informado na nota 2; 16:40 é âncora técnica.",
  },
  {
    id: "mik-1",
    time: "16:40",
    clientName: "Maria Mikelly Monteiro Coutinho",
    quantity: 1,
    total: 7,
    product: "sanduiche",
    channel: "Acal",
    paymentStatus: "pending",
    notes: "Retirada 1 de 2. Horário individual não informado na nota 2; 16:40 é âncora técnica.",
  },
  {
    id: "mik-2",
    time: "16:40",
    clientName: "Maria Mikelly Monteiro Coutinho",
    quantity: 1,
    total: 7,
    product: "sanduiche",
    channel: "Acal",
    paymentStatus: "pending",
    notes: "Retirada 2 de 2. Horário individual não informado na nota 2; 16:40 é âncora técnica.",
  },
];

const FIXTURE_EXTRAS: ReadingSettlement[] = [
  {
    id: "homolog-2010-raimunda-5",
    person: RAIMUNDA,
    originDate: "2026-10-19",
    paidDate: "2026-10-20",
    amount: 5,
    note: "HOMOLOG-2010 R2. Quitação confirmada. Pix 09:58 R$20; os outros R$15 são bônus. Sem linha nominal.",
  },
  {
    id: "homolog-2010-joaopedro-5",
    person: JP,
    originDate: "2026-10-20",
    paidDate: "2026-10-20",
    amount: 5,
    note: "HOMOLOG-2010 R1. Quitação presumida NÃO VINCULADA. Pix 15:51 R$15. Inferência aprovada pelo proprietário, não confirmada pelo pagador.",
  },
];

function assertReading(reading: DashboardDayReading, label: string): string[] {
  const problems: string[] = [];
  const near = (got: number, want: number, name: string) => {
    if (Math.abs(got - want) > 0.02) problems.push(`${label} ${name}: ${got} ≠ ${want}`);
  };
  near(reading.entries, 165, "entradas");
  near(reading.cashResult, 115, "resultado");
  near(reading.ownCost, 50, "custo real");
  near(reading.theoreticalCost ?? -1, 107, "custo teórico");
  near(reading.competence, 172, "competência");
  near(reading.salesReceived, 140, "vendas pagas");
  near(reading.newCredit, 32, "fiados");
  near(reading.priorSettlements, 10, "quitações");
  near(reading.otherInflows, 15, "bônus");
  near(reading.deposit, 115, "depósito");
  near(reading.unclassifiedBankDelta ?? -1, 2.19, "Δ bancário");
  if (reading.warnings.length) problems.push(`${label} avisos: ${reading.warnings.join(" | ")}`);

  const alloc = reading.receipts.flatMap((r) => r.allocations).reduce((s, a) => s + a.amount, 0);
  near(alloc, 165, "soma das alocações");
  const gross = reading.receipts.reduce((s, r) => s + r.gross, 0);
  near(gross, 165, "soma dos recebimentos");

  const jp = reading.receipts.find((r) => r.payer === JP);
  if (!jp || Math.abs(jp.gross - 15) > 0.02 || jp.allocations.length !== 2) {
    problems.push(`${label} João Pedro deveria ser um Pix de 15 com duas destinações`);
  } else if (jp.confidence !== "inferred_approved") {
    problems.push(`${label} João Pedro deveria ficar como inferência aprovada`);
  }
  const rm = reading.receipts.find((r) => r.payer === RAIMUNDA);
  if (!rm || Math.abs(rm.gross - 20) > 0.02 || rm.allocations.length !== 2) {
    problems.push(`${label} Raimunda deveria ser um Pix de 20 com duas destinações`);
  }
  const cicero = reading.receipts.filter((r) => r.payer.includes("Cicero"));
  if (label === "fixture" && cicero.length !== 2) problems.push("Cícero ficou agrupado");

  if (reading.credits.length !== 5) problems.push(`${label} fiados ${reading.credits.length}`);
  if (reading.credits.some((c) => c.time != null)) problems.push(`${label} fiado ganhou horário que a nota não tem`);
  if (reading.stock.sandwichesCounted !== 2) problems.push(`${label} sanduíches restantes`);

  const dumped = JSON.stringify(reading);
  for (const leaked of ["5091", "4974", "4976"]) {
    if (dumped.includes(leaked)) problems.push(`${label} vazou patrimônio ${leaked}`);
  }
  const ids = reading.caveats.map((c) => c.id);
  for (const id of ["R1", "R2", "R3", "R4", "R5", "R6"]) {
    if (!ids.includes(id)) problems.push(`${label} sem ${id}`);
  }
  return problems;
}

function assertPrivacy(): string[] {
  const problems: string[] = [];
  if (!allMoneyHidden(INITIAL_MONEY_VISIBILITY)) problems.push("estado inicial não está oculto");
  if (!isMoneyHidden(INITIAL_MONEY_VISIBILITY, "dashboard")) problems.push("dashboard nasce visível");
  const shown = toggleScreenMoney(INITIAL_MONEY_VISIBILITY, "v2-hoje", ["v2-hoje", "dashboard"]);
  if (isMoneyHidden(shown, "v2-hoje")) problems.push("a tela revelada continuou oculta");
  if (!isMoneyHidden(shown, "dashboard")) problems.push("revelar uma tela revelou as outras");
  const again = toggleGlobalMoney(shown);
  if (!allMoneyHidden(again)) problems.push("o olhinho geral não ocultou tudo");
  const reloaded = INITIAL_MONEY_VISIBILITY;
  if (!isMoneyHidden(reloaded, "v2-hoje")) problems.push("recarga não volta a ocultar");
  if (!isLegacyVisibilityKey("zaivon-hide-money:dashboard") || !isLegacyVisibilityKey("lbo-hide-money")) {
    problems.push("chave antiga não reconhecida para descarte");
  }
  const redacted = redactPatrimonyText(
    "FINANCEIRO CONCILIADO — DEPÓSITO R$115 — SALDO INFORMADO R$5.091,80 — Δ+2,19 NÃO CLASSIFICADO",
  );
  if (/5091|5\.091/.test(redacted)) problems.push(`redação ainda mostra saldo: ${redacted}`);
  if (!/115/.test(redacted)) problems.push("redação apagou o depósito");
  const masked = maskSensitiveText("Caixa R$ 165.00 e saldo 4.974,61", true);
  if (/165|4\.974/.test(masked)) problems.push(`máscara falhou: ${masked}`);
  return problems;
}

async function liveSales(): Promise<{ sales: ReadingSale[]; extras: ReadingSettlement[] }> {
  const db = await getPostgresDb();
  const biz = toDbBusinessId("salgados");
  const rows = await queryAll(
    db
      .select({
        id: sales.id,
        time: sales.saleTime,
        client: clients.name,
        qty: saleItems.quantity,
        total: sales.totalAmount,
        product: products.name,
        channel: sales.department,
        status: sales.paymentStatus,
        notes: sales.notes,
      })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .leftJoin(saleItems, eq(saleItems.saleId, sales.id))
      .leftJoin(products, eq(products.id, saleItems.productId))
      .where(and(eq(sales.businessId, biz), eq(sales.saleDate, "2026-10-20"))),
  );
  const meta = JSON.parse((await listSettingsMap()).omni_v2_meta_salgados ?? "{}") as {
    extraSettlements?: ReadingSettlement[];
  };
  return {
    sales: rows.map((r) => ({
      id: r.id,
      time: String(r.time).slice(0, 5),
      clientName: r.client,
      quantity: r.qty ?? 1,
      total: Number(r.total),
      product: (r.product ?? "").toLowerCase().includes("sandu") ? "sanduiche" : "salgado",
      channel: r.channel,
      paymentStatus: r.status,
      notes: r.notes,
    })),
    extras: (meta.extraSettlements ?? []).filter((s) => s.paidDate === "2026-10-20"),
  };
}

async function main() {
  const privacy = assertPrivacy();
  if (privacy.length) throw new Error(privacy.join("\n"));
  console.log("PRIVACY_OK");

  const fixture = buildOperationalReading({
    closing: CLOSING_2026_10_20,
    sales: FIXTURE_SALES,
    extraSettlements: FIXTURE_EXTRAS,
  });
  const fixtureProblems = assertReading(fixture, "fixture");
  if (fixtureProblems.length) throw new Error(fixtureProblems.join("\n"));
  console.log(
    `FIXTURE_OK recibos=${fixture.receipts.length} fiados=${fixture.credits.length} Δ=${fixture.unclassifiedBankDelta}`,
  );

  if (process.argv.includes("--live")) {
    const diary = await getDiaryEntry("salgados", "2026-10-20");
    if (!diary?.dayClosing) throw new Error("diário 20/10 ausente");
    const loaded = await liveSales();
    if (loaded.sales.length !== 25) throw new Error(`vendas ${loaded.sales.length} ≠ 25`);
    const live = buildOperationalReading({
      closing: diary.dayClosing,
      sales: loaded.sales,
      extraSettlements: loaded.extras,
    });
    const liveProblems = assertReading(live, "banco");
    const paid = loaded.sales.filter((s) => s.paymentStatus === "paid").length;
    const pending = loaded.sales.filter((s) => s.paymentStatus === "pending").length;
    if (paid !== 20 || pending !== 5) liveProblems.push(`linhas ${paid} pagas / ${pending} fiados`);
    if (liveProblems.length) throw new Error(liveProblems.join("\n"));
    console.log(`LIVE_OK recibos=${live.receipts.length} sem gravar`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
