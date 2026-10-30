import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { informedGapParts, readInformedBalance, readResponsiblePayment } from "./informed-balance";

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
});
