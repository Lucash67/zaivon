interface BusinessWriteNoticeProps {
  message: string;
  className?: string;
}

export function BusinessWriteNotice({ message, className }: BusinessWriteNoticeProps) {
  return (
    <div
      className={
        className
          ? `rounded-xl border border-z-primary/30 bg-gradient-to-r from-z-primary/10 to-z-emerald/5 px-4 py-3 text-sm text-text-secondary ${className}`
          : "rounded-xl border border-z-primary/30 bg-gradient-to-r from-z-primary/10 to-z-emerald/5 px-4 py-3 text-sm text-text-secondary"
      }
    >
      {message}
    </div>
  );
}
