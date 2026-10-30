import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DayClosingFinance } from "@/lib/finance/day-closing";
import type { OperationDay } from "@/lib/zaivon/types";
import { dayFinance, savedDeposit } from "./day";
import { buildDeclaredReferences, collectibleTotal, lossTotal } from "./debt-reading";
import { compareSnapshotToLive, planJoaoPedroExit } from "./snapshot-vs-live";
import type { Debt } from "@/lib/zaivon/types";

function closed28(): OperationDay {
  const dayClosing: DayClosingFinance = {
    date: "2026-10-28",
    competenceStatus: "provisional",
    competenceRevenue: 199,
    cash: { salesReceived: 185, priorSettlements: 10, otherInflows: 0, cashIn: 195 },
    competenceProfit: 75,
    cashManagementResult: 71,
    costs: { ownCost: 124, thirdPartyCost: 0, totalNewCost: 124 },
    newCredit: 14,
    lossesAmount: 0,
    lossesUnits: 0,
    stockRemainingUnits: 2,
    piggyBank: { openingBalance: 5814.08, deposit: 110, withdrawal: 0, bankYield: 0, closingBalance: 5924.08 },
    reconciliation: {
      competenceMinusCash: 4,
      competenceProfitMinusCashResult: 4,
      depositMinusCashResult: 39,
      notes: [],
    },
  };
  return {
    date: "2026-10-28",
    receivedBase: 185,
    ownCost: 124,
    thirdPartyCost: 0,
    bonus: 0,
    soldUnits: 37,
    lostUnits: 0,
    cofrinhoEnd: 5924.08,
    lines: [],
    closure: "closed_with_note",
    snapshotPending: 14,
    unlinkedUnits: 5,
    dayClosing,
  };
}

function debt(partial: Partial<Debt> & Pick<Debt, "id" | "person" | "amount" | "status">): Debt {
  return { type: "fiado", originDate: "2026-10-14", paid: 0, description: "", ...partial };
}

describe("fechamento de 28/10 permanece separado", () => {
  it("mantém competência, caixa, custo e resultado sem usar o pagamento de 90", () => {
    const finance = dayFinance(closed28(), []);
    assert.equal(finance.competenceRevenue, 199);
    assert.equal(finance.received, 185);
    assert.equal(finance.settlements, 10);
    assert.equal(finance.cashIn, 195);
    assert.equal(finance.newCredit, 14);
    assert.equal(finance.ownCost, 124);
    assert.equal(finance.operationalProfit, 71);
    assert.equal(finance.competenceProfit, 75);
    assert.equal(finance.competenceStatus, "provisional");
    assert.equal(savedDeposit(closed28()), 110);
    assert.notEqual(savedDeposit(closed28()), finance.profit);
    assert.equal(closed28().dayClosing?.stockRemainingUnits, 2);
  });

  it("separa perda, referência declarada e retrato do fechamento", () => {
    const debts = [
      debt({ id: "4834b3a8-fd8b-4876-9354-2ecee94028da", person: "Maria Mikelly Monteiro Coutinho", amount: 7, status: "loss" }),
      debt({ id: "mikelly-aberto", person: "Maria Mikelly Monteiro Coutinho", amount: 33, status: "open" }),
      debt({ id: "d079013d-d6e4-481c-8ac4-0d5e82c048d0", person: "João Lucas (identidade pendente)", amount: 5, status: "open" }),
      debt({ id: "8fde7aa5-b13a-4df0-b54a-3831145e193a", person: "João Lucas (vínculo pendente)", amount: 5, status: "open" }),
      debt({ id: "30e55dfd-74a8-4148-9c22-874547df26ff", person: "Henrique", amount: 35, status: "open" }),
    ];
    assert.equal(lossTotal(debts), 7);
    assert.equal(collectibleTotal(debts.filter((item) => /mikelly/i.test(item.person))), 33);
    const rows = buildDeclaredReferences(debts, [{ person: "Henrique", amount: 22, receivable: false }]);
    assert.equal(rows.find((row) => row.person === "João Lucas")?.liveOpenAmount, 10);
    assert.equal(rows.find((row) => row.person === "João Lucas")?.declaredAmount, 20);
    assert.equal(rows.find((row) => row.person === "Henrique")?.liveOpenAmount, 35);
    assert.equal(rows.find((row) => row.person === "Henrique")?.nonReceivableAmount, 22);
    assert.equal(rows.find((row) => row.person === "Henrique")?.declaredAmount, 85);
    assert.match(compareSnapshotToLive({ snapshotPending: 15, liveOpen: 0, settledLater: 15 }), /O fechamento não é reescrito/);
  });

  it("não lança segunda baixa quando a primeira já deixou o estoque em 1", () => {
    assert.equal(planJoaoPedroExit({ sales: 1, items: 0, exits: 0, bookStock: 2, inheritedPendingOpen: true }), "exit");
    assert.equal(planJoaoPedroExit({ sales: 1, items: 0, exits: 1, bookStock: 1, inheritedPendingOpen: true }), "already");
  });
});
