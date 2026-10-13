import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const src = path.join(root, "src");
const EXCLUDE = [
  /[\\/]components[\\/]crm[\\/]/,
  /[\\/]components[\\/]schedule[\\/]/,
  /[\\/]app[\\/]crm[\\/]/,
  /[\\/]app[\\/]schedule[\\/]/,
  /crm-brand\.ts$/,
  /globals\.css$/,
  /[\\/]lib[\\/]crm[\\/]/,
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

const OLD = /(7C3CFF|0CD4FF|3882F6|124,\s*60,\s*255|12,\s*212,\s*255|56,\s*130,\s*246)/i;

/** Regras exatas por papel (antes da regra genérica). */
const exact = [
  // Semântica de alerta: era roxo + texto ciano → warning.
  ['warning: "bg-[#7C3CFF]/10 text-[#0CD4FF] border-[#7C3CFF]/25"', 'warning: "bg-z-warning/10 text-z-warning border-z-warning/25"'],
  ['high: "border-[#7C3CFF]/40 bg-[#7C3CFF]/10 text-[#0CD4FF]"', 'high: "border-z-warning/40 bg-z-warning/10 text-z-warning"'],
  ['p.tone === "warning" && "border-[#7C3CFF]/40 bg-[#7C3CFF]/10 text-[#0CD4FF]"', 'p.tone === "warning" && "border-z-warning/40 bg-z-warning/10 text-z-warning"'],
  ['tone === "warning" && "border-[#7C3CFF]/30"', 'tone === "warning" && "border-z-warning/30"'],
  ['tone === "warning" && "text-[#0CD4FF]"', 'tone === "warning" && "text-z-warning"'],
  ['warning: { icon: AlertTriangle, badge: "warning" as const, accent: "border-[#7C3CFF]/25 bg-[#7C3CFF]/5", iconColor: "text-[#0CD4FF]" }', 'warning: { icon: AlertTriangle, badge: "warning" as const, accent: "border-z-warning/25 bg-z-warning/5", iconColor: "text-z-warning" }'],
  ['média: "border-[#7C3CFF]/30 bg-[#7C3CFF]/10 text-[#0CD4FF]"', 'média: "border-z-warning/30 bg-z-warning/10 text-z-warning"'],
  ['badge: "bg-[#7C3CFF]/15 text-[#0CD4FF] ring-[#7C3CFF]/30",\n    amount: "text-[#0CD4FF]"', 'badge: "bg-z-warning/15 text-z-warning ring-z-warning/30",\n    amount: "text-z-warning"'],
  ['<span className="h-2 w-2 rounded-full bg-[#7C3CFF]" /> Pendente / Perda', '<span className="h-2 w-2 rounded-full bg-z-warning" /> Pendente / Perda'],
  ['<Badge className="ml-2 bg-[#7C3CFF]/15 text-[#0CD4FF]">pendente</Badge>', '<Badge className="ml-2 bg-z-warning/15 text-z-warning">pendente</Badge>'],
  ['<p className="text-sm text-[#0CD4FF]">{commitBlockReason}</p>', '<p className="text-sm text-z-warning">{commitBlockReason}</p>'],
  // Pulse: "info" passa a ser o azul semântico; receita usa o esmeralda de apoio.
  ['ring: "border-[#3882F6]/40",\n    glow: "shadow-[0_0_28px_rgba(56,130,246,0.2)]",\n    icon: "bg-[#3882F6]/15 text-[#3882F6]",\n    value: "text-[#3882F6]",\n    blob: "bg-[#3882F6]/12"',
   'ring: "border-z-emerald/40",\n    glow: "shadow-[0_0_28px_rgb(var(--z-emerald-rgb)/0.2)]",\n    icon: "bg-z-emerald/15 text-z-emerald",\n    value: "text-z-emerald",\n    blob: "bg-z-emerald/12"'],
  ['ring: "border-[#0CD4FF]/35",\n    glow: "shadow-[0_0_24px_rgba(12,212,255,0.16)]",\n    icon: "bg-[#0CD4FF]/15 text-[#0CD4FF]",\n    value: "text-[#0CD4FF]",\n    blob: "bg-[#0CD4FF]/10"',
   'ring: "border-z-info/35",\n    glow: "shadow-[0_0_24px_rgb(var(--z-info-rgb)/0.16)]",\n    icon: "bg-z-info/15 text-z-info",\n    value: "text-z-info",\n    blob: "bg-z-info/10"'],
  // CTAs com gradiente da marca antiga → assinatura Lime → Esmeralda.
  ["from-[#7C3CFF] via-[#3882F6] to-[#0CD4FF]", "from-z-primary to-z-emerald"],
  ["from-[#7C3CFF] to-[#3882F6]", "from-z-primary to-z-emerald"],
  ["from-[#0CD4FF]/90 to-[#3882F6] text-[#0b0c14]", "from-z-emerald/90 to-z-info text-[#07110A]"],
  // Gradiente de texto da login.
  ["linear-gradient(105deg, #7C3CFF 0%, #3882F6 45%, #0CD4FF 100%)", "linear-gradient(105deg, #B7FF3C 0%, #2ED3A7 55%, #B7FF3C 100%)"],
  // Tons claros de roxo/ciano sobre fundo escuro fixo.
  ["text-[#B794FF]", "text-z-lime-400"],
  ["text-[#C4B5FD]", "text-z-lime-300"],
  ["text-[#A78BFA]", "text-z-lime-300"],
  ["text-[#67E8F9]", "text-[#7FE6C8]"],
];

function migrate(file, text) {
  const crlf = text.includes("\r\n");
  const out = migrateLf(file, crlf ? text.replace(/\r\n/g, "\n") : text);
  return crlf ? out.replace(/\n/g, "\r\n") : out;
}

function migrateLf(file, text) {
  let t = text;
  for (const [a, b] of exact) t = t.split(a).join(b);

  // Fundo sólido de marca (lime) nunca leva texto branco.
  t = t
    .split("\n")
    .map((line) => {
      const solidBrand =
        /\bbg-brand-gradient\b/.test(line) ||
        /\bfrom-z-primary\s+to-z-emerald\b/.test(line);
      return solidBrand ? line.replace(/\btext-white\b/g, "text-brand-on") : line;
    })
    .join("\n");

  const isCss = file.endsWith(".css");
  const isLoginCss = /hub-login\.css$/.test(file);
  const rgbaTo = (channel, fixed) => (_m, a) =>
    isLoginCss
      ? `rgba(${fixed}, ${a})`
      : isCss
        ? `rgb(var(${channel}) / ${a})`
        : `rgb(var(${channel})/${a})`;

  t = t
    .replace(/rgba\(\s*124,\s*60,\s*255,\s*([\d.]+)\s*\)/gi, rgbaTo("--z-primary-rgb", "183, 255, 60"))
    .replace(/rgba\(\s*12,\s*212,\s*255,\s*([\d.]+)\s*\)/gi, rgbaTo("--z-emerald-rgb", "46, 211, 167"))
    .replace(/rgba\(\s*56,\s*130,\s*246,\s*([\d.]+)\s*\)/gi, rgbaTo("--z-info-rgb", "61, 165, 255"))
    .replace(/-\[#7C3CFF\]/gi, "-z-primary")
    .replace(/-\[#0CD4FF\]/gi, "-z-emerald")
    .replace(/-\[#3882F6\]/gi, "-z-info");
  return t;
}

const changed = [];
const leftovers = [];
for (const f of walk(src)) {
  if (EXCLUDE.some((r) => r.test(f))) continue;
  const before = fs.readFileSync(f, "utf8");
  if (!OLD.test(before) && !/text-\[#(B794FF|C4B5FD|A78BFA|67E8F9)\]/i.test(before)) continue;
  const after = migrate(f, before);
  if (after !== before) {
    fs.writeFileSync(f, after);
    changed.push(path.relative(root, f));
  }
  after.split("\n").forEach((l, i) => {
    if (OLD.test(l)) leftovers.push(`${path.relative(root, f)}:${i + 1}: ${l.trim()}`);
  });
}
console.log("CHANGED", changed.length);
console.log(changed.join("\n"));
console.log("LEFTOVERS", leftovers.length);
console.log(leftovers.join("\n"));
