# ZAIVON Business

Painel Inteligente de Gestão e Crescimento para negócio de salgados.

Produção: [zaivon.vercel.app](https://zaivon.vercel.app)

Projeto **100% independente** — sem relação com Terus Platform.

**Release v1.0** — Runtime PostgreSQL (Supabase) homologado.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Estilo | Tailwind CSS, Framer Motion |
| Dados | PostgreSQL (Supabase) via postgres.js + Drizzle ORM |
| Estado | TanStack Query, Zustand |
| Gráficos | Recharts |

## Arquitetura (resumo)

```
Pages / API Routes (Next.js)
    ↓
Services (analytics, finance, diary, goals, CRM)
    ↓
Repositories (platform/db)
    ↓
PostgreSQL (Supabase) — runtime oficial
```

SQLite permanece apenas para ETL local e scripts legados (`data/`, `scripts/etl/`).

Documentação completa: [`docs/backend/`](docs/backend/) · [`docs/architecture/`](docs/architecture/)

---

## Instalação

**Requisitos:** Node.js ≥ 18, pnpm ≥ 8

```bash
git clone https://github.com/<seu-usuario>/lucas-business-os.git
cd lucas-business-os
pnpm install
```

---

## Configuração de ambiente

Copie o template e preencha com os valores do Supabase Dashboard (**Connect → Transaction pooler**):

```bash
cp .env.example .env.local
```

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `DB_PROVIDER` | Sim | `postgres` |
| `DATABASE_URL` | Sim | URI Supabase (pooler, porta **6543**) |

Exemplo (sem senha real):

```env
DB_PROVIDER=postgres
DATABASE_URL=postgresql://postgres.[project-ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

> **Nunca** commite `.env.local` ou credenciais no repositório.

---

## Executar localmente

```bash
pnpm dev          # http://localhost:3001
pnpm build        # build de produção
pnpm start        # servidor produção (porta 3001)
pnpm typecheck    # verificação TypeScript
```

---

## Smoke test (PostgreSQL)

Valida conexão, listagens e CRUD idempotente contra o Supabase:

```bash
npx tsx scripts/smoke-postgres-runtime.ts
```

Esperado: **17/17 passed**. Lê variáveis de `.env.local` automaticamente.

---

## Deploy (Vercel)

### 1. Importar repositório

- [vercel.com/new](https://vercel.com/new) → Import Git Repository
- Framework: **Next.js** (detectado automaticamente)

### 2. Build settings

| Setting | Valor |
|---------|-------|
| Install Command | `pnpm install` |
| Build Command | `pnpm build` |
| Output Directory | *(padrão Next.js)* |
| Node.js Version | **20.x** (ou 18.x) |

### 3. Environment Variables (Production)

| Name | Value |
|------|-------|
| `DB_PROVIDER` | `postgres` |
| `DATABASE_URL` | URI Transaction Pooler do Supabase |

Configure em **Project Settings → Environment Variables** para Production, Preview e Development.

### 4. Deploy

Push na branch `main` dispara deploy automático. Ou clique **Deploy** após importar.

---

## Módulos

Dashboard · Vendas · Produtos · Clientes · Financeiro · Desempenho · Banco de Lucro · Estoque · Metas · Relatórios · Diário · Insights · Rankings · Calendário · Configurações

---

## Banco de dados

| Banco | Uso |
|-------|-----|
| **PostgreSQL (Supabase)** | Runtime oficial |
| **SQLite** (`data/lucas-business-os.db`) | Legado — ETL e backups locais (não versionado) |

Migrations: `drizzle/migrations/`

---

## Licença

Projeto privado — ZAIVON Business © 2026
