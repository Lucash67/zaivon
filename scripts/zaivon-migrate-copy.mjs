// Troca pontual de texto visível OMNI → ZAIVON (identificadores técnicos não são tocados).
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const edits = {
  "src/constants/navigation.ts": [
    ['label: "OMNI v2",', 'label: "ZAIVON v2",'],
    ['export const APP_NAME = "OMNI Business";', 'export const APP_NAME = "ZAIVON Business";'],
    ["/** Telas do módulo OMNI v2 (operação diária). */", "/** Telas do módulo ZAIVON v2 (operação diária; rotas /v2). */"],
  ],
  "src/constants/omni-products.ts": [
    ['name: "OMNI Business",', 'name: "ZAIVON Business",'],
    ["Catálogo de produtos do ecossistema OMNI.", "Catálogo de produtos do ecossistema ZAIVON."],
  ],
  "src/lib/visao-geral.ts": [["mapa completo do OMNI Business.", "mapa completo do ZAIVON Business."]],
  "src/lib/theme-config.ts": [['brand: { label: "OMNI",', 'brand: { label: "ZAIVON",']],
  "src/components/visao-geral/visao-geral-hero.tsx": [["Visão Geral · OMNI Business", "Visão Geral · ZAIVON Business"]],
  "src/components/visao-geral/system-map.tsx": [["Principais funções do OMNI Business", "Principais funções do ZAIVON Business"]],
  "src/components/layout/sidebar.tsx": [
    ['OMNI <span className="font-semibold tracking-normal text-text-secondary">Business</span>', 'ZAIVON <span className="font-semibold tracking-normal text-text-secondary">Business</span>'],
  ],
  "src/components/hub/product-switcher.tsx": [['title="Voltar ao OMNI Hub"', 'title="Voltar ao ZAIVON Hub"']],
  "src/components/hub/omni-hub.tsx": [
    ["Produto OMNI", "Produto ZAIVON"],
    ["              OMNI Hub", "              ZAIVON Hub"],
    ['`, ${firstName}` : ""} à OMNI', '`, ${firstName}` : ""} à ZAIVON'],
  ],
  "src/app/configuracoes/page.tsx": [
    ['subtitle="Personalize o OMNI Business"', 'subtitle="Personalize o ZAIVON Business"'],
    ['<strong className="text-text-primary">OMNI</strong>', '<strong className="text-text-primary">ZAIVON</strong>'],
    ['<strong className="text-text-primary">OMNI Business</strong>', '<strong className="text-text-primary">ZAIVON Business</strong>'],
  ],
  "src/app/onboarding/page.tsx": [
    ['title: "Conheça a OMNI"', 'title: "Conheça a ZAIVON"'],
    ["Uma conta OMNI dá acesso", "Uma conta ZAIVON dá acesso"],
    ["OMNI · Ecossistema", "ZAIVON · Ecossistema"],
    ["Bem-vindo à OMNI", "Bem-vindo à ZAIVON"],
  ],
  "src/app/login/loading.tsx": [["Carregando OMNI Business", "Carregando ZAIVON Business"]],
  "src/app/relatorios/page.tsx": [['doc.text("OMNI Business —', 'doc.text("ZAIVON Business —']],
  "src/app/v2/layout.tsx": [['title: "OMNI Business — v2"', 'title: "ZAIVON Business — v2"']],
  "src/app/api/omni/route.ts": [['"Não foi possível carregar a OMNI."', '"Não foi possível carregar a ZAIVON."']],
  "src/lib/omni/omni-service.ts": [
    ["registrada na OMNI v2.", "registrada na ZAIVON v2."],
    ['notes: "Registrada na OMNI v2"', 'notes: "Registrada na ZAIVON v2"'],
    ["(OMNI v2).`", "(ZAIVON v2).`"],
  ],
  "src/components/omni-v2/root.tsx": [["`OMNI v2 · ", "`ZAIVON v2 · "]],
};

for (const [rel, pairs] of Object.entries(edits)) {
  const f = path.join(root, rel);
  let t = fs.readFileSync(f, "utf8");
  for (const [a, b] of pairs) {
    if (!t.includes(a)) {
      console.log(`MISS ${rel}: ${a}`);
      continue;
    }
    t = t.split(a).join(b);
  }
  fs.writeFileSync(f, t);
}
console.log("done");
