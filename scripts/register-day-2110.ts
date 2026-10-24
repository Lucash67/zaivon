/**
 * Gravação autorizada do fechamento de 21/10/2026.
 * Uma transação. Se a conferência depois do commit falhar, restaura o snapshot.
 * A segunda execução não insere nada.
 */
import "./load-env";
import { readFileSync, writeFileSync } from "fs";
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
  stickyNotes,
  stockMovements,
} from "../src/lib/db/postgres/schema";
import { buildDayClosing } from "../src/lib/finance/day-closing";
import { getPostgresDb, runPostgresTransaction, closePostgresConnection } from "../src/platform/db/postgres/client";
import { generateId } from "../src/shared/ids/generate-id";

const DATE = "2026-10-21";
const BIZ = "00000000-0000-4000-8000-000000000001";
const META_KEY = "omni_v2_meta_salgados";
const SNAPSHOT = "C:/Users/lucas/AppData/Local/Temp/zaivon-import-2110/snapshot-before-write-2110.json";
const PACK = "C:/Users/lucas/AppData/Local/Temp/zaivon-import-2110/ZAIVON-IMPORTACAO-21-10";
const TOKEN = "zaivon-2026-10-21-sales-link-";
const GABRIELA_SALE = "b91520de-3cad-483e-96f4-a75662567fde";
const BERNARDO_SALE = "f6f138ac-c899-434b-ae4c-e7582782907f";
const LUIZA_SALE = "669db9b0-9e17-45a2-9577-28fc4ad0af31";
const GABRIELA_TOKEN = "ZAIVON-2110-GABRIELA-NIGHT-PIX";
const BERNARDO_TOKEN = "ZAIVON-2110-BERNARDO-QUITACAO";
const JOAO_TOKEN = "IDENTITY-PENDING:zaivon-2026-10-21-joao-lucas-identity-pending";
const CREDIT_TOKEN = "CREDIT-APPLIED:zaivon-credit-2026-10-20-raimunda-vanderson";
const PREPAID_TOKEN = "PREPAID-APPLIED:zaivon-2026-10-21-sales-link-007";
const NEW_CLIENT_NOTE = "ZAIVON-2110-NEW-CLIENT";

const FORCE: Record<string, string> = {
  "Gabriela Barreto": "4f708113-ef9d-4c4e-acca-bc13a5f7f606",
  "João Victor dos Santos": "ff50e1c1-7ffd-456b-bbe8-6ed4cbcc5250",
  "Maria Luiza Marinho Rocha": "2615112a-7b83-4b34-a3a3-dffed4da107d",
  "Gerb da Silva Maganos": "2a17be8e-8066-47ff-86dc-ac407b56539d",
  "Anderson das Chagas": "c0dd1d2b-f5de-498b-806a-57c8201336c8",
  "Anderson da Silva Nascimento": "0343e108-75ee-483b-819d-f4982360b91e",
};
const NO_CLIENT = new Set(["João Lucas", "Vanderson"]);

const NOTES = [
  {
    id: "fd9de480-b857-4335-9960-f5f218384ea8",
    file: "01_RESUMO_EXECUTIVO.md",
    title: "Bloco 1 — Resumo executivo e indicadores",
  },
  {
    id: "c837e86d-0743-4f84-b576-40b9e2b4ffc1",
    file: "02_ESTOQUE_OPERACAO.md",
    title: "Bloco 2 — Operação, lotes e estoque",
  },
  {
    id: "7bda930d-edcf-45dc-89c9-1f500357b264",
    file: "03_FINANCEIRO_COFRINHO.md",
    title: "Bloco 3 — Financeiro, caixa, custos e cofrinho",
  },
  {
    id: "0a777d9c-ad20-48b2-9069-f1223a20679e",
    file: "04_FIADOS_AUDITORIA.md",
    title: "Bloco 4 — Fiados, créditos, quitações e ressalvas",
  },
] as const;

const ADDENDUM = `
## Estado persistido em 21/10/2026

A gravação confirma: competência R$208, Pix R$188, fiados novos R$25, quitações antigas R$17, saídas sem vínculo R$26, custo de caixa R$88, resultado de caixa e depósito R$100, custo gerencial R$125, resultado gerencial provisório R$83, diferença de custo R$37, cofrinho final R$5.212,02.

O cartão Lucro pessoal mostra R$120, porque a competência de R$208 menos o custo de caixa de R$88 produz esse valor. O resultado gerencial de R$83 permanece provisório e documentado. A diferença de R$37 não tem causa atribuída.

Ponte de abertura: o fechamento homologado de 20/10 permanece R$5.091,80. A abertura informada de 21/10 é R$5.112,02. A diferença de R$20,22 está em zaivon-2026-10-21-opening-bridge. R$10 são o Pix da Gabriela às 22h05, vinculado ao recebível b91520de-3cad-483e-96f4-a75662567fde por evento complementar, sem reescrever o fechamento de 20/10. R$8 são o Pix das 22h04 citado como Maria Luiza: o vínculo segue pendente, sem baixa de Luiza Marinho (669db9b0-9e17-45a2-9577-28fc4ad0af31) e sem quitar o fiado novo de Maria Luiza Marinho Rocha. R$2,22 seguem sem classificação. Nenhum rendimento bancário foi lançado.

João Lucas permanece com identidade pendente. O cartão Joao Lucas Eloi Pinto não foi usado. Só R$5 entram na competência de 21/10. Os R$5 de 19/10 e os R$5 de 20/10 não são vendas desses dias e não entram na receita de 21/10.

O crédito de Vanderson não tem cartão validado. O consumo de R$7 em 21/10 é competência, sem Pix e sem fiado. O saldo fica R$8. O sanduíche de 23/10 e a dispensa de R$1 não foram executados.

Gerb: os R$12 são recebimento identificado, com origem declarada e vínculo de recebível pendente. As vendas já pagas não foram quitadas outra vez. Bernardo: uma quitação, somente o recebível f6f138ac-c899-434b-ae4c-e7582782907f. Henrique não recebeu venda nem dívida por essa conversão.

As saídas sem vínculo saíram do estoque com motivo retirada_sem_identificacao e status de investigação encerrada com ressalva. Não há cliente, Pix nem perda definitiva.

Estas notas não geram lançamentos.
`.trim();

type Customer = {
  name: string;
  place: string;
  kind: "salgados" | "sandwiches";
  description: string;
  value: number;
  payment: string;
  time?: string;
  certainty?: string;
  externalId: string;
};

type Snapshot = {
  takenAt: string;
  meta: unknown;
  notes: Array<{ id: string; title: string; body: string }>;
  sales: Array<Record<string, unknown>>;
  products: Array<{ id: string; name: string; stock: number }>;
  diaries: Record<string, unknown>;
};

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function money(value: number): string {
  return value.toFixed(2);
}

function qtyOf(description: string): number {
  const match = description.trim().match(/^(\d+)/);
  if (!match) throw new Error(`Quantidade ausente em "${description}"`);
  return Number(match[1]);
}

function kindOf(payment: string): "pix" | "prepaid" | "credit" | "fiado" {
  if (payment === "Pix" || payment.startsWith("Pix agrupado")) return "pix";
  if (payment.startsWith("Pré-pago")) return "prepaid";
  if (payment.startsWith("Crédito")) return "credit";
  if (payment.startsWith("Fiado")) return "fiado";
  throw new Error(`Pagamento desconhecido: ${payment}`);
}

function clock(raw: string | undefined): string {
  const match = String(raw ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "12:00:00";
  return `${match[1]!.padStart(2, "0")}:${match[2]}:00`;
}

function loadCustomers(): Customer[] {
  const payload = JSON.parse(readFileSync(`${PACK}/fechamento_21-10_payload.json`, "utf8")) as {
    customers: Customer[];
  };
  const customers = payload.customers;
  if (customers.length !== 35) throw new Error(`${customers.length} linhas, esperado 35`);
  const ids = new Set(customers.map((c) => c.externalId));
  if (ids.size !== 35) throw new Error("ID externo de venda repetido");
  let total = 0;
  let salgados = 0;
  let sandwiches = 0;
  let pix = 0;
  let fiado = 0;
  let prepaid = 0;
  let credit = 0;
  for (const customer of customers) {
    const qty = qtyOf(customer.description);
    const unit = customer.value / qty;
    if (!near(unit * qty, customer.value)) throw new Error(`Valor indivisível: ${customer.externalId}`);
    total += customer.value;
    if (customer.kind === "salgados") salgados += qty;
    else if (customer.kind === "sandwiches") sandwiches += qty;
    else throw new Error(`Tipo desconhecido: ${customer.kind}`);
    const kind = kindOf(customer.payment);
    if (kind === "pix") pix += customer.value;
    if (kind === "fiado") fiado += customer.value;
    if (kind === "prepaid") prepaid += customer.value;
    if (kind === "credit") credit += customer.value;
  }
  if (!near(total, 208) || salgados !== 33 || sandwiches !== 6) {
    throw new Error(`Pacote fora da conta: total ${total}, salgados ${salgados}, sanduíches ${sandwiches}`);
  }
  if (!near(pix, 171) || !near(fiado, 25) || !near(prepaid, 5) || !near(credit, 7)) {
    throw new Error(`Classes fora da conta: pix ${pix}, fiado ${fiado}, pré ${prepaid}, crédito ${credit}`);
  }
  return customers;
}

function noteBody(file: string): string {
  let body = readFileSync(`${PACK}/notas/${file}`, "utf8").trim();
  if (file.startsWith("04_")) {
    const before = body;
    body = body
      .replace(
        "pagamento 20/10 às 22h04 quitou somente o dia anterior",
        "Pix de 20/10 às 22h04 está na ponte de abertura, com vínculo pendente; não quita este fiado nem o cartão Luiza Marinho",
      )
      .replace(
        "- Maria Luiza: Pix R$8 em 20/10 às 22h04 = quitação de 20/10; não quita automaticamente fiado de 21/10.",
        "- Maria Luiza: Pix R$8 em 20/10 às 22h04 entra na ponte de abertura. O vínculo com um recebível segue pendente. Não baixa Luiza Marinho e não quita o fiado novo de Maria Luiza Marinho Rocha.",
      )
      .replace(
        "- Gerb da Silva Maganos: Pix R$22 em 21/10 08h46 = R$10 referentes aos 2 salgados de 21/10 na Acal, R$7 de sanduíche do dia 20/10 e R$5 de salgado do dia 16/10.",
        "- Gerb da Silva Maganos: Pix R$22 em 21/10 08h46 = R$10 dos 2 salgados de 21/10. Os R$12 restantes têm origem declarada (R$5 em 16/10 e R$7 em 20/10), com vínculo de recebível pendente. Vendas já pagas não foram quitadas outra vez.",
      );
    if (body === before) throw new Error("A nota 4 não continha as frases que precisavam de correção");
  }
  return `${body}\n\n${ADDENDUM}\n`;
}

function assertHomologated(
  date: string,
  narrative: unknown,
  expected: { cash: number; own: number; deposit: number; close: number; competence: number },
): void {
  const parsed = JSON.parse(guardOf(narrative)) as {
    cash: number;
    own: number;
    deposit: number;
    close: number;
    competence: number;
  };
  if (
    !near(parsed.cash, expected.cash) ||
    !near(parsed.own, expected.own) ||
    !near(parsed.deposit, expected.deposit) ||
    !near(parsed.close, expected.close) ||
    !near(parsed.competence, expected.competence)
  ) {
    throw new Error(`Fechamento de ${date} inesperado: ${guardOf(narrative)}`);
  }
}

function guardOf(narrative: unknown): string {
  const closing = (narrative as { dayClosing?: Record<string, unknown> } | null)?.dayClosing;
  if (!closing) return "sem-fechamento";
  const cash = closing.cash as { cashIn?: number } | undefined;
  const costs = closing.costs as { ownCost?: number } | undefined;
  const piggy = closing.piggyBank as { deposit?: number; closingBalance?: number; openingBalance?: number } | undefined;
  return JSON.stringify({
    cash: cash?.cashIn ?? null,
    own: costs?.ownCost ?? null,
    deposit: piggy?.deposit ?? null,
    close: piggy?.closingBalance ?? null,
    open: piggy?.openingBalance ?? null,
    competence: closing.competenceRevenue ?? null,
  });
}

async function main(): Promise<void> {
  const customers = loadCustomers();
  const db = await getPostgresDb();
  const existing = await db
    .select({ id: sales.id })
    .from(sales)
    .where(and(eq(sales.businessId, BIZ), like(sales.notes, `%${TOKEN}%`)));
  if (existing.length === 35) {
    await verify(db, "segunda execução");
    console.log("ZERO_NEW");
    return;
  }
  if (existing.length > 0) {
    throw new Error(`Importação parcial: ${existing.length} vendas com o token. Nada foi alterado nesta execução.`);
  }

  const snapshot = await takeSnapshot(db);
  validateSnapshot(snapshot);
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot));
  const reread = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Snapshot;
  if (reread.notes.length !== 4 || reread.sales.length !== 3) throw new Error("Snapshot relido incompleto");
  console.log("SNAPSHOT_OK", SNAPSHOT);

  const clientIds = await resolveClients(db, customers);
  let committed = false;
  try {
    const written = await runPostgresTransaction(async (tx) => {
      await applyPendingStatus(tx);
      return writeAll(tx, customers, clientIds);
    });
    committed = true;
    console.log("COMMIT_OK");
    console.log(JSON.stringify(written, null, 2));
    await verify(db, "depois do commit");
    console.log("VERIFY_OK");
  } catch (error) {
    if (committed) {
      console.error("VERIFY_FAIL — restaurando snapshot");
      await restore(snapshot);
      console.error("SNAPSHOT_RESTAURADO");
    }
    throw error;
  }
}

async function takeSnapshot(db: Awaited<ReturnType<typeof getPostgresDb>>): Promise<Snapshot> {
  const metaRow = await db.select().from(appSettings).where(eq(appSettings.key, META_KEY));
  const noteRows = await db
    .select({ id: stickyNotes.id, title: stickyNotes.title, body: stickyNotes.body })
    .from(stickyNotes)
    .where(inArray(stickyNotes.id, NOTES.map((n) => n.id)));
  const saleRows = await db
    .select()
    .from(sales)
    .where(inArray(sales.id, [GABRIELA_SALE, BERNARDO_SALE, LUIZA_SALE]));
  const productRows = await db
    .select({ id: products.id, name: products.name, stock: products.stockQuantity })
    .from(products)
    .where(eq(products.businessId, BIZ));
  const diaryRows = await db
    .select({ date: operationDays.operationDate, narrative: diaryEntries.narrative })
    .from(operationDays)
    .leftJoin(diaryEntries, eq(diaryEntries.operationDayId, operationDays.id))
    .where(
      and(
        eq(operationDays.businessId, BIZ),
        inArray(operationDays.operationDate, ["2026-10-15", "2026-10-19", "2026-10-20", DATE]),
      ),
    );
  const diaries: Record<string, unknown> = {};
  for (const row of diaryRows) diaries[row.date] = row.narrative ?? null;
  return {
    takenAt: new Date().toISOString(),
    meta: metaRow[0]?.value ?? null,
    notes: noteRows,
    sales: saleRows as unknown as Array<Record<string, unknown>>,
    products: productRows,
    diaries,
  };
}

function validateSnapshot(snapshot: Snapshot): void {
  if (snapshot.notes.length !== 4) throw new Error("Snapshot sem as quatro notas");
  if (snapshot.sales.length !== 3) throw new Error("Snapshot sem as três vendas de controle");
  const byId = new Map(snapshot.sales.map((s) => [String(s.id), s]));
  for (const id of [GABRIELA_SALE, BERNARDO_SALE, LUIZA_SALE]) {
    const row = byId.get(id);
    if (!row || row.paymentStatus !== "pending" || Number(row.amountReceived) !== 0) {
      throw new Error(`Venda de controle ${id} não está pendente com recebido zero`);
    }
  }
  const stock = new Map(snapshot.products.map((p) => [p.name, p.stock]));
  if (stock.get("Salgado (sabor não identificado)") !== 0) throw new Error("Estoque do salgado não identificado mudou antes da escrita");
  if (stock.get("Sanduíche Natural") !== 2) throw new Error("Estoque do sanduíche mudou antes da escrita");
  if (stock.get("Mistão Frito") !== 525) throw new Error("Estoque do mistão frito mudou antes da escrita");
  if (snapshot.diaries[DATE]) throw new Error("21/10 já tem diário");
  const meta = snapshot.meta as { cofrinho?: Record<string, number> };
  if (!near(meta.cofrinho?.["2026-10-20"] ?? 0, 5091.8)) throw new Error("Cofrinho de 20/10 não está em 5091,80");
  if (!near(meta.cofrinho?.["2026-10-19"] ?? 0, 4974.61)) throw new Error("Cofrinho de 19/10 não está em 4974,61");
  assertHomologated("2026-10-20", snapshot.diaries["2026-10-20"], { cash: 165, own: 50, deposit: 115, close: 5091.8, competence: 172 });
  assertHomologated("2026-10-19", snapshot.diaries["2026-10-19"], { cash: 118, own: 110, deposit: 118, close: 4974.61, competence: 170 });
}

async function resolveClients(
  db: Awaited<ReturnType<typeof getPostgresDb>>,
  customers: Customer[],
): Promise<Map<string, string | null>> {
  const rows = await db.select({ id: clients.id, name: clients.name }).from(clients);
  const byNorm = new Map<string, string[]>();
  const byId = new Map(rows.map((r) => [r.id, r.name]));
  for (const row of rows) {
    const key = norm(row.name);
    byNorm.set(key, [...(byNorm.get(key) ?? []), row.id]);
  }
  const resolved = new Map<string, string | null>();
  for (const name of Array.from(new Set(customers.map((c) => c.name)))) {
    if (NO_CLIENT.has(name)) {
      resolved.set(name, null);
      continue;
    }
    const forced = FORCE[name];
    if (forced) {
      const stored = byId.get(forced);
      if (!stored || !norm(stored).includes(norm(name))) {
        throw new Error(`Cartão forçado de ${name} não confere: ${stored ?? "ausente"}`);
      }
      resolved.set(name, forced);
      continue;
    }
    const hits = byNorm.get(norm(name)) ?? [];
    if (hits.length > 1) throw new Error(`Nome ambíguo, escrita interrompida: ${name}`);
    resolved.set(name, hits[0] ?? "CREATE");
  }
  return resolved;
}

async function applyPendingStatus(tx: Parameters<Parameters<typeof runPostgresTransaction>[0]>[0]): Promise<void> {
  const found = await tx.execute(sql`
    SELECT c.conname AS name, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'operational_pendings'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%status%'
  `);
  const checks = Array.from(found as unknown as Array<{ name: string; def: string }>);
  if (checks.some((c) => c.def.includes("closed_with_caveat"))) return;
  for (const check of checks) {
    await tx.execute(sql.raw(`ALTER TABLE public.operational_pendings DROP CONSTRAINT "${check.name}"`));
  }
  await tx.execute(sql`
    ALTER TABLE public.operational_pendings
    ADD CONSTRAINT operational_pendings_status_check
    CHECK (status IN ('open', 'resolved', 'converted_to_loss', 'closed_with_caveat'))
  `);
}

async function writeAll(
  tx: Parameters<Parameters<typeof runPostgresTransaction>[0]>[0],
  customers: Customer[],
  clientIds: Map<string, string | null>,
): Promise<{ saleIds: string[]; createdClients: string[]; operationDayId: string }> {
  const now = new Date();
  await tx.execute(sql`SELECT id FROM products WHERE business_id = ${BIZ} FOR UPDATE`);
  await tx.execute(sql`SELECT key FROM app_settings WHERE key = ${META_KEY} FOR UPDATE`);

  const catalog = await tx
    .select()
    .from(products)
    .where(eq(products.businessId, BIZ));
  const salgado = catalog.find((p) => p.name === "Salgado (sabor não identificado)");
  const sandwich = catalog.find((p) => p.name === "Sanduíche Natural");
  if (!salgado || !sandwich) throw new Error("Produto do lote ausente");
  if (salgado.stockQuantity !== 0 || sandwich.stockQuantity !== 2) {
    throw new Error("Estoque do lote mudou dentro da transação");
  }
  const dayRows = await tx
    .select({ id: operationDays.id })
    .from(operationDays)
    .where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, DATE)));
  if (dayRows.length > 0) throw new Error("Dia operacional de 21/10 já existe");

  const createdClients: string[] = [];
  for (const [name, id] of Array.from(clientIds.entries())) {
    if (id !== "CREATE") continue;
    const created = generateId();
    await tx.insert(clients).values({
      id: created,
      name,
      notes: NEW_CLIENT_NOTE,
      registeredBusinessId: BIZ,
      createdAt: now,
      updatedAt: now,
    });
    clientIds.set(name, created);
    createdClients.push(created);
  }

  const operationDayId = generateId();
  await tx.insert(operationDays).values({
    id: operationDayId,
    businessId: BIZ,
    operationDate: DATE,
    status: "closed",
    createdAt: now,
    updatedAt: now,
  });

  let salgadoBal = 0;
  let sandwichBal = 2;
  salgadoBal += 34;
  sandwichBal += 7;
  await move(tx, salgado.id, operationDayId, null, "entry", 34, salgadoBal, "ZAIVON-2110 entrada lote salgados", now);
  await move(tx, sandwich.id, operationDayId, null, "entry", 7, sandwichBal, "ZAIVON-2110 entrada sanduiches novos", now);

  const saleIds: string[] = [];
  for (const customer of customers) {
    const qty = qtyOf(customer.description);
    const kind = kindOf(customer.payment);
    const product = customer.kind === "salgados" ? salgado : sandwich;
    const clientId = clientIds.get(customer.name);
    if (clientId === "CREATE" || clientId === undefined) throw new Error(`Cliente sem resolução: ${customer.name}`);
    if ((customer.name === "João Lucas" || customer.name === "Vanderson") && clientId !== null) {
      throw new Error(`${customer.name} receberia um cartão`);
    }
    const saleId = generateId();
    const total = customer.value;
    const unit = total / qty;
    const notes = [
      customer.externalId,
      customer.description,
      customer.place,
      customer.payment,
      customer.certainty ?? "",
      "ZAIVON-2110",
      kind === "prepaid" ? PREPAID_TOKEN : "",
      kind === "credit" ? CREDIT_TOKEN : "",
      customer.name === "João Lucas" ? JOAO_TOKEN : "",
      customer.time ? "" : "horário não informado",
    ]
      .filter(Boolean)
      .join(" | ");
    await tx.insert(sales).values({
      id: saleId,
      businessId: BIZ,
      operationDayId,
      clientId,
      saleDate: DATE,
      saleTime: clock(customer.time),
      department: customer.place,
      paymentMethod: kind === "pix" ? "pix" : null,
      paymentStatus: kind === "fiado" ? "pending" : "paid",
      amountReceived: money(kind === "pix" ? total : 0),
      settlementDate: null,
      totalAmount: money(total),
      totalCost: "0.00",
      profit: money(total),
      notes,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(saleItems).values({
      id: generateId(),
      saleId,
      productId: product.id,
      quantity: qty,
      unitPrice: money(unit),
      unitCost: "0.00",
      subtotal: money(total),
      profit: money(total),
      flavorConfidence: customer.kind === "salgados" ? "unknown" : "confirmed",
    });
    if (customer.kind === "salgados") salgadoBal -= qty;
    else sandwichBal -= qty;
    await move(
      tx,
      product.id,
      operationDayId,
      saleId,
      "exit",
      qty,
      customer.kind === "salgados" ? salgadoBal : sandwichBal,
      `ZAIVON-2110 sale ${customer.externalId}`,
      now,
    );
    saleIds.push(saleId);
  }

  salgadoBal -= 1;
  sandwichBal -= 3;
  if (salgadoBal !== 0 || sandwichBal !== 0) {
    throw new Error(`Estoque final do lote ${salgadoBal} / ${sandwichBal}`);
  }
  await move(tx, salgado.id, operationDayId, null, "exit", 1, 0, "retirada_sem_identificacao EX-21-S-01", now);
  await move(tx, sandwich.id, operationDayId, null, "exit", 3, 0, "retirada_sem_identificacao EX-21-SN-01", now);
  await tx.update(products).set({ stockQuantity: 0, updatedAt: now }).where(eq(products.id, salgado.id));
  await tx.update(products).set({ stockQuantity: 0, updatedAt: now }).where(eq(products.id, sandwich.id));

  await tx.insert(operationalPendings).values([
    {
      id: generateId(),
      operationDayId,
      pendingType: "inventory_investigation",
      productId: salgado.id,
      quantity: 1,
      potentialRevenue: "5.00",
      status: "closed_with_caveat",
      description:
        "EX-21-S-01 retirada_sem_identificacao investigacao_encerrada_com_ressalva. 1 salgado, R$5, Acal. Recebimento R$0. Sem cliente, sem fiado nominal e sem perda definitiva.",
      resolvedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      operationDayId,
      pendingType: "inventory_investigation",
      productId: sandwich.id,
      quantity: 3,
      potentialRevenue: "21.00",
      status: "closed_with_caveat",
      description:
        "EX-21-SN-01 retirada_sem_identificacao investigacao_encerrada_com_ressalva. 3 sanduíches, R$21, Acal. Recebimento R$0. Sem cliente, sem fiado nominal e sem perda definitiva.",
      resolvedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await settleGabriela(tx, now);
  await settleBernardo(tx, now);

  const closing = buildDayClosing({
    date: DATE,
    competenceRevenue: 208,
    salesReceived: 171,
    priorSettlements: 17,
    otherInflows: 0,
    ownCost: 88,
    thirdPartyCost: 0,
    newCredit: 25,
    lossesAmount: 0,
    lossesUnits: 0,
    stockRemainingUnits: 0,
    piggyOpening: 5112.02,
    piggyDeposit: 100,
    bankYield: 0,
    piggyClosing: 5212.02,
    competenceStatus: "provisional",
    operationalAudit: {
      salgados: {
        initial: 34,
        paidUnits: 33,
        lostUnits: 0,
        final: 0,
        status: "ok",
        note: "33 unidades em vendas e 1 saída sem vínculo. Estoque final zero. A saída não é perda.",
      },
      sandwiches: {
        initial: 9,
        ownConsumption: 0,
        counted: 0,
        status: "ok",
        note: "7 novos mais 2 remanescentes. 6 vendas e 3 saídas sem vínculo. Os 2 remanescentes não foram custeados de novo. Estoque final zero.",
      },
    },
    extraNotes: [
      "ENCERRADO COM RESSALVAS AUDITÁVEIS.",
      "Competência 208 = Pix de vendas 171 + pré-pago 5 + crédito 7 + fiados novos 25.",
      "A identidade 208 − 188 = 20 fecha com fiados 25 − quitações 17 + pré-pago 5 + crédito 7.",
      "Pix 188 = 171 + Gerb 12 + Bernardo 5. Pré-pago e crédito têm valor recebido zero.",
      "Lucro pessoal exibido 120 = 208 − custo de caixa 88. Resultado de caixa 100 = 188 − 88. Depósito 100.",
      "Custo gerencial 125 (salgados 104 + sanduíches novos 7 × 3). Resultado gerencial provisório 83 = 208 − 125. Diferença de bases 37, sem causa atribuída.",
      "Saídas sem vínculo 26, fora da competência e fora do caixa.",
      "Ponte zaivon-2026-10-21-opening-bridge: 5091,80 + 20,22 = 5112,02. R$10 Gabriela vinculados. R$8 Maria Luiza com vínculo pendente. R$2,22 sem classificação. Rendimento 0.",
      "Cofrinho final 5212,02. O fechamento de 20/10 permanece 5091,80.",
    ],
  });
  if (!near(closing.competenceProfit, 120) || !near(closing.cash.cashIn, 188) || !near(closing.cashManagementResult, 100)) {
    throw new Error("Fechamento calculado fora dos critérios");
  }
  if (!near(closing.piggyBank.closingBalance, 5212.02) || !near(closing.piggyBank.openingBalance, 5112.02)) {
    throw new Error("Cofrinho calculado fora dos critérios");
  }

  const diaryId = generateId();
  await tx.insert(diaryEntries).values({
    id: diaryId,
    operationDayId,
    schemaVersion: 2,
    revenueReceived: "188.00",
    revenuePending: "25.00",
    revenueTotal: "208.00",
    operationalProfit: "100.00",
    quantitySold: 39,
    quantityLost: 0,
    observations: [
      "Fechamento 21/10 — ENCERRADO COM RESSALVAS AUDITÁVEIS.",
      "Competência R$208. Pix R$188. Fiados novos R$25. Custo de caixa R$88. Resultado de caixa R$100.",
      "Lucro pessoal da tela R$120. Resultado gerencial provisório R$83. Diferença de custo R$37.",
      "Quatro unidades sem vínculo saíram do estoque e não são perda.",
    ].join("\n"),
    manualInsights:
      "Pré-pago e crédito não entram no Pix. A ponte de R$20,22 não é rendimento. O vínculo noturno de R$8 segue pendente.",
    tags: ["zaivon-v2", "day-closing-v2", "zaivon-2110"],
    narrative: {
      sales: { paidCount: 33, creditCount: 4 },
      bonusIncome: 0,
      bonusIncomeDescription: "Não há bônus novo em 21/10. O crédito de Vanderson consome o bônus já registrado em 20/10.",
      dayClosing: closing,
    },
    createdAt: now,
    updatedAt: now,
  });

  await tx.insert(dailyInvestments).values({
    id: generateId(),
    operationDayId,
    amount: "88.00",
    investmentType: "additional",
    sourceType: "own_capital",
    sourceName: null,
    description: "ZAIVON-2110 custo de caixa informado. Não é o custo gerencial de R$125 e não é saída bancária além da destinação já conciliada.",
  });
  const purchaseId = generateId();
  await tx.insert(dailyPurchases).values({
    id: purchaseId,
    operationDayId,
    totalUnits: 41,
    totalInvestment: "88.00",
    createdAt: now,
    updatedAt: now,
  });
  await tx.insert(dailyPurchaseItems).values([
    {
      id: generateId(),
      dailyPurchaseId: purchaseId,
      productId: salgado.id,
      productName: salgado.name,
      quantity: 34,
      unitCost: null,
    },
    {
      id: generateId(),
      dailyPurchaseId: purchaseId,
      productId: sandwich.id,
      productName: sandwich.name,
      quantity: 7,
      unitCost: null,
    },
  ]);

  const metaRow = await tx.select().from(appSettings).where(eq(appSettings.key, META_KEY));
  const current = metaRow[0]?.value as {
    cofrinho: Record<string, number>;
    closure: Record<string, { status: string; note?: string }>;
    extraSettlements: Array<{ id: string }>;
    lossSaleIds: string[];
  };
  if (!current?.cofrinho || !near(current.cofrinho["2026-10-20"] ?? 0, 5091.8)) {
    throw new Error("Meta de 20/10 ausente na hora de gravar");
  }
  const next = {
    ...current,
    cofrinho: { ...current.cofrinho, [DATE]: 5212.02 },
    closure: {
      ...current.closure,
      [DATE]: {
        status: "closed_with_note",
        note: "ENCERRADO COM RESSALVAS AUDITÁVEIS",
      },
    },
    extraSettlements: [
      ...current.extraSettlements,
      {
        id: "zaivon-2026-10-21-gerb-12",
        person: "Gerb da Silva Maganos",
        originDate: "2026-10-16",
        paidDate: DATE,
        amount: 12,
        note: "ZAIVON-2110. Pix único de R$22: R$10 são a venda zaivon-2026-10-21-sales-link-010. R$12 são quitações antigas declaradas (R$5 salgado de 16/10 e R$7 sanduíche de 20/10). Não há recebível aberto compatível. As vendas já pagas não foram quitadas de novo. Vínculo pendente de auditoria.",
      },
    ],
    customerCredits: [
      {
        id: "zaivon-credit-2026-10-20-raimunda-vanderson",
        beneficiaryLabel: "Vanderson (identidade pendente)",
        beneficiaryClientId: null,
        origin: {
          date: "2026-10-20",
          source: "bonus",
          person: "Raimunda",
          amount: 15,
          note: "Bônus de R$15 já registrado no caixa de 20/10. Não é entrada nova.",
        },
        consumptions: [
          {
            id: "zaivon-2026-10-21-vanderson-credit-7",
            date: DATE,
            amount: 7,
            saleExternalId: "zaivon-2026-10-21-sales-link-034",
            cash: false,
            competence: true,
          },
        ],
        planned: [
          { date: "2026-10-23", amount: 7, status: "intention", note: "Sanduíche de sexta. Não executado." },
          { amount: 1, status: "waiver_not_executed", note: "Dispensa combinada. Não executada." },
        ],
        balance: 8,
      },
    ],
    provisionalReceivables: [
      {
        id: "zaivon-2026-10-21-joao-lucas-identity-pending",
        label: "João Lucas (identidade pendente)",
        clientId: null,
        excludedClientIds: ["46c69ef9-81af-4ac9-a329-ea8abcc79634"],
        promiseDate: "2026-10-30",
        evidence: "WhatsApp 19h24 em 21/10, três salgados. Sem identidade bastante para um cartão.",
        lines: [
          {
            id: "zaivon-2026-10-21-joao-lucas-line-1910",
            date: "2026-10-19",
            amount: 5,
            inCompetence: false,
            description: "Compromisso informado depois. Não é venda de 19/10 e não entra na competência de 21/10.",
          },
          {
            id: "zaivon-2026-10-21-joao-lucas-line-2010",
            date: "2026-10-20",
            amount: 5,
            inCompetence: false,
            description: "Compromisso informado depois. Não é venda de 20/10 e não entra na competência de 21/10.",
          },
          {
            id: "zaivon-2026-10-21-sales-link-035",
            date: DATE,
            amount: 5,
            inCompetence: true,
            description: "Única competência nova. A venda do dia carrega este valor.",
          },
        ],
      },
    ],
    openingBridges: [
      {
        id: "zaivon-2026-10-21-opening-bridge",
        previousClosing: 5091.8,
        informedOpening: 5112.02,
        gap: 20.22,
        parts: [
          { amount: 10, label: "Pix Gabriela 20/10 22:05", linkStatus: "linked", saleId: GABRIELA_SALE },
          { amount: 8, label: "Pix 20/10 22:04 citado como Maria Luiza", linkStatus: "pending" },
          { amount: 2.22, label: "Sem classificação", linkStatus: "unclassified" },
        ],
      },
    ],
  };
  if (!near(next.cofrinho["2026-10-19"] ?? 0, 4974.61) || !near(next.cofrinho["2026-10-20"] ?? 0, 5091.8)) {
    throw new Error("A meta ia alterar o cofrinho homologado");
  }
  await tx.update(appSettings).set({ value: next, updatedAt: now }).where(eq(appSettings.key, META_KEY));

  for (const note of NOTES) {
    await tx
      .update(stickyNotes)
      .set({ title: note.title, body: noteBody(note.file), updatedAt: now })
      .where(eq(stickyNotes.id, note.id));
  }

  const afterCatalog = await tx
    .select({ id: products.id, name: products.name, stock: products.stockQuantity })
    .from(products)
    .where(eq(products.businessId, BIZ));
  for (const product of afterCatalog) {
    if (product.id === salgado.id || product.id === sandwich.id) {
      if (product.stock !== 0) throw new Error(`${product.name} não zerou`);
      continue;
    }
    const before = catalog.find((p) => p.id === product.id);
    if (!before || before.stockQuantity !== product.stock) {
      throw new Error(`Estoque global alterado: ${product.name}`);
    }
  }

  return { saleIds, createdClients, operationDayId };
}

async function move(
  tx: Parameters<Parameters<typeof runPostgresTransaction>[0]>[0],
  productId: string,
  operationDayId: string,
  saleId: string | null,
  movementType: "entry" | "exit",
  quantity: number,
  balanceAfter: number,
  reason: string,
  now: Date,
): Promise<void> {
  if (quantity <= 0 || balanceAfter < 0) throw new Error(`Movimento inválido: ${reason}`);
  await tx.update(products).set({ stockQuantity: balanceAfter, updatedAt: now }).where(eq(products.id, productId));
  await tx.insert(stockMovements).values({
    id: generateId(),
    productId,
    operationDayId,
    saleId,
    movementType,
    quantity,
    balanceAfter,
    reason,
    createdAt: now,
  });
}

async function settleGabriela(
  tx: Parameters<Parameters<typeof runPostgresTransaction>[0]>[0],
  now: Date,
): Promise<void> {
  const rows = await tx.select().from(sales).where(eq(sales.id, GABRIELA_SALE));
  const row = rows[0];
  if (!row) throw new Error("Recebível da Gabriela ausente");
  if (row.clientId !== "4f708113-ef9d-4c4e-acca-bc13a5f7f606") throw new Error("Titular da Gabriela divergente");
  if (row.saleDate !== "2026-10-20" || Number(row.totalAmount) !== 5 || row.paymentStatus !== "pending" || Number(row.amountReceived) !== 0) {
    throw new Error("Saldo da Gabriela não confere com a prévia");
  }
  await tx
    .update(sales)
    .set({
      paymentStatus: "paid",
      amountReceived: "5.00",
      settlementDate: "2026-10-20",
      notes: `${row.notes ?? ""}\n${GABRIELA_TOKEN} Pix R$10 em 20/10 às 22:05, posterior ao fechamento homologado. R$5 quitam este recebível. R$5 são o pré-pago do salgado entregue em 21/10. O dayClosing de 20/10 não foi reescrito. Este valor não entra no Pix de 21/10.`,
      updatedAt: now,
    })
    .where(eq(sales.id, GABRIELA_SALE));
}

async function settleBernardo(
  tx: Parameters<Parameters<typeof runPostgresTransaction>[0]>[0],
  now: Date,
): Promise<void> {
  const rows = await tx.select().from(sales).where(eq(sales.id, BERNARDO_SALE));
  const row = rows[0];
  if (!row) throw new Error("Recebível do Bernardo ausente");
  if (row.clientId !== "173d1b7d-b39c-4305-9b90-c12744f35f81") throw new Error("Titular do Bernardo divergente");
  if (row.saleDate !== "2026-10-15" || Number(row.totalAmount) !== 5 || row.paymentStatus !== "pending" || Number(row.amountReceived) !== 0) {
    throw new Error("Saldo do Bernardo não confere com a prévia");
  }
  await tx
    .update(sales)
    .set({
      paymentStatus: "paid",
      amountReceived: "5.00",
      settlementDate: DATE,
      notes: `${row.notes ?? ""}\n${BERNARDO_TOKEN} Uma quitação de R$5 em 21/10. A espécie foi convertida em Pix por Henrique. Não há segunda receita e Henrique não é o devedor.`,
      updatedAt: now,
    })
    .where(eq(sales.id, BERNARDO_SALE));
}

async function verify(db: Awaited<ReturnType<typeof getPostgresDb>>, label: string): Promise<void> {
  const daySales = await db
    .select({
      total: sales.totalAmount,
      received: sales.amountReceived,
      status: sales.paymentStatus,
      notes: sales.notes,
      clientId: sales.clientId,
      date: sales.saleDate,
    })
    .from(sales)
    .where(and(eq(sales.businessId, BIZ), like(sales.notes, `%${TOKEN}%`)));
  if (daySales.length !== 35) throw new Error(`${label}: ${daySales.length} vendas`);
  const competence = daySales.reduce((sum, row) => sum + Number(row.total), 0);
  const pix = daySales
    .filter((row) => !String(row.notes).includes("PREPAID-APPLIED:") && !String(row.notes).includes("CREDIT-APPLIED:"))
    .reduce((sum, row) => sum + Number(row.received), 0);
  const prepaid = daySales.filter((row) => String(row.notes).includes("PREPAID-APPLIED:"));
  const credit = daySales.filter((row) => String(row.notes).includes("CREDIT-APPLIED:"));
  const fiado = daySales.filter((row) => row.status === "pending").reduce((sum, row) => sum + Number(row.total), 0);
  if (!near(competence, 208) || !near(pix, 171) || !near(fiado, 25)) {
    throw new Error(`${label}: competência ${competence}, pix ${pix}, fiado ${fiado}`);
  }
  if (prepaid.length !== 1 || Number(prepaid[0]?.received) !== 0 || credit.length !== 1 || Number(credit[0]?.received) !== 0) {
    throw new Error(`${label}: pré-pago ou crédito gerou recebimento`);
  }
  const joao = daySales.filter((row) => String(row.notes).includes(JOAO_TOKEN));
  if (joao.length !== 1 || joao[0]?.clientId !== null || Number(joao[0]?.total) !== 5 || joao[0]?.date !== DATE) {
    throw new Error(`${label}: João Lucas duplicado ou fora da competência`);
  }
  const oldJoao = await db
    .select({ id: sales.id })
    .from(sales)
    .where(and(like(sales.notes, `%${JOAO_TOKEN}%`), inArray(sales.saleDate, ["2026-10-19", "2026-10-20"])));
  if (oldJoao.length > 0) throw new Error(`${label}: compromisso antigo de João Lucas virou venda`);

  const gabriela = await db.select().from(sales).where(eq(sales.id, GABRIELA_SALE));
  const bernardo = await db.select().from(sales).where(eq(sales.id, BERNARDO_SALE));
  const luiza = await db.select().from(sales).where(eq(sales.id, LUIZA_SALE));
  if (gabriela[0]?.paymentStatus !== "paid" || Number(gabriela[0]?.amountReceived) !== 5 || gabriela[0]?.settlementDate !== "2026-10-20") {
    throw new Error(`${label}: Gabriela não regularizada`);
  }
  if (bernardo[0]?.paymentStatus !== "paid" || Number(bernardo[0]?.amountReceived) !== 5 || bernardo[0]?.settlementDate !== DATE) {
    throw new Error(`${label}: Bernardo não quitado uma vez`);
  }
  if (luiza[0]?.paymentStatus !== "pending" || Number(luiza[0]?.amountReceived) !== 0 || Number(luiza[0]?.totalAmount) !== 8) {
    throw new Error(`${label}: Luiza Marinho foi alterada`);
  }

  const fresh = await takeSnapshot(db);
  const before = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Snapshot;
  if (guardOf(fresh.diaries["2026-10-19"]) !== guardOf(before.diaries["2026-10-19"])) {
    throw new Error(`${label}: fechamento de 19/10 mudou`);
  }
  if (guardOf(fresh.diaries["2026-10-20"]) !== guardOf(before.diaries["2026-10-20"])) {
    throw new Error(`${label}: fechamento de 20/10 mudou`);
  }
  if (guardOf(fresh.diaries["2026-10-15"]) !== guardOf(before.diaries["2026-10-15"])) {
    throw new Error(`${label}: fechamento de 15/10 mudou`);
  }
  const meta = fresh.meta as {
    cofrinho: Record<string, number>;
    extraSettlements: Array<{ id: string; amount: number }>;
    customerCredits: Array<{ balance: number; consumptions: Array<{ amount: number; cash: boolean }> }>;
    openingBridges: Array<{ gap: number }>;
  };
  if (!near(meta.cofrinho[DATE] ?? 0, 5212.02) || !near(meta.cofrinho["2026-10-20"] ?? 0, 5091.8)) {
    throw new Error(`${label}: cofrinho divergente`);
  }
  const gerb = meta.extraSettlements.find((item) => item.id === "zaivon-2026-10-21-gerb-12");
  if (!gerb || !near(gerb.amount, 12)) throw new Error(`${label}: quitação do Gerb ausente`);
  if (meta.extraSettlements.filter((item) => item.id === "zaivon-2026-10-21-gerb-12").length !== 1) {
    throw new Error(`${label}: Gerb duplicado`);
  }
  const creditBook = meta.customerCredits?.[0];
  if (!creditBook || !near(creditBook.balance, 8) || creditBook.consumptions.some((item) => item.cash)) {
    throw new Error(`${label}: crédito inconsistente`);
  }
  if (!near(meta.openingBridges?.[0]?.gap ?? 0, 20.22)) throw new Error(`${label}: ponte ausente`);

  const day = fresh.diaries[DATE] as { dayClosing?: { competenceProfit: number; cashManagementResult: number; cash: { cashIn: number }; newCredit: number; costs: { ownCost: number }; competenceRevenue: number; piggyBank: { closingBalance: number } } };
  const closing = day?.dayClosing;
  if (!closing) throw new Error(`${label}: diário sem fechamento`);
  if (!near(closing.competenceRevenue, 208) || !near(closing.cash.cashIn, 188) || !near(closing.newCredit, 25)) {
    throw new Error(`${label}: KPIs do diário divergentes`);
  }
  if (!near(closing.costs.ownCost, 88) || !near(closing.competenceProfit, 120) || !near(closing.cashManagementResult, 100)) {
    throw new Error(`${label}: custo ou resultado divergente`);
  }
  if (!near(closing.piggyBank.closingBalance, 5212.02)) throw new Error(`${label}: cofrinho do diário divergente`);

  const stock = new Map(fresh.products.map((p) => [p.name, p.stock]));
  const beforeStock = new Map(before.products.map((p) => [p.name, p.stock]));
  if (stock.get("Salgado (sabor não identificado)") !== 0 || stock.get("Sanduíche Natural") !== 0) {
    throw new Error(`${label}: lote não zerou`);
  }
  for (const [name, quantity] of Array.from(beforeStock.entries())) {
    if (name === "Salgado (sabor não identificado)" || name === "Sanduíche Natural") continue;
    if (stock.get(name) !== quantity) throw new Error(`${label}: estoque global de ${name} mudou`);
  }
  const pendings = await db
    .select({ status: operationalPendings.status, potential: operationalPendings.potentialRevenue })
    .from(operationalPendings)
    .where(like(operationalPendings.description, "%retirada_sem_identificacao%"));
  if (pendings.length !== 2 || pendings.some((row) => row.status !== "closed_with_caveat")) {
    throw new Error(`${label}: saídas sem vínculo fora do status combinado`);
  }
  const unlinked = pendings.reduce((sum, row) => sum + Number(row.potential), 0);
  if (!near(unlinked, 26)) throw new Error(`${label}: saídas sem vínculo somam ${unlinked}`);
  console.log("VERIFY", label, "208/188/25/17/26/88/100/120/83/5212.02");
}

async function restore(snapshot: Snapshot): Promise<void> {
  await runPostgresTransaction(async (tx) => {
    const day = await tx
      .select({ id: operationDays.id })
      .from(operationDays)
      .where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, DATE)));
    const dayId = day[0]?.id;
    if (dayId) {
      await tx.delete(stockMovements).where(eq(stockMovements.operationDayId, dayId));
      await tx.delete(operationalPendings).where(eq(operationalPendings.operationDayId, dayId));
      const purchase = await tx.select({ id: dailyPurchases.id }).from(dailyPurchases).where(eq(dailyPurchases.operationDayId, dayId));
      if (purchase[0]) {
        await tx.delete(dailyPurchaseItems).where(eq(dailyPurchaseItems.dailyPurchaseId, purchase[0].id));
        await tx.delete(dailyPurchases).where(eq(dailyPurchases.id, purchase[0].id));
      }
      await tx.delete(dailyInvestments).where(eq(dailyInvestments.operationDayId, dayId));
      await tx.delete(diaryEntries).where(eq(diaryEntries.operationDayId, dayId));
      await tx.delete(sales).where(eq(sales.operationDayId, dayId));
      await tx.delete(operationDays).where(eq(operationDays.id, dayId));
    }
    await tx.delete(clients).where(like(clients.notes, `%${NEW_CLIENT_NOTE}%`));
    for (const product of snapshot.products) {
      await tx.update(products).set({ stockQuantity: product.stock }).where(eq(products.id, product.id));
    }
    for (const sale of snapshot.sales) {
      await tx
        .update(sales)
        .set({
          paymentStatus: sale.paymentStatus as "pending",
          amountReceived: String(sale.amountReceived),
          settlementDate: (sale.settlementDate as string | null) ?? null,
          notes: (sale.notes as string | null) ?? null,
          updatedAt: new Date(String(sale.updatedAt)),
        })
        .where(eq(sales.id, String(sale.id)));
    }
    await tx.update(appSettings).set({ value: snapshot.meta, updatedAt: new Date() }).where(eq(appSettings.key, META_KEY));
    for (const note of snapshot.notes) {
      await tx
        .update(stickyNotes)
        .set({ title: note.title, body: note.body, updatedAt: new Date() })
        .where(eq(stickyNotes.id, note.id));
    }
    const still = await tx
      .select({ id: operationalPendings.id })
      .from(operationalPendings)
      .where(eq(operationalPendings.status, "closed_with_caveat"));
    if (still.length === 0) {
      await tx.execute(sql`ALTER TABLE public.operational_pendings DROP CONSTRAINT IF EXISTS operational_pendings_status_check`);
      await tx.execute(sql`
        ALTER TABLE public.operational_pendings
        ADD CONSTRAINT operational_pendings_status_check
        CHECK (status IN ('open', 'resolved', 'converted_to_loss'))
      `);
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePostgresConnection();
  });
