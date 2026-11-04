import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeUnlinkedAudit, unlinkedAuditMark } from "./unlinked-audit";

describe("retiradas sem vínculo", () => {
  it("mantém R$ 84 e separa R$ 24 conferidos em 30/10 de R$ 60 ainda sujeitos a auditoria", () => {
    const summary = summarizeUnlinkedAudit([
      { date: "2026-10-30", quantity: 1, commercialValue: 5, status: "open" },
      { date: "2026-10-30", quantity: 1, commercialValue: 5, status: "open" },
      { date: "2026-10-30", quantity: 1, commercialValue: 7, status: "open" },
      { date: "2026-10-30", quantity: 1, commercialValue: 7, status: "open" },
      { date: "2026-10-28", quantity: 5, commercialValue: 25, status: "open" },
      { date: "2026-10-27", quantity: 6, commercialValue: 30, status: "open" },
      { date: "2026-10-29", quantity: 1, commercialValue: 5, status: "open" },
      { date: "2026-10-21", quantity: 2, commercialValue: 10, status: "resolved" },
    ]);
    assert.equal(summary.investigationCommercial, 84);
    assert.equal(summary.auditedCommercial, 24);
    assert.equal(summary.auditedUnits, 4);
    assert.equal(summary.pendingAuditCommercial, 60);
    assert.equal(summary.pendingAuditUnits, 12);
    assert.equal(unlinkedAuditMark("2026-10-30"), "conferido");
    assert.equal(unlinkedAuditMark("2026-10-28"), "sujeito-a-auditoria");
  });
});
