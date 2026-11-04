import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { preliminaryEconomicResult } from "../zaivon/finance/day";
import { buildDayClosing } from "./day-closing";

describe("fechamento de 30/10/2026", () => {
  const closing = buildDayClosing({
    date: "2026-10-30",
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
      },
      sandwiches: {
        initial: 3,
        ownConsumption: 1,
        countedAt: "2026-10-30",
        counted: 0,
        status: "pending",
      },
      unlinked: {
        commercialTotal: 24,
        confirmedLoss: false,
        items: [],
      },
    },
  });

  it("separa depósito, caixa, custo próprio e custo de terceiros", () => {
    assert.equal(closing.piggyBank.deposit, 110);
    assert.equal(closing.piggyBank.bankYield, 0);
    assert.equal(closing.piggyBank.closingBalance, 6183.08);
    assert.equal(closing.cash.cashIn, 110);
    assert.equal(closing.costs.ownCost, 0);
    assert.equal(closing.costs.thirdPartyCost, 91.2);
    assert.equal(closing.costs.totalNewCost, 91.2);
    assert.equal(closing.competenceRevenue, 130);
    assert.equal(closing.newCredit, 20);
    assert.equal(closing.competenceProfit, 130);
    assert.equal(preliminaryEconomicResult(130, 0, 91.2), 38.8);
    assert.notEqual(closing.competenceProfit, preliminaryEconomicResult(130, 0, 91.2));
    assert.notEqual(closing.piggyBank.deposit, preliminaryEconomicResult(130, 0, 91.2));
    assert.equal(closing.cashManagementResult, 110);
    assert.equal(closing.reconciliation.depositMinusCashResult, 0);
    assert.equal(closing.lossesAmount, 0);
    assert.equal(closing.operationalAudit?.unlinked?.confirmedLoss, false);
    assert.equal(closing.reconciliation.notes.some((note) => note.startsWith("DIVERGENTE cofrinho")), false);
  });
});
