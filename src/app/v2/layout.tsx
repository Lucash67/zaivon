import type { Metadata } from "next";
import { OmniRoot } from "@/components/omni-v2/root";

export const metadata: Metadata = {
  title: "ZAIVON Business — v2",
  description: "Gestão da operação de salgados: lucro, cofrinho, pendências e meta.",
};

export default function OmniV2Layout({ children }: { children: React.ReactNode }) {
  return <OmniRoot>{children}</OmniRoot>;
}
