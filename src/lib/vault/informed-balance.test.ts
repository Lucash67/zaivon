import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { informedGapParts, orderVaultRowsForPresentation, readInformedBalance, readResponsiblePayment } from "./informed-balance";

describe("saldo informado do cofrinho", () => {
  it("lê o saldo informado sem tratar a diferença como rendimento", () => {
    assert.equal(readInformedBalance({ informedBankBalance: 5706.54 }), 5706.54);
    assert.equal(readInformedBalance({ informedBalance: 5931.84, yield: false }), 5931.84);
    assert.equal(readInformedBalance({}), null);
    assert.equal(readResponsiblePayment({ paymentInformed: 90 }), 90);
  });

  it("compõe 2,46 + 2,51 + 2,79 e deixa a origem em aberto", () => {
    const parts = informedGapParts([
      { date: "2026-10-24", bookAfter: 5594.08, informed: 5594.08 },
      { date: "2026-10-26", bookAfter: 5704.08, informed: 5706.54 },
      { date: "2026-10-27", bookAfter: 5814.08, informed: 5819.05 },
      { date: "2026-10-28", bookAfter: 5924.08, informed: 5931.84 },
    ]);
    assert.deepEqual(parts.map((part) => part.amount), [2.46, 2.51, 2.79]);
    assert.equal(parts.every((part) => part.origin === "nao-identificada"), true);
    assert.equal(Math.round(parts.reduce((sum, part) => sum + part.amount, 0) * 100) / 100, 7.76);
  });

  it("separa os R$ 2,66 de 30/10 do buraco anterior, sem rendimento", () => {
    const parts = informedGapParts([
      { date: "2026-10-29", bookAfter: 6073.08, informed: 6083.43 },
      { date: "2026-10-30", bookAfter: 6183.08, informed: 6196.09 },
    ]);
    assert.deepEqual(parts.map((part) => part.amount), [10.35, 2.66]);
    assert.equal(parts.every((part) => part.origin === "nao-identificada"), true);
  });

  it("lê os depósitos de 29/10 pelo saldo contábil, sem mudar o saldo final", () => {
    const persisted = [
      { date: "2026-10-28", amount: 110, metadata: { bookBalance: 5924.08, informedBalance: 5931.84 } },
      { date: "2026-10-29", amount: 110, metadata: { bookBalance: 6034.08, informedBalance: 6044.43 } },
      { date: "2026-10-29", amount: 20, metadata: { bookBalance: 6073.08, informedBalance: 6083.43 } },
      { date: "2026-10-29", amount: 19, metadata: { bookBalance: 6053.08, informedBalance: 6063.43 } },
      { date: "2026-10-30", amount: 110, metadata: { bookBalance: 6183.08, informedBalance: 6196.09 } },
    ];
    const presented = orderVaultRowsForPresentation(persisted);
    assert.deepEqual(presented.filter((row) => row.date === "2026-10-29").map((row) => row.amount), [110, 19, 20]);
    let book = 5924.08 - 110;
    const gapRows = presented.map((row) => {
      book = Math.round((book + row.amount) * 100) / 100;
      return { date: row.date, bookAfter: book, informed: row.metadata.informedBalance };
    });
    assert.equal(gapRows.at(-1)?.bookAfter, 6183.08);
    assert.deepEqual(informedGapParts(gapRows).map((part) => part.amount), [7.76, 2.59, 2.66]);
    assert.equal(Math.round(informedGapParts(gapRows).reduce((sum, part) => sum + part.amount, 0) * 100) / 100, 13.01);
  });
});
