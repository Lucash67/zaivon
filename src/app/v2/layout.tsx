import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { ZaivonRoot } from "@/components/zaivon-v2/root";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "ZAIVON Business — v2",
  description: "Gestão da operação de salgados: lucro, cofrinho, pendências e meta.",
};

export default function ZaivonV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={manrope.variable}>
      <ZaivonRoot>{children}</ZaivonRoot>
    </div>
  );
}
