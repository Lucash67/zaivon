/**
 * Auditoria corretiva do fechamento 22/10.
 * Não recria o dia. A segunda execução não cria vendas novas.
 */
import "./load-env";
import { and, eq, like } from "drizzle-orm";
import {
  appSettings,
  clients,
  diaryEntries,
  operationDays,
  operationalActions,
  operationalPendings,
  sales,
  saleItems,
  stockMovements,
} from "../src/lib/db/postgres/schema";
import { closePostgresConnection, getPostgresDb, runPostgresTransaction } from "../src/platform/db/postgres/client";
import { generateId } from "../src/shared/ids/generate-id";

const DAY = "a7b27379-b036-45c5-a96e-c17a0a8cfa72";
const BIZ = "00000000-0000-4000-8000-000000000001";
const DATE = "2026-10-22";
const AGGREGATE = "3942b218-057b-4f9b-96d5-9f500b10c4f4";
const CASH = "06cd206d-9a89-4d7a-bbe7-e2abf11dd24a";
const MOVE = "ad7c247c-4628-47b8-b129-d10af55b1f17";
const ITEM = "ccfe7032-2bd5-43e5-b923-03b3eb3ab274";
const PENDING = "5e398930-02b7-4163-9bf8-e415f01f7033";
const SALGADO = "4da6e5b2-86ad-4f3e-8e71-9492f43f8291";
const PIX = "zaivon-2026-10-22-pix-line-";
const MIGRATED = "MIGRATED-2210-PIX-140";
const META_KEY = "omni_v2_meta_salgados";
const CREDIT_ID = "zaivon-credit-2026-10-20-raimunda-vanderson";
const WAIVER = "zaivon-2026-10-24-vanderson-residual-1";
const NEW_CLIENT = "ZAIVON-2210-PIX-CLIENT";
const MARK = "AUDITORIA-2210-NOMINAL";

const LINES: Array<{ time: string; name: string; amount: number; local: "Acal" | "Unifor"; confidence: "confirmado" | "provisorio"; clientId: string | null }> = [
  { time: "09:00:00", name: "Anderson da Silva Nascimento", amount: 5, local: "Acal", confidence: "confirmado", clientId: "0343e108-75ee-483b-819d-f4982360b91e" },
  { time: "09:01:00", name: "Cristiano Messias Lopes", amount: 15, local: "Acal", confidence: "confirmado", clientId: "f6d79f69-e2cd-46d5-b164-d8e36e4bdcde" },
  { time: "09:03:00", name: "Caio Felipe Teixeira Pereira", amount: 5, local: "Acal", confidence: "confirmado", clientId: "3c40b0a0-f38f-4d60-be6e-c083fdd9cafc" },
  { time: "09:07:00", name: "Bruno José Furtado e Silva", amount: 5, local: "Acal", confidence: "confirmado", clientId: "903c5c08-16e5-412b-9b0d-51126b96cd74" },
  { time: "09:11:00", name: "Yasmin Michelle Nunes Rodrigues", amount: 5, local: "Acal", confidence: "confirmado", clientId: "d0b0caf1-da35-46b2-a58a-e73c6e57cb91" },
  { time: "09:12:00", name: "Joaquim Neto", amount: 5, local: "Unifor", confidence: "provisorio", clientId: "71f98e41-305b-4ff3-bf6c-3d898bf77d29" },
  { time: "09:14:00", name: "João Travassos Barroso", amount: 5, local: "Unifor", confidence: "provisorio", clientId: null },
  { time: "09:16:00", name: "Aryane da Silva Assunção", amount: 5, local: "Unifor", confidence: "provisorio", clientId: "0515b5d7-09e2-465a-9c89-dc980b55d8f5" },
  { time: "09:18:00", name: "João Guilherme da Silva Lima", amount: 10, local: "Acal", confidence: "confirmado", clientId: "066b0565-89dc-4d87-b8a5-3f63b9fc343b" },
  { time: "09:28:00", name: "Maria Lusangela Alexandre da Costa", amount: 5, local: "Acal", confidence: "confirmado", clientId: "0394b313-247b-4402-a7a5-517ecc482839" },
  { time: "09:29:00", name: "Mateus Oliveira Teófilo", amount: 10, local: "Unifor", confidence: "provisorio", clientId: "d51878e5-3ede-430e-a278-4c8b96a0f4b6" },
  { time: "09:35:00", name: "Rhenan Mateus Matias Filgueira", amount: 10, local: "Unifor", confidence: "provisorio", clientId: "4207fee0-7db8-4f00-b755-067fcbde17c6" },
  { time: "09:37:00", name: "Amanda Sousa Calaça", amount: 5, local: "Unifor", confidence: "provisorio", clientId: null },
  { time: "09:37:00", name: "Rebeca Frota de Souza", amount: 5, local: "Unifor", confidence: "provisorio", clientId: null },
  { time: "09:38:00", name: "José Gabriel de Oliveira Abreu Matos", amount: 5, local: "Acal", confidence: "confirmado", clientId: "ba57c0b2-7828-4887-9a7d-65897c8e3c3e" },
  { time: "09:38:00", name: "Jamilly Facundes dos Santos", amount: 5, local: "Unifor", confidence: "provisorio", clientId: "ad5fe69d-d249-4412-8f3b-598623833234" },
  { time: "09:38:00", name: "Marcela Alves Farias", amount: 5, local: "Unifor", confidence: "provisorio", clientId: "f5a837c6-855f-4bc7-a740-beaa4d34f00d" },
  { time: "09:42:00", name: "Aline Maria da Silva Lopes", amount: 5, local: "Unifor", confidence: "provisorio", clientId: "f8d62389-175d-4819-a644-85139c03afd6" },
  { time: "10:08:00", name: "Lucas Moraes", amount: 5, local: "Acal", confidence: "provisorio", clientId: "19aa6e8e-f97c-4ee9-8a4e-88e8e52f7363" },
  { time: "10:08:00", name: "Cleane Cipriano Pereira", amount: 5, local: "Acal", confidence: "provisorio", clientId: "cad65b3d-b7d2-424b-8a4e-6b835d954d35" },
  { time: "11:47:00", name: "Gerson Ryan Silva de Oliveira", amount: 5, local: "Acal", confidence: "provisorio", clientId: "c96691ae-8973-4a0d-addc-b72e03a7c5d0" },
  { time: "14:29:00", name: "Walderlan Falcão dos Santos", amount: 5, local: "Acal", confidence: "provisorio", clientId: "abf74577-f07b-422a-9d33-8adcc7a92a7f" },
  { time: "15:33:00", name: "Maria Clara Gomes Mororó", amount: 5, local: "Acal", confidence: "provisorio", clientId: "dfb256dd-af52-4133-860c-04edf71e9fe0" },
];

function norm(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function slug(line: { time: string; name: string }): string {
  const head = norm(line.name).split(" ")[0] ?? "cliente";
  return `${line.time.replace(/:/g, "")}-${head}`;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.009;
}

async function main() {
  const expectedMoney = LINES.reduce((sum, line) => sum + line.amount, 0);
  const expectedUnits = LINES.reduce((sum, line) => sum + line.amount / 5, 0);
  if (LINES.length !== 23 || expectedMoney !== 140 || expectedUnits !== 28) {
    throw new Error(`Pacote inválido: ${LINES.length} / ${expectedMoney} / ${expectedUnits}`);
  }

  const db = await getPostgresDb();
  const existing = await db.select({ id: sales.id }).from(sales).where(like(sales.notes, `%${PIX}%`));
  const aggregate = await db.select().from(sales).where(eq(sales.id, AGGREGATE));
  if (existing.length === 23 && Number(aggregate[0]?.totalAmount) === 0) {
    await verify(db);
    console.log("ZERO_NEW");
    await closePostgresConnection();
    return;
  }
  if (existing.length !== 0 || Number(aggregate[0]?.totalAmount) !== 140) {
    throw new Error(`Estado inesperado: ${existing.length} linhas e total ${aggregate[0]?.totalAmount}`);
  }

  await runPostgresTransaction(async (tx) => {
    const now = new Date();
    const allClients = await tx.select({ id: clients.id, name: clients.name }).from(clients);
    const byNorm = new Map<string, string[]>();
    for (const client of allClients) {
      const key = norm(client.name);
      byNorm.set(key, [...(byNorm.get(key) ?? []), client.id]);
    }

    for (const line of LINES) {
      const qty = line.amount / 5;
      if (!Number.isInteger(qty)) throw new Error(`Quantidade inválida em ${line.name}`);
      let clientId = line.clientId;
      if (clientId) {
        const card = allClients.find((client) => client.id === clientId);
        if (!card || norm(card.name) !== norm(line.name)) throw new Error(`Cartão divergente: ${line.name}`);
      } else {
        const matches = byNorm.get(norm(line.name)) ?? [];
        if (matches.length > 1) throw new Error(`Nome ambíguo: ${line.name}`);
        clientId = matches[0] ?? generateId();
        if (!matches[0]) {
          await tx.insert(clients).values({
            id: clientId,
            registeredBusinessId: BIZ,
            name: line.name,
            notes: NEW_CLIENT,
            createdAt: now,
            updatedAt: now,
          });
          byNorm.set(norm(line.name), [clientId]);
        }
      }
      const saleId = generateId();
      await tx.insert(sales).values({
        id: saleId,
        businessId: BIZ,
        operationDayId: DAY,
        clientId,
        saleDate: DATE,
        saleTime: line.time,
        paymentMethod: "pix",
        paymentStatus: "paid",
        amountReceived: line.amount.toFixed(2),
        settlementDate: null,
        totalAmount: line.amount.toFixed(2),
        totalCost: "0.00",
        profit: line.amount.toFixed(2),
        notes: `${PIX}${slug(line)} ORIGEM:${AGGREGATE} LOCAL:${line.local} CONFIANCA:${line.confidence} ${line.name}. ${qty} salgado(s), R$${line.amount}. Substitui o consolidado sem somar de novo.`,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(saleItems).values({
        id: generateId(),
        saleId,
        productId: SALGADO,
        quantity: qty,
        unitPrice: "5.00",
        unitCost: "0.00",
        subtotal: line.amount.toFixed(2),
        profit: line.amount.toFixed(2),
        flavorConfidence: "unknown",
      });
    }

    await tx.delete(saleItems).where(eq(saleItems.id, ITEM));
    await tx
      .update(sales)
      .set({
        totalAmount: "0.00",
        amountReceived: "0.00",
        profit: "0.00",
        notes: `${aggregate[0]?.notes ?? ""}\n${MIGRATED} Substituído por 23 Pix individuais que somam R$140 e 28 salgados. Este lançamento deixa de contar. Item ${ITEM} retirado da contagem. A baixa física de 28 unidades permanece no movimento ${MOVE}.`,
        updatedAt: now,
      })
      .where(eq(sales.id, AGGREGATE));
    await tx
      .update(stockMovements)
      .set({
        reason: "ZAIVON-2210 pix-140 baixa física única de 28 salgados. O detalhe nominal está nas vendas zaivon-2026-10-22-pix-line. Não repetir esta saída.",
      })
      .where(eq(stockMovements.id, MOVE));

    const cash = await tx.select().from(sales).where(eq(sales.id, CASH));
    if (Number(cash[0]?.totalAmount) !== 10) throw new Error("Venda em espécie mudou de valor");
    if (!(cash[0]?.notes ?? "").includes("PARCIAL-2210:Francisco de Assis")) {
      await tx
        .update(sales)
        .set({
          notes: `${cash[0]?.notes ?? ""}\nPARCIAL-2210:Francisco de Assis Identidade completa não confirmada. Há outro cartão Francisco de Assis Soares Pereira, que não foi vinculado. Cédula de R$20, troco de R$10 e Pix de R$20 do Henrique continuam sendo uma única venda líquida de R$10.`,
          updatedAt: now,
        })
        .where(eq(sales.id, CASH));
    }

    await tx
      .update(operationalPendings)
      .set({
        status: "open",
        resolvedAt: null,
        description: [
          "EX-22-S-01 pendência operacional temporária.",
          "3 salgados, valor comercial R$15, origem 22/10/2026, prazo de 7 dias, limite 29/10/2026.",
          "Não é venda paga, não é fiado, não é cortesia e não é perda definitiva.",
          "Histórico: a importação encerrou a investigação com ressalva em 24/10/2026. A auditoria reabriu o prazo a pedido do responsável.",
          "Até 29/10/2026 a pendência permanece ativa. Identificação posterior deve vincular cliente e pagamento sem duplicar receita.",
          "Depois de 29/10/2026, se continuar sem nome, fica vencida e elegível para perda definitiva somente com confirmação do responsável. Sem baixa automática.",
        ].join(" "),
        updatedAt: now,
      })
      .where(eq(operationalPendings.id, PENDING));

    const action = await tx.select({ id: operationalActions.id }).from(operationalActions).where(eq(operationalActions.externalId, "EX-22-S-01"));
    if (action.length === 0) {
      await tx.insert(operationalActions).values({
        id: generateId(),
        operationDayId: DAY,
        externalId: "EX-22-S-01",
        title: "Investigar 3 salgados sem identificação até 29/10/2026",
        description: "Pendência EX-22-S-01, R$15, 3 unidades. Não converter em perda sem confirmação depois do prazo.",
        status: "in_progress",
        source: "diary",
        createdAt: now,
        updatedAt: now,
      });
    }

    const diary = await tx.select().from(diaryEntries).where(eq(diaryEntries.operationDayId, DAY));
    const entry = diary[0];
    if (!entry || !near(Number(entry.revenueTotal), 188) || !near(Number(entry.revenueReceived), 164) || !near(Number(entry.operationalProfit), 104)) {
      throw new Error("Diário de 22/10 não está nos valores confirmados");
    }
    const narrative = (entry.narrative ?? {}) as {
      dayClosing?: {
        competenceRevenue?: number;
        cash?: { cashIn?: number };
        cashManagementResult?: number;
        competenceProfit?: number;
        costs?: { ownCost?: number; thirdPartyCost?: number };
        piggyBank?: { deposit?: number; closingBalance?: number; bankYield?: number };
        reconciliation?: { notes?: string[] };
      };
    };
    const closing = narrative.dayClosing;
    if (
      !closing ||
      !near(closing.competenceRevenue ?? 0, 188) ||
      !near(closing.cash?.cashIn ?? 0, 164) ||
      !near(closing.competenceProfit ?? 0, 128) ||
      !near(closing.cashManagementResult ?? 0, 104) ||
      !near(closing.costs?.ownCost ?? 0, 60) ||
      !near(closing.costs?.thirdPartyCost ?? 0, 52) ||
      !near(closing.piggyBank?.deposit ?? 0, 129) ||
      !near(closing.piggyBank?.closingBalance ?? 0, 5346.08) ||
      !near(closing.piggyBank?.bankYield ?? 0, 0)
    ) {
      throw new Error("Fechamento confirmado seria alterado");
    }
    const auditNote = `${MARK} 23 Pix nomeados substituem o consolidado ${AGGREGATE}, com os mesmos R$140 e 28 salgados. A ponte de R$5,06 segue como rendimento presumido, sem comprovante. O residual de R$1 do Vanderson foi encerrado por decisão do responsável, sem receita nova.`;
    const notes = closing.reconciliation?.notes ?? [];
    if (!notes.some((note) => note.includes(MARK))) notes.push(auditNote);
    if (closing.reconciliation) closing.reconciliation.notes = notes;
    const observations = entry.observations ?? "";
    await tx
      .update(diaryEntries)
      .set({
        narrative,
        observations: observations.includes(MARK) ? observations : `${observations}\n${auditNote}`,
        updatedAt: now,
      })
      .where(eq(diaryEntries.id, entry.id));

    const metaRow = await tx.select().from(appSettings).where(eq(appSettings.key, META_KEY));
    const meta = metaRow[0]?.value as {
      cofrinho?: Record<string, number>;
      openingBridges?: Array<Record<string, unknown>>;
      customerCredits?: Array<{
        id: string;
        balance: number;
        consumptions: Array<{ id: string }>;
        planned: Array<Record<string, unknown>>;
        writeOffs?: Array<Record<string, unknown>>;
      }>;
    };
    if (!near(meta.cofrinho?.["2026-10-21"] ?? 0, 5212.02) || !near(meta.cofrinho?.["2026-10-22"] ?? 0, 5346.08)) {
      throw new Error("Cofrinho confirmado seria alterado");
    }
    for (const bridge of meta.openingBridges ?? []) {
      if (bridge.id !== "zaivon-2026-10-22-opening-bridge") continue;
      bridge.classification = "rendimento_presumido_nao_comprovado";
      bridge.status = "pendente_de_confirmacao_documental";
      bridge.note = "Diferença de R$5,06 entre o fechamento de 21/10 (5212,02) e a abertura informada de 22/10 (5217,08). Classificação provável de rendimento bancário, sem comprovante. Não é venda, quitação, caixa operacional nem rendimento confirmado. O fechamento de 21/10 não foi reescrito. Nenhuma movimentação de R$5,06 foi encontrada no caixa.";
    }
    for (const book of meta.customerCredits ?? []) {
      if (book.id !== CREDIT_ID) continue;
      if (book.balance !== 1) throw new Error(`Residual do Vanderson está em ${book.balance}`);
      book.balance = 0;
      book.writeOffs = [
        ...(book.writeOffs ?? []),
        {
          id: WAIVER,
          date: "2026-10-24",
          amount: 1,
          cash: false,
          competence: false,
          revenue: false,
          reason: "Baixa administrativa do residual por decisão do responsável. Não será usado em compra futura. Não é Pix, não é venda e não entra no lucro.",
        },
      ];
      book.planned = book.planned.map((item) =>
        item.amount === 1
          ? { ...item, status: "encerrado_sem_receita", note: "Residual de R$1 encerrado em 24/10/2026 por decisão do responsável, sem apropriação como receita." }
          : item,
      );
    }
    await tx.update(appSettings).set({ value: meta, updatedAt: now }).where(eq(appSettings.key, META_KEY));

    const frozen = await tx
      .select({ narrative: diaryEntries.narrative })
      .from(operationDays)
      .innerJoin(diaryEntries, eq(diaryEntries.operationDayId, operationDays.id))
      .where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, "2026-10-21")));
    const frozenCash = (frozen[0]?.narrative as { dayClosing?: { cash?: { cashIn?: number }; piggyBank?: { closingBalance?: number } } } | null)?.dayClosing;
    if (!near(frozenCash?.cash?.cashIn ?? 0, 188) || !near(frozenCash?.piggyBank?.closingBalance ?? 0, 5212.02)) {
      throw new Error("Fechamento de 21/10 foi atingido");
    }
    const nextDay = await tx.select({ status: operationDays.status }).from(operationDays).where(eq(operationDays.operationDate, "2026-10-23"));
    if (nextDay[0]?.status !== "open") throw new Error("23/10 não está aberto");
  });

  await verify(db);
  console.log("VERIFY_OK");
  await closePostgresConnection();
}

async function verify(db: Awaited<ReturnType<typeof getPostgresDb>>) {
  const lines = await db
    .select({ total: sales.totalAmount, notes: sales.notes })
    .from(sales)
    .where(like(sales.notes, `%${PIX}%`));
  if (lines.length !== 23) throw new Error(`Pix individuais: ${lines.length}`);
  const money = lines.reduce((sum, line) => sum + Number(line.total), 0);
  const units = lines.reduce((sum, line) => {
    const match = line.notes?.match(/(\d+) salgado/);
    return sum + Number(match?.[1] ?? 0);
  }, 0);
  if (!near(money, 140) || units !== 28) throw new Error(`Pix ${money} / ${units}`);
  const aggregate = await db.select({ total: sales.totalAmount, notes: sales.notes }).from(sales).where(eq(sales.id, AGGREGATE));
  const items = await db.select({ id: saleItems.id }).from(saleItems).where(eq(saleItems.saleId, AGGREGATE));
  if (Number(aggregate[0]?.total) !== 0 || !(aggregate[0]?.notes ?? "").includes(MIGRATED) || items.length !== 0) {
    throw new Error("Consolidado ainda contabilizável");
  }
  const moves = await db.select({ quantity: stockMovements.quantity }).from(stockMovements).where(eq(stockMovements.id, MOVE));
  if (moves[0]?.quantity !== 28) throw new Error("Baixa física de 28 foi alterada");
  const pending = await db.select().from(operationalPendings).where(eq(operationalPendings.id, PENDING));
  if (pending[0]?.status !== "open" || !(pending[0]?.description ?? "").includes("29/10/2026")) {
    throw new Error("Pendência temporária não ficou ativa");
  }
  const meta = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, META_KEY));
  const value = meta[0]?.value as {
    cofrinho?: Record<string, number>;
    customerCredits?: Array<{ id: string; balance: number; writeOffs?: Array<{ id: string }> }>;
    openingBridges?: Array<{ id?: string; classification?: string; gap?: number }>;
  };
  const book = value.customerCredits?.find((item) => item.id === CREDIT_ID);
  const bridge = value.openingBridges?.find((item) => item.id === "zaivon-2026-10-22-opening-bridge");
  if (book?.balance !== 0 || book.writeOffs?.filter((item) => item.id === WAIVER).length !== 1) {
    throw new Error("Residual do Vanderson sem trilha única");
  }
  if (bridge?.classification !== "rendimento_presumido_nao_comprovado" || !near(bridge.gap ?? 0, 5.06)) {
    throw new Error("Ponte de 5,06 alterada");
  }
  if (!near(value.cofrinho?.["2026-10-22"] ?? 0, 5346.08)) throw new Error("Cofrinho final mudou");
  const tokens = new Set(lines.map((line) => line.notes));
  if (tokens.size !== 23) throw new Error("Token de Pix repetido");
}

main().catch(async (error) => {
  console.error(error);
  await closePostgresConnection();
  process.exit(1);
});
