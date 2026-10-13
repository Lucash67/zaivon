import { cn } from "./utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  className?: string;
}

const variants = {
  default: "bg-surface-elevated text-text-secondary border-surface-border",
  success: "bg-brand-green/10 text-brand-green border-brand-green/20",
  warning: "bg-z-warning/10 text-z-warning border-z-warning/25",
  error: "bg-brand-red/10 text-brand-red border-brand-red/20",
  info: "bg-z-info/10 text-z-info border-z-info/20",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
