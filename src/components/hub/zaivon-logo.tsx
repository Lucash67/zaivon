import { cn } from "@/components/ui/utils";
import { ZaivonMark, ZaivonWordtype } from "@/components/hub/zaivon-monogram";
import { HUB_BRAND_ASSETS, HUB_COPY } from "@/constants/hub-brand";

type HubLogoVariant = "horizontal" | "horizontal-compact" | "stacked" | "icon";

interface BrandLogoProps {
  className?: string;
  height?: number;
  iconSize?: number;
}

function resolveHeight(height?: number, iconSize?: number, fallback = 40): number {
  return height ?? iconSize ?? fallback;
}

/** Logo do produto ZAIVON Business. */
export function ZaivonHubLogo({
  variant = "horizontal",
  className,
  height,
  iconSize,
}: BrandLogoProps & { variant?: HubLogoVariant }) {
  const h = resolveHeight(height, iconSize, variant === "icon" ? 28 : 40);

  if (variant === "icon") {
    return <ZaivonMark size={h} className={className} />;
  }

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)} style={{ height: h }}>
      <ZaivonMark size={Math.round(h * 0.85)} />
      <span className="inline-flex items-center gap-2">
        <ZaivonWordtype height={Math.round(h * 0.3)} />
        <span className="font-semibold text-text-muted" style={{ fontSize: h * 0.34 }}>
          Business
        </span>
      </span>
    </div>
  );
}

/** Logo da marca-mãe ZAIVON. */
export function ZaivonLogo({ className, height, iconSize }: BrandLogoProps) {
  const h = resolveHeight(height, iconSize, 44);

  return (
    <div
      className={cn("inline-flex flex-col items-start justify-center gap-1", className)}
      style={{ minHeight: h }}
    >
      <div className="inline-flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HUB_BRAND_ASSETS.monogram}
          alt=""
          aria-hidden
          draggable={false}
          className="shrink-0"
          style={{ height: 30, width: "auto" }}
        />
        <div className="flex flex-col items-start gap-1.5 leading-tight">
          <ZaivonWordtype onDark height={18} />
          <p className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted">
            {HUB_COPY.holdingTagline}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ZaivonIcon({ className, height, iconSize }: BrandLogoProps) {
  const h = resolveHeight(height, iconSize, 36);
  return <ZaivonMark size={h} className={className} />;
}
