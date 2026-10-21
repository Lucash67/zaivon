import type { Metadata } from "next";
import { FinanceProvider } from "@/components/finance/finance-provider";
import { FinanceGate } from "@/components/finance/finance-shell";

export const metadata: Metadata = {
  title: "ZAIVON Finance",
  description: "Controle pessoal, previsão de caixa, metas, insights e desafios.",
};

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <FinanceProvider>
      <FinanceGate>{children}</FinanceGate>
    </FinanceProvider>
  );
}
