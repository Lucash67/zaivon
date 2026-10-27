/**
 * Fechamento de 26/10/2026. Idempotente. Não altera dias anteriores.
 * Uma transação. Se a conferência interna falhar, nada fica gravado.
 */
import "./load-env";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { and, eq, inArray, sql } from "drizzle-orm";
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
  stickyNotes,
  stockMovements,
  vaultAccounts,
  vaultMovementRevisions,
  vaultMovements,
} from "../src/lib/db/postgres/schema";
import { buildDayClosing } from "../src/lib/finance/day-closing";
import { centsToMoney, foldVaultCents, moneyToCents } from "../src/lib/vault/balance";
import { getDatabaseUrl } from "../src/platform/db/config";
import { closePostgresConnection, getPostgresDb, runPostgresTransaction } from "../src/platform/db/postgres/client";
import { generateId } from "../src/shared/ids/generate-id";

const BIZ = "00000000-0000-4000-8000-000000000001";
const DATE = "2026-10-26";
const TOKEN = "zaivon-2026-10-26-op-";
const DEPOSIT_KEY = "zaivon-2026-10-26-deposito-110";
const ADENDO = "ZAIVON-2610-ADENDO";
const META_KEY = "omni_v2_meta_salgados";
const PRACTICAL_KEY = "profit_bank_practical_salgados";
const SALGADO = "4da6e5b2-86ad-4f3e-8e71-9492f43f8291";
const SANDWICH = "b1161a39-149e-475c-9eb1-345553006c0d";
const MISTAO = "9f608fcc-70ae-4ac0-8656-96281bffe365";
const PENDING_OLD = "5e78d1cc-ef0e-4d4e-a79f-b06009640606";
const HELLEN = "03430e3d-6ffa-42c4-a5d0-c9584d558f37";
const RHENAN = "4207fee0-7db8-4f00-b755-067fcbde17c6";
const ARYANE = "0515b5d7-09e2-465a-9c89-dc980b55d8f5";
const NOTE_LENGTHS: Record<string, number> = {
  "27b7750f-e39b-4060-9380-2b18b45e9542": 5212,
  "a93195ca-acfd-4ff8-a440-97d22ec7a58d": 7753,
  "ea3da55a-1813-4bd1-942c-b12641a15260": 8634,
  "dd55fd1a-8c74-43ee-8f1d-e4e640675659": 9658,
};

const CLOSURE = `FECHADO COM RESSALVAS. Resultado provisório. Lucro pessoal definitivo pendente dos custos dos sanduíches.

Receita identificada R$ 177. Pix R$ 162, em 28 recebimentos. Fiados identificados R$ 15. Saídas comerciais potenciais R$ 218. Saídas sem pagamento identificado R$ 41. Custo próprio dos salgados R$ 52. Resultado de caixa antes dos custos dos sanduíches R$ 110. Resultado por competência antes dos custos dos sanduíches R$ 125.

R01. R$ 20 na Acal, antes do retorno após o treino. Composição e quantidade de unidades desconhecidas. Não é ausência de retirada.
R02. 3 sanduíches na Acal, entre o fim do expediente e o retorno por volta das 18h. R$ 21. Sem cliente, sem pagamento e sem perda definitiva.
R03. 1 sanduíche de consumo próprio na Acal, após o treino. Receita zero, fiado zero, perda zero.
R04. Estoque físico final: 2 sanduíches. Estoque contábil: 3. A unidade de diferença é a pendência 5e78d1cc, herdada de 23/10, e não foi baixada neste dia.

Cofrinho contábil após o depósito único de R$ 110: R$ 5.704,08. Saldo bancário informado: R$ 5.706,54. Diferença R$ 2,46 sem rendimento. As quatro notas HTML deste dia foram preservadas.`;

type ProductLine = {
  slug: string;
  time: string | null;
  person: string;
  clientId: string | null;
  local: "Unifor" | "Acal";
  kind: "salgado" | "sandwich";
  qty: number;
  amount: number;
  paid: boolean;
  flavor: string;
  extra: string;
};

const PRODUCT_LINES: ProductLine[] = [
  { slug: "hellen", time: "07:56", person: "Hellen Alessandra Oliveira Costa", clientId: HELLEN, local: "Unifor", kind: "salgado", qty: 1, amount: 5, paid: true, flavor: "Mistão de forno", extra: "PIX 07:56 R$ 1 e 08:22 R$ 4. Uma única venda." },
  { slug: "maria-luiza", time: "07:37", person: "Maria Luiza Marinho Rocha", clientId: null, local: "Unifor", kind: "sandwich", qty: 1, amount: 8, paid: true, flavor: "Sanduíche natural", extra: "WhatsApp final 3067 é esta compra. Não quita fiados antigos de R$ 8." },
  { slug: "vitoria", time: "09:19", person: "Vitória Lorena", clientId: null, local: "Unifor", kind: "salgado", qty: 1, amount: 5, paid: true, flavor: "Croissant", extra: "WhatsApp final 5562 é esta compra. Sem cartão novo." },
  { slug: "rhenan", time: "09:08", person: "Rhenan Mateus Matias Filgueira", clientId: RHENAN, local: "Unifor", kind: "salgado", qty: 2, amount: 10, paid: true, flavor: "Mistão frito", extra: "" },
  { slug: "aryane", time: "09:15", person: "Aryane Da Silva Assunção", clientId: ARYANE, local: "Unifor", kind: "salgado", qty: 1, amount: 5, paid: true, flavor: "Mistão frito", extra: "Presencial por volta das 09:16." },
  { slug: "aline", time: "09:15", person: "Aline Maria da Silva Lopes", clientId: null, local: "Unifor", kind: "salgado", qty: 1, amount: 5, paid: true, flavor: "Mistão frito", extra: "WhatsApp final 2264. Cartão não vinculado." },
  { slug: "joao-victor", time: null, person: "João Victor", clientId: null, local: "Unifor", kind: "salgado", qty: 1, amount: 5, paid: false, flavor: "Mistão frito", extra: "Fiado novo. Três cartões homônimos, nenhum vinculado." },
  { slug: "raimunda", time: null, person: "Raimunda Sousa", clientId: null, local: "Acal", kind: "salgado", qty: 2, amount: 10, paid: false, flavor: "sabor não informado", extra: "Fiado novo de 2 salgados. Quatro cartões homônimos, nenhum vinculado." },
];

const RECEIPTS: Array<[number, string, string, number]> = [
  [4, "09:07", "Carla Gabriela", 5],
  [5, "09:07", "Maria Clara Gomes", 10],
  [6, "09:07", "Cristiane Rodrigues", 5],
  [7, "09:07", "Cássio Adriel", 5],
  [8, "09:08", "Pablo Alexandre", 5],
  [10, "09:14", "Anderson da Silva Nascimento", 5],
  [13, "09:18", "Jackson Mendes", 5],
  [15, "09:24", "Yasmin Michelle", 5],
  [16, "09:42", "João Pedro", 5],
  [17, "09:48", "Maria Graziele", 5],
  [18, "09:55", "Cleane Cipriano", 7],
  [19, "09:58", "João Guilherme", 10],
  [20, "09:59", "Cleane Cipriano", 5],
  [21, "11:21", "Gerson Ryan", 5],
  [22, "13:24", "João Pedro Pinto", 5],
  [23, "13:24", "Pedro Iago Lopes", 10],
  [24, "13:29", "Pedro Henrique Ribeiro", 5],
  [25, "14:02", "José Gabriel Santos", 5],
  [26, "15:16", "Francisco Nazareno", 5],
  [27, "16:06", "Vanderson Dias", 7],
  [28, "16:48", "Gerb da Silva Maganos", 5],
];

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.009;
}
function money(n: number): string {
  return n.toFixed(2);
}

async function applyMigration() {
  const sqlClient = postgres(getDatabaseUrl(), { prepare: false, max: 1 });
  await sqlClient.unsafe(readFileSync("drizzle/migrations/0022_unknown_time_and_quantity.sql", "utf8"));
  await sqlClient.end();
}

async function main() {
  await applyMigration();
  const db = await getPostgresDb();
  const existing = await db.execute(sql`select count(*)::int as n from sales where notes like ${TOKEN + "%"}`);
  const already = Number((existing as unknown as Array<{ n: number }>)[0]?.n ?? 0);
  if (already === 29) {
    await verify(db);
    console.log("ZERO_NEW");
    await closePostgresConnection();
    return;
  }
  if (already !== 0) throw new Error(`Dia 26/10 incompleto: ${already} vendas com a chave. Gravação interrompida.`);

  const created = await runPostgresTransaction(async (tx) => {
    const dayRows = await tx.select({ id: operationDays.id }).from(operationDays).where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, DATE)));
    if (dayRows.length > 0) throw new Error("Já existe dia 26/10 sem as 29 chaves. Gravação interrompida.");
    const day27 = await tx.select({ id: operationDays.id }).from(operationDays).where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, "2026-10-27")));
    if (day27.length > 0) throw new Error("27/10 já existe.");

    for (const [id, name] of [[HELLEN, "Hellen Alessandra Oliveira Costa"], [RHENAN, "Rhenan Mateus Matias Filgueira"], [ARYANE, "Aryane Da Silva Assunção"]] as const) {
      const row = await tx.select({ name: clients.name }).from(clients).where(eq(clients.id, id));
      if (row.length !== 1 || row[0].name !== name) throw new Error(`Cartão divergente: ${name}`);
    }

    const noteRows = await tx.select({
      id: stickyNotes.id,
      len: sql<number>`char_length(${stickyNotes.body})::int`,
      ownerId: stickyNotes.ownerId,
    }).from(stickyNotes).where(inArray(stickyNotes.id, Object.keys(NOTE_LENGTHS)));
    const notes = noteRows;
    if (notes.length !== 4) throw new Error("As quatro notas HTML não estão todas presentes.");
    for (const note of notes) {
      if (note.len !== NOTE_LENGTHS[note.id]) throw new Error(`Nota ${note.id} mudou de tamanho. Gravação interrompida.`);
    }
    const ownerId = notes[0].ownerId;

    const stockBefore = await tx.select({ id: products.id, stock: products.stockQuantity }).from(products).where(eq(products.businessId, BIZ));
    const stockMap = new Map(stockBefore.map((row) => [row.id, row.stock]));
    if (stockMap.get(SALGADO) !== 0 || stockMap.get(SANDWICH) !== 1 || stockMap.get(MISTAO) !== 525) {
      throw new Error("Estoque inicial divergente.");
    }
    const oldPending = await tx.select({ status: operationalPendings.status, quantity: operationalPendings.quantity }).from(operationalPendings).where(eq(operationalPendings.id, PENDING_OLD));
    if (oldPending[0]?.status !== "open" || oldPending[0]?.quantity !== 1) throw new Error("Pendência herdada de sanduíche divergente.");

    const saleCountBefore = await tx.execute(sql`select sale_date::text as date, count(*)::int as n from sales where business_id = ${BIZ}::uuid group by sale_date`);
    const countsBefore = new Map((saleCountBefore as unknown as Array<{ date: string; n: number }>).map((row) => [row.date, row.n]));

    const account = await tx.select({ id: vaultAccounts.id }).from(vaultAccounts).where(and(eq(vaultAccounts.businessId, BIZ), eq(vaultAccounts.slug, "salgados-e-sanduiches")));
    if (!account[0]) throw new Error("Conta do cofrinho ausente.");
    const vaultRows = await tx.select({
      key: vaultMovements.idempotencyKey,
      type: vaultMovements.movementType,
      effect: vaultMovements.effect,
      amount: vaultMovements.amount,
      status: vaultMovements.status,
      date: vaultMovements.effectiveDate,
    }).from(vaultMovements).where(eq(vaultMovements.accountId, account[0].id));
    if (vaultRows.some((row) => row.key === DEPOSIT_KEY)) throw new Error("Depósito de R$ 110 já existe sem o dia.");
    const balanceBefore = centsToMoney(foldVaultCents(vaultRows.map((row) => ({
      idempotencyKey: row.key,
      type: row.type,
      effect: row.effect,
      amountCents: moneyToCents(Number(row.amount)),
      status: row.status,
      effectiveDate: row.date,
    }))));
    if (!near(balanceBefore, 5594.08)) throw new Error(`Razão inicial ${balanceBefore}.`);

    const now = new Date();
    let tick = 0;
    const stamp = () => new Date(now.getTime() + tick++);
    const dayId = generateId();
    await tx.insert(operationDays).values({
      id: dayId,
      businessId: BIZ,
      operationDate: DATE,
      status: "closed",
      createdAt: now,
      updatedAt: now,
    });

    const ids: Record<string, string> = { dayId };
    let salgadoBal = 0;
    let sandwichBal = 1;
    const move = async (productId: string, saleId: string | null, type: "entry" | "exit", qty: number, balance: number, reason: string) => {
      const id = generateId();
      await tx.insert(stockMovements).values({
        id,
        productId,
        operationDayId: dayId,
        saleId,
        movementType: type,
        quantity: qty,
        balanceAfter: balance,
        reason,
        createdAt: stamp(),
      });
      return id;
    };

    salgadoBal = 35;
    ids.entrySalgado = await move(SALGADO, null, "entry", 35, salgadoBal, `${TOKEN}entrada-35-salgados`);
    sandwichBal = 10;
    ids.entrySandwich = await move(SANDWICH, null, "entry", 9, sandwichBal, `${TOKEN}producao-9-sanduiches Abertura contabil herdada: 1.`);

    for (const line of PRODUCT_LINES) {
      const saleId = generateId();
      ids[line.slug] = saleId;
      const nameNote = line.clientId ? "" : `NOME-INFORMADO:${line.person}| `;
      await tx.insert(sales).values({
        id: saleId,
        businessId: BIZ,
        operationDayId: dayId,
        clientId: line.clientId,
        saleDate: DATE,
        saleTime: line.time ? `${line.time}:00` : null,
        department: line.local,
        paymentMethod: line.paid ? "pix" : null,
        paymentStatus: line.paid ? "paid" : "pending",
        amountReceived: money(line.paid ? line.amount : 0),
        totalAmount: money(line.amount),
        totalCost: "0.00",
        profit: money(line.amount),
        notes: `${TOKEN}${line.slug} ${nameNote}HORARIO-CONFIANCA:${line.time ? "comprovado" : "nao-informado"} LOCAL:${line.local} CONFIANCA:${line.clientId ? "cartao-unico" : "vinculo-pendente"} SABOR:${line.flavor} ${line.extra}`,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(saleItems).values({
        id: generateId(),
        saleId,
        productId: line.kind === "salgado" ? SALGADO : SANDWICH,
        quantity: line.qty,
        unitPrice: money(line.amount / line.qty),
        unitCost: "0.00",
        subtotal: money(line.amount),
        profit: money(line.amount),
        flavorConfidence: line.flavor === "sabor não informado" ? "unknown" : "confirmed",
      });
      if (line.kind === "salgado") salgadoBal -= line.qty;
      else sandwichBal -= line.qty;
      await move(
        line.kind === "salgado" ? SALGADO : SANDWICH,
        saleId,
        "exit",
        line.qty,
        line.kind === "salgado" ? salgadoBal : sandwichBal,
        `${TOKEN}${line.slug}`,
      );
    }

    for (const [n, time, person, amount] of RECEIPTS) {
      const slug = `pix-${String(n).padStart(2, "0")}`;
      const saleId = generateId();
      ids[slug] = saleId;
      await tx.insert(sales).values({
        id: saleId,
        businessId: BIZ,
        operationDayId: dayId,
        clientId: null,
        saleDate: DATE,
        saleTime: `${time}:00`,
        department: "Acal",
        paymentMethod: "pix",
        paymentStatus: "paid",
        amountReceived: money(amount),
        totalAmount: money(amount),
        totalCost: "0.00",
        profit: "0.00",
        notes: `${TOKEN}${slug} NOME-INFORMADO:${person}| HORARIO-CONFIANCA:comprovado LOCAL:Acal CONFIANCA:composicao-nao-identificada RECEBIMENTO-SEM-COMPOSICAO`,
        createdAt: now,
        updatedAt: now,
      });
    }

    salgadoBal -= 26;
    ids.exitSalgadoAcal = await move(SALGADO, null, "exit", 26, salgadoBal, `${TOKEN}acal-26-salgados-sem-composicao-por-linha`);
    sandwichBal -= 2;
    ids.exitSandwichPaid = await move(SANDWICH, null, "exit", 2, sandwichBal, `${TOKEN}acal-2-sanduiches-pagos-sem-nome`);
    sandwichBal -= 3;
    ids.exitR02 = await move(SANDWICH, null, "exit", 3, sandwichBal, `${TOKEN}r02-3-sanduiches-sem-pagamento`);
    sandwichBal -= 1;
    ids.exitR03 = await move(SANDWICH, null, "exit", 1, sandwichBal, `${TOKEN}r03-consumo-proprio Horario aproximado apos o treino, por volta das 18h. Receita zero.`);
    if (salgadoBal !== 0 || sandwichBal !== 3) throw new Error(`Saldo de movimento ${salgadoBal}/${sandwichBal}.`);

    ids.r01 = generateId();
    ids.r02 = generateId();
    await tx.insert(operationalPendings).values([
      {
        id: ids.r01,
        operationDayId: dayId,
        pendingType: "inventory_investigation",
        quantity: null,
        potentialRevenue: "20.00",
        status: "open",
        description: `${TOKEN}R01 R$ 20 na Acal antes do retorno apos o treino. Quantidade de unidades desconhecida. O campo quantity nulo nao significa ausencia de retirada.`,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: ids.r02,
        operationDayId: dayId,
        pendingType: "inventory_investigation",
        productId: SANDWICH,
        quantity: 3,
        potentialRevenue: "21.00",
        status: "open",
        description: `${TOKEN}R02 3 sanduiches na Acal, entre o fim do expediente e o retorno por volta das 18h. R$ 21. Sem cliente e sem perda definitiva.`,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await tx.insert(dailyInvestments).values([
      { id: generateId(), operationDayId: dayId, amount: "52.00", investmentType: "additional", sourceType: "own_capital", sourceName: "proprietário", description: `${TOKEN}custo-proprio-salgados R$ 52. Nao inclui os sanduiches.` },
      { id: generateId(), operationDayId: dayId, amount: "56.00", investmentType: "additional", sourceType: "other", sourceName: null, description: `${TOKEN}parcela-nao-atribuida R$ 56. Sem terceiro nomeado.` },
    ]);
    const purchaseId = generateId();
    ids.purchase = purchaseId;
    await tx.insert(dailyPurchases).values({ id: purchaseId, operationDayId: dayId, totalUnits: 35, totalInvestment: "108.00", createdAt: now, updatedAt: now });
    await tx.insert(dailyPurchaseItems).values({
      id: generateId(),
      dailyPurchaseId: purchaseId,
      productId: SALGADO,
      productName: "Salgado (sabor não identificado)",
      quantity: 35,
      unitCost: null,
    });

    const closing = buildDayClosing({
      date: DATE,
      competenceRevenue: 177,
      salesReceived: 162,
      priorSettlements: 0,
      otherInflows: 0,
      ownCost: 52,
      thirdPartyCost: 56,
      newCredit: 15,
      lossesAmount: 0,
      lossesUnits: 0,
      stockRemainingUnits: 3,
      piggyOpening: 5594.08,
      piggyDeposit: 110,
      bankYield: 0,
      piggyClosing: 5704.08,
      competenceStatus: "provisional",
      definitivePersonalProfit: "pending",
      extraNotes: [
        "Receita identificada R$ 177. Pix R$ 162. Fiados identificados R$ 15.",
        "Saídas comerciais potenciais R$ 218. Saídas sem pagamento identificado R$ 41.",
        "Custo próprio dos salgados R$ 52. Os R$ 27 de referência dos sanduíches não entram neste custo.",
        "Resultado de caixa antes dos custos dos sanduíches R$ 110.",
        "Resultado por competência antes dos custos dos sanduíches R$ 125.",
        "Lucro pessoal definitivo pendente do reconhecimento dos custos dos sanduíches.",
        "Cofrinho contábil R$ 5.704,08. Saldo informado R$ 5.706,54. Diferença R$ 2,46 sem rendimento.",
      ],
    });
    if (!near(closing.competenceProfit, 125) || !near(closing.cashManagementResult, 110) || !near(closing.cash.cashIn, 162) || closing.definitivePersonalProfit !== "pending") {
      throw new Error("Fechamento calculado fora da prévia.");
    }
    ids.diary = generateId();
    await tx.insert(diaryEntries).values({
      id: ids.diary,
      operationDayId: dayId,
      schemaVersion: 2,
      revenueReceived: "162.00",
      revenuePending: "15.00",
      revenueTotal: "177.00",
      operationalProfit: "110.00",
      quantitySold: 41,
      quantityLost: 0,
      observations: CLOSURE,
      manualInsights: "Lucro pessoal definitivo pendente. R$ 125 e resultado por competencia antes dos custos dos sanduiches. R$ 110 e resultado de caixa antes desses custos.",
      tags: ["zaivon-v2", "day-closing-v2", "zaivon-2610"],
      narrative: { sales: { paidCount: 27, creditCount: 2, receiptsWithoutComposition: 21 }, bonusIncome: 0, dayClosing: closing },
      createdAt: now,
      updatedAt: now,
    });

    const depositId = generateId();
    ids.deposit = depositId;
    const deposit = {
      id: depositId,
      businessId: BIZ,
      accountId: account[0].id,
      movementType: "deposit" as const,
      effect: "credit" as const,
      amount: "110.00",
      effectiveDate: DATE,
      competenceDate: DATE,
      description: "Depósito único de R$ 110 no cofrinho em 26/10. Não é lucro pessoal definitivo. A diferença de R$ 2,46 para o saldo informado de R$ 5.706,54 fica sem rendimento.",
      sourceLabel: "depósito informado em 26/10",
      operationDayId: dayId,
      idempotencyKey: DEPOSIT_KEY,
      status: "posted" as const,
      metadata: {
        classification: "deposito_efetivo",
        revenue: false,
        profit: false,
        previousBalance: 5594.08,
        bookBalance: 5704.08,
        informedBankBalance: 5706.54,
        reconciliationGap: 2.46,
        yield: false,
      },
      createdAt: now,
      updatedAt: now,
    };
    await tx.insert(vaultMovements).values(deposit);
    await tx.insert(vaultMovementRevisions).values({
      id: generateId(),
      movementId: depositId,
      before: null,
      after: deposit,
      reason: "criacao",
      createdAt: now,
    });

    await tx.update(products).set({ stockQuantity: 0, updatedAt: now }).where(eq(products.id, SALGADO));
    await tx.update(products).set({ stockQuantity: 3, updatedAt: now }).where(eq(products.id, SANDWICH));

    const metaRow = await tx.select().from(appSettings).where(eq(appSettings.key, META_KEY));
    const current = metaRow[0]?.value as {
      cofrinho?: Record<string, number>;
      closure?: Record<string, { status: string; note?: string }>;
      henriqueConfirmations?: Array<{ status?: string; amount?: number }>;
    };
    if (!near(current.cofrinho?.["2026-10-22"] ?? 0, 5346.08) || !near(current.cofrinho?.["2026-10-21"] ?? 0, 5212.02)) {
      throw new Error("Cofrinho histórico divergente.");
    }
    if (current.cofrinho?.["2026-10-23"] != null || current.cofrinho?.["2026-10-24"] != null || current.cofrinho?.[DATE] != null) {
      throw new Error("Mapa de cofrinho inesperado.");
    }
    if (current.henriqueConfirmations?.[0]?.status !== "aguardando_confirmacao" || current.henriqueConfirmations?.[0]?.amount !== 22) {
      throw new Error("Confirmação do Henrique divergente.");
    }
    await tx.update(appSettings).set({
      value: {
        ...current,
        cofrinho: { ...current.cofrinho, [DATE]: 5704.08 },
        closure: { ...current.closure, [DATE]: { status: "closed_with_note", note: CLOSURE } },
      },
      updatedAt: now,
    }).where(eq(appSettings.key, META_KEY));
    await tx.insert(appSettings).values({ key: PRACTICAL_KEY, value: 5704.08, updatedAt: now }).onConflictDoUpdate({
      target: appSettings.key,
      set: { value: 5704.08, updatedAt: now },
    });

    ids.adendo = generateId();
    await tx.insert(stickyNotes).values({
      id: ids.adendo,
      ownerId,
      businessId: BIZ,
      title: "Adendo — razão e estoque contábil",
      body: `${ADENDO}\n\nAdendo de 26/10/2026. Não substitui as notas 01 a 04.\n\nRazão contábil após o depósito único de R$ 110: R$ 5.704,08.\nSaldo bancário informado: R$ 5.706,54.\nDiferença preservada: R$ 2,46, sem rendimento lançado.\n\nEstoque físico final: 2 sanduíches.\nEstoque contábil final: 3 sanduíches.\nA unidade que separa esses números é a divergência herdada de 23/10, pendência 5e78d1cc. Ela não foi baixada em 26/10.\n\nAs notas anteriores registram o estoque físico de sanduíches zerado ao fim de 23/10. O razão do catálogo manteve 1 unidade.`,
      color: "default",
      noteDate: DATE,
      pinned: false,
      archived: false,
      sortOrder: 0,
      clientUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const saleCountAfter = await tx.execute(sql`select sale_date::text as date, count(*)::int as n from sales where business_id = ${BIZ}::uuid group by sale_date`);
    for (const row of saleCountAfter as unknown as Array<{ date: string; n: number }>) {
      if (row.date === DATE) {
        if (row.n !== 29) throw new Error(`Vendas do dia ${row.n}.`);
      } else if (countsBefore.get(row.date) !== row.n) {
        throw new Error(`Contagem de ${row.date} mudou.`);
      }
    }
    const stockAfter = await tx.select({ id: products.id, stock: products.stockQuantity }).from(products).where(eq(products.businessId, BIZ));
    for (const row of stockAfter) {
      if (row.id === SALGADO && row.stock !== 0) throw new Error("Salgado final divergente.");
      if (row.id === SANDWICH && row.stock !== 3) throw new Error("Sanduíche final divergente.");
      if (row.id !== SALGADO && row.id !== SANDWICH && row.stock !== stockMap.get(row.id)) {
        throw new Error(`Catálogo alterado: ${row.id}.`);
      }
    }
    const paid = await tx.execute(sql`select count(*)::int as n, coalesce(sum(amount_received), 0)::text as received from sales where operation_day_id = ${dayId}::uuid and payment_status = 'paid'`);
    const paidRow = (paid as unknown as Array<{ n: number; received: string }>)[0];
    if (paidRow.n !== 27 || !near(Number(paidRow.received), 162)) throw new Error("Pix divergente.");
    const credit = await tx.execute(sql`select count(*)::int as n, coalesce(sum(total_amount), 0)::text as total from sales where operation_day_id = ${dayId}::uuid and payment_status = 'pending'`);
    const creditRow = (credit as unknown as Array<{ n: number; total: string }>)[0];
    if (creditRow.n !== 2 || !near(Number(creditRow.total), 15)) throw new Error("Fiados divergentes.");
    const items = await tx.execute(sql`select count(*)::int as n from sale_items where sale_id in (select id from sales where operation_day_id = ${dayId}::uuid)`);
    if (Number((items as unknown as Array<{ n: number }>)[0]?.n) !== 8) throw new Error("Itens de venda divergentes.");
    const receipts = await tx.execute(sql`select count(*)::int as n from sales where operation_day_id = ${dayId}::uuid and notes like '%RECEBIMENTO-SEM-COMPOSICAO%'`);
    if (Number((receipts as unknown as Array<{ n: number }>)[0]?.n) !== 21) throw new Error("Recebimentos divergentes.");
    const nullTimes = await tx.execute(sql`select count(*)::int as n from sales where operation_day_id = ${dayId}::uuid and sale_time is null`);
    if (Number((nullTimes as unknown as Array<{ n: number }>)[0]?.n) !== 2) throw new Error("Horários nulos divergentes.");
    const r01 = await tx.select({ quantity: operationalPendings.quantity }).from(operationalPendings).where(eq(operationalPendings.id, ids.r01));
    if (r01[0]?.quantity !== null) throw new Error("R01 gravou quantidade.");
    const moves = await tx.execute(sql`select count(*)::int as n from stock_movements where operation_day_id = ${dayId}::uuid`);
    if (Number((moves as unknown as Array<{ n: number }>)[0]?.n) !== 14) throw new Error("Movimentos de estoque divergentes.");
    const linkedReceipts = await tx.execute(sql`
      select count(*)::int as n from stock_movements
      where sale_id in (select id from sales where operation_day_id = ${dayId}::uuid and notes like '%RECEBIMENTO-SEM-COMPOSICAO%')`);
    if (Number((linkedReceipts as unknown as Array<{ n: number }>)[0]?.n) !== 0) throw new Error("Recebimento movimentou estoque.");
    const later = await tx.select({ id: operationDays.id }).from(operationDays).where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, "2026-10-27")));
    if (later.length > 0) throw new Error("27/10 foi criado.");
    const noteAfter = await tx.select({
      id: stickyNotes.id,
      len: sql<number>`char_length(${stickyNotes.body})::int`,
    }).from(stickyNotes).where(inArray(stickyNotes.id, Object.keys(NOTE_LENGTHS)));
    for (const note of noteAfter) {
      if (note.len !== NOTE_LENGTHS[note.id]) throw new Error("Nota HTML alterada durante a gravação.");
    }
    return ids;
  });

  await verify(db);
  console.log(JSON.stringify({ status: "VERIFY_OK", created }, null, 2));
  await closePostgresConnection();
}

async function verify(db: Awaited<ReturnType<typeof getPostgresDb>>) {
  const day = await db.select({ id: operationDays.id, status: operationDays.status }).from(operationDays).where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, DATE)));
  if (day.length !== 1 || day[0].status !== "closed") throw new Error("Dia 26/10 não ficou fechado.");
  const later = await db.select({ id: operationDays.id }).from(operationDays).where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, "2026-10-27")));
  if (later.length > 0) throw new Error("27/10 existe.");
  const diary = await db.select().from(diaryEntries).where(eq(diaryEntries.operationDayId, day[0].id));
  if (!near(Number(diary[0]?.revenueReceived), 162) || !near(Number(diary[0]?.revenuePending), 15) || !near(Number(diary[0]?.revenueTotal), 177) || !near(Number(diary[0]?.operationalProfit), 110) || diary[0]?.quantitySold !== 41) {
    throw new Error("Diário divergente na releitura.");
  }
  const narrative = diary[0]?.narrative as { bonusIncome?: number; dayClosing?: { competenceStatus?: string; definitivePersonalProfit?: string; competenceProfit?: number } };
  if (narrative.bonusIncome !== 0 || narrative.dayClosing?.competenceStatus !== "provisional" || narrative.dayClosing?.definitivePersonalProfit !== "pending" || !near(narrative.dayClosing?.competenceProfit ?? 0, 125)) {
    throw new Error("Fechamento provisório divergente na releitura.");
  }
  const previous = await db.select({ date: operationDays.operationDate, status: operationDays.status, received: diaryEntries.revenueReceived, total: diaryEntries.revenueTotal, profit: diaryEntries.operationalProfit }).from(operationDays).innerJoin(diaryEntries, eq(diaryEntries.operationDayId, operationDays.id)).where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, "2026-10-23")));
  if (previous[0]?.status !== "closed" || !near(Number(previous[0]?.received), 195) || !near(Number(previous[0]?.total), 192) || !near(Number(previous[0]?.profit), 195)) {
    throw new Error("23/10 alterado.");
  }
  const day22 = await db.select({ status: operationDays.status, received: diaryEntries.revenueReceived, total: diaryEntries.revenueTotal, profit: diaryEntries.operationalProfit }).from(operationDays).innerJoin(diaryEntries, eq(diaryEntries.operationDayId, operationDays.id)).where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, "2026-10-22")));
  if (day22[0]?.status !== "closed" || !near(Number(day22[0]?.received), 164) || !near(Number(day22[0]?.total), 188) || !near(Number(day22[0]?.profit), 104)) {
    throw new Error("22/10 alterado.");
  }
  const stock = await db.select({ id: products.id, stock: products.stockQuantity }).from(products).where(eq(products.businessId, BIZ));
  const map = new Map(stock.map((row) => [row.id, row.stock]));
  if (map.get(SALGADO) !== 0 || map.get(SANDWICH) !== 3 || map.get(MISTAO) !== 525) throw new Error("Saldos finais divergentes.");
  const vault = await db.select({
    key: vaultMovements.idempotencyKey,
    type: vaultMovements.movementType,
    effect: vaultMovements.effect,
    amount: vaultMovements.amount,
    status: vaultMovements.status,
    date: vaultMovements.effectiveDate,
  }).from(vaultMovements).where(eq(vaultMovements.businessId, BIZ));
  const deposits = vault.filter((row) => row.key === DEPOSIT_KEY);
  if (deposits.length !== 1 || !near(Number(deposits[0].amount), 110) || deposits[0].date !== DATE) throw new Error("Depósito divergente.");
  const balance = centsToMoney(foldVaultCents(vault.map((row) => ({
    idempotencyKey: row.key,
    type: row.type,
    effect: row.effect,
    amountCents: moneyToCents(Number(row.amount)),
    status: row.status,
    effectiveDate: row.date,
  }))));
  if (!near(balance, 5704.08)) throw new Error(`Razão ${balance}.`);
  const practical = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, PRACTICAL_KEY));
  if (!near(Number(practical[0]?.value), 5704.08)) throw new Error("Saldo prático divergente.");
  const meta = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, META_KEY));
  const value = meta[0]?.value as { cofrinho?: Record<string, number>; closure?: Record<string, { status?: string; note?: string }>; henriqueConfirmations?: Array<{ status?: string; amount?: number }> };
  if (value.closure?.[DATE]?.status !== "closed_with_note" || !(value.closure?.[DATE]?.note ?? "").includes("R01") || !(value.closure?.[DATE]?.note ?? "").includes("R04")) {
    throw new Error("Fechamento com ressalva ausente.");
  }
  if (!near(value.cofrinho?.[DATE] ?? 0, 5704.08) || !near(value.cofrinho?.["2026-10-22"] ?? 0, 5346.08) || value.cofrinho?.["2026-10-23"] != null || value.cofrinho?.["2026-10-24"] != null) {
    throw new Error("Mapa do cofrinho divergente.");
  }
  if (value.henriqueConfirmations?.[0]?.status !== "aguardando_confirmacao") throw new Error("Henrique alterado.");
  const oldPending = await db.select({ status: operationalPendings.status }).from(operationalPendings).where(eq(operationalPendings.id, PENDING_OLD));
  if (oldPending[0]?.status !== "open") throw new Error("Pendência de 23/10 alterada.");
  const hellen = await db.execute(sql`select count(*)::int as n from sales where notes like ${TOKEN + "hellen%"} and total_amount = 5`);
  if (Number((hellen as unknown as Array<{ n: number }>)[0]?.n) !== 1) throw new Error("Hellen duplicada ou divergente.");
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closePostgresConnection();
  process.exit(1);
});
