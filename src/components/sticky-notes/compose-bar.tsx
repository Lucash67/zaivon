"use client";

import { useState } from "react";

interface ComposeBarProps {
  onCreate: (seed?: { title?: string; body?: string }) => Promise<unknown> | unknown;
}

/** Composer central estilo Keep, com chrome OMNI. */
export function ComposeBar({ onCreate }: ComposeBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setTitle("");
    setBody("");
    setExpanded(false);
  };

  const submit = async () => {
    if (!title.trim() && !body.trim()) {
      reset();
      return;
    }
    setBusy(true);
    try {
      await onCreate({ title: title.trim(), body: body.trim() });
      reset();
    } finally {
      setBusy(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mx-auto flex w-full max-w-[600px] items-center rounded-xl border border-z-primary/25 bg-[#1a1c24] px-4 py-3.5 text-left text-[15px] text-[#e8eaed]/55 shadow-[0_1px_3px_rgba(0,0,0,0.45)] transition hover:border-z-primary/40 hover:bg-[#1f2230]"
      >
        Tirar uma nota...
      </button>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[600px] overflow-hidden rounded-xl border border-z-primary/35 bg-[#1a1c24] shadow-[0_4px_20px_rgb(var(--z-primary-rgb)/0.18)]">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Título"
        className="w-full bg-transparent px-4 pt-4 text-[16px] font-medium text-[#e8eaed] placeholder:text-[#e8eaed]/40 focus:outline-none"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Anotar..."
        rows={3}
        className="w-full resize-none bg-transparent px-4 py-3 text-[14px] leading-relaxed text-[#e8eaed]/90 placeholder:text-[#e8eaed]/35 focus:outline-none"
      />
      <div className="flex justify-end px-2 pb-2">
        <button
          type="button"
          disabled={busy}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void submit()}
          className="rounded-lg bg-brand-gradient px-3 py-1.5 text-sm font-medium text-brand-on shadow-[0_2px_10px_rgb(var(--z-primary-rgb)/0.3)] hover:brightness-110 disabled:opacity-50"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
