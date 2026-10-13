"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { isRichNoteBody, noteBodyToPlainText, noteBodyToSafeHtml } from "@/lib/sticky-notes/rich-text";

/**
 * Prévia da nota no quadro. Notas formatadas mostram a formatação depois de montar
 * (a sanitização usa DOMParser); antes disso, e para notas antigas, texto puro.
 */
export function NoteBodyPreview({
  body,
  fallback,
  className,
}: {
  body: string;
  fallback?: string;
  className?: string;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const rich = isRichNoteBody(body);

  useEffect(() => {
    setHtml(rich ? noteBodyToSafeHtml(body) : null);
  }, [body, rich]);

  const plain = noteBodyToPlainText(body).trim();
  if (!plain) {
    return fallback ? <p className={cn("whitespace-pre-wrap", className)}>{fallback}</p> : null;
  }
  if (rich && html !== null) {
    return <div className={cn("note-rich note-rich-preview", className)} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <p className={cn("whitespace-pre-wrap", className)}>{plain}</p>;
}
