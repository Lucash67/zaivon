import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import { Providers } from "@/components/providers";
import { HUB_BRAND_ASSETS } from "@/constants/hub-brand";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZAIVON Business — Gestão da operação | ZAIVON",
  description:
    "ZAIVON Business — produto de gestão do ecossistema ZAIVON. Operação, vendas, financeiro e indicadores em um só lugar.",
  icons: {
    icon: [
      { url: HUB_BRAND_ASSETS.favicon, sizes: "64x64", type: "image/png" },
      { url: HUB_BRAND_ASSETS.favicon32, sizes: "32x32", type: "image/png" },
    ],
    apple: HUB_BRAND_ASSETS.appleTouch,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#05070B",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${sora.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
