/**
 * Registra 07/10, 08/10 e 09/10/2026 — Salgados + Sanduíche Natural.
 * Uso: pnpm tsx scripts/register-days-0710-0910.ts
 *
 * Critério: só o que é consistente, priorizando o financeiro (caixa, meu custo, lucro).
 * Custo dos sanduíches desconsiderado — vale o meu custo total final do dia.
 *   07/10 · caixa R$213 · meu custo R$100 · lucro R$113 · cofrinho R$4.117,83
 *   08/10 · caixa R$203 · meu custo R$100 · lucro R$103 · cofrinho R$4.222,65
 *   09/10 · caixa R$214 · meu custo R$64  · lucro R$150 · cofrinho R$4.374,55
 * Recuperação/quitação só conta a partir de 09/10; não identificados de 08/10 viram perda.
 */
import "./load-env";
import { and, eq, inArray } from "drizzle-orm";
import { cleanupOperationDay } from "./cleanup-operation-day";
import { commitDayRegistration } from "../src/lib/day-registration/day-registration-service";
import { sanitizeRegistrationPlan } from "../src/lib/day-registration/plan-sanitize";
import type { DayRegistrationPlan, DraftSale } from "../src/lib/day-registration/types";
import { getDiaryEntry, upsertDiaryEntry } from "../src/lib/diary-service";
import { setPracticalProfitBankBalance } from "../src/lib/profit-bank-service";
import { UNIDENTIFIED_FLAVOR_PRODUCT_NAME } from "../src/lib/salgados-flavors";
import { getPostgresDb } from "../src/platform/db/postgres/client";
import { toDbBusinessId } from "../src/platform/db/business-id";
import { clients, saleItems, sales } from "../src/lib/db/postgres/schema";
import { queryAll, queryRun } from "../src/platform/db/query";
import { countSalesForDate } from "@/platform/db/repositories/sale-repository";
import { getProductById, listProducts, updateProduct } from "@/platform/db/repositories/product-repository";
import { listStickyNotes } from "@/platform/db/repositories/sticky-note-repository";

const BUSINESS = "salgados";
const OWNER_ID = "55c8453d-509f-4ed2-a7f4-180faa4673e4";
const SANDUICHE = "Sanduíche Natural";
const SANDUICHE_COST = 1.9;

const HENRIQUE = "Henrique Alberto Matos Da Rocha";
const JV = "João Victor dos Santos Carvalho";
const MIKELLY = "Maria Mikelly Monteiro Coutinho";
const LAURA = "Ana Laura";
const NAYANA = "Nayana Lemos Galvão";
const RIAN = "Rian Nestor";
const VANDERSON = "Francisco Vanderson Dias";
const ANDERSON = "Francisco Anderson Das Chagas Xavier Rocha";
const MEIA_SOLA = "Clientes da Meia Sola";
const ESPECIE_0810 = "Cliente espécie não identificado (08/10)";
const NI_0910 = "Cliente Não Identificado (2026-10-09)";

const SALE_LINE =
  /^(?:\d+\.\s*)?(\d{1,2}:\d{2})\s*[—-]\s*(.+?)\s*[—-]\s*(\d+)\s*salgados?\s*[—-]\s*R\$\s*([\d.,]+)(.*)$/i;

/** Venda com preço real por unidade (o commit grava tudo a R$5; corrigido depois). */
interface PricedSale {
  sale: DraftSale;
  unitPrice: number;
  sandwich: boolean;
}

function salgado(
  partial: Partial<DraftSale> & Pick<DraftSale, "time" | "clientName" | "quantity">,
): PricedSale {
  return {
    sale: {
      productName: UNIDENTIFIED_FLAVOR_PRODUCT_NAME,
      paymentMethod: "pix",
      paymentStatus: "paid",
      department: "Acal",
      ...partial,
    },
    unitPrice: 5,
    sandwich: false,
  };
}

function sanduiche(
  partial: Partial<DraftSale> & Pick<DraftSale, "time" | "clientName" | "quantity" | "department">,
  unitPrice: number,
): PricedSale {
  return {
    sale: { productName: SANDUICHE, paymentMethod: "pix", paymentStatus: "paid", ...partial },
    unitPrice,
    sandwich: true,
  };
}

async function parseSalgadoLines(date: string): Promise<{ time: string; clientName: string; quantity: number }[]> {
  const notes = await listStickyNotes(OWNER_ID);
  const bodies = notes.filter((n) => n.noteDate === date).map((n) => n.body);
  const out: { time: string; clientName: string; quantity: number }[] = [];
  for (const body of bodies) {
    for (const raw of body.split(/\r?\n/)) {
      const m = raw.trim().match(SALE_LINE);
      if (!m) continue;
      out.push({ time: m[1].padStart(5, "0"), clientName: m[2].trim(), quantity: Number(m[3]) });
    }
  }
  return out;
}

async function ensureSandwichProduct(): Promise<void> {
  const products = await listProducts(BUSINESS);
  const match = products.find((p) => p.name === SANDUICHE);
  if (!match) return;
  const product = await getProductById(match.id);
  if (!product) return;
  await updateProduct({
    id: product.id,
    name: product.name,
    category: "Sanduíches",
    price: 7,
    cost: SANDUICHE_COST,
    stockQuantity: product.stockQuantity,
    minStock: product.minStock,
    status: product.status,
  });
}

/** Ajusta preço/custo de cada venda (sanduíche R$7/R$8, salgado R$5). */
async function applyRealPrices(saleIds: string[], priced: PricedSale[]): Promise<void> {
  const db = await getPostgresDb();
  for (let i = 0; i < saleIds.length; i += 1) {
    const { unitPrice, sandwich, sale } = priced[i];
    const items = await queryAll(db.select().from(saleItems).where(eq(saleItems.saleId, saleIds[i])));
    let total = 0;
    let cost = 0;
    for (const item of items) {
      const unitCost = sandwich ? SANDUICHE_COST : Number(item.unitCost);
      const subtotal = unitPrice * item.quantity;
      const itemCost = unitCost * item.quantity;
      total += subtotal;
      cost += itemCost;
      await queryRun(
        db
          .update(saleItems)
          .set({
            unitPrice: unitPrice.toFixed(2),
            unitCost: unitCost.toFixed(2),
            subtotal: subtotal.toFixed(2),
            profit: (subtotal - itemCost).toFixed(2),
          })
          .where(eq(saleItems.id, item.id)),
      );
    }
    const paid = (sale.paymentStatus ?? "paid") === "paid";
    await queryRun(
      db
        .update(sales)
        .set({
          totalAmount: total.toFixed(2),
          totalCost: cost.toFixed(2),
          profit: (total - cost).toFixed(2),
          amountReceived: paid ? total.toFixed(2) : "0.00",
          updatedAt: new Date(),
        })
        .where(eq(sales.id, saleIds[i])),
    );
  }
}

/** Marca como quitados os fiados de um cliente numa data de origem. */
async function settle(clientName: string, saleDate: string, settlementDate: string, note: string): Promise<void> {
  const db = await getPostgresDb();
  const rows = await queryAll(
    db
      .select({ id: sales.id, total: sales.totalAmount })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(
        and(
          eq(sales.businessId, toDbBusinessId(BUSINESS)),
          eq(sales.saleDate, saleDate),
          inArray(sales.paymentStatus, ["pending", "partial"]),
          eq(clients.name, clientName),
        ),
      ),
  );
  if (rows.length === 0) throw new Error(`Fiado não encontrado: ${clientName} em ${saleDate}`);
  for (const row of rows) {
    await queryRun(
      db
        .update(sales)
        .set({
          paymentStatus: "paid",
          amountReceived: row.total,
          settlementDate,
          notes: note,
          updatedAt: new Date(),
        })
        .where(eq(sales.id, row.id)),
    );
  }
  console.log(`  ✓ quitado ${clientName} (${saleDate}) em ${settlementDate}`);
}

interface DaySpec {
  date: string;
  priced: PricedSale[];
  purchase: DayRegistrationPlan["purchase"];
  profit: number;
  received: number;
  pending: number;
  sold: number;
  lost: number;
  paidCount: number;
  creditCount: number;
  lossReason?: string;
  observations: string[];
  manualInsights: string;
  lessonsLearned?: string;
  newClientSectors: Record<string, string>;
}

async function registerDay(spec: DaySpec): Promise<void> {
  const { date, priced } = spec;
  console.log(`\n======== SALGADOS ${date} ========`);
  await cleanupOperationDay(BUSINESS, date);
  const existing = await countSalesForDate(BUSINESS, date);
  if (existing > 0) throw new Error(`${date}: ainda ${existing} venda(s) após cleanup`);

  const names = Array.from(new Set(priced.map((p) => p.sale.clientName)));
  const plan: DayRegistrationPlan = {
    businessId: BUSINESS,
    date,
    purchase: spec.purchase,
    summary: {
      revenue: spec.received,
      profit: spec.profit,
      quantitySold: spec.sold,
      quantityLost: spec.lost,
      lossReason: spec.lossReason,
      forecastProfit: 77,
    },
    sales: priced.map((p) => p.sale),
    newClients: names.map((name) => ({
      name,
      sector: spec.newClientSectors[name] ?? priced.find((p) => p.sale.clientName === name)!.sale.department,
    })),
    observations: spec.observations.join("\n"),
    manualInsights: spec.manualInsights,
    lessonsLearned: spec.lessonsLearned,
  };

  const result = await commitDayRegistration(sanitizeRegistrationPlan(plan));
  if (result.saleIds.length !== priced.length) {
    throw new Error(`${date}: ${result.saleIds.length} vendas gravadas, esperado ${priced.length}`);
  }
  await ensureSandwichProduct();
  await applyRealPrices(result.saleIds, priced);

  // Sem fixDayPricing: preços diferentes por produto (sanduíche R$7/R$8) e ele reescreveria tudo a R$5.
  const entry = await getDiaryEntry(BUSINESS, date);
  if (!entry) throw new Error(`${date}: diário ausente`);
  await upsertDiaryEntry({
    ...entry,
    profit: spec.profit,
    bonusIncome: 0,
    quantitySold: spec.sold,
    quantityLost: spec.lost,
    lossReason: spec.lossReason,
    revenue: { received: spec.received, pending: spec.pending, total: spec.received + spec.pending },
    observations: plan.observations,
    manualInsights: spec.manualInsights,
    lessonsLearned: spec.lessonsLearned,
    sales: { paidCount: spec.paidCount, creditCount: spec.creditCount },
  });

  const saved = await getDiaryEntry(BUSINESS, date);
  if (!saved || saved.profit !== spec.profit || saved.revenue.received !== spec.received || saved.revenue.pending !== spec.pending) {
    throw new Error(`${date}: diário não fechou`);
  }
  console.log(
    `✅ ${date} OK — lucro R$${saved.profit} · rec R$${spec.received} · pend R$${spec.pending} · vendidos ${saved.quantitySold} · perdas ${saved.quantityLost} · ${priced.length} linhas`,
  );
}

const SALGADOS_PRODUCTS_0710 = [
  { name: "Mistão Frito", quantity: 12 },
  { name: "Queijo Frito", quantity: 8 },
  { name: "Mistão de Forno", quantity: 6 },
  { name: "Frango com Catupiry", quantity: 6 },
  { name: "Coxinha", quantity: 5 },
  { name: "Croissant", quantity: 4 },
  { name: "Carne com Cheddar de Forno", quantity: 4 },
];

const SALGADOS_PRODUCTS_STD = [
  { name: "Mistão Frito", quantity: 10 },
  { name: "Coxinha", quantity: 10 },
  { name: "Queijo Frito", quantity: 6 },
  { name: "Frango com Catupiry", quantity: 4 },
  { name: "Mistão de Forno", quantity: 3 },
  { name: "Carne com Cheddar de Forno", quantity: 1 },
  { name: "Croissant", quantity: 1 },
];

const SALGADOS_PRODUCTS_0910 = [
  { name: "Mistão Frito", quantity: 9 },
  { name: "Coxinha", quantity: 6 },
  { name: "Queijo Frito", quantity: 6 },
  { name: "Frango com Catupiry", quantity: 4 },
  { name: "Mistão de Forno", quantity: 4 },
  { name: "Carne com Cheddar de Forno", quantity: 1 },
  { name: "Croissant", quantity: 1 },
];

function sumUnits(priced: PricedSale[], sandwich: boolean): number {
  return priced.filter((p) => p.sandwich === sandwich).reduce((s, p) => s + p.sale.quantity, 0);
}

async function day0710(): Promise<void> {
  const date = "2026-10-07";
  const lines = await parseSalgadoLines(date);
  const listed = lines.reduce((s, l) => s + l.quantity, 0);
  if (listed !== 38) throw new Error(`07/10: lista com ${listed} salgados, esperado 38`);

  const priced: PricedSale[] = lines.map((l) =>
    l.clientName === ANDERSON
      ? salgado({ ...l, quantity: 1, notes: "Linha de R$15: 1 un do dia + R$10 de quitação do fiado de 06/10." })
      : salgado(l),
  );
  priced.push(
    salgado({ time: "17:00", clientName: JV, quantity: 1, paymentStatus: "pending", notes: "Fiado 07/10 — quitado 08/10." }),
    salgado({ time: "17:01", clientName: RIAN, quantity: 1, paymentStatus: "pending", notes: "Fiado 07/10 — quitado 09/10." }),
    salgado({ time: "17:02", clientName: HENRIQUE, quantity: 1, paymentStatus: "pending", notes: "Fiado 07/10 — quitado 09/10." }),
    sanduiche({ time: "09:17", clientName: "Venda com Tap to Pay", quantity: 1, department: "Unifor" }, 8),
    sanduiche({ time: "09:23", clientName: "Mariana Lourenço Mendes", quantity: 1, department: "Unifor" }, 8),
    sanduiche({ time: "10:19", clientName: "Fernando Martins Cruz", quantity: 1, department: "Acal" }, 7),
    sanduiche({ time: "17:10", clientName: MIKELLY, quantity: 2, department: "Acal", paymentStatus: "pending", notes: "Fiado 07/10 — 2 sanduíches R$14." }, 7),
    sanduiche({ time: "17:11", clientName: NAYANA, quantity: 1, department: "Acal", paymentStatus: "pending", notes: "Fiado 07/10 — quitado 08/10." }, 7),
    sanduiche({ time: "17:12", clientName: LAURA, quantity: 1, department: "Acal", paymentStatus: "pending", notes: "Fiado 07/10 — 1 sanduíche R$7." }, 7),
  );

  await registerDay({
    date,
    priced,
    purchase: {
      totalUnits: 35,
      investment: 108,
      ownInvestment: 100,
      thirdParty: { name: "Terceiros", amount: 8 },
      products: SALGADOS_PRODUCTS_0710,
    },
    profit: 113,
    received: 213,
    pending: 43,
    sold: 45,
    lost: 0,
    paidCount: 38,
    creditCount: 7,
    newClientSectors: { [HENRIQUE]: "Colegas do Henrique" },
    observations: [
      "Considerado só o consistente (financeiro primeiro).",
      "Salgados: 35 comprados (R$108) · 35 vendidos · 0 perdas. Sanduíches: 10 levados · 6 pagos + 4 fiados.",
      "Caixa R$213 = R$203 do dia + R$10 quitação Anderson das Chagas (fiado de 06/10 fora do sistema).",
      "Meu custo R$100 · terceiros R$8 · custo dos sanduíches desconsiderado. Lucro R$113 = 213 − 100.",
      "Fiados do dia: JV R$5, Rian Nestor R$5, Henrique R$5 (salgados) · Mikelly R$14, Nayana R$7, Laura R$7 (sanduíches).",
      "2 sanduíches saíram a R$5 (sem cartaz de R$7) e estão dentro das linhas de salgado da lista; a lista tem 36 un de salgado contra 35 reais.",
      "Espécie: Jamile R$20 e menina do CPA R$10, trocados com o Henrique.",
      "Cofrinho prático R$4.117,83 (+R$114,67 = 113 + R$1,67 rendimento).",
    ],
    manualInsights: "Primeiro dia de sanduíche natural: 10 levados, todos saíram (6 pagos, 4 fiados).",
    lessonsLearned: "Colocar cartaz com o preço do sanduíche (R$7 Acal / R$8 Unifor).",
  });
}

async function day0810(): Promise<void> {
  const date = "2026-10-08";
  const lines = await parseSalgadoLines(date);
  const listed = lines.reduce((s, l) => s + l.quantity, 0);
  if (listed !== 32) throw new Error(`08/10: lista com ${listed} salgados, esperado 32`);

  const daySalgados = lines.filter((l) => !(l.clientName.toLowerCase().startsWith("joao victor") && l.time === "08:50"));
  const priced: PricedSale[] = daySalgados.map((l) => salgado(l));
  priced.push(
    salgado({ time: "16:30", clientName: JV, quantity: 1, paymentStatus: "pending", notes: "Fiado 08/10 — quitado 09/10." }),
    salgado({
      time: "16:31",
      clientName: ESPECIE_0810,
      quantity: 1,
      department: "Unifor",
      paymentMethod: "cash",
      paymentStatus: "pending",
      notes: "R$5 em espécie, trocado com o Henrique em 09/10.",
    }),
    sanduiche({ time: "09:09", clientName: "Yonara Bernardo Cabral", quantity: 1, department: "Acal" }, 7),
    sanduiche({ time: "09:55", clientName: "Maria Luiza Marinho Rocha", quantity: 1, department: "Unifor" }, 8),
    sanduiche({ time: "13:23", clientName: NAYANA, quantity: 1, department: "Acal", notes: "Linha de R$14: 1 sanduíche do dia + R$7 de quitação de 07/10." }, 7),
    sanduiche({ time: "15:10", clientName: "Mardem Leandro De Almeida Adonias", quantity: 1, department: "Acal" }, 7),
    sanduiche({ time: "15:10", clientName: "Aline Maria Bezerra De Sena", quantity: 1, department: "Acal" }, 7),
  );
  if (sumUnits(priced, false) !== 32) throw new Error(`08/10: ${sumUnits(priced, false)} salgados nas vendas, esperado 32`);

  await registerDay({
    date,
    priced,
    purchase: {
      totalUnits: 35,
      investment: 108,
      ownInvestment: 100,
      thirdParty: { name: "Terceiros", amount: 8 },
      products: SALGADOS_PRODUCTS_STD,
    },
    profit: 103,
    received: 203,
    pending: 10,
    sold: 37,
    lost: 6,
    lossReason: "3 salgados e 3 sanduíches não identificados/não pagos — considerados perda.",
    paidCount: 35,
    creditCount: 2,
    newClientSectors: { [ESPECIE_0810]: "Unifor" },
    observations: [
      "Considerado só o consistente (financeiro primeiro).",
      "Salgados: 35 comprados (R$108) · 30 pagos + JV 1 fiado + 1 em espécie (Unifor) · 3 perdas (não identificados).",
      "Sanduíches: 16 levados · 5 pagos · 8 sobraram para 09/10 · 3 perdas (não identificados).",
      "Caixa R$203 = R$186 do dia + quitações R$17 (JV R$10 de 06/10 e 07/10, Nayana R$7 de 07/10).",
      "Meu custo R$100 · terceiros R$8 · custo dos sanduíches desconsiderado. Lucro R$103 = 203 − 100.",
      "Recuperação de não identificados só a partir de 09/10 — os de 08/10 ficam como perda.",
      "Cofrinho prático R$4.222,65 (+R$104,82 = 103 + R$1,82 rendimento).",
    ],
    manualInsights: "Sanduíches: venda menor (5 de 16) e 3 sumiram sem pagamento.",
    lessonsLearned: "Controlar a saída dos sanduíches na Acal para não ter unidades sem dono.",
  });

  await settle(JV, "2026-10-06", date, "Fiado 06/10 quitado em 08/10 (JV pagou R$10 por 06/10 e 07/10).");
  await settle(JV, "2026-10-07", date, "Fiado 07/10 quitado em 08/10 (JV pagou R$10 por 06/10 e 07/10).");
  await settle(NAYANA, "2026-10-07", date, "Fiado 07/10 quitado em 08/10.");
}

async function day0910(): Promise<void> {
  const date = "2026-10-09";
  const lines = await parseSalgadoLines(date);
  const listed = lines.reduce((s, l) => s + l.quantity, 0);
  if (listed !== 31) throw new Error(`09/10: lista com ${listed} salgados, esperado 31`);

  const settlements = new Set([`11:17|${JV.toLowerCase()}`, `12:46|${HENRIQUE.toLowerCase()}`]);
  const isSettlement = (l: { time: string; clientName: string }) =>
    l.time === "11:17" ? l.clientName.toLowerCase().startsWith("joao victor") : settlements.has(`${l.time}|${l.clientName.toLowerCase()}`);

  const priced: PricedSale[] = lines.filter((l) => !isSettlement(l)).map((l) => salgado(l));
  priced.push(
    salgado({ time: "10:03", clientName: "Ana Angelica Magalhaes Martins", quantity: 2, notes: "Linha de R$24: 2 salgados + 2 sanduíches Acal." }),
    salgado({ time: "16:40", clientName: NI_0910, quantity: 2, paymentStatus: "pending", notes: "2 salgados pegos sem aviso — em investigação." }),
    sanduiche({ time: "10:02", clientName: "Joao Guilherme Da Silva Lima", quantity: 2, department: "Acal" }, 7),
    sanduiche({ time: "10:03", clientName: "Ana Angelica Magalhaes Martins", quantity: 2, department: "Acal" }, 7),
    sanduiche({ time: "13:20", clientName: "João Pedro Pinto De Farias", quantity: 1, department: "Acal" }, 7),
    sanduiche({ time: "16:14", clientName: "Cleane Cipriano Pereira", quantity: 1, department: "Acal" }, 7),
    sanduiche({
      time: "16:30",
      clientName: "Maria Clara Gomes Mororo",
      quantity: 1,
      department: "Acal",
      paymentMethod: "cash",
      notes: "Deu R$100 em espécie, voltei R$93 (trocado com o Henrique).",
    }, 7),
    sanduiche({ time: "16:41", clientName: MIKELLY, quantity: 1, department: "Acal", paymentStatus: "pending", notes: "Fiado 09/10." }, 7),
    sanduiche({ time: "16:42", clientName: VANDERSON, quantity: 1, department: "Acal", paymentStatus: "pending", notes: "Fiado 09/10." }, 7),
    sanduiche({ time: "16:43", clientName: LAURA, quantity: 1, department: "Acal", paymentStatus: "pending", notes: "Fiado 09/10." }, 7),
    sanduiche({ time: "16:44", clientName: NI_0910, quantity: 1, department: "Acal", paymentStatus: "pending", notes: "1 sanduíche sem dono — em investigação." }, 7),
    sanduiche({ time: "12:00", clientName: MEIA_SOLA, quantity: 4, department: "Meia Sola", paymentStatus: "pending", notes: "4 sanduíches a R$8 — a receber." }, 8),
  );
  if (sumUnits(priced, false) !== 32) throw new Error(`09/10: ${sumUnits(priced, false)} salgados nas vendas, esperado 32`);
  if (sumUnits(priced, true) !== 15) throw new Error(`09/10: ${sumUnits(priced, true)} sanduíches nas vendas, esperado 15`);

  await registerDay({
    date,
    priced,
    purchase: {
      totalUnits: 31,
      investment: 96,
      ownInvestment: 64,
      thirdParty: { name: "Terceiros", amount: 32 },
      products: SALGADOS_PRODUCTS_0910,
    },
    profit: 150,
    received: 214,
    pending: 70,
    sold: 46,
    lost: 0,
    paidCount: 36,
    creditCount: 10,
    newClientSectors: { [MEIA_SOLA]: "Meia Sola", [NI_0910]: "Acal" },
    observations: [
      "Considerado só o consistente (financeiro primeiro) — fechamento mestre de 09/10.",
      "Salgados: 31 comprados (R$96) · 29 pagos + 2 não identificados (em investigação).",
      "A lista tem 30 un de salgado do dia: 1 linha é a quitação do Rian Nestor (não identificada na lista).",
      "Sanduíches: 15 (Acal 11 = 3 novos + 8 de 08/10; Meia Sola 4) · 7 pagos R$49 · 3 fiados · 1 não identificado · Meia Sola R$32 a receber.",
      "Caixa R$214 = R$194 do dia + quitações R$20 (JV, Henrique 07/10, Henrique espécie 08/10, Rian).",
      "Meu custo R$64 · terceiros na compra de salgados R$32 (a nota traz R$60,50 contando os sanduíches; custo deles desconsiderado). Lucro R$150 = 214 − 64.",
      "A receber: fiados R$57 (Mikelly R$36, Laura R$14, Vanderson R$7) + Meia Sola R$32 = R$89 · em investigação R$17.",
      "Cofrinho prático R$4.374,55 (+R$151,90 = 150 + R$1,90 rendimento).",
    ],
    manualInsights: "Melhor lucro da semana (R$150) com custo próprio baixo (R$64).",
    lessonsLearned: "Organizar novo método de controle e abatimento; formulário de feedback dos sanduíches com QR code.",
  });

  await settle(HENRIQUE, "2026-10-07", date, "Fiado 07/10 quitado em 09/10.");
  await settle(RIAN, "2026-10-07", date, "Fiado 07/10 quitado em 09/10.");
  await settle(JV, "2026-10-08", date, "Fiado 08/10 quitado em 09/10.");
  await settle(ESPECIE_0810, "2026-10-08", date, "Espécie de 08/10 trocado com o Henrique em 09/10.");
}

async function main() {
  await day0710();
  await day0810();
  await day0910();
  await setPracticalProfitBankBalance(BUSINESS, 4374.55);
  console.log("\n✓ Cofrinho prático → R$4.374,55");
  console.log("ALL_DAYS_OK");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
