import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareSnapshotToLive, dayLayerFacts, planJoaoPedroExit } from "./snapshot-vs-live";

describe("fechamento e baixa de João Pedro", () => {
  it("separa o retrato do que ainda está aberto", () => {
    const text = compareSnapshotToLive({ snapshotPending: 15, liveOpen: 0, settledLater: 15 });
    assert.match(text, /Pendente no fechamento: R\$ 15,00/);
    assert.match(text, /Ainda em aberto: R\$ 0,00/);
    assert.match(text, /Quitado depois: R\$ 15,00/);
  });

  it("separa o que ainda está aberto do que foi quitado depois", () => {
    const facts = dayLayerFacts({
      date: "2026-10-26",
      debts: [{ originDate: "2026-10-26", status: "paid", amount: 15, paid: 15 }],
      settlements: [{ originDate: "2026-10-26", paidDate: "2026-10-27", amount: 15 }],
    });
    assert.equal(facts.liveOpen, 0);
    assert.equal(facts.settledLater, 15);
  });

  it("baixa uma unidade só quando o estoque está em 2 e não existe saída", () => {
    assert.equal(planJoaoPedroExit({ sales: 1, items: 0, exits: 0, bookStock: 2, inheritedPendingOpen: true }), "exit");
    assert.equal(planJoaoPedroExit({ sales: 1, items: 0, exits: 1, bookStock: 1, inheritedPendingOpen: true }), "already");
    assert.equal(planJoaoPedroExit({ sales: 1, items: 0, exits: 0, bookStock: 2, inheritedPendingOpen: false }), "stop");
    assert.equal(planJoaoPedroExit({ sales: 1, items: 2, exits: 0, bookStock: 2, inheritedPendingOpen: true }), "stop");
    assert.equal(planJoaoPedroExit({ sales: 1, items: 0, exits: 0, bookStock: 4, inheritedPendingOpen: true }), "stop");
    assert.equal(planJoaoPedroExit({ sales: 1, items: 0, exits: 1, bookStock: 2, inheritedPendingOpen: true }), "stop");
  });
});
