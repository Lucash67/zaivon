/**
 * ZAIVON Schedule — schema isolado (`schedule.*`).
 *
 * NÃO misturar com tabelas do ZAIVON Business (`public.*`).
 * Auth compartilha apenas `public.users` (FK por UUID, sem cascade destrutivo no Business).
 *
 * Verticalização via `organizations.business_type` (ex.: barber_shop) —
 * entidades genéricas, sem tabelas barber_*.
 *
 * Horários: profissional sem working_hours herda organization_working_hours;
 * com working_hours próprios, faz override. Nunca copiar org → profissional.
 */
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgSchema,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const scheduleSchema = pgSchema("schedule");

export const SCHEDULE_BUSINESS_TYPES = [
  "barber_shop",
  "beauty_salon",
  "personal_trainer",
  "nutritionist",
  "other",
] as const;

export const SCHEDULE_MEMBER_ROLES = ["owner", "manager", "professional"] as const;

export const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

export const APPOINTMENT_SOURCES = ["dashboard", "public_booking"] as const;

export const SCHEDULE_EXCEPTION_SCOPES = ["organization", "professional"] as const;

export const SCHEDULE_EXCEPTION_KINDS = ["unavailable", "available"] as const;

/** Estabelecimento / tenant do Schedule (≠ public.businesses do Business). */
export const scheduleOrganizations = scheduleSchema.table(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    businessType: text("business_type").notNull().default("barber_shop"),
    timezone: text("timezone").notNull().default("America/Fortaleza"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    description: text("description"),
    logoUrl: text("logo_url"),
    active: boolean("active").notNull().default(true),
    onboardingStep: integer("onboarding_step").notNull().default(0),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex("idx_sch_organizations_slug").on(t.slug),
  }),
);

/** Membros autenticados (dono/gestor/profissional com conta ZAIVON). */
export const scheduleOrganizationMembers = scheduleSchema.table(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => scheduleOrganizations.id, { onDelete: "cascade" }),
    /** FK lógica para public.users.id — sem FK cross-schema para não acoplar migrations. */
    userId: uuid("user_id").notNull(),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgUserIdx: uniqueIndex("idx_sch_org_members_org_user").on(t.organizationId, t.userId),
    userIdx: index("idx_sch_org_members_user").on(t.userId),
  }),
);

export const scheduleProfessionals = scheduleSchema.table(
  "professionals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => scheduleOrganizations.id, { onDelete: "cascade" }),
    /** Opcional: vincula a usuário autenticado depois. */
    userId: uuid("user_id"),
    name: text("name").notNull(),
    bio: text("bio"),
    photoUrl: text("photo_url"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("idx_sch_professionals_org").on(t.organizationId),
  }),
);

export const scheduleServices = scheduleSchema.table(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => scheduleOrganizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("idx_sch_services_org").on(t.organizationId),
  }),
);

export const scheduleProfessionalServices = scheduleSchema.table(
  "professional_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => scheduleOrganizations.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => scheduleProfessionals.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => scheduleServices.id, { onDelete: "cascade" }),
  },
  (t) => ({
    uniq: uniqueIndex("idx_sch_prof_services_uniq").on(t.professionalId, t.serviceId),
  }),
);

export const scheduleCustomers = scheduleSchema.table(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => scheduleOrganizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("idx_sch_customers_org").on(t.organizationId),
    orgPhoneIdx: uniqueIndex("idx_sch_customers_org_phone_unique").on(t.organizationId, t.phone),
  }),
);

/**
 * Horário semanal da organização (base).
 * Profissional sem linhas em working_hours herda estes intervalos.
 */
export const scheduleOrganizationWorkingHours = scheduleSchema.table(
  "organization_working_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => scheduleOrganizations.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => ({
    orgWeekIdx: index("idx_sch_org_hours_org_weekday").on(t.organizationId, t.weekday),
  }),
);

/** Horário recorrente semanal do profissional (0=dom … 6=sáb). Override da org. */
export const scheduleWorkingHours = scheduleSchema.table(
  "working_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => scheduleOrganizations.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => scheduleProfessionals.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => ({
    profWeekIdx: index("idx_sch_working_hours_prof_weekday").on(t.professionalId, t.weekday),
  }),
);

/**
 * Exceções em data específica.
 * scope=organization + professional_id null → fechamento/extra da casa.
 * kind=available → disponibilidade extraordinária.
 */
export const scheduleAvailabilityExceptions = scheduleSchema.table(
  "availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => scheduleOrganizations.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id").references(() => scheduleProfessionals.id, {
      onDelete: "cascade",
    }),
    exceptionDate: date("exception_date").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    scope: text("scope").notNull().default("professional"),
    kind: text("kind").notNull().default("unavailable"),
    reason: text("reason"),
  },
  (t) => ({
    profDateIdx: index("idx_sch_avail_exc_prof_date").on(t.professionalId, t.exceptionDate),
    orgDateIdx: index("idx_sch_avail_exc_org_date").on(t.organizationId, t.exceptionDate),
  }),
);

export const scheduleAppointments = scheduleSchema.table(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => scheduleOrganizations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => scheduleCustomers.id, { onDelete: "restrict" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => scheduleProfessionals.id, { onDelete: "restrict" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"),
    /** Total dos snapshots em appointment_services. */
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    notes: text("notes"),
    source: text("source").notNull().default("dashboard"),
    publicToken: uuid("public_token").notNull().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgStartIdx: index("idx_sch_appointments_org_start").on(t.organizationId, t.startAt),
    profStartIdx: index("idx_sch_appointments_prof_start").on(t.professionalId, t.startAt),
    statusIdx: index("idx_sch_appointments_status").on(t.organizationId, t.status),
    publicTokenIdx: uniqueIndex("idx_sch_appointments_public_token").on(t.publicToken),
  }),
);

/** Linhas do atendimento — snapshots para histórico se o serviço for desativado. */
export const scheduleAppointmentServices = scheduleSchema.table(
  "appointment_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => scheduleOrganizations.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => scheduleAppointments.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => scheduleServices.id, { onDelete: "set null" }),
    serviceNameSnapshot: text("service_name_snapshot").notNull(),
    durationMinutesSnapshot: integer("duration_minutes_snapshot").notNull(),
    priceSnapshot: numeric("price_snapshot", { precision: 12, scale: 2 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    apptIdx: index("idx_sch_appt_services_appt").on(t.appointmentId),
    orgIdx: index("idx_sch_appt_services_org").on(t.organizationId),
  }),
);
