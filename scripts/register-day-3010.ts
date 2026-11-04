/**
 * Fechamento de 30/10/2026. Idempotente. Não reescreve 26/10 a 29/10.
 * Uma transação. Se a conferência interna falhar, nada fica gravado.
 */
import "./load-env";
import { and, eq, sql } from "drizzle-orm";
import {
  appSettings,
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
import { closePostgresConnection, getPostgresDb, runPostgresTransaction } from "../src/platform/db/postgres/client";
import { generateId } from "../src/shared/ids/generate-id";

const BIZ = "00000000-0000-4000-8000-000000000001";
const DATE = "2026-10-30";
const TOKEN = "zaivon-2026-10-30-op-";
const META_KEY = "omni_v2_meta_salgados";
const PRACTICAL_KEY = "profit_bank_practical_salgados";
const SALGADO = "4da6e5b2-86ad-4f3e-8e71-9492f43f8291";
const SANDWICH = "b1161a39-149e-475c-9eb1-345553006c0d";
const MISTAO = "9f608fcc-70ae-4ac0-8656-96281bffe365";
const DEPOSIT_KEY = "zaivon-2026-10-30-deposito-110";
const MIKELLY = "0aa3cfe8-f4f2-424e-8d79-817b326a0b65";

const CARDS: Record<string, string> = {
  "1131c84d-34ed-47ed-a2a3-5d3f657710cb": "Teedy Leuris da Silva Ferreira (Ted)",
  "e0bd8ba3-5771-4fa9-9950-469cdb801f92": "José Kaio Gaspar de Souza",
  "b1e6093e-d560-4e19-aa36-fcfce7050291": "Ana Luzia Araújo Uchoa",
  "d0b0caf1-da35-46b2-a58a-e73c6e57cb91": "Yasmin Michelle Nunes Rodrigues",
  "ce5d926c-287a-4c8b-b2dc-25fedd161b07": "Carla Gabriela Bernardo Martins",
  "3c40b0a0-f38f-4d60-be6e-c083fdd9cafc": "Caio Felipe Teixeira Pereira",
  "5d253d46-a2b3-444f-8d20-ec23a1a3732c": "Diego Martins Pinheiro",
  "204f4c02-323e-4670-b0ec-4473dcf30a8b": "Yonara Bernardo Cabral",
  "313b2851-cc59-44ec-a289-57053a99ea75": "Rodrigo David Gadelha De Sousa",
  "5e9e4ad3-f62c-4dab-90fb-01658eafe6b0": "Hilmanita Carvalho Parente",
  "5f7272f3-b18f-437a-854f-58a5e6c373f7": "Francisco Ricardo Feijão Pinho",
  "0343e108-75ee-483b-819d-f4982360b91e": "Anderson da Silva Nascimento",
  "7769ea47-f698-45b7-8a36-a8e36996bde5": "Yasmin Silva De Lima",
  "8aefb4ec-0bd6-4ce2-8354-37bbeb4a0145": "Pedro Henrique Ribeiro",
  "c96691ae-8973-4a0d-addc-b72e03a7c5d0": "Gerson Ryan Silva De Oliveira",
  "a791206a-b10b-41c1-b715-4d0cba448f1b": "Raimunda Raimunda Sousa",
  "b6d20f20-adc8-4afb-8dc2-f6f759332527": "Leonardo De Sousa Sena",
  [MIKELLY]: "Maria Mikelly Monteiro Coutinho",
};

const FROZEN_SALES = [
  "30e55dfd-74a8-4148-9c22-874547df26ff",
  "33c09ecf-708d-47f8-b73e-1ddca91c9907",
  "4834b3a8-fd8b-4876-9354-2ecee94028da",
  "ce370f65-cbce-406a-907e-ab2ffa95e569",
  "d4d2c007-3434-43be-bb15-3acd8ac1dbaf",
  "fa51ad78-0442-46f6-9ee4-5e0333a476c0",
  "d079013d-d6e4-481c-8ac4-0d5e82c048d0",
  "8fde7aa5-b13a-4df0-b54a-3831145e193a",
  "c38de80d-ef5a-47b2-9d89-4af66b92524b",
  "669db9b0-9e17-45a2-9577-28fc4ad0af31",
  "be8972ea-17a7-40ce-9037-fa8589a45412",
  "047ef351-a74c-475c-8b7c-b0f3635e6b7d",
  "427752a7-69d6-4c7b-b068-51d723807f5a",
  "57f333c9-a36e-4ad0-975b-ab5e00fd5acd",
  "e94ef478-812f-4156-8716-e3e963a35597",
  "46ba70bf-603a-4797-88c2-a61ec949f0c4",
  "4ffd188f-06fe-4f36-bb6a-5d3ceaefc059",
  "679ad48c-8196-46b5-972e-419f657e335f",
];

const FROZEN_NOTES: Record<string, string> = {
  "b5fea118-b05c-43df-816a-c646a85bdcbe": "84d9d42ab9070befe95aff4f329c3978",
  "dd55fd1a-8c74-43ee-8f1d-e4e640675659": "e7445228b84795b3af85c9da2c1a93fe",
  "a93195ca-acfd-4ff8-a440-97d22ec7a58d": "c9f3b37426e2f5bbe414bad9965a1a5c",
  "ea3da55a-1813-4bd1-942c-b12641a15260": "0d80dc200606f041fd298efc1e5608d3",
  "27b7750f-e39b-4060-9380-2b18b45e9542": "4325e9e7672ea932271037d0133f3cb3",
  "ad4fba06-5aa6-4679-b7ae-26e9a6e4d426": "5ca73965acf5eec42396ad850366fd39",
  "42304280-cab9-4e0e-a920-e250817e0f77": "6ef6e0ac574a799b7f550de915fa14dc",
  "bc6a6705-42b9-452f-b7b6-e9e331fe4cda": "2621314f434f1d4e9f1b2b7f78727934",
  "55e031cb-29ef-4fa2-89cd-2bbdef7400eb": "0e2443357246618a36fa196673d42654",
  "54cf71ad-f040-4493-8fab-8a8aa7c6963b": "706a505f205c21fe713da97c443b1db6",
  "3ebeca22-2217-4d6e-977c-0044bb50b256": "192bd8418eb430a415f9032cede00adb",
  "0276b255-4dab-407d-885b-399fb1c25de0": "60710fe06bfd029d0d0bbd9a3cf106c6",
  "dedb5d13-15a2-4ece-aeb0-f95ec327828d": "93651ef6bc75fa8483d6f35f38ef8d9c",
  "52e0553d-2140-4017-9869-9aefd89a72cc": "adfe94a5bcbc2cd9647ca6065240ebe9",
  "65aaf83e-845e-4783-af72-65c7e7012f04": "dcd154b8f40adfecacabe1539c61bc3b",
  "765f2774-a6b9-4090-82b9-4694b5b1fd37": "c2c19576cc8eec5fde4537568a17d36b",
  "d2906fad-b76a-4c3f-866a-4d56b59b2bd4": "19c229e4893b927677669115c4a1de6a",
};

type PixKind = "venda";
const PIX: Array<{ time: string; person: string; cents: number; kind: PixKind }> = [
  { time: "08:29", person: "Teedy Leuris da Silva Ferreira", cents: 500, kind: "venda" },
  { time: "08:32", person: "Matheus Morais Matos", cents: 1000, kind: "venda" },
  { time: "09:08", person: "José Kaio Gaspar de Souza", cents: 1000, kind: "venda" },
  { time: "09:33", person: "Ana Luzia Araújo Uchoa", cents: 500, kind: "venda" },
  { time: "09:11", person: "Yasmin Michelle Nunes Rodrigues", cents: 500, kind: "venda" },
  { time: "09:12", person: "Carla Gabriela Bernardo Martins", cents: 500, kind: "venda" },
  { time: "09:12", person: "Caio Felipe Teixeira Pereira", cents: 500, kind: "venda" },
  { time: "09:17", person: "Diego Martins Pinheiro", cents: 500, kind: "venda" },
  { time: "09:42", person: "Yonara Bernardo Cabral", cents: 500, kind: "venda" },
  { time: "09:42", person: "Rodrigo David Gadelha de Sousa", cents: 500, kind: "venda" },
  { time: "09:48", person: "Hilmanita Carvalho Parente", cents: 500, kind: "venda" },
  { time: "09:54", person: "Francisco Ricardo Feijao Pinho", cents: 500, kind: "venda" },
  { time: "10:02", person: "Anderson da Silva Nascimento", cents: 500, kind: "venda" },
  { time: "10:14", person: "Yasmin Silva de Lima", cents: 500, kind: "venda" },
  { time: "10:20", person: "Pedro Henrique Ribeiro", cents: 500, kind: "venda" },
  { time: "12:01", person: "Geovana Mota de Aquino", cents: 500, kind: "venda" },
  { time: "12:59", person: "Gerson Ryan Silva de Oliveira", cents: 500, kind: "venda" },
  { time: "15:29", person: "Raimunda Raimunda Sousa", cents: 500, kind: "venda" },
  { time: "15:51", person: "Vitória de Sousa Ferreira", cents: 500, kind: "venda" },
  { time: "16:00", person: "Leonardo de Sousa Sena", cents: 500, kind: "venda" },
];

type Line = {
  slug: string;
  time: string | null;
  clientId: string | null;
  person: string;
  local: "Unifor" | "Acal";
  qty: number;
  amount: number;
  received: number;
  status: "paid" | "pending";
  method: "pix" | null;
  flavor: "confirmed" | "unknown";
  extra: string;
};

const LINES: Line[] = [
  { slug: "teedy", time: "08:29", clientId: "1131c84d-34ed-47ed-a2a3-5d3f657710cb", person: "Teedy Leuris da Silva Ferreira (Ted)", local: "Unifor", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "confirmed", extra: "1 frango de forno. Entrega confirmada." },
  { slug: "matheus", time: "08:32", clientId: null, person: "Matheus Morais Matos", local: "Unifor", qty: 2, amount: 10, received: 10, status: "paid", method: "pix", flavor: "confirmed", extra: "1 mistão frito e 1 frango de forno. Sem cartão compatível." },
  { slug: "jose-kaio", time: "09:08", clientId: "e0bd8ba3-5771-4fa9-9950-469cdb801f92", person: "José Kaio Gaspar de Souza", local: "Unifor", qty: 2, amount: 10, received: 10, status: "paid", method: "pix", flavor: "confirmed", extra: "1 mistão frito e 1 coxinha. Entrega confirmada." },
  { slug: "ana-luzia", time: "09:33", clientId: "b1e6093e-d560-4e19-aa36-fcfce7050291", person: "Ana Luzia Araújo Uchoa", local: "Unifor", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "confirmed", extra: "1 queijo frito. Entrega confirmada." },
  { slug: "yasmin-michelle", time: "09:11", clientId: "d0b0caf1-da35-46b2-a58a-e73c6e57cb91", person: "Yasmin Michelle Nunes Rodrigues", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Pix do próprio dia. O sabor não foi identificado." },
  { slug: "carla", time: "09:12", clientId: "ce5d926c-287a-4c8b-b2dc-25fedd161b07", person: "Carla Gabriela Bernardo Martins", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Pix do próprio dia. O sabor não foi identificado." },
  { slug: "caio", time: "09:12", clientId: "3c40b0a0-f38f-4d60-be6e-c083fdd9cafc", person: "Caio Felipe Teixeira Pereira", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Pix do próprio dia. O sabor não foi identificado." },
  { slug: "diego", time: "09:17", clientId: "5d253d46-a2b3-444f-8d20-ec23a1a3732c", person: "Diego Martins Pinheiro", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Pix do próprio dia. O sabor não foi identificado." },
  { slug: "yonara", time: "09:42", clientId: "204f4c02-323e-4670-b0ec-4473dcf30a8b", person: "Yonara Bernardo Cabral", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Pix do próprio dia. O sabor não foi identificado." },
  { slug: "rodrigo", time: "09:42", clientId: "313b2851-cc59-44ec-a289-57053a99ea75", person: "Rodrigo David Gadelha De Sousa", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Cartão com a grafia De Sousa. O cartão De Souza não foi usado." },
  { slug: "hilmanita", time: "09:48", clientId: "5e9e4ad3-f62c-4dab-90fb-01658eafe6b0", person: "Hilmanita Carvalho Parente", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Pix do próprio dia. O sabor não foi identificado." },
  { slug: "feijao", time: "09:54", clientId: "5f7272f3-b18f-437a-854f-58a5e6c373f7", person: "Francisco Ricardo Feijão Pinho", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Pix do próprio dia. O sabor não foi identificado." },
  { slug: "anderson-silva", time: "10:02", clientId: "0343e108-75ee-483b-819d-f4982360b91e", person: "Anderson da Silva Nascimento", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Não é Francisco Anderson das Chagas. O Pix de 29/10 não foi reutilizado." },
  { slug: "yasmin-lima", time: "10:14", clientId: "7769ea47-f698-45b7-8a36-a8e36996bde5", person: "Yasmin Silva De Lima", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Pix do próprio dia. O sabor não foi identificado." },
  { slug: "pedro", time: "10:20", clientId: "8aefb4ec-0bd6-4ce2-8354-37bbeb4a0145", person: "Pedro Henrique Ribeiro", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Pix do próprio dia. O sabor não foi identificado." },
  { slug: "geovana", time: "12:01", clientId: null, person: "Geovana Mota de Aquino", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Sem cartão compatível. Pix do próprio dia." },
  { slug: "gerson", time: "12:59", clientId: "c96691ae-8973-4a0d-addc-b72e03a7c5d0", person: "Gerson Ryan Silva De Oliveira", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Pix do próprio dia. O sabor não foi identificado." },
  { slug: "raimunda-pix", time: "15:29", clientId: "a791206a-b10b-41c1-b715-4d0cba448f1b", person: "Raimunda Raimunda Sousa", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Pix das 15:29 atribuído ao faturamento do próprio dia. Não baixa o fiado novo nem dívida anterior. Raimunda de Sousa Brito e os cartões Souza não foram usados." },
  { slug: "vitoria", time: "15:51", clientId: null, person: "Vitória de Sousa Ferreira", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Sem cartão compatível. Pix do próprio dia." },
  { slug: "leonardo", time: "16:00", clientId: "b6d20f20-adc8-4afb-8dc2-f6f759332527", person: "Leonardo De Sousa Sena", local: "Acal", qty: 1, amount: 5, received: 5, status: "paid", method: "pix", flavor: "unknown", extra: "Cartão Leonardo De Sousa Sena. O cartão Leonardo de Sousa não foi usado." },
  { slug: "fiado-raimunda", time: null, clientId: null, person: "Raimunda", local: "Acal", qty: 1, amount: 5, received: 0, status: "pending", method: null, flavor: "unknown", extra: "Fiado novo antes da chegada. Há vários cartões Raimunda; nenhum foi escolhido. O Pix das 15:29 não quita este fiado. Não havia dívida antiga em aberto." },
  { slug: "fiado-gerb", time: null, clientId: null, person: "Gerb", local: "Acal", qty: 1, amount: 5, received: 0, status: "pending", method: null, flavor: "unknown", extra: "Fiado novo. Os cartões Gerb e Gerb da Silva Maganos não foram escolhidos. Dívida antiga quitada não foi reaberta." },
  { slug: "fiado-mikelly", time: null, clientId: MIKELLY, person: "Maria Mikelly Monteiro Coutinho", local: "Acal", qty: 1, amount: 5, received: 0, status: "pending", method: null, flavor: "unknown", extra: "Fiado novo no cartão já confirmado em 29/10. Outros cartões parecidos não foram mesclados. Não houve pagamento." },
  { slug: "fiado-joao-lucas", time: null, clientId: null, person: "João Lucas", local: "Acal", qty: 1, amount: 5, received: 0, status: "pending", method: null, flavor: "unknown", extra: "Fiado novo. João Lucas Eloi Pinto não foi vinculado. A promessa anterior não foi paga neste lançamento." },
];

const CLOSURE = `FECHADO COM RESSALVAS. Encomenda de 30 salgados. Faturamento identificado R$ 130, sendo R$ 110 recebidos em 20 Pix e R$ 20 em quatro fiados novos. Consumo próprio e retiradas sem vínculo ficaram fora da receita. Custo econômico R$ 91,20, pago por terceiros. Desembolso próprio R$ 0. A previsão anterior de R$ 100 não foi lançada. Depósito único de R$ 110. Razão R$ 6.183,08. Saldo exibido R$ 6.196,09. A diferença de R$ 2,66 frente à projeção de R$ 6.193,43 permanece a apurar e não é rendimento. Dois salgados sem vínculo e dois sanduíches herdados não localizados somam R$ 24 de exposição comercial, sem perda definitiva. Bernardo segue como hipótese, sem cobrança.`;

const NOTES: Array<{ marker: string; sort: number; title: string; html: string }> = [
  {
    marker: "ZAIVON-FECHAMENTO:2026-10-30:01",
    sort: 1,
    title: "30/10/2026 — Operação e Estoque",
    html: `<p>Encomenda de 30 salgados: 14 mistão frito, 7 queijo frito, 3 frango de forno, 3 mistão de forno e 3 coxinhas.</p><p>Distribuição inicial: 14 Unifor e 16 Acal.</p><p>Dois consumos próprios de mistão frito, sem venda, sem fiado e sem receita.</p><p>Seis vendas pagas na Unifor, totalizando R$ 30. Transferência de sete salgados da Unifor para a Acal, sem receita e sem custo adicional.</p><p>Na Acal, 16 vendas pagas, quatro fiados e duas retiradas sem vínculo.</p><p>Estoque físico final de salgados: zero. Conciliação quantitativa: 30 unidades.</p>`,
  },
  {
    marker: "ZAIVON-FECHAMENTO:2026-10-30:02",
    sort: 2,
    title: "30/10/2026 — Financeiro e Cofrinho",
    html: `<p>Pix recebidos: R$ 110, em 20 lançamentos que cobrem 22 salgados pagos.</p><p>Novos fiados: R$ 20. Faturamento identificado: R$ 130.</p><p>Custo de aquisição dos salgados: R$ 91,20, pago por terceiros. Desembolso próprio declarado: R$ 0. A previsão de R$ 100 não foi registrada.</p><p>Depósito efetivo no cofrinho: R$ 110. Saldo após depósito: R$ 6.196,09. Diferença positiva frente à projeção de R$ 6.193,43: R$ 2,66, a apurar.</p><p>O depósito não representa lucro contábil. O resultado econômico de R$ 38,80 não foi lançado como lucro pessoal.</p>`,
  },
  {
    marker: "ZAIVON-FECHAMENTO:2026-10-30:03",
    sort: 3,
    title: "30/10/2026 — Fiados e Clientes",
    html: `<p>Carteira-base de 29/10: R$ 112.</p><p>Novos fiados: Raimunda R$ 5, Gerb R$ 5, Mikelly R$ 5 e João Lucas R$ 5.</p><p>Carteira principal provisória: R$ 132, sujeita à validação dos registros persistidos e a eventuais baixas.</p><p>Bernardo possivelmente retirou um salgado de R$ 5, ainda sem confirmação. Não há cobrança definitiva para Bernardo.</p><p>Quitações, baixas e cobranças encerradas foram preservadas. Henrique não foi reaberto.</p><p>Os Pix foram atribuídos ao dia corrente, salvo evidência específica em contrário. O Pix de Raimunda às 15h29 não quita o fiado novo.</p>`,
  },
  {
    marker: "ZAIVON-FECHAMENTO:2026-10-30:04",
    sort: 4,
    title: "30/10/2026 — Auditoria e Pendências",
    html: `<p>Duas retiradas de salgados sem vínculo: R$ 10. Dois sanduíches herdados não localizados: R$ 14. Exposição comercial total em investigação: R$ 24.</p><p>Três sanduíches herdados de 29/10, nenhum produzido em 30/10, um consumido pelo proprietário e dois não localizados. Estoque físico final de sanduíches: zero.</p><p>Bernardo deverá ser consultado sobre uma possível retirada.</p><p>A diferença de R$ 2,66 no cofrinho permanece a apurar.</p><p>Ocorrências não comprovadas não foram classificadas como perdas definitivas. A auditoria histórica e a possibilidade de recuperação futura permanecem.</p>`,
  },
];

function assertPack() {
  if (PIX.length !== 20 || PIX.reduce((sum, row) => sum + row.cents, 0) !== 11000) throw new Error("Pix divergente.");
  const paid = LINES.filter((row) => row.status === "paid");
  const pending = LINES.filter((row) => row.status === "pending");
  const paidUnits = paid.reduce((sum, row) => sum + row.qty, 0);
  const paidCents = paid.reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
  const pendingCents = pending.reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
  if (LINES.length !== 24 || paid.length !== 20 || pending.length !== 4 || paidUnits !== 22 || paidCents !== 11000 || pendingCents !== 2000) {
    throw new Error("Linhas do dia divergentes.");
  }
  if (paidUnits + pending.reduce((sum, row) => sum + row.qty, 0) + 2 + 2 !== 30) throw new Error("Quantidade física divergente.");
}

function near(a: number, b: number) {
  return Math.abs(a - b) < 0.009;
}
function money(cents: number) {
  return (cents / 100).toFixed(2);
}
function noteBody(marker: string, html: string) {
  return `<div><p>Identificador: ${marker}</p>${html}</div>`;
}

type Db = Awaited<ReturnType<typeof getPostgresDb>>;
type Tx = Parameters<Parameters<typeof runPostgresTransaction>[0]>[0];
type Meta = {
  cofrinho?: Record<string, number>;
  closure?: Record<string, { status?: string; note?: string }>;
  lossSaleIds?: string[];
  collectionReviews?: unknown[];
  henriqueDefault2910?: { activeCollection?: boolean; unbookedDeclared?: number; declaredWriteOff?: number };
  provisionalReceivables?: unknown;
  extraSettlements?: unknown;
  henriqueConfirmations?: unknown;
  [key: string]: unknown;
};

async function hashes(tx: Tx | Db) {
  const ids = Object.keys(FROZEN_NOTES);
  const rows = await tx.execute(sql`select id::text as id, md5(body) as hash from sticky_notes where id in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`);
  return new Map((rows as unknown as Array<{ id: string; hash: string }>).map((row) => [row.id, row.hash]));
}
async function assertFrozen(tx: Tx | Db) {
  const found = await hashes(tx);
  for (const [id, hash] of Object.entries(FROZEN_NOTES)) {
    if (found.get(id) !== hash) throw new Error(`Nota histórica alterada: ${id}.`);
  }
}
async function vaultBalance(tx: Tx | Db, accountId: string) {
  const rows = await tx.select({
    key: vaultMovements.idempotencyKey,
    type: vaultMovements.movementType,
    effect: vaultMovements.effect,
    amount: vaultMovements.amount,
    status: vaultMovements.status,
    date: vaultMovements.effectiveDate,
  }).from(vaultMovements).where(eq(vaultMovements.accountId, accountId));
  return centsToMoney(foldVaultCents(rows.map((row) => ({
    idempotencyKey: row.key,
    type: row.type,
    effect: row.effect,
    amountCents: moneyToCents(Number(row.amount)),
    status: row.status,
    effectiveDate: row.date,
  }))));
}
async function countToken(db: Db) {
  const rows = await db.execute(sql`select count(*)::int as n from sales where notes like ${TOKEN + "%"}`);
  return Number((rows as unknown as Array<{ n: number }>)[0]?.n ?? 0);
}
async function saleFingerprint(tx: Tx | Db) {
  const rows = await tx.execute(sql`
    select id::text as id, md5(payment_status || '|' || amount_received::text || '|' || total_amount::text || '|' || coalesce(notes, '')) as hash
    from sales where id in (${sql.join(FROZEN_SALES.map((id) => sql`${id}::uuid`), sql`, `)})`);
  const found = rows as unknown as Array<{ id: string; hash: string }>;
  if (found.length !== FROZEN_SALES.length) throw new Error("Venda histórica protegida não foi encontrada.");
  return found.sort((a, b) => a.id.localeCompare(b.id)).map((row) => `${row.id}:${row.hash}`).join(";");
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  if (typeof value === "number") return Math.round(value * 100) / 100;
  return value;
}
function preservedMeta(value: Meta) {
  return {
    cofrinho29: value.cofrinho?.["2026-10-29"] ?? null,
    closure29: value.closure?.["2026-10-29"] ?? null,
    reviews: stable(value.collectionReviews ?? null),
    henrique: stable(value.henriqueDefault2910 ?? null),
    losses: [...(value.lossSaleIds ?? [])].sort(),
    extras: stable(value.extraSettlements ?? null),
    provisional: stable(value.provisionalReceivables ?? null),
    confirmations: stable(value.henriqueConfirmations ?? null),
  };
}
function assertPreserved(before: ReturnType<typeof preservedMeta>, after: ReturnType<typeof preservedMeta>) {
  for (const key of Object.keys(before) as Array<keyof typeof before>) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) throw new Error(`Metadado preservado mudou: ${key}.`);
  }
}

async function main() {
  assertPack();
  const db = await getPostgresDb();
  const already = await countToken(db);
  if (already === 24) {
    await verify(db);
    console.log("ZERO_NEW");
    await closePostgresConnection();
    return;
  }
  if (already !== 0) throw new Error(`30/10 incompleto: ${already} vendas. Gravação interrompida.`);

  const created = await runPostgresTransaction(async (tx) => {
    if ((await tx.select({ id: operationDays.id }).from(operationDays).where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, DATE)))).length > 0) {
      throw new Error("Dia 30/10 já existe.");
    }
    const notes30 = await tx.execute(sql`select count(*)::int as n from sticky_notes where note_date = '2026-10-30' or body like '%ZAIVON-FECHAMENTO:2026-10-30:%'`);
    if (Number((notes30 as unknown as Array<{ n: number }>)[0]?.n) !== 0) throw new Error("Notas de 30/10 já existem.");
    await assertFrozen(tx);
    const frozenBefore = await saleFingerprint(tx);
    const stockBefore = await tx.select({ id: products.id, stock: products.stockQuantity }).from(products).where(eq(products.businessId, BIZ));
    const stockMap = new Map(stockBefore.map((row) => [row.id, row.stock]));
    if (stockMap.get(SALGADO) !== 0 || stockMap.get(SANDWICH) !== 3 || stockMap.get(MISTAO) !== 525) throw new Error("Estoque inicial divergente.");

    const names = await tx.execute(sql`select id::text as id, name from clients where id in (${sql.join(Object.keys(CARDS).map((id) => sql`${id}::uuid`), sql`, `)})`);
    const nameMap = new Map((names as unknown as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]));
    for (const [id, name] of Object.entries(CARDS)) {
      if (nameMap.get(id) !== name) throw new Error(`Cartão divergente: ${id}.`);
    }

    const account = await tx.select({ id: vaultAccounts.id }).from(vaultAccounts).where(and(eq(vaultAccounts.businessId, BIZ), eq(vaultAccounts.slug, "salgados-e-sanduiches")));
    if (!account[0] || !near(await vaultBalance(tx, account[0].id), 6073.08)) throw new Error("Razão inicial divergente.");
    if ((await tx.select({ id: vaultMovements.id }).from(vaultMovements).where(eq(vaultMovements.idempotencyKey, DEPOSIT_KEY))).length > 0) throw new Error("Depósito já existe.");

    const metaRow = await tx.select().from(appSettings).where(eq(appSettings.key, META_KEY));
    const current = metaRow[0]?.value as Meta;
    const preservedBefore = preservedMeta(current);
    if (!near(current.cofrinho?.["2026-10-29"] ?? 0, 6073.08) || current.closure?.["2026-10-29"]?.status !== "closed_with_note") throw new Error("Fechamento de 29/10 divergente.");
    if (current.cofrinho?.[DATE] != null || current.closure?.[DATE] != null) throw new Error("30/10 já estava no mapa.");
    if (current.henriqueDefault2910?.activeCollection !== false || current.henriqueDefault2910?.declaredWriteOff !== 70) throw new Error("Henrique foi alterado.");
    if ((current.collectionReviews ?? []).length !== 3) throw new Error("Conferências da carteira divergentes.");
    if (!(current.lossSaleIds ?? []).some((id) => id.startsWith("30e55dfd"))) throw new Error("Baixa do Henrique ausente.");
    const practical = await tx.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, PRACTICAL_KEY));
    if (!near(Number(practical[0]?.value), 6073.08)) throw new Error("Saldo prático divergente.");

    const diary29 = await tx.execute(sql`
      select md5(e.observations) as hash
      from operation_days d join diary_entries e on e.operation_day_id = d.id
      where d.operation_date = '2026-10-29' and d.business_id = ${BIZ}::uuid`);
    if ((diary29 as unknown as Array<{ hash: string }>)[0]?.hash !== "fe5b4a8b4e886923d61e70c083161318") throw new Error("Diário de 29/10 divergente.");
    const countsBefore = new Map((await tx.execute(sql`select sale_date::text as date, count(*)::int as n from sales where business_id = ${BIZ}::uuid group by sale_date`) as unknown as Array<{ date: string; n: number }>).map((row) => [row.date, row.n]));
    const ownerRows = await tx.execute(sql`select owner_id::text as owner from sticky_notes where note_date = '2026-10-29' limit 1`);
    const ownerId = (ownerRows as unknown as Array<{ owner: string }>)[0]?.owner;
    if (!ownerId) throw new Error("Dono das notas ausente.");

    const now = new Date();
    let tick = 0;
    const stamp = () => new Date(now.getTime() + tick++);
    const dayId = generateId();
    const ids: Record<string, string> = { dayId };
    await tx.insert(operationDays).values({ id: dayId, businessId: BIZ, operationDate: DATE, status: "closed", createdAt: now, updatedAt: now });

    let salgadoBal = 0;
    let sandwichBal = 3;
    const move = async (productId: string, saleId: string | null, type: "entry" | "exit", qty: number, balance: number, reason: string) => {
      const id = generateId();
      await tx.insert(stockMovements).values({ id, productId, operationDayId: dayId, saleId, movementType: type, quantity: qty, balanceAfter: balance, reason, createdAt: stamp() });
      return id;
    };
    salgadoBal = 30;
    ids.entry = await move(SALGADO, null, "entry", 30, salgadoBal, `${TOKEN}entrada-30-salgados 14 mistao frito, 7 queijo frito, 3 frango de forno, 3 mistao de forno e 3 coxinha. Unifor 14 e Acal 16. A transferencia interna de 7 fica no diario e nao e outra movimentacao.`);
    salgadoBal -= 1;
    ids.consumoUnifor = await move(SALGADO, null, "exit", 1, salgadoBal, `${TOKEN}consumo-proprio-unifor 1 mistao frito. Sem venda, sem fiado e sem receita.`);
    salgadoBal -= 1;
    ids.consumoAcal = await move(SALGADO, null, "exit", 1, salgadoBal, `${TOKEN}consumo-proprio-acal 1 mistao frito antes da operacao. A disponibilidade inicial da Acal passou de 16 para 15. Sem venda, sem fiado e sem receita.`);

    for (const line of LINES) {
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
        paymentMethod: line.method,
        paymentStatus: line.status,
        amountReceived: money(Math.round(line.received * 100)),
        totalAmount: money(Math.round(line.amount * 100)),
        totalCost: "0.00",
        profit: money(Math.round(line.amount * 100)),
        notes: `${TOKEN}${line.slug} ${nameNote}HORARIO-CONFIANCA:${line.time ? "comprovado" : "nao-informado"} LOCAL:${line.local} ${line.extra}`,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(saleItems).values({
        id: generateId(),
        saleId,
        productId: SALGADO,
        quantity: line.qty,
        unitPrice: "5.00",
        unitCost: "0.00",
        subtotal: money(Math.round(line.amount * 100)),
        profit: money(Math.round(line.amount * 100)),
        flavorConfidence: line.flavor,
      });
      salgadoBal -= line.qty;
      await move(SALGADO, saleId, "exit", line.qty, salgadoBal, `${TOKEN}${line.slug}`);
    }
    salgadoBal -= 1;
    ids.unlinkedSalgado1 = await move(SALGADO, null, "exit", 1, salgadoBal, `${TOKEN}saida-sem-vinculo-1 1 salgado da Acal, R$ 5. HIPOTESE-BERNARDO quantidade 1, a confirmar. Cobranca nao autorizada. Nao e venda, fiado nem perda.`);
    salgadoBal -= 1;
    ids.unlinkedSalgado2 = await move(SALGADO, null, "exit", 1, salgadoBal, `${TOKEN}saida-sem-vinculo-2 1 salgado da Acal, R$ 5. Sem hipotese. Nao e venda, fiado nem perda.`);
    if (salgadoBal !== 0) throw new Error(`Saldo de salgados ${salgadoBal}.`);

    sandwichBal -= 1;
    ids.consumoSanduiche = await move(SANDWICH, null, "exit", 1, sandwichBal, `${TOKEN}consumo-proprio-sanduiche 1 unidade herdada de 29/10, consumida pelo proprietario. Sem venda e sem receita.`);
    sandwichBal -= 1;
    ids.unlinkedSanduiche1 = await move(SANDWICH, null, "exit", 1, sandwichBal, `${TOKEN}saida-sem-vinculo-sanduiche-1 1 sanduiche herdado de 29/10 nao localizado, R$ 7. Nao e venda, fiado nem perda definitiva.`);
    sandwichBal -= 1;
    ids.unlinkedSanduiche2 = await move(SANDWICH, null, "exit", 1, sandwichBal, `${TOKEN}saida-sem-vinculo-sanduiche-2 1 sanduiche herdado de 29/10 nao localizado, R$ 7. Nao e venda, fiado nem perda definitiva.`);
    if (sandwichBal !== 0) throw new Error(`Saldo de sanduíches ${sandwichBal}.`);

    const pendings = [
      ["pendingSalgado1", SALGADO, "5.00", `${TOKEN}SAIDA-SEM-VINCULO 1 salgado da Acal, potencial R$ 5. Hipótese Bernardo, a confirmar. Cobrança não autorizada. Não é o segundo salgado sem vínculo.`],
      ["pendingSalgado2", SALGADO, "5.00", `${TOKEN}SAIDA-SEM-VINCULO 1 salgado da Acal, potencial R$ 5. Sem hipótese de cliente. Não é venda, fiado nem perda.`],
      ["pendingSanduiche1", SANDWICH, "7.00", `${TOKEN}SAIDA-SEM-VINCULO 1 sanduíche herdado de 29/10 não localizado, potencial R$ 7. Não é venda, fiado nem perda definitiva.`],
      ["pendingSanduiche2", SANDWICH, "7.00", `${TOKEN}SAIDA-SEM-VINCULO 1 sanduíche herdado de 29/10 não localizado, potencial R$ 7. Não é venda, fiado nem perda definitiva.`],
    ] as const;
    for (const [key, productId, potential, description] of pendings) {
      const id = generateId();
      ids[key] = id;
      await tx.insert(operationalPendings).values({
        id,
        operationDayId: dayId,
        pendingType: "inventory_investigation",
        productId,
        quantity: 1,
        potentialRevenue: potential,
        status: "open",
        description,
        createdAt: now,
        updatedAt: now,
      });
    }

    await tx.insert(dailyInvestments).values({
      id: generateId(),
      operationDayId: dayId,
      amount: "91.20",
      investmentType: "additional",
      sourceType: "other",
      sourceName: null,
      description: `${TOKEN}custo-terceiros-91.20 Custo econômico da encomenda de 30 salgados, pago por terceiros. Desembolso próprio declarado R$ 0. A previsão de R$ 100 não foi lançada. Não é receita de vendas.`,
    });
    const purchaseId = generateId();
    ids.purchase = purchaseId;
    await tx.insert(dailyPurchases).values({ id: purchaseId, operationDayId: dayId, totalUnits: 30, totalInvestment: "91.20", createdAt: now, updatedAt: now });
    await tx.insert(dailyPurchaseItems).values([
      { id: generateId(), dailyPurchaseId: purchaseId, productName: "Mistão frito", quantity: 14 },
      { id: generateId(), dailyPurchaseId: purchaseId, productName: "Queijo frito", quantity: 7 },
      { id: generateId(), dailyPurchaseId: purchaseId, productName: "Frango de forno", quantity: 3 },
      { id: generateId(), dailyPurchaseId: purchaseId, productName: "Mistão de forno", quantity: 3 },
      { id: generateId(), dailyPurchaseId: purchaseId, productName: "Coxinha", quantity: 3 },
    ]);

    const closing = buildDayClosing({
      date: DATE,
      competenceRevenue: 130,
      salesReceived: 110,
      priorSettlements: 0,
      ownCost: 0,
      thirdPartyCost: 91.2,
      newCredit: 20,
      lossesAmount: 0,
      lossesUnits: 0,
      stockRemainingUnits: 0,
      piggyOpening: 6073.08,
      piggyDeposit: 110,
      bankYield: 0,
      piggyClosing: 6183.08,
      competenceStatus: "confirmed",
      extraNotes: [
        "Depósito de R$ 110, uma vez. Não é lucro.",
        "Custo econômico R$ 91,20 pago por terceiros. Desembolso próprio R$ 0. A previsão de R$ 100 não foi lançada.",
        "Resultado econômico da competência identificada: R$ 130 menos R$ 91,20 = R$ 38,80. Não foi lançado como lucro pessoal nem como depósito.",
        "Razão R$ 6.183,08. Saldo informado anterior R$ 6.083,43. Projeção R$ 6.193,43. Saldo exibido R$ 6.196,09. Diferença de R$ 2,66 a apurar, sem rendimento.",
        "Exposição comercial em investigação: R$ 24. Bernardo é hipótese e não é cobrança.",
      ],
      operationalAudit: {
        salgados: {
          initial: 30,
          paidUnits: 22,
          creditUnits: 4,
          ownConsumption: 2,
          unlinkedUnits: 2,
          lostUnits: 0,
          final: 0,
          status: "ok",
          note: "30 = 22 pagos + 4 fiados + 2 consumos próprios + 2 sem vínculo.",
        },
        sandwiches: {
          initial: 3,
          ownConsumption: 1,
          countedAt: "2026-10-30",
          counted: 0,
          status: "pending",
          note: "3 herdados, 0 produzidos, 1 consumo próprio e 2 não localizados. Não é perda definitiva.",
        },
        unlinked: {
          commercialTotal: 24,
          confirmedLoss: false,
          items: [
            { id: `${TOKEN}saida-sem-vinculo-1`, kind: "salgado", quantity: 1, commercialValue: 5, note: "Hipótese Bernardo, a confirmar. Cobrança não autorizada.", chargeAuthorized: false },
            { id: `${TOKEN}saida-sem-vinculo-2`, kind: "salgado", quantity: 1, commercialValue: 5, note: "Sem hipótese de cliente.", chargeAuthorized: false },
            { id: `${TOKEN}saida-sem-vinculo-sanduiche-1`, kind: "sanduiche", quantity: 1, commercialValue: 7, note: "Herdado de 29/10 e não localizado.", chargeAuthorized: false },
            { id: `${TOKEN}saida-sem-vinculo-sanduiche-2`, kind: "sanduiche", quantity: 1, commercialValue: 7, note: "Herdado de 29/10 e não localizado.", chargeAuthorized: false },
          ],
        },
      },
    });
    if (!near(closing.cash.cashIn, 110) || !near(closing.competenceProfit, 130) || !near(closing.costs.totalNewCost, 91.2) || closing.piggyBank.bankYield !== 0) {
      throw new Error("Fechamento calculado fora do pacote.");
    }
    ids.diary = generateId();
    await tx.insert(diaryEntries).values({
      id: ids.diary,
      operationDayId: dayId,
      schemaVersion: 2,
      revenueReceived: "110.00",
      revenuePending: "20.00",
      revenueTotal: "130.00",
      operationalProfit: "110.00",
      quantitySold: 26,
      quantityLost: 0,
      observations: CLOSURE,
      manualInsights: "R$ 110 é o depósito e também o caixa do dia. R$ 130 é o faturamento identificado. R$ 91,20 é custo de terceiros. R$ 38,80 é o resultado econômico e não foi lançado como lucro.",
      tags: ["zaivon-v2", "day-closing-v2", "zaivon-3010"],
      narrative: {
        sales: { paidProductCount: 22, creditCount: 4 },
        bonusIncome: 0,
        dayClosing: closing,
        pixLedger: PIX,
        internalTransfer: {
          token: `${TOKEN}transferencia-unifor-acal`,
          from: "Unifor",
          to: "Acal",
          units: 7,
          lines: [
            { product: "Mistão frito", quantity: 2 },
            { product: "Queijo frito", quantity: 1 },
            { product: "Frango de forno", quantity: 1 },
            { product: "Mistão de forno", quantity: 3 },
            { product: "Coxinha", quantity: 0 },
          ],
          revenue: false,
          extraCost: false,
        },
        ownConsumption: [
          { product: "Mistão frito", quantity: 1, local: "Unifor" },
          { product: "Mistão frito", quantity: 1, local: "Acal" },
          { product: "Sanduíche", quantity: 1, local: "proprietário" },
        ],
      },
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
      description: "Depósito de R$ 110 no cofrinho Salgados e Sanduíches. Saldo informado anterior R$ 6.083,43. Projeção R$ 6.193,43. Saldo exibido R$ 6.196,09. A diferença de R$ 2,66 fica a apurar e não é rendimento nem segundo depósito.",
      sourceLabel: "depósito informado em 30/10",
      operationDayId: dayId,
      idempotencyKey: DEPOSIT_KEY,
      status: "posted" as const,
      metadata: {
        classification: "deposito_efetivo",
        revenue: false,
        profit: false,
        yield: false,
        bookBalance: 6183.08,
        informedBalance: 6196.09,
        informedOpening: 6083.43,
        projectedBalance: 6193.43,
        pendingDifference: 2.66,
        ownDisbursement: 0,
      },
      createdAt: now,
      updatedAt: now,
    };
    await tx.insert(vaultMovements).values(deposit);
    await tx.insert(vaultMovementRevisions).values({ id: generateId(), movementId: depositId, before: null, after: deposit, reason: "criacao", createdAt: now });

    await tx.update(products).set({ stockQuantity: 0, updatedAt: now }).where(eq(products.id, SALGADO));
    await tx.update(products).set({ stockQuantity: 0, updatedAt: now }).where(eq(products.id, SANDWICH));
    await tx.update(appSettings).set({
      value: {
        ...current,
        cofrinho: { ...current.cofrinho, [DATE]: 6183.08 },
        closure: { ...current.closure, [DATE]: { status: "closed_with_note", note: CLOSURE } },
      },
      updatedAt: now,
    }).where(eq(appSettings.key, META_KEY));
    await tx.update(appSettings).set({ value: 6183.08, updatedAt: now }).where(eq(appSettings.key, PRACTICAL_KEY));

    for (const note of NOTES) {
      const id = generateId();
      ids[note.marker] = id;
      await tx.insert(stickyNotes).values({
        id,
        ownerId,
        businessId: BIZ,
        title: note.title,
        body: noteBody(note.marker, note.html),
        color: "default",
        noteDate: DATE,
        pinned: false,
        archived: false,
        sortOrder: note.sort,
        clientUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    const countsAfter = await tx.execute(sql`select sale_date::text as date, count(*)::int as n from sales where business_id = ${BIZ}::uuid group by sale_date`);
    for (const row of countsAfter as unknown as Array<{ date: string; n: number }>) {
      if (row.date === DATE) {
        if (row.n !== 24) throw new Error(`Vendas do dia ${row.n}.`);
      } else if ((countsBefore.get(row.date) ?? 0) !== row.n) throw new Error(`Contagem de ${row.date} mudou.`);
    }
    if (await saleFingerprint(tx) !== frozenBefore) throw new Error("Venda histórica foi reescrita.");
    await assertFrozen(tx);
    const stockAfter = await tx.select({ id: products.id, stock: products.stockQuantity }).from(products).where(eq(products.businessId, BIZ));
    for (const row of stockAfter) {
      if (row.id === SANDWICH && row.stock !== 0) throw new Error("Sanduíche final divergente.");
      if (row.id === SALGADO && row.stock !== 0) throw new Error("Salgado final divergente.");
      if (row.id !== SANDWICH && row.stock !== stockMap.get(row.id)) throw new Error(`Catálogo alterado: ${row.id}.`);
    }
    if (!near(await vaultBalance(tx, account[0].id), 6183.08)) throw new Error("Razão final divergente.");
    const metaAfter = await tx.select().from(appSettings).where(eq(appSettings.key, META_KEY));
    assertPreserved(preservedBefore, preservedMeta(metaAfter[0]?.value as Meta));
    const yieldRows = await tx.execute(sql`select count(*)::int as n from vault_movements where business_id = ${BIZ}::uuid and effective_date = '2026-10-30' and movement_type = 'yield'`);
    if (Number((yieldRows as unknown as Array<{ n: number }>)[0]?.n) !== 0) throw new Error("Rendimento foi lançado.");
    return { dayId, diaryId: ids.diary, depositId };
  });

  await verify(db);
  console.log(JSON.stringify({ status: "UPDATED", ...created }, null, 2));
  await closePostgresConnection();
}

async function verify(db: Db) {
  const day = await db.select({ id: operationDays.id, status: operationDays.status }).from(operationDays).where(and(eq(operationDays.businessId, BIZ), eq(operationDays.operationDate, DATE)));
  if (day.length !== 1 || day[0].status !== "closed") throw new Error("Dia não fechado.");
  const diary = await db.select().from(diaryEntries).where(eq(diaryEntries.operationDayId, day[0].id));
  if (diary.length !== 1) throw new Error("Diário não é único.");
  const narrative = diary[0]?.narrative as {
    pixLedger?: Array<{ cents: number }>;
    internalTransfer?: { units?: number };
    dayClosing?: {
      competenceRevenue?: number;
      cash?: { cashIn?: number };
      costs?: { ownCost?: number; thirdPartyCost?: number; totalNewCost?: number };
      piggyBank?: { deposit?: number; closingBalance?: number; bankYield?: number };
      newCredit?: number;
      lossesAmount?: number;
      stockRemainingUnits?: number;
      operationalAudit?: { unlinked?: { commercialTotal?: number; confirmedLoss?: boolean } };
    };
  };
  const closing = narrative.dayClosing;
  const pix = narrative.pixLedger ?? [];
  if (pix.length !== 20 || pix.reduce((sum, row) => sum + row.cents, 0) !== 11000) throw new Error("Pix divergentes.");
  if (narrative.internalTransfer?.units !== 7) throw new Error("Transferência divergente.");
  if (!near(Number(diary[0]?.revenueReceived), 110) || !near(Number(diary[0]?.revenuePending), 20) || !near(Number(diary[0]?.revenueTotal), 130) || !near(Number(diary[0]?.operationalProfit), 110) || diary[0]?.quantitySold !== 26 || diary[0]?.quantityLost !== 0) throw new Error("Diário divergente.");
  if (!near(closing?.competenceRevenue ?? 0, 130) || !near(closing?.cash?.cashIn ?? 0, 110) || !near(closing?.costs?.ownCost ?? 0, 0) || !near(closing?.costs?.thirdPartyCost ?? 0, 91.2) || !near(closing?.costs?.totalNewCost ?? 0, 91.2) || !near(closing?.piggyBank?.deposit ?? 0, 110) || !near(closing?.piggyBank?.closingBalance ?? 0, 6183.08) || closing?.piggyBank?.bankYield !== 0 || !near(closing?.newCredit ?? 0, 20) || closing?.lossesAmount !== 0 || closing?.stockRemainingUnits !== 0 || closing?.operationalAudit?.unlinked?.commercialTotal !== 24 || closing?.operationalAudit?.unlinked?.confirmedLoss !== false) throw new Error("Fechamento divergente.");

  const stock = await db.select({ id: products.id, stock: products.stockQuantity }).from(products).where(eq(products.businessId, BIZ));
  const map = new Map(stock.map((row) => [row.id, row.stock]));
  if (map.get(SALGADO) !== 0 || map.get(SANDWICH) !== 0 || map.get(MISTAO) !== 525) throw new Error("Estoques divergentes.");
  const exits = await db.execute(sql`
    select coalesce(sum(quantity), 0)::int as qty
    from stock_movements
    where operation_day_id = ${day[0].id}::uuid and product_id = ${SALGADO}::uuid and movement_type = 'exit'`);
  if (Number((exits as unknown as Array<{ qty: number }>)[0]?.qty) !== 30) throw new Error("Saídas físicas divergentes.");
  const entry = await db.execute(sql`
    select coalesce(sum(quantity), 0)::int as qty
    from stock_movements
    where operation_day_id = ${day[0].id}::uuid and product_id = ${SALGADO}::uuid and movement_type = 'entry'`);
  if (Number((entry as unknown as Array<{ qty: number }>)[0]?.qty) !== 30) throw new Error("Entrada divergente.");
  const transferMoves = await db.execute(sql`select count(*)::int as n from stock_movements where reason like ${TOKEN + "transferencia%"}`);
  if (Number((transferMoves as unknown as Array<{ n: number }>)[0]?.n) !== 0) throw new Error("Transferência foi duplicada no estoque.");

  const account = await db.select({ id: vaultAccounts.id }).from(vaultAccounts).where(and(eq(vaultAccounts.businessId, BIZ), eq(vaultAccounts.slug, "salgados-e-sanduiches")));
  if (!near(await vaultBalance(db, account[0].id), 6183.08)) throw new Error("Razão divergente.");
  const deposits = await db.execute(sql`select amount::text as amount, metadata->>'informedBalance' as informed, metadata->>'pendingDifference' as gap from vault_movements where idempotency_key = ${DEPOSIT_KEY}`);
  const depositRows = deposits as unknown as Array<{ amount: string; informed: string; gap: string }>;
  if (depositRows.length !== 1 || !near(Number(depositRows[0].amount), 110) || !near(Number(depositRows[0].informed), 6196.09) || !near(Number(depositRows[0].gap), 2.66)) throw new Error("Depósito divergente.");
  const yieldRows = await db.execute(sql`select count(*)::int as n from vault_movements where business_id = ${BIZ}::uuid and effective_date = '2026-10-30' and movement_type = 'yield'`);
  if (Number((yieldRows as unknown as Array<{ n: number }>)[0]?.n) !== 0) throw new Error("Rendimento foi lançado.");

  const salesRows = await db.execute(sql`
    select payment_status, coalesce(sum(total_amount), 0)::text as total, count(*)::int as n
    from sales where notes like ${TOKEN + "%"} group by payment_status order by payment_status`);
  const grouped = salesRows as unknown as Array<{ payment_status: string; total: string; n: number }>;
  const paid = grouped.find((row) => row.payment_status === "paid");
  const pending = grouped.find((row) => row.payment_status === "pending");
  if (paid?.n !== 20 || !near(Number(paid.total), 110) || pending?.n !== 4 || !near(Number(pending.total), 20)) throw new Error("Vendas divergentes.");
  const exposure = await db.execute(sql`
    select coalesce(sum(potential_revenue), 0)::text as total, count(*)::int as n
    from operational_pendings
    where operation_day_id = ${day[0].id}::uuid and status = 'open' and description like ${TOKEN + "SAIDA-SEM-VINCULO%"}`);
  const exposureRow = (exposure as unknown as Array<{ total: string; n: number }>)[0];
  if (exposureRow?.n !== 4 || !near(Number(exposureRow.total), 24)) throw new Error("Exposição divergente.");

  const meta = await db.select().from(appSettings).where(eq(appSettings.key, META_KEY));
  const value = meta[0]?.value as Meta;
  if (value.closure?.[DATE]?.status !== "closed_with_note" || value.closure?.["2026-10-29"]?.status !== "closed_with_note") throw new Error("Status divergente.");
  if (!near(value.cofrinho?.[DATE] ?? 0, 6183.08) || !near(value.cofrinho?.["2026-10-29"] ?? 0, 6073.08)) throw new Error("Cofrinho divergente.");
  if (value.henriqueDefault2910?.activeCollection !== false) throw new Error("Henrique voltou à cobrança.");
  const practical = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, PRACTICAL_KEY));
  if (!near(Number(practical[0]?.value), 6183.08)) throw new Error("Saldo prático divergente.");
  const notes = await db.execute(sql`select sort_order, title from sticky_notes where note_date = '2026-10-30' and body like '%ZAIVON-FECHAMENTO:2026-10-30:%' order by sort_order`);
  const noteRows = notes as unknown as Array<{ sort_order: number; title: string }>;
  if (noteRows.length !== 4 || noteRows.map((row) => row.title).join("|") !== NOTES.map((note) => note.title).join("|")) throw new Error("Notas divergentes.");
  await assertFrozen(db);
  const diary29 = await db.execute(sql`
    select md5(e.observations) as hash, e.revenue_received::text as received
    from operation_days d join diary_entries e on e.operation_day_id = d.id
    where d.operation_date = '2026-10-29' and d.business_id = ${BIZ}::uuid`);
  const previous = (diary29 as unknown as Array<{ hash: string; received: string }>)[0];
  if (previous?.hash !== "fe5b4a8b4e886923d61e70c083161318" || !near(Number(previous.received), 253)) throw new Error("29/10 foi alterado.");
  const purchase = await db.execute(sql`
    select p.total_units, p.total_investment::text as investment
    from daily_purchases p join operation_days d on d.id = p.operation_day_id
    where d.operation_date = '2026-10-30' and d.business_id = ${BIZ}::uuid`);
  const purchaseRow = (purchase as unknown as Array<{ total_units: number; investment: string }>)[0];
  if (purchaseRow?.total_units !== 30 || !near(Number(purchaseRow.investment), 91.2)) throw new Error("Encomenda divergente.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "falha";
  console.error(message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[url]"));
  process.exit(1);
});
