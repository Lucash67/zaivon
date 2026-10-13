/* eslint-disable @next/next/no-img-element */
import { cn } from "@/components/ui/utils";
import { HUB_BRAND_ASSETS } from "@/constants/hub-brand";

interface ZaivonMarkProps {
  size?: number;
  className?: string;
}

/**
 * Monograma ZAIVON Vertex (ZV). Ocupa o mesmo quadrado do antigo anel ZAIVON e
 * preserva a proporção da arte (object-contain).
 */
export function ZaivonMark({ size = 32, className }: ZaivonMarkProps) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <img src={HUB_BRAND_ASSETS.monogram} alt="" className="h-full w-full object-contain" draggable={false} />
    </span>
  );
}

/**
 * Lettering oficial "ZAIVON" (recorte do wordmark). `onDark` força a versão clara;
 * sem ele, troca para a versão escura no tema light.
 */
export function ZaivonWordtype({
  height = 14,
  onDark = false,
  className,
}: {
  height?: number;
  onDark?: boolean;
  className?: string;
}) {
  const style = { height, width: "auto" } as const;
  if (onDark) {
    return (
      <img src={HUB_BRAND_ASSETS.wordtypeLight} alt="ZAIVON" style={style} className={className} draggable={false} />
    );
  }
  return (
    <span className={cn("inline-flex items-center", className)}>
      <img
        src={HUB_BRAND_ASSETS.wordtypeLight}
        alt="ZAIVON"
        style={style}
        className="[.light_&]:hidden"
        draggable={false}
      />
      <img
        src={HUB_BRAND_ASSETS.wordtypeDark}
        alt="ZAIVON"
        style={style}
        className="hidden [.light_&]:block"
        draggable={false}
      />
    </span>
  );
}

/** @deprecated use ZaivonMark — alias para compat. */
export function ZaivonMonogram({ size = 32, className }: ZaivonMarkProps) {
  return <ZaivonMark size={size} className={className} />;
}

/** Monograma grande e discreto — watermark no fundo do login. */
export function ZaivonMonogramOutline({ className }: { className?: string }) {
  return (
    <img
      src={HUB_BRAND_ASSETS.monogram}
      alt=""
      aria-hidden
      draggable={false}
      className={cn("object-contain opacity-[0.07]", className)}
    />
  );
}
