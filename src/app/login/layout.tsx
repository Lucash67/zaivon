import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { HUB_BRAND_ASSETS } from "@/constants/hub-brand";
import "./hub-login.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZAIVON — Entrar",
  description:
    "Acesse o ecossistema ZAIVON. Inteligência, controle e evolução para o seu negócio.",
  icons: {
    icon: [{ url: HUB_BRAND_ASSETS.favicon, sizes: "64x64", type: "image/png" }],
    apple: HUB_BRAND_ASSETS.appleTouch,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`hub-login ${sora.variable} h-full min-h-screen overflow-x-hidden antialiased lg:h-screen lg:overflow-hidden`}
      style={{ fontFamily: "var(--font-sora), system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}
