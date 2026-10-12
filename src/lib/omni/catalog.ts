import type { ChannelInfo, Product } from "@/lib/omni/types";

export const OMNI_PRODUCTS: Product[] = [
  { id: "salgado", name: "Salgado", category: "Salgados", prices: { default: 5 }, cost: 3.1 },
  {
    id: "sanduiche",
    name: "Sanduíche Natural",
    category: "Sanduíches",
    prices: { default: 7, acal: 7, unifor: 8, meia_sola: 8 },
    cost: 1.9,
  },
];

export const OMNI_CHANNELS: ChannelInfo[] = [
  { id: "acal", name: "Acal", kind: "direta" },
  { id: "unifor", name: "Unifor", kind: "direta" },
  { id: "meia_sola", name: "Meia Sola", kind: "parceiro" },
  { id: "henrique", name: "Henrique", kind: "especial" },
];
