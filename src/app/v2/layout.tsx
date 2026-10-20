import type { Metadata } from "next";
import { ZaivonRoot } from "@/components/zaivon-v2/root";

export const metadata: Metadata = {
  title: "ZAIVON Business — v2",
  description: "Gestão da operação de salgados: lucro, cofrinho, pendências e meta.",
};

/** Tipografia: herda Sora do root layout (--font-sora / font-sans / font-zaivon). */
export default function ZaivonV2Layout({ children }: { children: React.ReactNode }) {
  return <ZaivonRoot>{children}</ZaivonRoot>;
}
