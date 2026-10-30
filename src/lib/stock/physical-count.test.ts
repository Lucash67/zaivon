import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyStockQuantity, entryReasonWithCount, informedPhysicalFromText } from "./physical-count";

describe("contagem física na entrada", () => {
  it("exige a contagem quando o saldo já existe e não usa esse número como novo saldo", () => {
    const missing = entryReasonWithCount({ currentStock: 2, type: "entry", reason: "produção", physicalCount: "" });
    assert.equal(missing.ok, false);
    const recorded = entryReasonWithCount({ currentStock: 2, type: "entry", reason: "produção", physicalCount: 1 });
    assert.equal(recorded.ok, true);
    if (recorded.ok) assert.equal(recorded.reason, "CONTAGEM-FISICA:1. produção");
  });

  it("dispensa a contagem na primeira entrada e na saída", () => {
    assert.equal(entryReasonWithCount({ currentStock: 0, type: "entry", reason: null, physicalCount: "" }).ok, true);
    assert.equal(entryReasonWithCount({ currentStock: 4, type: "exit", reason: "venda", physicalCount: "" }).ok, true);
  });

  it("soma a entrada e preserva a contagem física só no motivo", () => {
    const recorded = entryReasonWithCount({ currentStock: 1, type: "entry", reason: "produção", physicalCount: 0 });
    assert.equal(recorded.ok, true);
    assert.equal(applyStockQuantity(1, "entry", 5), 6);
    assert.equal(informedPhysicalFromText("Estoque fisico informado: zero. Saldo contabil preservado: 1."), 0);
  });
});
