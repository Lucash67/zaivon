/**
 * Vista Aurora de 20/10 — não grava.
 * Sem argumentos: giro, transferência e Pix mistos no fechamento homologado.
 * Com --live: relê o banco (25 lançamentos, 21 recebimentos, KPIs).
 */
import "./load-env";
import { CLOSING_2026_10_20 } from "../src/lib/finance/day-closing";
import { buildAuroraSnapshot, buildGiro, GIRO_FORMULA } from "../src/lib/finance/aurora-view";
import type { ReadingSale, ReadingSettlement } from "../src/lib/finance/operational-reading";
import { loadAuroraSnapshot } from "../src/lib/finance/aurora-load";

const JP = "João Pedro De Souza Pereira Marques";
const RAIMUNDA = "Raimunda Raimunda Sousa";

function near(a: number, b: number) {
  if (Math.abs(a - b) > 0.02) throw new Error(`${a} ≠ ${b}`);
}

const sales: ReadingSale[] = [
  {
    id: "jp",
    time: "15:51",
    clientName: JP,
    quantity: 2,
    total: 10,
    product: "salgado",
    channel: "Acal",
    paymentStatus: "paid",
    notes: "HOMOLOG-2010 15:51 Acal. Parte de um Pix de R$15. Inferência aprovada pelo proprietário, não confirmada pelo pagador.",
  },
  {
    id: "pago",
    time: "09:00",
    clientName: "Cicero Carlos Azevedo Dos Santos",
    quantity: 1,
    total: 130,
    product: "salgado",
    channel: "Acal",
    paymentStatus: "paid",
    notes: "09:00 Acal. Confirmado.",
  },
];

const extras: ReadingSettlement[] = [
  {
    id: "homolog-2010-joaopedro-5",
    person: JP,
    amount: 5,
    paidDate: "2026-10-20",
    originDate: "2026-10-20",
    note: "HOMOLOG-2010 R1. Pix 15:51 R$15. Inferência aprovada, não confirmada pelo pagador.",
  },
  {
    id: "homolog-2010-raimunda-5",
    person: RAIMUNDA,
    amount: 5,
    paidDate: "2026-10-20",
    originDate: "2026-10-19",
    note: "HOMOLOG-2010 R2. Pix 09:58 R$20. Os outros R$15 são bônus.",
  },
];

const fixture = buildAuroraSnapshot({
  from: "2026-10-20",
  to: "2026-10-20",
  profileName: "Lucas",
  days: [{ date: "2026-10-20", closing: CLOSING_2026_10_20, sales, extraSettlements: extras }],
});

const giro = buildGiro(CLOSING_2026_10_20.operationalAudit);
if (!giro?.formula.includes("Não é diagnóstico financeiro")) throw new Error("giro sem fórmula");
if (giro.formula !== GIRO_FORMULA) throw new Error("fórmula alterada");
if (giro.score !== 89) throw new Error(`giro ${giro.score}`);
if (!fixture.operation.transfer || fixture.operation.transfer.salgados !== 3 || fixture.operation.transfer.sandwiches !== 1) {
  throw new Error("transferência");
}
const jp = fixture.timeline.filter((event) => event.name === JP && event.value === 15);
const rm = fixture.timeline.filter((event) => event.name === RAIMUNDA && event.value === 20);
if (jp.length !== 1 || jp[0]!.allocations.length !== 2) throw new Error("joão pedro duplicado");
if (rm.length !== 1 || rm[0]!.allocations.length !== 2) throw new Error("raimunda duplicada");
if (JSON.stringify(fixture.caveats).match(/5091|4974|5\.091|4\.974/)) throw new Error("saldo vazou");
const empty = buildAuroraSnapshot({
  from: "2026-01-01",
  to: "2026-01-01",
  profileName: "Lucas",
  days: [{ date: "2026-01-01", closing: null, sales: [], extraSettlements: [] }],
});
if (empty.hasData || empty.metrics) throw new Error("dia vazio fabricou indicador");
console.log("FIXTURE_OK giro=89 transferência=3+1");

async function main() {
if (process.argv.includes("--live")) {
  const live = await loadAuroraSnapshot({ from: "2026-10-20", to: "2026-10-20", profileName: "Lucas" });
  if (!live.metrics) throw new Error("sem fechamento");
  near(live.metrics.entries, 165);
  near(live.metrics.cashResult, 115);
  near(live.metrics.ownCost, 50);
  near(live.metrics.competence, 172);
  near(live.metrics.salesReceived, 140);
  near(live.metrics.priorSettlements, 10);
  near(live.metrics.bonus, 15);
  near(live.metrics.newCredit, 32);
  near(live.metrics.deposit, 115);
  if (live.counts.salesTotal !== 25 || live.counts.salesPaid !== 20 || live.counts.salesPending !== 5) {
    throw new Error(`vendas ${live.counts.salesTotal}/${live.counts.salesPaid}/${live.counts.salesPending}`);
  }
  if (live.counts.receipts !== 21) throw new Error(`recebimentos ${live.counts.receipts}`);
  const cashEvents = live.timeline.filter((event) => event.type === "sale" || event.type === "settlement");
  if (cashEvents.length !== 21) throw new Error(`timeline caixa ${cashEvents.length}`);
  near(cashEvents.reduce((sum, event) => sum + (event.value ?? 0), 0), 165);
  const liveJp = cashEvents.filter((event) => /jo[aã]o pedro de souza/i.test(event.name));
  const liveRm = cashEvents.filter((event) => /raimunda/i.test(event.name));
  if (liveJp.length !== 1 || liveJp[0]!.value !== 15 || liveJp[0]!.allocations.length < 2) throw new Error("jp live");
  if (liveRm.length !== 1 || liveRm[0]!.value !== 20) throw new Error("raimunda live");
  if (live.fiados.length !== 5) throw new Error(`fiados ${live.fiados.length}`);
  near(live.fiados.reduce((sum, item) => sum + item.value, 0), 32);
  const ids = ["R1", "R2", "R3", "R4", "R5", "R6"];
  if (!ids.every((id) => live.caveats.some((item) => item.id === id))) throw new Error("ressalvas");
  if (JSON.stringify(live).match(/5091|4974|5\.091|4\.974|4\.976/)) throw new Error("saldo no payload");
  if (live.operation.sandwiches?.remaining !== 2 || live.operation.sandwiches.sold !== 5) throw new Error("sanduíches");
  if (live.operation.salgados?.moved !== 27) throw new Error("salgados");
  console.log("LIVE_OK vendas=25 recebimentos=21 sem gravar");

  const day19 = await loadAuroraSnapshot({ from: "2026-10-19", to: "2026-10-19", profileName: "Lucas" });
  if (!day19.metrics) throw new Error("19/10 sem fechamento");
  near(day19.metrics.entries, 118);
  near(day19.metrics.competence, 170);
  near(day19.metrics.ownCost, 110);
  near(day19.metrics.deposit, 118);
  near(day19.metrics.cashResult, 8);

  const period = await loadAuroraSnapshot({ from: "2026-10-19", to: "2026-10-20", profileName: "Lucas" });
  if (!period.metrics) throw new Error("período sem fechamento");
  near(period.metrics.entries, 283);
  near(period.metrics.cashResult, 123);
  near(period.metrics.ownCost, 160);
  near(period.metrics.deposit, 233);
  near(period.metrics.competence, 342);
  if (period.counts.receipts < 21) throw new Error("período perdeu recebimentos");
  if (period.giro != null) throw new Error("giro de período não deve ser um score único");

  const blank = await loadAuroraSnapshot({ from: "2026-01-02", to: "2026-01-02", profileName: "Lucas" });
  if (blank.hasData) throw new Error("02/01 fabricou fechamento");
  console.log("PERIODO_OK 19/10 + 19–20/10 + dia vazio");
}
process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
