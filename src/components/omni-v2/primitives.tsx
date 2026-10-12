"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* Botão ------------------------------------------------------------------ */

type ButtonVariant = "default" | "outline" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "icon";

export function buttonClass(variant: ButtonVariant = "default", size: ButtonSize = "default", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
    {
      default: "bg-o-primary text-o-primary-foreground hover:bg-o-primary/90",
      outline: "border bg-o-background hover:bg-o-muted",
      ghost: "hover:bg-o-muted",
      link: "text-o-primary underline-offset-4 hover:underline",
    }[variant],
    { default: "h-9 px-4", sm: "h-8 px-3 text-xs", icon: "size-9" }[size],
    className,
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ variant, size, className, type = "button", ...props }, ref) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
});

/* Campos ----------------------------------------------------------------- */

const fieldClass =
  "w-full rounded-xl border bg-o-background px-3 text-sm text-o-foreground placeholder:text-o-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-o-ring";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(fieldClass, "h-9", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(fieldClass, "py-2", className)} {...props} />;
  },
);

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}

export const selectClass = "h-9 w-full rounded-xl border bg-o-background px-2 text-sm text-o-foreground";

/* Abas ------------------------------------------------------------------- */

const TabsCtx = createContext<{ value: string; set: (v: string) => void } | null>(null);

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const set = (v: string) => {
    if (value == null) setInner(v);
    onValueChange?.(v);
  };
  return (
    <TabsCtx.Provider value={{ value: current, set }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div role="tablist" className={cn("inline-flex items-center gap-1 rounded-xl bg-o-muted p-1 text-o-muted-foreground", className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsCtx)!;
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.set(value)}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-o-background text-o-foreground shadow-sm" : "hover:text-o-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className, children }: { value: string; className?: string; children: ReactNode }) {
  const ctx = useContext(TabsCtx)!;
  if (ctx.value !== value) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}

/* Painel lateral --------------------------------------------------------- */

export function Sheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (v: boolean) => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onOpenChange]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/60" onClick={() => onOpenChange(false)} />
      <div role="dialog" aria-modal className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l bg-o-background p-5 shadow-2xl">
        <button type="button" aria-label="Fechar" onClick={() => onOpenChange(false)} className="absolute right-4 top-4 text-o-muted-foreground hover:text-o-foreground">
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

/* Avisos ----------------------------------------------------------------- */

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

let toastSeq = 0;
let toastItems: ToastItem[] = [];
const toastListeners = new Set<(items: ToastItem[]) => void>();

function pushToast(kind: ToastKind, title: string, opts?: { description?: string }) {
  const item = { id: ++toastSeq, kind, title, description: opts?.description };
  toastItems = [...toastItems, item];
  toastListeners.forEach((l) => l(toastItems));
  setTimeout(() => {
    toastItems = toastItems.filter((t) => t.id !== item.id);
    toastListeners.forEach((l) => l(toastItems));
  }, 4000);
}

export const toast = Object.assign((title: string, opts?: { description?: string }) => pushToast("info", title, opts), {
  success: (title: string, opts?: { description?: string }) => pushToast("success", title, opts),
  error: (title: string, opts?: { description?: string }) => pushToast("error", title, opts),
});

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    toastListeners.add(setItems);
    return () => {
      toastListeners.delete(setItems);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-[60] grid w-80 max-w-[calc(100vw-2rem)] gap-2 md:bottom-4" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-xl border bg-o-popover p-3 text-sm shadow-xl",
            t.kind === "success" && "border-o-ok/40",
            t.kind === "error" && "border-o-alert/50",
          )}
        >
          <div className={cn("font-semibold", t.kind === "success" && "text-o-ok", t.kind === "error" && "text-o-alert")}>{t.title}</div>
          {t.description && <div className="mt-0.5 text-xs text-o-muted-foreground">{t.description}</div>}
        </div>
      ))}
    </div>
  );
}
