import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value: Buffer): Buffer {
    return value;
  },
  fromDriver(value: unknown): Buffer {
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
    if (typeof value === "string") {
      if (value.startsWith("\\x")) return Buffer.from(value.slice(2), "hex");
      return Buffer.from(value, "base64");
    }
    return Buffer.alloc(0);
  },
});

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: text("status", { enum: ["active", "inactive"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("idx_businesses_status").on(table.status),
    ownerIdx: index("idx_businesses_owner").on(table.ownerId),
    ownerSlugIdx: uniqueIndex("idx_businesses_owner_slug").on(table.ownerId, table.slug),
  }),
);

export const operationDays = pgTable(
  "operation_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    operationDate: date("operation_date").notNull(),
    status: text("status", { enum: ["open", "closed", "homologated"] })
      .notNull()
      .default("open"),
    dailyGoalUnits: integer("daily_goal_units"),
    homologatedAt: timestamp("homologated_at", { withTimezone: true }),
    homologationRef: text("homologation_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessDateUnique: unique("operation_days_business_id_operation_date_unique").on(
      table.businessId,
      table.operationDate,
    ),
    businessDateIdx: index("idx_operation_days_business_date").on(
      table.businessId,
      table.operationDate,
    ),
    dailyGoalCheck: check(
      "operation_days_daily_goal_units_check",
      sql`${table.dailyGoalUnits} IS NULL OR ${table.dailyGoalUnits} >= 0`,
    ),
  }),
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    name: text("name").notNull(),
    category: text("category").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    minStock: integer("min_stock").notNull().default(0),
    imageUrl: text("image_url"),
    status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIdx: index("idx_products_business").on(table.businessId),
    businessStatusIdx: index("idx_products_business_status").on(table.businessId, table.status),
    activeNameUnique: uniqueIndex("idx_products_business_name_active")
      .on(table.businessId, table.name)
      .where(sql`${table.status} = 'active'`),
    unitPriceCheck: check("products_unit_price_check", sql`${table.unitPrice} >= 0`),
    unitCostCheck: check("products_unit_cost_check", sql`${table.unitCost} >= 0`),
    stockQuantityCheck: check("products_stock_quantity_check", sql`${table.stockQuantity} >= 0`),
  }),
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    sector: text("sector"),
    company: text("company"),
    phone: text("phone"),
    notes: text("notes"),
    registeredBusinessId: uuid("registered_business_id").references(() => businesses.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    registeredBusinessIdx: index("idx_clients_registered_business").on(table.registeredBusinessId),
    nameIdx: index("idx_clients_name").on(table.name),
  }),
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    operationDayId: uuid("operation_day_id")
      .notNull()
      .references(() => operationDays.id),
    clientId: uuid("client_id").references(() => clients.id),
    saleDate: date("sale_date").notNull(),
    saleTime: time("sale_time").notNull(),
    department: text("department"),
    paymentMethod: text("payment_method", { enum: ["pix", "card", "cash"] }),
    paymentStatus: text("payment_status", { enum: ["paid", "pending", "partial"] })
      .notNull()
      .default("paid"),
    amountReceived: numeric("amount_received", { precision: 12, scale: 2 }).notNull().default("0"),
    settlementDate: date("settlement_date"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    totalCost: numeric("total_cost", { precision: 12, scale: 2 }).notNull(),
    profit: numeric("profit", { precision: 12, scale: 2 }).notNull(),
    notes: text("notes"),
    /** Comprovante confirmado para contar no programa de fidelidade. */
    loyaltyConfirmed: boolean("loyalty_confirmed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessDateIdx: index("idx_sales_business_date").on(table.businessId, table.saleDate),
    operationDayIdx: index("idx_sales_operation_day").on(table.operationDayId),
    clientIdx: index("idx_sales_client").on(table.clientId),
  }),
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    profit: numeric("profit", { precision: 12, scale: 2 }).notNull(),
    flavorConfidence: text("flavor_confidence", {
      enum: ["confirmed", "unknown", "estimated"],
    }),
  },
  (table) => ({
    saleIdx: index("idx_sale_items_sale").on(table.saleId),
    productIdx: index("idx_sale_items_product").on(table.productId),
    quantityCheck: check("sale_items_quantity_check", sql`${table.quantity} > 0`),
  }),
);

export const dailyPurchases = pgTable(
  "daily_purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operationDayId: uuid("operation_day_id")
      .notNull()
      .unique()
      .references(() => operationDays.id),
    totalUnits: integer("total_units").notNull(),
    totalInvestment: numeric("total_investment", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    totalUnitsCheck: check("daily_purchases_total_units_check", sql`${table.totalUnits} > 0`),
    totalInvestmentCheck: check(
      "daily_purchases_total_investment_check",
      sql`${table.totalInvestment} >= 0`,
    ),
  }),
);

export const dailyPurchaseItems = pgTable(
  "daily_purchase_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dailyPurchaseId: uuid("daily_purchase_id")
      .notNull()
      .references(() => dailyPurchases.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id),
    productName: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 4 }),
  },
  (table) => ({
    purchaseIdx: index("idx_daily_purchase_items_purchase").on(table.dailyPurchaseId),
    quantityCheck: check("daily_purchase_items_quantity_check", sql`${table.quantity} > 0`),
  }),
);

export const dailyInvestments = pgTable(
  "daily_investments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operationDayId: uuid("operation_day_id")
      .notNull()
      .references(() => operationDays.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    investmentType: text("investment_type", {
      enum: ["initial", "additional", "withdrawal"],
    }).notNull(),
    sourceType: text("source_type", {
      enum: ["own_capital", "family", "partner", "investor", "supplier", "loan", "other"],
    }).notNull(),
    sourceName: text("source_name"),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    operationDayIdx: index("idx_daily_investments_operation_day").on(table.operationDayId),
    sourceIdx: index("idx_daily_investments_source").on(table.sourceType, table.sourceName),
    amountCheck: check("daily_investments_amount_check", sql`${table.amount} > 0`),
  }),
);

export const cashFlowEvents = pgTable(
  "cash_flow_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    operationDayId: uuid("operation_day_id").references(() => operationDays.id),
    saleId: uuid("sale_id").references(() => sales.id),
    eventType: text("event_type", { enum: ["income", "expense"] }).notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    eventDate: date("event_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessDateIdx: index("idx_cash_flow_business_date").on(table.businessId, table.eventDate),
    saleIdx: index("idx_cash_flow_sale").on(table.saleId),
    amountCheck: check("cash_flow_events_amount_check", sql`${table.amount} > 0`),
  }),
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    operationDayId: uuid("operation_day_id").references(() => operationDays.id),
    saleId: uuid("sale_id").references(() => sales.id),
    movementType: text("movement_type", { enum: ["entry", "exit", "adjustment"] }).notNull(),
    quantity: integer("quantity").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productCreatedIdx: index("idx_stock_movements_product_created").on(
      table.productId,
      table.createdAt,
    ),
    quantityCheck: check("stock_movements_quantity_check", sql`${table.quantity} > 0`),
    balanceAfterCheck: check("stock_movements_balance_after_check", sql`${table.balanceAfter} >= 0`),
  }),
);

export const diaryEntries = pgTable(
  "diary_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operationDayId: uuid("operation_day_id")
      .notNull()
      .unique()
      .references(() => operationDays.id),
    schemaVersion: integer("schema_version").notNull().default(1),
    revenueReceived: numeric("revenue_received", { precision: 12, scale: 2 }).notNull(),
    revenuePending: numeric("revenue_pending", { precision: 12, scale: 2 }).notNull().default("0"),
    revenueTotal: numeric("revenue_total", { precision: 12, scale: 2 }).notNull(),
    operationalProfit: numeric("operational_profit", { precision: 12, scale: 2 }).notNull(),
    quantitySold: integer("quantity_sold").notNull(),
    quantityLost: integer("quantity_lost").notNull().default(0),
    observations: text("observations"),
    manualInsights: text("manual_insights"),
    commercialIntelligence: jsonb("commercial_intelligence"),
    tags: text("tags").array().default(sql`'{}'::text[]`),
    narrative: jsonb("narrative"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const operationalLessons = pgTable(
  "operational_lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operationDayId: uuid("operation_day_id")
      .notNull()
      .references(() => operationDays.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    tags: text("tags").array().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    operationDayIdx: index("idx_operational_lessons_operation_day").on(table.operationDayId),
  }),
);

export const productHypotheses = pgTable("product_hypotheses", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationDayId: uuid("operation_day_id")
    .notNull()
    .references(() => operationDays.id, { onDelete: "cascade" }),
  flavor: text("flavor").notNull(),
  hypothesis: text("hypothesis").notNull(),
  confirmed: boolean("confirmed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const operationalActions = pgTable(
  "operational_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operationDayId: uuid("operation_day_id")
      .notNull()
      .references(() => operationDays.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: text("status", { enum: ["planned", "in_progress", "done"] })
      .notNull()
      .default("planned"),
    source: text("source").notNull().default("diary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("idx_operational_actions_status").on(table.status),
  }),
);

export const operationalPendings = pgTable("operational_pendings", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationDayId: uuid("operation_day_id")
    .notNull()
    .references(() => operationDays.id, { onDelete: "cascade" }),
  pendingType: text("pending_type", {
    enum: ["inventory_investigation", "flavor_unknown", "client_unknown", "payment_pending"],
  }).notNull(),
  productId: uuid("product_id").references(() => products.id),
  clientId: uuid("client_id").references(() => clients.id),
  saleId: uuid("sale_id").references(() => sales.id),
  quantity: integer("quantity").notNull().default(1),
  costAmount: numeric("cost_amount", { precision: 12, scale: 2 }),
  potentialRevenue: numeric("potential_revenue", { precision: 12, scale: 2 }),
  status: text("status", { enum: ["open", "resolved", "converted_to_loss"] })
    .notNull()
    .default("open"),
  description: text("description").notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const operationalLosses = pgTable("operational_losses", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationDayId: uuid("operation_day_id")
    .notNull()
    .references(() => operationDays.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const futureOrders = pgTable(
  "future_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    clientId: uuid("client_id").references(() => clients.id),
    productId: uuid("product_id").references(() => products.id),
    productName: text("product_name"),
    quantity: integer("quantity").notNull(),
    scheduledDate: date("scheduled_date").notNull(),
    status: text("status", { enum: ["planned", "confirmed", "fulfilled", "cancelled"] })
      .notNull()
      .default("planned"),
    originOperationDayId: uuid("origin_operation_day_id").references(() => operationDays.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessScheduledIdx: index("idx_future_orders_business_scheduled").on(
      table.businessId,
      table.scheduledDate,
    ),
  }),
);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    goalType: text("goal_type", { enum: ["daily", "weekly", "monthly", "yearly"] }).notNull(),
    targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
    targetUnits: integer("target_units"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessTypeIdx: index("idx_goals_business_type").on(
      table.businessId,
      table.goalType,
      table.periodStart,
    ),
  }),
);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("idx_users_email").on(table.email),
  }),
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashIdx: index("idx_password_reset_token_hash").on(table.tokenHash),
    userIdx: index("idx_password_reset_user").on(table.userId),
  }),
);

/** Bloco de notas pessoal (estilo Keep) — escopo por usuário. */
export const stickyNotes = pgTable(
  "sticky_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "set null" }),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    color: text("color").notNull().default("default"),
    noteDate: date("note_date"),
    pinned: boolean("pinned").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    clientUpdatedAt: timestamp("client_updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("idx_sticky_notes_owner").on(table.ownerId),
    ownerArchivedIdx: index("idx_sticky_notes_owner_archived").on(table.ownerId, table.archived),
    ownerUpdatedIdx: index("idx_sticky_notes_owner_updated").on(table.ownerId, table.clientUpdatedAt),
    ownerNoteDateIdx: index("idx_sticky_notes_owner_note_date").on(table.ownerId, table.noteDate),
  }),
);

/** Ideias, demandas e observações futuras — escopo por usuário. */
export const ideaItems = pgTable(
  "idea_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "set null" }),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    kind: text("kind", { enum: ["ideia", "demanda", "observacao"] }).notNull().default("ideia"),
    status: text("status", { enum: ["open", "done", "archived"] }).notNull().default("open"),
    pinned: boolean("pinned").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("idx_idea_items_owner").on(table.ownerId),
    ownerStatusIdx: index("idx_idea_items_owner_status").on(table.ownerId, table.status),
    ownerUpdatedIdx: index("idx_idea_items_owner_updated").on(table.ownerId, table.updatedAt),
  }),
);

/** Leitura interpretativa semanal/mensal (Retrato). */
export const periodReviews = pgTable(
  "period_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    periodType: text("period_type", { enum: ["weekly", "monthly"] }).notNull(),
    periodKey: text("period_key").notNull(),
    rangeStart: date("range_start").notNull(),
    rangeEnd: date("range_end").notNull(),
    status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
    title: text("title").notNull().default(""),
    headline: text("headline").notNull().default(""),
    summary: text("summary").notNull().default(""),
    causes: jsonb("causes").$type<unknown[]>().notNull().default([]),
    actions: jsonb("actions").$type<unknown[]>().notNull().default([]),
    channelNotes: jsonb("channel_notes").$type<unknown[]>().notNull().default([]),
    metricsSnapshot: jsonb("metrics_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    bodyMd: text("body_md").notNull().default(""),
    fairReading: text("fair_reading").notNull().default(""),
    nextGoals: text("next_goals").notNull().default(""),
    schemaVersion: integer("schema_version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessPeriodUnique: unique("period_reviews_business_period_unique").on(
      table.businessId,
      table.periodType,
      table.periodKey,
    ),
    businessTypeStartIdx: index("idx_period_reviews_business_type_start").on(
      table.businessId,
      table.periodType,
      table.rangeStart,
    ),
  }),
);

/** Galeria de design/arte — pastas/itens com um ou vários arquivos. */
export const galleryAssets = pgTable(
  "gallery_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    category: text("category", {
      enum: ["cardapio", "cartaz", "fidelidade", "anuncio", "arte", "outro"],
    })
      .notNull()
      .default("outro"),
    notes: text("notes").notNull().default(""),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    byteSize: integer("byte_size"),
    hasFile: boolean("has_file").notNull().default(false),
    fileCount: integer("file_count").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessCreatedIdx: index("idx_gallery_assets_business_created").on(
      table.businessId,
      table.createdAt,
    ),
    businessCategoryIdx: index("idx_gallery_assets_business_category").on(
      table.businessId,
      table.category,
    ),
    businessSortIdx: index("idx_gallery_assets_business_sort").on(
      table.businessId,
      table.sortOrder,
    ),
    byteSizeCheck: check(
      "gallery_assets_byte_size_check",
      sql`${table.byteSize} IS NULL OR ${table.byteSize} >= 0`,
    ),
  }),
);

export const galleryFiles = pgTable(
  "gallery_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => galleryAssets.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    content: bytea("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assetSortIdx: index("idx_gallery_files_asset_sort").on(table.assetId, table.sortOrder),
  }),
);

/** @deprecated use galleryFiles — mantido só se algum import antigo restar. */
export const galleryAssetFiles = galleryFiles;

export * from "./schema-engine";
export * from "./schema-crm";
export * from "./schema-schedule";
export * from "./schema-loyalty";
export * from "./schema-finance";
