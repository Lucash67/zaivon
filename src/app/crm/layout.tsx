import { ProductInDevelopment } from "@/components/hub/product-in-development";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  void children;
  return <ProductInDevelopment productId="crm" />;
}
