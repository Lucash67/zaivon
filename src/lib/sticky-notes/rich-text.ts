/**
 * Corpo das notas: texto puro (notas antigas) ou HTML com formatação básica.
 * O HTML só é renderizado depois de passar por `sanitizeNoteHtml` (whitelist).
 */

const RICH_TAG_RE =
  /<\/?(div|p|br|hr|b|strong|i|em|u|s|strike|del|span|font|mark|h[1-6]|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|pre|code)\b[^>]*>/i;

const ALLOWED_TAGS = new Set([
  "DIV", "P", "BR", "HR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "SPAN",
  "MARK", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE",
  "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "PRE", "CODE",
]);

export const BLOCK_TAGS = new Set([
  "DIV", "P", "HR", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE", "TABLE", "PRE",
]);

/** Removidos com todo o conteúdo. */
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "NOSCRIPT", "TEMPLATE", "SVG", "MATH", "HEAD", "META", "LINK", "TITLE"]);

const ALLOWED_STYLES = [
  "color",
  "background-color",
  "font-size",
  "text-align",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
] as const;

const SAFE_STYLE_VALUE = /^[#\w\s(),.%-]+$/;

/** Tamanhos do `<font size>` gerado pelo execCommand. */
const FONT_SIZE_MAP: Record<string, string> = {
  "1": "12px",
  "2": "14px",
  "3": "16px",
  "4": "19px",
  "5": "23px",
  "6": "28px",
  "7": "34px",
};

export function isRichNoteBody(body: string): boolean {
  return RICH_TAG_RE.test(body);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Texto puro → HTML equivalente (quebras de linha viram <br>). */
export function plainTextToNoteHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

/** Texto para busca, prévias e cópia (funciona no servidor). */
export function noteBodyToPlainText(body: string): string {
  if (!isRichNoteBody(body)) return body;
  return body
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr[^>]*>/gi, "\n")
    .replace(/<\/(div|p|li|h[1-6]|blockquote|tr|pre)>/gi, "\n")
    .replace(/<\/t[hd]>/gi, "  ")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{2,}(?=• )/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanStyle(style: CSSStyleDeclaration, keepColors: boolean): string {
  const parts: string[] = [];
  for (const prop of ALLOWED_STYLES) {
    if (!keepColors && (prop === "color" || prop === "background-color" || prop === "font-size")) continue;
    const value = style.getPropertyValue(prop).trim();
    if (!value || !SAFE_STYLE_VALUE.test(value) || /url|expression/i.test(value)) continue;
    parts.push(`${prop}: ${value}`);
  }
  return parts.join("; ");
}

function sanitizeNode(node: Node, doc: Document, keepColors: boolean): Node | DocumentFragment | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? "");
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as HTMLElement;
  const tag = el.tagName.toUpperCase();
  if (DROP_TAGS.has(tag)) return null;

  const children = doc.createDocumentFragment();
  el.childNodes.forEach((child) => {
    const clean = sanitizeNode(child, doc, keepColors);
    if (clean) children.appendChild(clean);
  });

  if (tag === "FONT") {
    const span = doc.createElement("span");
    const styles: string[] = [];
    const size = el.getAttribute("size");
    if (keepColors && size && FONT_SIZE_MAP[size]) styles.push(`font-size: ${FONT_SIZE_MAP[size]}`);
    const color = el.getAttribute("color");
    if (keepColors && color && SAFE_STYLE_VALUE.test(color)) styles.push(`color: ${color}`);
    const inline = cleanStyle(el.style, keepColors);
    if (inline) styles.push(inline);
    if (styles.length) span.setAttribute("style", styles.join("; "));
    span.appendChild(children);
    return span;
  }

  if (!ALLOWED_TAGS.has(tag)) return children;

  // Título/parágrafo com blocos dentro (colagem antiga com "Título" ativo): desembrulha.
  if (/^(H[1-6]|P)$/.test(tag) && Array.from(children.childNodes).some((c) => c.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((c as Element).tagName))) {
    return children;
  }

  const out = doc.createElement(tag.toLowerCase());
  const style = cleanStyle(el.style, keepColors);
  if (style) out.setAttribute("style", style);
  out.appendChild(children);
  return out;
}

/**
 * Mantém só tags/estilos de formatação. `keepColors: false` (colagem) remove
 * cores e tamanhos vindos de outros apps, preservando títulos, listas e negrito.
 */
export function sanitizeNoteHtml(html: string, opts: { keepColors?: boolean } = {}): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return plainTextToNoteHtml(noteBodyToPlainText(html));
  }
  const keepColors = opts.keepColors ?? true;
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const target = document.implementation.createHTMLDocument("");
  const wrapper = target.createElement("div");
  parsed.body.childNodes.forEach((child) => {
    const clean = sanitizeNode(child, target, keepColors);
    if (clean) wrapper.appendChild(clean);
  });
  return wrapper.innerHTML;
}

/** HTML pronto para o editor/prévia, aceitando notas antigas em texto puro. */
export function noteBodyToSafeHtml(body: string): string {
  if (!body) return "";
  if (!isRichNoteBody(body)) return plainTextToNoteHtml(body);
  return sanitizeNoteHtml(body);
}

/** Editor vazio (só <br>, divs vazias) → string vazia. */
export function normalizeEditorHtml(html: string): string {
  if (/<hr\b/i.test(html)) return html;
  const text = html.replace(/<br\s*\/?>/gi, "").replace(/<\/?(div|p|span)[^>]*>/gi, "").replace(/&nbsp;/g, "").trim();
  return text ? html : "";
}

/**
 * Texto copiado pelo botão "Copiar" do ChatGPT vem em Markdown. Só convertemos quando
 * há sinais claros (títulos #, **negrito**, divisória ---) para não transformar
 * rascunhos comuns com "- " em lista.
 */
export function looksLikeMarkdown(text: string): boolean {
  return (
    /^#{1,6}\s+\S/m.test(text) ||
    /\*\*[^*\n]+\*\*/.test(text) ||
    /^\s*(-{3,}|\*{3,}|_{3,})\s*$/m.test(text) ||
    /^```/m.test(text)
  );
}

function inlineMarkdown(text: string): string {
  const codes: string[] = [];
  let out = escapeHtml(text).replace(/`([^`\n]+)`/g, (_m, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out
    .replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+?)__/g, "<strong>$1</strong>")
    .replace(/~~([^~\n]+?)~~/g, "<s>$1</s>")
    .replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
  return out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)] ?? "");
}

function tableRowCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

/** Markdown (subconjunto usado pelo ChatGPT) → HTML da nota. */
export function markdownToNoteHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  const lists: { type: "ul" | "ol"; indent: number }[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inlineMarkdown).join("<br>")}</p>`);
    para = [];
  };
  const closeLists = (toIndent = -1) => {
    while (lists.length && lists[lists.length - 1]!.indent > toIndent) {
      out.push(`</li></${lists.pop()!.type}>`);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.replace(/\t/g, "    ");

    if (/^\s*```/.test(line)) {
      flushPara();
      closeLists();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) code.push(lines[i++]!);
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    if (!line.trim()) {
      flushPara();
      continue;
    }

    const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushPara();
      closeLists();
      const level = heading[1]!.length;
      out.push(`<h${level}>${inlineMarkdown(heading[2]!)}</h${level}>`);
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      closeLists();
      out.push("<hr>");
      continue;
    }

    const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      flushPara();
      const indent = item[1]!.length;
      const type: "ul" | "ol" = /\d/.test(item[2]!) ? "ol" : "ul";
      while (lists.length && lists[lists.length - 1]!.indent > indent) {
        out.push(`</li></${lists.pop()!.type}>`);
      }
      const top = lists[lists.length - 1];
      if (top && top.indent === indent && top.type !== type) {
        out.push(`</li></${lists.pop()!.type}>`);
      }
      const current = lists[lists.length - 1];
      if (current && current.indent === indent) {
        out.push(`</li><li>${inlineMarkdown(item[3]!)}`);
      } else {
        out.push(`<${type}><li>${inlineMarkdown(item[3]!)}`);
        lists.push({ type, indent });
      }
      continue;
    }

    if (/^\s*>/.test(line)) {
      flushPara();
      closeLists();
      out.push(`<blockquote>${inlineMarkdown(line.replace(/^\s*>\s?/, ""))}</blockquote>`);
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushPara();
      closeLists();
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]!)) {
        const cells = tableRowCells(lines[i]!);
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      const [head, ...body] = rows;
      const th = (head ?? []).map((c) => `<th>${inlineMarkdown(c)}</th>`).join("");
      const trs = body.map((r) => `<tr>${r.map((c) => `<td>${inlineMarkdown(c)}</td>`).join("")}</tr>`).join("");
      out.push(`<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`);
      continue;
    }

    if (lists.length && /^\s+\S/.test(line)) {
      out.push(`<br>${inlineMarkdown(line.trim())}`);
      continue;
    }

    closeLists();
    para.push(line.trim());
  }

  flushPara();
  closeLists();
  return out.join("");
}
