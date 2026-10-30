export interface SnapshotLive {
  snapshotPending: number;
  liveOpen: number;
  settledLater: number;
}

export function dayLayerFacts(input: {
  date: string;
  debts: Array<{ originDate: string; status: string; amount: number; paid: number; referenceOnly?: boolean }>;
  settlements: Array<{ originDate: string; paidDate: string; amount: number }>;
}): { liveOpen: number; settledLater: number } {
  const liveOpen = round2(
    input.debts
      .filter((debt) => debt.originDate === input.date && debt.status === "open" && !debt.referenceOnly)
      .reduce((sum, debt) => sum + debt.amount - debt.paid, 0),
  );
  const settledLater = round2(
    input.settlements
      .filter((item) => item.originDate === input.date && item.paidDate > input.date)
      .reduce((sum, item) => sum + item.amount, 0),
  );
  return { liveOpen, settledLater };
}

export function compareSnapshotToLive(input: SnapshotLive): string {
  return `Pendente no fechamento: R$ ${money(input.snapshotPending)}. Ainda em aberto: R$ ${money(input.liveOpen)}. Quitado depois: R$ ${money(input.settledLater)}. O fechamento não é reescrito.`;
}

export function planJoaoPedroExit(input: {
  sales: number;
  items: number;
  exits: number;
  bookStock: number;
  inheritedPendingOpen: boolean;
}): "exit" | "already" | "stop" {
  if (input.sales !== 1 || input.items > 1 || input.exits > 1 || !input.inheritedPendingOpen) return "stop";
  if (input.exits === 1 && input.bookStock === 1) return "already";
  if (input.exits === 0 && input.bookStock === 2) return "exit";
  return "stop";
}

function money(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
