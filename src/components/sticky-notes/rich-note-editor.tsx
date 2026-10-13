"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  ALargeSmall,
  AlignCenter,
  AlignLeft,
  Baseline,
  Bold,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BLOCK_TAGS,
  looksLikeMarkdown,
  markdownToNoteHtml,
  noteBodyToSafeHtml,
  normalizeEditorHtml,
  plainTextToNoteHtml,
  sanitizeNoteHtml,
} from "@/lib/sticky-notes/rich-text";

/* Cores legíveis sobre os fundos escuros das notas. */
const TEXT_COLORS = [
  { label: "Padrão", value: "#e8eaed" },
  { label: "Lima", value: "#c9ff69" },
  { label: "Verde", value: "#4ade80" },
  { label: "Esmeralda", value: "#2ed3a7" },
  { label: "Azul", value: "#60b4ff" },
  { label: "Amarelo", value: "#fcd34d" },
  { label: "Laranja", value: "#fb923c" },
  { label: "Vermelho", value: "#f87171" },
  { label: "Rosa", value: "#f472b6" },
  { label: "Cinza", value: "#9aa0a6" },
] as const;

/* Marca-texto translúcido: o texto claro continua legível por cima. */
const HIGHLIGHTS = [
  { label: "Sem destaque", value: "transparent" },
  { label: "Amarelo", value: "rgba(250, 204, 21, 0.38)" },
  { label: "Lima", value: "rgba(183, 255, 60, 0.32)" },
  { label: "Verde", value: "rgba(34, 197, 94, 0.36)" },
  { label: "Azul", value: "rgba(61, 165, 255, 0.36)" },
  { label: "Laranja", value: "rgba(251, 146, 60, 0.38)" },
  { label: "Vermelho", value: "rgba(243, 93, 107, 0.38)" },
  { label: "Rosa", value: "rgba(244, 114, 182, 0.36)" },
] as const;

const SIZES = [
  { label: "Pequeno", font: "2", className: "text-xs" },
  { label: "Normal", font: "3", className: "text-sm" },
  { label: "Grande", font: "5", className: "text-base" },
  { label: "Muito grande", font: "6", className: "text-lg" },
  { label: "Enorme", font: "7", className: "text-xl" },
] as const;

const FONT_PX: Record<string, string> = { "2": "14px", "3": "16px", "5": "23px", "6": "28px", "7": "34px" };

type ActiveState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  ul: boolean;
  ol: boolean;
  block: string;
};

const EMPTY_ACTIVE: ActiveState = { bold: false, italic: false, underline: false, strike: false, ul: false, ol: false, block: "" };

/** Guarda a última seleção dentro do editor (toques na barra podem tirar o foco no celular). */
function useSavedSelection(editorRef: RefObject<HTMLDivElement>) {
  const saved = useRef<Range | null>(null);

  useEffect(() => {
    const onChange = () => {
      const sel = window.getSelection();
      const el = editorRef.current;
      if (!sel || sel.rangeCount === 0 || !el) return;
      const range = sel.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) saved.current = range.cloneRange();
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, [editorRef]);

  const restore = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    const sel = window.getSelection();
    if (!sel) return;
    const inside = sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer);
    if (!inside && saved.current) {
      sel.removeAllRanges();
      sel.addRange(saved.current);
    }
  }, [editorRef]);

  return restore;
}

interface RichNoteBodyProps {
  editorRef: RefObject<HTMLDivElement>;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

/** Área de texto com formatação (contentEditable). O valor é HTML ou texto puro legado. */
export function RichNoteBody({ editorRef, value, onChange, placeholder, className }: RichNoteBodyProps) {
  const lastValue = useRef<string | null>(null);
  const [empty, setEmpty] = useState(!value);

  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el || value === lastValue.current) return;
    el.innerHTML = noteBodyToSafeHtml(value);
    lastValue.current = value;
    setEmpty(!value);
  }, [editorRef, value]);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = normalizeEditorHtml(el.innerHTML);
    lastValue.current = html;
    setEmpty(!html);
    onChange(html);
  }, [editorRef, onChange]);

  return (
    <div
      ref={editorRef}
      role="textbox"
      aria-multiline="true"
      aria-label={placeholder ?? "Texto da nota"}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      data-empty={empty ? "true" : "false"}
      onInput={emit}
      onKeyDown={(e) => e.stopPropagation()}
      onPaste={(e) => {
        const html = e.clipboardData.getData("text/html");
        const text = e.clipboardData.getData("text/plain");
        if (!html && !text) return;
        const el = editorRef.current;
        const sel = window.getSelection();
        if (!el || !sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        if (!el.contains(range.commonAncestorContainer)) return;
        e.preventDefault();

        const clean = html
          ? sanitizeNoteHtml(html, { keepColors: false })
          : looksLikeMarkdown(text)
            ? markdownToNoteHtml(text)
            : plainTextToNoteHtml(text);

        range.deleteContents();
        const template = document.createElement("template");
        template.innerHTML = clean;
        const last = template.content.lastChild;

        // Blocos (títulos, listas…) não podem cair dentro de um título/parágrafo existente.
        const hasBlocks = Array.from(template.content.childNodes).some(
          (n) => n.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((n as Element).tagName),
        );
        if (hasBlocks) {
          let node: Node | null = range.startContainer;
          let host: HTMLElement | null = null;
          while (node && node !== el) {
            if (node instanceof HTMLElement && /^(H[1-6]|P|BLOCKQUOTE)$/.test(node.tagName)) host = node;
            node = node.parentNode;
          }
          if (host) {
            if (!host.textContent?.trim()) {
              range.selectNode(host);
              range.deleteContents();
            } else {
              range.setStartAfter(host);
              range.collapse(true);
            }
          }
        }
        range.insertNode(template.content);
        if (last) {
          const caret = document.createRange();
          caret.setStartAfter(last);
          caret.collapse(true);
          sel.removeAllRanges();
          sel.addRange(caret);
        }
        emit();
      }}
      className={cn("note-rich", className)}
    />
  );
}

function FormatButton({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#e8eaed]/75 transition-colors sm:h-8 sm:w-8",
        active ? "bg-z-primary/20 text-[#e8eaed]" : "hover:bg-white/10 hover:text-[#e8eaed] active:bg-white/15",
      )}
    >
      {children}
    </button>
  );
}

type Popover = "size" | "color" | "highlight" | null;

/** Barra de formatação: tamanho, negrito, cores, marca-texto, títulos, listas, alinhamento. */
export function RichFormatToolbar({
  editorRef,
  onEdited,
}: {
  editorRef: RefObject<HTMLDivElement>;
  onEdited: () => void;
}) {
  const restore = useSavedSelection(editorRef);
  const [active, setActive] = useState<ActiveState>(EMPTY_ACTIVE);
  const [open, setOpen] = useState<Popover>(null);

  useEffect(() => {
    const refresh = () => {
      const el = editorRef.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return;
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strike: document.queryCommandState("strikeThrough"),
        ul: document.queryCommandState("insertUnorderedList"),
        ol: document.queryCommandState("insertOrderedList"),
        block: String(document.queryCommandValue("formatBlock") || "").toLowerCase(),
      });
    };
    document.addEventListener("selectionchange", refresh);
    return () => document.removeEventListener("selectionchange", refresh);
  }, [editorRef]);

  const run = useCallback(
    (command: string, value?: string, css = false) => {
      restore();
      document.execCommand("styleWithCSS", false, css ? "true" : "false");
      document.execCommand(command, false, value);
      onEdited();
    },
    [onEdited, restore],
  );

  const setSize = useCallback(
    (font: string) => {
      restore();
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand("fontSize", false, font);
      editorRef.current?.querySelectorAll("font[size]").forEach((node) => {
        const fontEl = node as HTMLElement;
        const span = document.createElement("span");
        const px = FONT_PX[fontEl.getAttribute("size") ?? ""];
        if (px && fontEl.getAttribute("size") !== "3") span.style.fontSize = px;
        if (fontEl.getAttribute("color")) span.style.color = fontEl.getAttribute("color")!;
        span.append(...Array.from(fontEl.childNodes));
        fontEl.replaceWith(span);
      });
      onEdited();
      setOpen(null);
    },
    [editorRef, onEdited, restore],
  );

  const toggleBlock = (tag: "h1" | "h2" | "blockquote") =>
    run("formatBlock", active.block === tag ? "<div>" : `<${tag}>`);

  return (
    <div className="relative">
      {open && (
        <div className="absolute bottom-[calc(100%+0.35rem)] left-2 right-2 z-30 rounded-xl border border-[#5f6368]/50 bg-[#2d2e30] p-2 shadow-xl sm:right-auto sm:w-max">
          {open === "size" && (
            <div className="flex flex-col">
              {SIZES.map((s) => (
                <button
                  key={s.font}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSize(s.font)}
                  className={cn("rounded-md px-3 py-2 text-left text-[#e8eaed] hover:bg-white/10", s.className)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {open === "color" && (
            <div className="flex max-w-[280px] flex-wrap gap-2">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  aria-label={`Cor do texto: ${c.label}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    run("foreColor", c.value, true);
                    setOpen(null);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-white/15 hover:ring-white/50 sm:h-8 sm:w-8"
                >
                  <span className="text-[15px] font-bold" style={{ color: c.value }}>
                    A
                  </span>
                </button>
              ))}
            </div>
          )}
          {open === "highlight" && (
            <div className="flex max-w-[280px] flex-wrap gap-2">
              {HIGHLIGHTS.map((h) => (
                <button
                  key={h.value}
                  type="button"
                  title={h.label}
                  aria-label={`Destaque: ${h.label}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    run("hiliteColor", h.value, true);
                    setOpen(null);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-white/15 hover:ring-white/50 sm:h-8 sm:w-8"
                  style={{ background: h.value === "transparent" ? undefined : h.value }}
                >
                  {h.value === "transparent" && <span className="text-xs text-[#e8eaed]/70">∅</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-0.5 overflow-x-auto px-1.5 py-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-3 [&::-webkit-scrollbar]:hidden">
        <FormatButton title="Tamanho do texto" active={open === "size"} onClick={() => setOpen((v) => (v === "size" ? null : "size"))}>
          <ALargeSmall className="h-[18px] w-[18px]" />
        </FormatButton>
        <FormatButton title="Título" active={active.block === "h1"} onClick={() => toggleBlock("h1")}>
          <Heading1 className="h-[18px] w-[18px]" />
        </FormatButton>
        <FormatButton title="Subtítulo" active={active.block === "h2"} onClick={() => toggleBlock("h2")}>
          <Heading2 className="h-[18px] w-[18px]" />
        </FormatButton>
        <FormatButton title="Texto normal" onClick={() => run("formatBlock", "<div>")}>
          <Pilcrow className="h-[18px] w-[18px]" />
        </FormatButton>

        <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />

        <FormatButton title="Negrito (Ctrl+B)" active={active.bold} onClick={() => run("bold")}>
          <Bold className="h-[18px] w-[18px]" />
        </FormatButton>
        <FormatButton title="Itálico (Ctrl+I)" active={active.italic} onClick={() => run("italic")}>
          <Italic className="h-[18px] w-[18px]" />
        </FormatButton>
        <FormatButton title="Sublinhado (Ctrl+U)" active={active.underline} onClick={() => run("underline")}>
          <Underline className="h-[18px] w-[18px]" />
        </FormatButton>
        <FormatButton title="Riscado" active={active.strike} onClick={() => run("strikeThrough")}>
          <Strikethrough className="h-[18px] w-[18px]" />
        </FormatButton>

        <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />

        <FormatButton title="Cor do texto" active={open === "color"} onClick={() => setOpen((v) => (v === "color" ? null : "color"))}>
          <Baseline className="h-[18px] w-[18px]" />
        </FormatButton>
        <FormatButton title="Destacar (marca-texto)" active={open === "highlight"} onClick={() => setOpen((v) => (v === "highlight" ? null : "highlight"))}>
          <Highlighter className="h-[18px] w-[18px]" />
        </FormatButton>

        <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />

        <FormatButton title="Lista com marcadores" active={active.ul} onClick={() => run("insertUnorderedList")}>
          <List className="h-[18px] w-[18px]" />
        </FormatButton>
        <FormatButton title="Lista numerada" active={active.ol} onClick={() => run("insertOrderedList")}>
          <ListOrdered className="h-[18px] w-[18px]" />
        </FormatButton>
        <FormatButton title="Citação" active={active.block === "blockquote"} onClick={() => toggleBlock("blockquote")}>
          <Quote className="h-[18px] w-[18px]" />
        </FormatButton>
        <FormatButton title="Alinhar à esquerda" onClick={() => run("justifyLeft")}>
          <AlignLeft className="h-[18px] w-[18px]" />
        </FormatButton>
        <FormatButton title="Centralizar" onClick={() => run("justifyCenter")}>
          <AlignCenter className="h-[18px] w-[18px]" />
        </FormatButton>

        <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />

        <FormatButton
          title="Limpar formatação"
          onClick={() => {
            run("removeFormat");
            run("formatBlock", "<div>");
          }}
        >
          <RemoveFormatting className="h-[18px] w-[18px]" />
        </FormatButton>
      </div>
    </div>
  );
}
