import Link from "next/link";
import {
  ZAIVON_HUB_PATH,
  ZAIVON_IN_DEVELOPMENT_NOTICE,
  ZAIVON_PRODUCTS,
  type ZaivonProductId,
} from "@/constants/zaivon-products";

export function ProductInDevelopment({ productId }: { productId: ZaivonProductId }) {
  const product = ZAIVON_PRODUCTS.find((item) => item.id === productId);
  const Icon = product?.icon;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05060c] px-4 text-[#F5F6FA]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgb(var(--z-primary-rgb)/0.16),_transparent_55%)]"
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-3xl border border-dashed border-white/15 bg-[#12141c]/90 p-6 text-center sm:p-8">
        {Icon ? (
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-[#E7E5E4] ring-1 ring-white/10">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A3A3A3]">
          Em desenvolvimento
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{product?.name ?? "ZAIVON"}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#E7E5E4]">{ZAIVON_IN_DEVELOPMENT_NOTICE}</p>
        <Link
          href={ZAIVON_HUB_PATH}
          className="mt-6 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#12141c] transition hover:brightness-95"
        >
          Voltar ao Hub
        </Link>
      </div>
    </div>
  );
}
