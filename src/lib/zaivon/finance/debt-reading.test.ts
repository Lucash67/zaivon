import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDeclaredReferences, collectibleTotal, lossTotal } from "./debt-reading";
import type { Debt } from "@/lib/zaivon/types";

function debt(partial: Partial<Debt> & Pick<Debt, "id" | "person" | "amount" | "status">): Debt {
  return {
    type: "fiado",
    originDate: "2026-10-14",
    paid: 0,
    description: "",
    ...partial,
  };
}

describe("fiados sem transformar perda em cobrança", () => {
  const debts = [
    debt({ id: "4834b3a8-fd8b-4876-9354-2ecee94028da", person: "Maria Mikelly Monteiro Coutinho", amount: 7, status: "loss" }),
    debt({ id: "m2", person: "Maria Mikelly Monteiro Coutinho", amount: 33, status: "open" }),
    debt({ id: "jl1", person: "João Lucas (identidade pendente)", amount: 5, status: "open" }),
    debt({ id: "jl2", person: "João Lucas (vínculo pendente)", amount: 5, status: "open" }),
    debt({ id: "30e55dfd-74a8-4148-9c22-874547df26ff", person: "Henrique", amount: 35, status: "open" }),
  ];

  it("exclui a perda do total cobrável", () => {
    assert.equal(lossTotal(debts), 7);
    assert.equal(collectibleTotal(debts), 78);
  });

  it("mostra as referências declaradas sem somar Henrique nem criar os R$ 10 de João Lucas", () => {
    const rows = buildDeclaredReferences(debts, [{ person: "Henrique", amount: 22, receivable: false }]);
    const lucas = rows.find((row) => row.id === "joao-lucas-nota-2810");
    const henrique = rows.find((row) => row.id === "henrique-nota-2810");
    const mikelly = rows.find((row) => row.id === "mikelly-nota-2710");
    assert.equal(lucas?.liveOpenAmount, 10);
    assert.equal(lucas?.declaredAmount, 20);
    assert.match(lucas?.unreconciledNote ?? "", /não é cobrança/);
    assert.equal(henrique?.liveOpenAmount, 35);
    assert.equal(henrique?.nonReceivableAmount, 22);
    assert.equal(henrique?.declaredAmount, 85);
    assert.match(henrique?.unreconciledNote ?? "", /não são somadas/);
    assert.equal(mikelly?.liveOpenAmount, 33);
    assert.equal(mikelly?.lossAmount, 7);
    assert.match(mikelly?.unreconciledNote ?? "", /R\$ 2/);
  });

  it("não transforma compromisso informado em cadastro aberto", () => {
    const withReference = [
      ...debts,
      debt({
        id: "zaivon-2026-10-21-joao-lucas-line-1910",
        person: "João Lucas (identidade pendente)",
        amount: 5,
        status: "open",
        referenceOnly: true,
      }),
    ];
    const lucas = buildDeclaredReferences(withReference).find((row) => row.id === "joao-lucas-nota-2810");
    assert.equal(lucas?.liveOpenAmount, 10);
    assert.match(lucas?.unreconciledNote ?? "", /não são venda/);
    assert.equal(collectibleTotal(withReference), 78);
  });
});
