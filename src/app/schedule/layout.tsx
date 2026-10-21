import { ProductInDevelopment } from "@/components/hub/product-in-development";

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  void children;
  return <ProductInDevelopment productId="schedule" />;
}
