/**
 * Fechamento ZAIVON 22/10/2026.
 * Segunda execução com os mesmos tokens não cria venda, transferência nem cliente.
 */
import "./load-env";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import {
  appSettings,
  clients,
  dailyInvestments,
  dailyPurchaseItems,
  dailyPurchases,
  diaryEntries,
  operationDays,
  operationalPendings,
  products,
  saleItems,
  sales,
  stockMovements,
} from "../src/lib/db/postgres/schema";
import { buildDayClosing } from "../src/lib/finance/day-closing";
import { closePostgresConnection, getPostgresDb, runPostgresTransaction } from "../src/platform/db/postgres/client";
import { generateId } from "../src/shared/ids/generate-id";

const DATE = "2026-10-22";
const NEXT = "2026-10-23";
const BIZ = "00000000-0000-4000-8000-000000000001";
const META_KEY = "omni_v2_meta_salgados";
const TOKEN = "zaivon-2026-10-22-sales-link-";
const NEXT_TOKEN = "zaivon-2026-10-23-nayanna-salgados";
const JV_TOKEN = "ZAIVON-2210-JV-QUITACAO-2110";
const CREDIT_ID = "zaivon-credit-2026-10-20-raimunda-vanderson";
const CREDIT_USE = "zaivon-2026-10-22-vanderson-credit-7";
const NEW_CLIENT_NOTE = "ZAIVON-2210-NEW-CLIENT";
const SNAPSHOT = "C:/Users/lucas/AppData/Local/Temp/zaivon-import-2210/snapshot-before-write-2210.json";
const PLACEHOLDER_TIME = "12:00:00";

const JV = [
  "d5caf667-c680-4a7d-bbee-2c57d19e9d61",
  "ddb20393-8ef4-4259-9fe4-ff708efd2f79",
  "47e5b927-1efb-4400-82f8-c787e272a29e",
] as const;

const PEOPLE = {
  gabriela: "4f708113-ef9d-4c4e-acca-bc13a5f7f606",
  bernardo: "173d1b7d-b39c-4305-9b90-c12744f35f81",
  graziele: "6cf4b503-6a01-4e62-87f3-f1b6cf86ba15",
  leticia: "4a04171a-904c-46d6-85ab-ed45cf0ca206",
  meylla: "12b459c0-d47e-40c7-bd5a-765d88110bff",
} as const;

type Snapshot = {
  takenAt: string;
  meta: unknown;
  products: Array<{ id: string; name: string; stock: number }>;
  joaoVictor: Array<Record<string, unknown>>;
  day21Cash: number;
  day21Close: number;
};

function money(value: number): string {
  return value.toFixed(2);
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.009;
}

function norm(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

async function main() {
  const db = await getPostgresDb();
  const existing = await db
    .select({ id: sales.id })
    .from(sales)
    .where(and(eq(sales.businessId, BIZ), like(sales.notes, `%${TOKEN}%`)));
  if (existing.length === 9) {
    await verifyPersisted(db);
    console.log("ZERO_NEW");
    await closePostgresConnection();
    return;
  }
  if (existing.length > 0) throw new Error(`Importação parcial anterior: ${existing.length} vendas com o token`);

  const snapshot = await takeSnapshot(db);
  validateSnapshot(snapshot);
  mkdirSync("C:/Users/lucas/AppData/Local/Temp/zaivon-import-2210", { recursive: true });
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot));

  await runPostgresTransaction(async (tx) => {
    const productRows = await tx
      .select({ id: products.id, name: products.name, stock: products.stockQuantity })
      .from(products)
      .where(eq(products.businessId, BIZ));
    const salgado = productRows.find((p) => p.name === "Salgado (sabor não identificado)");
    const sandwich = productRows.find((p) => p.name === "Sanduíche Natural");
    const mistao = productRows.find((p) => p.name === "Mistão Frito");
    if (!salgado || !sandwich || !mistao) throw new Error("Produtos do lote ausentes");
    if (salgado.stock !== 0 || sandwich.stock !== 0 || mistao.stock !== 525) {
      throw new Error("Estoque de partida diferente do snapshot");
    }

    const people = await tx
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(inArray(clients.id, Object.values(PEOPLE)));
    const byId = new Map(people.map((p) => [p.id, norm(p.name)]));
    if (byId.get(PEOPLE.gabriela) !== norm("Gabriela Barreto Vasconcelos")) throw new Error("Gabriela divergente");
    if (byId.get(PEOPLE.bernardo) !== norm("Bernardo Ferreira Domingo")) throw new Error("Bernardo divergente");
    if (byId.get(PEOPLE.graziele) !== norm("Maria Graziele Dos Santos Oliveira")) throw new Error("Graziele divergente");
    if (byId.get(PEOPLE.leticia) !== norm("Letícia Santana Rodrigues")) throw new Error("Letícia divergente");
    if (byId.get(PEOPLE.meylla) !== norm("Meylla Sinnara Ribeiro Dos Santos")) throw new Error("Meylla divergente");

    const nayannaRows = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(sql`lower(translate(name, 'áàâãéêíóôõúç', 'aaaaeeiooouc')) = 'nayanna lemos'`);
    if (nayannaRows.length > 1) throw new Error("Nayanna ambígua");
    const nayannaId = nayannaRows[0]?.id ?? generateId();
    const now = new Date();
    if (!nayannaRows[0]) {
      await tx.insert(clients).values({
        id: nayannaId,
        registeredBusinessId: BIZ,
        name: "Nayanna Lemos",
        notes: NEW_CLIENT_NOTE,
        createdAt: now,
        updatedAt: now,
      });
    }

    const operationDayId = generateId();
    const nextDayId = generateId();
    await tx.insert(operationDays).values([
      { id: operationDayId, businessId: BIZ, operationDate: DATE, status: "closed", createdAt: now, updatedAt: now },
      { id: nextDayId, businessId: BIZ, operationDate: NEXT, status: "open", createdAt: now, updatedAt: now },
    ]);

    let salgadoBal = 36;
    let sandwichBal = 7;
    const move = async (
      productId: string,
      dayId: string,
      saleId: string | null,
      type: "entry" | "exit",
      qty: number,
      balance: number,
      reason: string,
    ) => {
      await tx.insert(stockMovements).values({
        id: generateId(),
        productId,
        operationDayId: dayId,
        saleId,
        movementType: type,
        quantity: qty,
        balanceAfter: balance,
        reason,
        createdAt: now,
      });
    };
    await move(salgado.id, operationDayId, null, "entry", 36, 36, "ZAIVON-2210 entrada 36 salgados");
    await move(sandwich.id, operationDayId, null, "entry", 7, 7, "ZAIVON-2210 producao 7 sanduiches");

    const sell = async (input: {
      externalId: string;
      clientId: string | null;
      productId: string;
      kind: "salgados" | "sandwiches";
      qty: number;
      total: number;
      received: number;
      method: "pix" | "cash" | null;
      settlementDate: string | null;
      notes: string;
    }) => {
      const saleId = generateId();
      await tx.insert(sales).values({
        id: saleId,
        businessId: BIZ,
        operationDayId,
        clientId: input.clientId,
        saleDate: DATE,
        saleTime: PLACEHOLDER_TIME,
        paymentMethod: input.method,
        paymentStatus: "paid",
        amountReceived: money(input.received),
        settlementDate: input.settlementDate,
        totalAmount: money(input.total),
        totalCost: "0.00",
        profit: money(input.total),
        notes: `${TOKEN}${input.externalId} ${input.notes}`,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(saleItems).values({
        id: generateId(),
        saleId,
        productId: input.productId,
        quantity: input.qty,
        unitPrice: money(input.total / input.qty),
        unitCost: "0.00",
        subtotal: money(input.total),
        profit: money(input.total),
        flavorConfidence: input.kind === "salgados" ? "unknown" : "confirmed",
      });
      if (input.kind === "salgados") salgadoBal -= input.qty;
      else sandwichBal -= input.qty;
      if (salgadoBal < 0 || sandwichBal < 0) throw new Error("Estoque do lote ficou negativo");
      await move(
        input.productId,
        operationDayId,
        saleId,
        "exit",
        input.qty,
        input.kind === "salgados" ? salgadoBal : sandwichBal,
        `ZAIVON-2210 ${input.externalId}`,
      );
    };

    await sell({
      externalId: "pix-140",
      clientId: null,
      productId: salgado.id,
      kind: "salgados",
      qty: 28,
      total: 140,
      received: 140,
      method: "pix",
      settlementDate: null,
      notes: "AGGREGATE-2210 28 salgados em Pix. O pacote não trouxe os nomes. Não é cliente e não é fiado.",
    });
    await sell({
      externalId: "cash-10",
      clientId: null,
      productId: salgado.id,
      kind: "salgados",
      qty: 2,
      total: 10,
      received: 10,
      method: "cash",
      settlementDate: null,
      notes:
        "AGGREGATE-2210 espécie líquida R$10. Cédula de R$20, troco de R$10 em Pix e Pix posterior de R$20 do Henrique são a mesma conversão, não uma segunda venda.",
    });
    await sell({
      externalId: "bernardo-5",
      clientId: PEOPLE.bernardo,
      productId: salgado.id,
      kind: "salgados",
      qty: 1,
      total: 5,
      received: 5,
      method: null,
      settlementDate: NEXT,
      notes: "Fiado de 22/10 quitado em 23/10. Saldo atual zero.",
    });
    await sell({
      externalId: "graziele-5",
      clientId: PEOPLE.graziele,
      productId: salgado.id,
      kind: "salgados",
      qty: 1,
      total: 5,
      received: 5,
      method: null,
      settlementDate: NEXT,
      notes: "Fiado de Maria Graziele em 22/10 quitado em 23/10. Saldo atual zero. O cartão sem Dos não foi usado.",
    });
    await sell({
      externalId: "gabriela-cortesia",
      clientId: PEOPLE.gabriela,
      productId: salgado.id,
      kind: "salgados",
      qty: 1,
      total: 0,
      received: 0,
      method: null,
      settlementDate: null,
      notes: "CORTESIA-2210 Gabriela Barreto, 1 salgado, Unifor, valor recebido zero. Não é fiado.",
    });
    await sell({
      externalId: "leticia-7",
      clientId: PEOPLE.leticia,
      productId: sandwich.id,
      kind: "sandwiches",
      qty: 1,
      total: 7,
      received: 7,
      method: "pix",
      settlementDate: null,
      notes: "Letícia Santana Rodrigues. 1 sanduíche na Acal, pago em 22/10. Incluído nos R$154 de Pix.",
    });
    await sell({
      externalId: "meylla-7",
      clientId: PEOPLE.meylla,
      productId: sandwich.id,
      kind: "sandwiches",
      qty: 1,
      total: 7,
      received: 7,
      method: "pix",
      settlementDate: null,
      notes: "Meylla Sinnara Ribeiro Dos Santos. 1 sanduíche na Acal, pago em 22/10. Incluído nos R$154 de Pix.",
    });
    await sell({
      externalId: "vanderson-credito",
      clientId: null,
      productId: sandwich.id,
      kind: "sandwiches",
      qty: 1,
      total: 7,
      received: 0,
      method: null,
      settlementDate: null,
      notes: `CREDIT-APPLIED:${CREDIT_ID} ${CREDIT_USE}. Sem recebimento novo e sem fiado. Saldo do crédito fica R$1.`,
    });
    await sell({
      externalId: "nayanna-7",
      clientId: nayannaId,
      productId: sandwich.id,
      kind: "sandwiches",
      qty: 1,
      total: 7,
      received: 7,
      method: null,
      settlementDate: NEXT,
      notes: "Fiado de 22/10 quitado em 23/10. Dos R$17 de 23/10, R$7 quitam este sanduíche.",
    });

    if (salgadoBal !== 3 || sandwichBal !== 3) throw new Error(`Estoque antes da saída sem nome ${salgadoBal}/${sandwichBal}`);
    salgadoBal = 0;
    await move(salgado.id, operationDayId, null, "exit", 3, 0, "retirada_sem_identificacao EX-22-S-01");
    await tx.update(products).set({ stockQuantity: 0, updatedAt: now }).where(eq(products.id, salgado.id));
    await tx.update(products).set({ stockQuantity: 3, updatedAt: now }).where(eq(products.id, sandwich.id));
    if (mistao.stock !== 525) throw new Error("Mistão foi alterado");

    await tx.insert(operationalPendings).values({
      id: generateId(),
      operationDayId,
      pendingType: "inventory_investigation",
      productId: salgado.id,
      quantity: 3,
      potentialRevenue: "15.00",
      status: "closed_with_caveat",
      description:
        "EX-22-S-01 retirada_sem_identificacao investigacao_encerrada_com_ressalva. 3 salgados, valor comercial R$15. Recebimento R$0. Sem cliente, sem fiado e sem perda definitiva.",
      resolvedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const nextSaleId = generateId();
    await tx.insert(sales).values({
      id: nextSaleId,
      businessId: BIZ,
      operationDayId: nextDayId,
      clientId: nayannaId,
      saleDate: NEXT,
      saleTime: PLACEHOLDER_TIME,
      paymentMethod: null,
      paymentStatus: "paid",
      amountReceived: "10.00",
      settlementDate: NEXT,
      totalAmount: "10.00",
      totalCost: "0.00",
      profit: "10.00",
      notes: `${NEXT_TOKEN} Dois salgados de 23/10. Parte dos R$17 de Nayanna. Sem baixa de estoque porque o lote de 23/10 ainda não foi importado. Fora do faturamento de 22/10.`,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(saleItems).values({
      id: generateId(),
      saleId: nextSaleId,
      productId: salgado.id,
      quantity: 2,
      unitPrice: "5.00",
      unitCost: "0.00",
      subtotal: "10.00",
      profit: "10.00",
      flavorConfidence: "unknown",
    });

    for (const id of JV) {
      const row = await tx.select().from(sales).where(eq(sales.id, id));
      const sale = row[0];
      if (!sale || sale.paymentStatus !== "pending") throw new Error(`João Victor ${id} não está pendente`);
      await tx
        .update(sales)
        .set({
          paymentStatus: "paid",
          paymentMethod: "pix",
          amountReceived: sale.totalAmount,
          settlementDate: "2026-10-21",
          notes: `${sale.notes ?? ""}\n${JV_TOKEN} Recebido em 21/10 às 21h27. Quitação da dívida acumulada de R$20. Não entra no caixa de 22/10 e não altera o fechamento congelado de 21/10.`,
          updatedAt: now,
        })
        .where(eq(sales.id, id));
    }

    await tx.insert(dailyInvestments).values([
      {
        id: generateId(),
        operationDayId,
        amount: "60.00",
        investmentType: "additional",
        sourceType: "own_capital",
        sourceName: null,
        description: "ZAIVON-2210 custo próprio confirmado de R$60. Não recebe acréscimo.",
      },
      {
        id: generateId(),
        operationDayId,
        amount: "52.00",
        investmentType: "additional",
        sourceType: "other",
        sourceName: "terceiros",
        description: "ZAIVON-2210 custo de terceiros de R$52. Não entra no custo próprio nem no resultado de caixa.",
      },
    ]);
    const purchaseId = generateId();
    await tx.insert(dailyPurchases).values({
      id: purchaseId,
      operationDayId,
      totalUnits: 43,
      totalInvestment: "112.00",
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(dailyPurchaseItems).values([
      { id: generateId(), dailyPurchaseId: purchaseId, productId: salgado.id, productName: salgado.name, quantity: 36, unitCost: null },
      { id: generateId(), dailyPurchaseId: purchaseId, productId: sandwich.id, productName: sandwich.name, quantity: 7, unitCost: null },
    ]);

    const closing = buildDayClosing({
      date: DATE,
      competenceRevenue: 188,
      salesReceived: 164,
      priorSettlements: 0,
      otherInflows: 0,
      ownCost: 60,
      thirdPartyCost: 52,
      newCredit: 17,
      lossesAmount: 0,
      lossesUnits: 0,
      stockRemainingUnits: 3,
      piggyOpening: 5217.08,
      piggyDeposit: 129,
      bankYield: 0,
      piggyClosing: 5346.08,
      competenceStatus: "provisional",
      operationalAudit: {
        salgados: {
          initial: 36,
          paidUnits: 33,
          lostUnits: 0,
          final: 0,
          status: "ok",
          note: "30 pagos, 2 fiados e 1 cortesia. Mais 3 saídas sem pagamento. Estoque físico zero. A transferência de 7 é estimativa e não foi gravada.",
        },
        sandwiches: {
          initial: 7,
          ownConsumption: 0,
          counted: 3,
          status: "ok",
          note: "4 saídas identificadas e 3 unidades preservadas para o estoque inicial de 23/10. Nenhuma saída sem nome.",
        },
      },
      extraNotes: [
        "ENCERRADO COM RESSALVAS AUDITÁVEIS.",
        "Competência 188 = Pix de salgados 140 + espécie 10 + Letícia 7 + Meylla 7 + crédito 7 + fiados 17. Cortesia zero. Saídas sem nome fora da competência.",
        "Caixa de 22/10 = 164. A base 189 do cofrinho inclui João Victor 20 de 21/10 e Graziele 5 de 23/10. Não é o faturamento nem o caixa exclusivo do dia.",
        "Resultado de caixa 104 = 164 − 60. Depósito 129 = 189 − 60. A diferença de 25 fica explicada e não vira rendimento.",
        "Custo próprio 60 e custo de terceiros 52. Custo dos salgados 112. Nenhum custo extra foi somado aos 60.",
        "Ponte de abertura 5,06: fechamento de 21/10 permanece 5212,02. Abertura informada 5217,08. Sem rendimento.",
        "Saldo bancário observado 203, com residual aceito. Uber cancelado não gera lançamento. Reserva 13,98 e Zamp 145,80 ficam fora do custo operacional.",
        "Horário 12:00 é exigência do registro, não horário observado.",
      ],
    });
    if (!near(closing.competenceProfit, 128) || !near(closing.cash.cashIn, 164) || !near(closing.cashManagementResult, 104)) {
      throw new Error("Fechamento calculado fora dos critérios");
    }
    if (!near(closing.piggyBank.closingBalance, 5346.08) || !near(closing.costs.ownCost, 60) || !near(closing.costs.thirdPartyCost, 52)) {
      throw new Error("Custo ou cofrinho calculado fora dos critérios");
    }

    await tx.insert(diaryEntries).values({
      id: generateId(),
      operationDayId,
      schemaVersion: 2,
      revenueReceived: "164.00",
      revenuePending: "17.00",
      revenueTotal: "188.00",
      operationalProfit: "104.00",
      quantitySold: 37,
      quantityLost: 0,
      observations: [
        "Fechamento 22/10 parcial, com ressalvas.",
        "Salgados iniciais 36: Unifor 22 e Acal 14. Sabores no texto do fechamento. Estoque físico final zero.",
        "Transferência estimada de 7 salgados da Unifor para a Acal, sem quantidade confirmada.",
        "Sanduíches: produção 7, Unifor 3 e Acal 4, transferência de 3 para a Acal, 4 saídas e 3 remanescentes.",
        "Os 3 sanduíches ficam no estoque do produto e são o lote inicial de 23/10. Não há segunda entrada.",
      ].join("\n"),
      manualInsights:
        "A base de R$189 não é competência nem caixa de 22/10. Mikelly e Ana Laura não receberam lançamento novo. O Pix de R$154 não tem lista nominal.",
      tags: ["zaivon-v2", "day-closing-v2", "zaivon-2210"],
      narrative: { sales: { paidCount: 9, creditCount: 3 }, bonusIncome: 0, dayClosing: closing },
      createdAt: now,
      updatedAt: now,
    });

    const metaRow = await tx.select().from(appSettings).where(eq(appSettings.key, META_KEY));
    const current = metaRow[0]?.value as {
      cofrinho: Record<string, number>;
      closure: Record<string, { status: string; note?: string }>;
      customerCredits?: Array<{
        id: string;
        balance: number;
        consumptions: Array<{ id: string }>;
        planned: Array<{ date?: string; status: string; note: string; amount: number }>;
      }>;
      openingBridges?: unknown[];
    };
    if (!current?.cofrinho || !near(current.cofrinho["2026-10-21"] ?? 0, 5212.02)) {
      throw new Error("Cofrinho de 21/10 ausente na hora de gravar");
    }
    if (!(current.customerCredits ?? []).some((book) => book.id === CREDIT_ID)) {
      throw new Error("Livro de crédito de Vanderson ausente");
    }
    const credits = (current.customerCredits ?? []).map((book) => {
      if (book.id !== CREDIT_ID) return book;
      if (book.balance !== 8) throw new Error(`Crédito de Vanderson está em ${book.balance}, não em 8`);
      if (book.consumptions.some((item) => item.id === CREDIT_USE)) throw new Error("Consumo de 22/10 já existia");
      return {
        ...book,
        balance: 1,
        consumptions: [
          ...book.consumptions,
          {
            id: CREDIT_USE,
            cash: false,
            date: DATE,
            amount: 7,
            competence: true,
            saleExternalId: `${TOKEN}vanderson-credito`,
          },
        ],
        planned: book.planned.map((item) =>
          item.date === NEXT
            ? { ...item, status: "not_executed", note: "Não executado em 23/10. O sanduíche de R$7 foi consumido em 22/10." }
            : item,
        ),
      };
    });
    await tx
      .update(appSettings)
      .set({
        value: {
          ...current,
          cofrinho: { ...current.cofrinho, [DATE]: 5346.08 },
          closure: {
            ...current.closure,
            [DATE]: { status: "closed_with_note", note: "ENCERRADO COM RESSALVAS AUDITÁVEIS" },
          },
          customerCredits: credits,
          openingBridges: [
            ...(current.openingBridges ?? []),
            {
              id: "zaivon-2026-10-22-opening-bridge",
              fromBalance: 5212.02,
              informedOpening: 5217.08,
              gap: 5.06,
              note: "O fechamento de 21/10 permanece 5212,02. A abertura informada de 22/10 é 5217,08. Diferença de 5,06 sem classificação e sem rendimento.",
            },
          ],
        },
        updatedAt: now,
      })
      .where(eq(appSettings.key, META_KEY));

    const frozen = await tx
      .select({ narrative: diaryEntries.narrative })
      .from(operationDays)
      .innerJoin(diaryEntries, eq(diaryEntries.operationDayId, operationDays.id))
      .where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, "2026-10-21")));
    const frozenClosing = (frozen[0]?.narrative as { dayClosing?: { cash?: { cashIn?: number }; piggyBank?: { closingBalance?: number } } } | null)
      ?.dayClosing;
    if (!near(frozenClosing?.cash?.cashIn ?? 0, 188) || !near(frozenClosing?.piggyBank?.closingBalance ?? 0, 5212.02)) {
      throw new Error("A escrita atingiu o fechamento de 21/10");
    }
  });

  try {
    await verifyPersisted(db);
    console.log("VERIFY_OK");
  } catch (error) {
    console.error(error);
    await restore(db);
    throw error;
  }
  await closePostgresConnection();
}

async function takeSnapshot(db: Awaited<ReturnType<typeof getPostgresDb>>): Promise<Snapshot> {
  const metaRow = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, META_KEY));
  const productRows = await db
    .select({ id: products.id, name: products.name, stock: products.stockQuantity })
    .from(products)
    .where(eq(products.businessId, BIZ));
  const joaoVictor = await db.select().from(sales).where(inArray(sales.id, [...JV]));
  const day21 = await db
    .select({ narrative: diaryEntries.narrative })
    .from(operationDays)
    .innerJoin(diaryEntries, eq(diaryEntries.operationDayId, operationDays.id))
    .where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, "2026-10-21")));
  const closing = (day21[0]?.narrative as { dayClosing?: { cash?: { cashIn?: number }; piggyBank?: { closingBalance?: number } } } | null)
    ?.dayClosing;
  return {
    takenAt: new Date().toISOString(),
    meta: metaRow[0]?.value ?? null,
    products: productRows,
    joaoVictor: joaoVictor as unknown as Array<Record<string, unknown>>,
    day21Cash: closing?.cash?.cashIn ?? 0,
    day21Close: closing?.piggyBank?.closingBalance ?? 0,
  };
}

function validateSnapshot(snapshot: Snapshot): void {
  const stock = new Map(snapshot.products.map((p) => [p.name, p.stock]));
  if (stock.get("Salgado (sabor não identificado)") !== 0) throw new Error("Salgado não está zerado");
  if (stock.get("Sanduíche Natural") !== 0) throw new Error("Sanduíche não está zerado");
  if (stock.get("Mistão Frito") !== 525) throw new Error("Mistão frito mudou");
  if (snapshot.joaoVictor.length !== 3) throw new Error("João Victor sem as três dívidas");
  if (snapshot.joaoVictor.some((row) => row.paymentStatus !== "pending" || Number(row.amountReceived) !== 0)) {
    throw new Error("João Victor já não está pendente");
  }
  const meta = snapshot.meta as { cofrinho?: Record<string, number> };
  if (!near(meta.cofrinho?.["2026-10-21"] ?? 0, 5212.02)) throw new Error("Cofrinho de 21/10 não está em 5212,02");
  if (!near(snapshot.day21Cash, 188) || !near(snapshot.day21Close, 5212.02)) {
    throw new Error("Fechamento congelado de 21/10 mudou antes da escrita");
  }
}

async function verifyPersisted(db: Awaited<ReturnType<typeof getPostgresDb>>) {
  const rows = await db
    .select({
      total: sales.totalAmount,
      received: sales.amountReceived,
      date: sales.saleDate,
      notes: sales.notes,
      settle: sales.settlementDate,
      status: sales.paymentStatus,
    })
    .from(sales)
    .where(and(eq(sales.businessId, BIZ), like(sales.notes, `%${TOKEN}%`)));
  if (rows.length !== 9) throw new Error(`Vendas de 22/10: ${rows.length}`);
  const pixLines = await db
    .select({ total: sales.totalAmount, received: sales.amountReceived })
    .from(sales)
    .where(and(eq(sales.businessId, BIZ), like(sales.notes, "%zaivon-2026-10-22-pix-line-%")));
  const active = rows.filter((row) => !(row.notes ?? "").includes("MIGRATED-2210-PIX-140"));
  const competence = active.reduce((sum, row) => sum + Number(row.total), 0) + pixLines.reduce((sum, row) => sum + Number(row.total), 0);
  const cash = active
    .filter((row) => row.settle == null && Number(row.received) > 0)
    .reduce((sum, row) => sum + Number(row.received), 0) + pixLines.reduce((sum, row) => sum + Number(row.received), 0);
  if (!near(competence, 188) || !near(cash, 164)) throw new Error(`Totais ${competence} / ${cash}`);
  const courtesy = rows.filter((row) => (row.notes ?? "").includes("CORTESIA-2210"));
  if (courtesy.length !== 1 || Number(courtesy[0]?.total) !== 0) throw new Error("Cortesia duplicada ou com valor");
  const settled = rows.filter((row) => row.settle === NEXT);
  if (settled.length !== 3) throw new Error("Quitações de 23/10 fora da conta");

  const next = await db.select({ id: sales.id }).from(sales).where(like(sales.notes, `%${NEXT_TOKEN}%`));
  if (next.length !== 1) throw new Error("Venda de Nayanna em 23/10 duplicada ou ausente");

  const jv = await db.select({ received: sales.amountReceived, status: sales.paymentStatus, settle: sales.settlementDate }).from(sales).where(inArray(sales.id, [...JV]));
  const jvSum = jv.reduce((sum, row) => sum + Number(row.received), 0);
  if (jv.length !== 3 || jv.some((row) => row.status !== "paid" || row.settle !== "2026-10-21") || !near(jvSum, 20)) {
    throw new Error("Quitação de João Victor divergente");
  }

  const stock = await db
    .select({ name: products.name, stock: products.stockQuantity })
    .from(products)
    .where(inArray(products.name, ["Salgado (sabor não identificado)", "Sanduíche Natural", "Mistão Frito"]));
  const stockMap = new Map(stock.map((row) => [row.name, row.stock]));
  if (stockMap.get("Salgado (sabor não identificado)") !== 0) throw new Error("Estoque final de salgados não é zero");
  if (stockMap.get("Sanduíche Natural") !== 3) throw new Error("Estoque final de sanduíches não é 3");
  if (stockMap.get("Mistão Frito") !== 525) throw new Error("Mistão frito mudou");

  const pending = await db
    .select({ id: operationalPendings.id })
    .from(operationalPendings)
    .where(like(operationalPendings.description, "%EX-22-S-01%"));
  if (pending.length !== 1) throw new Error("Saída sem identificação duplicada ou ausente");

  const investments = await db
    .select({ amount: dailyInvestments.amount, source: dailyInvestments.sourceType, date: operationDays.operationDate })
    .from(dailyInvestments)
    .innerJoin(operationDays, eq(operationDays.id, dailyInvestments.operationDayId))
    .where(eq(operationDays.operationDate, DATE));
  const own = investments.filter((row) => row.source === "own_capital").reduce((sum, row) => sum + Number(row.amount), 0);
  const third = investments.filter((row) => row.source !== "own_capital").reduce((sum, row) => sum + Number(row.amount), 0);
  if (!near(own, 60) || !near(third, 52)) throw new Error(`Custos ${own} / ${third}`);

  const metaRow = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, META_KEY));
  const meta = metaRow[0]?.value as {
    cofrinho?: Record<string, number>;
    customerCredits?: Array<{ id: string; balance: number; consumptions: Array<{ id: string }>; writeOffs?: Array<{ id: string }> }>;
  };
  if (!near(meta.cofrinho?.["2026-10-22"] ?? 0, 5346.08) || !near(meta.cofrinho?.["2026-10-21"] ?? 0, 5212.02)) {
    throw new Error("Cofrinho divergente");
  }
  const book = meta.customerCredits?.find((item) => item.id === CREDIT_ID);
  const waiver = book?.writeOffs?.some((item) => item.id === "zaivon-2026-10-24-vanderson-residual-1") ?? false;
  const creditOk = book?.consumptions.filter((item) => item.id === CREDIT_USE).length === 1 && (book.balance === 1 || (book.balance === 0 && waiver));
  if (!creditOk) throw new Error("Crédito de Vanderson divergente");

  const frozen = await db
    .select({ narrative: diaryEntries.narrative })
    .from(operationDays)
    .innerJoin(diaryEntries, eq(diaryEntries.operationDayId, operationDays.id))
    .where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, "2026-10-21")));
  const frozenClosing = (frozen[0]?.narrative as { dayClosing?: { cash?: { cashIn?: number }; piggyBank?: { closingBalance?: number } } } | null)
    ?.dayClosing;
  if (!near(frozenClosing?.cash?.cashIn ?? 0, 188) || !near(frozenClosing?.piggyBank?.closingBalance ?? 0, 5212.02)) {
    throw new Error("Fechamento de 21/10 foi alterado");
  }
}

async function restore(db: Awaited<ReturnType<typeof getPostgresDb>>) {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Snapshot;
  await runPostgresTransaction(async (tx) => {
    const days = await tx
      .select({ id: operationDays.id })
      .from(operationDays)
      .where(and(eq(operationDays.businessId, BIZ), inArray(operationDays.operationDate, [DATE, NEXT])));
    for (const day of days) {
      await tx.delete(stockMovements).where(eq(stockMovements.operationDayId, day.id));
      await tx.delete(operationalPendings).where(eq(operationalPendings.operationDayId, day.id));
      const purchase = await tx.select({ id: dailyPurchases.id }).from(dailyPurchases).where(eq(dailyPurchases.operationDayId, day.id));
      if (purchase[0]) {
        await tx.delete(dailyPurchaseItems).where(eq(dailyPurchaseItems.dailyPurchaseId, purchase[0].id));
        await tx.delete(dailyPurchases).where(eq(dailyPurchases.id, purchase[0].id));
      }
      await tx.delete(dailyInvestments).where(eq(dailyInvestments.operationDayId, day.id));
      await tx.delete(diaryEntries).where(eq(diaryEntries.operationDayId, day.id));
      await tx.delete(sales).where(eq(sales.operationDayId, day.id));
      await tx.delete(operationDays).where(eq(operationDays.id, day.id));
    }
    await tx.delete(clients).where(eq(clients.notes, NEW_CLIENT_NOTE));
    for (const product of snapshot.products) {
      await tx.update(products).set({ stockQuantity: product.stock }).where(eq(products.id, product.id));
    }
    for (const sale of snapshot.joaoVictor) {
      await tx
        .update(sales)
        .set({
          paymentStatus: sale.paymentStatus as "pending",
          paymentMethod: (sale.paymentMethod as "pix" | null) ?? null,
          amountReceived: String(sale.amountReceived),
          settlementDate: (sale.settlementDate as string | null) ?? null,
          notes: (sale.notes as string | null) ?? null,
          updatedAt: new Date(String(sale.updatedAt)),
        })
        .where(eq(sales.id, String(sale.id)));
    }
    await tx.update(appSettings).set({ value: snapshot.meta, updatedAt: new Date() }).where(eq(appSettings.key, META_KEY));
  });
  console.log("RESTORED");
}

main().catch(async (error) => {
  console.error(error);
  await closePostgresConnection();
  process.exit(1);
});
