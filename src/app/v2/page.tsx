import { Inter, Space_Grotesk } from "next/font/google";
import { AuroraDashboard } from "@/components/zaivon-aurora/dashboard";
import "./aurora/aurora.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-aurora-sans", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-aurora-display", display: "swap" });

export default function HojePage() {
  return (
    <div className={`${inter.variable} ${grotesk.variable} aurora relative overflow-hidden rounded-3xl`}>
      <AuroraDashboard />
    </div>
  );
}
