/**
 * Corpo das notas: texto puro (notas antigas) ou HTML com formatação básica.
 * O HTML só é renderizado depois de passar por `sanitizeNoteHtml` (whitelist).
 */

const RICH_TAG_RE = /<\/?(div|p|br|b|strong|i|em|u|s|strike|span|font|mark|h[1-3]|ul|ol|li|blockquote)\b[^>]*>/i;

const ALLOWED_TAGS = new Set([
  "DIV", "P", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SPAN",
  "MARK", "H1", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE",
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
    .replace(/<\/(div|p|li|h[1-3]|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
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
  const text = html.replace(/<br\s*\/?>/gi, "").replace(/<\/?(div|p|span)[^>]*>/gi, "").replace(/&nbsp;/g, "").trim();
  return text ? html : "";
}
