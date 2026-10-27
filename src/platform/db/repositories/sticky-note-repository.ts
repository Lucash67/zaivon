import { and, desc, eq } from "drizzle-orm";
import { getPostgresDb, getSqliteDb, isPostgres } from "@/platform/db";
import { stickyNotes as pgStickyNotes } from "@/lib/db/postgres/schema";
import { stickyNotes as sqliteStickyNotes } from "@/lib/db/schema";
import { queryAll, queryOne, queryRun, toDateString, toIsoTimestamp } from "@/platform/db/query";
import { generateId } from "@/shared/ids/generate-id";
import type { StickyNote, StickyNoteColor } from "@/lib/sticky-notes/types";
import {
  buildWeekdayDraftTemplate,
  isSeededFutureNote,
  officialDraftNoteTitle,
  operationalDatesOfYear,
  SEEDED_NOTE_CUTOFF,
  stripLeadingDraftDate,
} from "@/lib/day-registration/weekday-draft-templates";

export interface StickyNoteWriteInput {
  id?: string;
  title?: string;
  body?: string;
  color?: StickyNoteColor;
  noteDate?: string | null;
  pinned?: boolean;
  archived?: boolean;
  sortOrder?: number;
  clientUpdatedAt: string;
  businessId?: string | null;
}

function mapPgRow(row: typeof pgStickyNotes.$inferSelect): StickyNote {
  return {
    id: row.id,
    ownerId: row.ownerId,
    businessId: row.businessId,
    title: row.title ?? "",
    body: row.body ?? "",
    color: (row.color as StickyNoteColor) || "default",
    noteDate: row.noteDate ? toDateString(row.noteDate) : null,
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    sortOrder: row.sortOrder ?? 0,
    clientUpdatedAt: toIsoTimestamp(row.clientUpdatedAt),
    createdAt: toIsoTimestamp(row.createdAt),
    updatedAt: toIsoTimestamp(row.updatedAt),
  };
}

function mapSqliteRow(row: typeof sqliteStickyNotes.$inferSelect): StickyNote {
  return {
    id: row.id,
    ownerId: row.ownerId,
    businessId: row.businessId,
    title: row.title ?? "",
    body: row.body ?? "",
    color: (row.color as StickyNoteColor) || "default",
    noteDate: row.noteDate ?? null,
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    sortOrder: row.sortOrder ?? 0,
    clientUpdatedAt: row.clientUpdatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listStickyNotes(
  ownerId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<StickyNote[]> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    const rows = await queryAll(
      db
        .select()
        .from(pgStickyNotes)
        .where(
          includeArchived
            ? eq(pgStickyNotes.ownerId, ownerId)
            : and(eq(pgStickyNotes.ownerId, ownerId), eq(pgStickyNotes.archived, false)),
        )
        .orderBy(desc(pgStickyNotes.pinned), desc(pgStickyNotes.clientUpdatedAt)),
    );
    return rows.map(mapPgRow);
  }

  const db = getSqliteDb();
  const rows = includeArchived
    ? db
        .select()
        .from(sqliteStickyNotes)
        .where(eq(sqliteStickyNotes.ownerId, ownerId))
        .orderBy(desc(sqliteStickyNotes.pinned), desc(sqliteStickyNotes.clientUpdatedAt))
        .all()
    : db
        .select()
        .from(sqliteStickyNotes)
        .where(
          and(eq(sqliteStickyNotes.ownerId, ownerId), eq(sqliteStickyNotes.archived, false)),
        )
        .orderBy(desc(sqliteStickyNotes.pinned), desc(sqliteStickyNotes.clientUpdatedAt))
        .all();
  return rows.map(mapSqliteRow);
}

export async function getStickyNoteById(
  ownerId: string,
  id: string,
): Promise<StickyNote | null> {
  if (isPostgres()) {
    const db = await getPostgresDb();
    const row = await queryOne(
      db
        .select()
        .from(pgStickyNotes)
        .where(and(eq(pgStickyNotes.id, id), eq(pgStickyNotes.ownerId, ownerId)))
        .limit(1),
    );
    return row ? mapPgRow(row) : null;
  }

  const db = getSqliteDb();
  const row = db
    .select()
    .from(sqliteStickyNotes)
    .where(and(eq(sqliteStickyNotes.id, id), eq(sqliteStickyNotes.ownerId, ownerId)))
    .get();
  return row ? mapSqliteRow(row) : null;
}

export async function upsertStickyNote(
  ownerId: string,
  input: StickyNoteWriteInput,
): Promise<StickyNote> {
  const now = new Date().toISOString();
  const id = input.id ?? generateId();
  const existing = input.id ? await getStickyNoteById(ownerId, input.id) : null;

  if (
    existing &&
    input.clientUpdatedAt &&
    existing.clientUpdatedAt > input.clientUpdatedAt
  ) {
    return existing;
  }

  const title = input.title ?? existing?.title ?? "";
  const body = input.body ?? existing?.body ?? "";
  const color = input.color ?? existing?.color ?? "default";
  const noteDate =
    input.noteDate !== undefined ? input.noteDate : (existing?.noteDate ?? null);
  const pinned = input.pinned ?? existing?.pinned ?? false;
  const archived = input.archived ?? existing?.archived ?? false;
  const sortOrder = input.sortOrder ?? existing?.sortOrder ?? 0;
  const clientUpdatedAt = input.clientUpdatedAt || now;

  if (isPostgres()) {
    const db = await getPostgresDb();
    if (existing) {
      await queryRun(
        db
          .update(pgStickyNotes)
          .set({
            title,
            body,
            color,
            noteDate,
            pinned,
            archived,
            sortOrder,
            clientUpdatedAt: new Date(clientUpdatedAt),
            updatedAt: new Date(),
          })
          .where(and(eq(pgStickyNotes.id, id), eq(pgStickyNotes.ownerId, ownerId))),
      );
    } else {
      await queryRun(
        db.insert(pgStickyNotes).values({
          id,
          ownerId,
          title,
          body,
          color,
          noteDate,
          pinned,
          archived,
          sortOrder,
          clientUpdatedAt: new Date(clientUpdatedAt),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );
    }
    const saved = await getStickyNoteById(ownerId, id);
    if (!saved) throw new Error("Falha ao salvar nota.");
    return saved;
  }

  const db = getSqliteDb();
  if (existing) {
    db.update(sqliteStickyNotes)
      .set({
        title,
        body,
        color,
        noteDate,
        pinned,
        archived,
        sortOrder,
        clientUpdatedAt,
        updatedAt: now,
      })
      .where(and(eq(sqliteStickyNotes.id, id), eq(sqliteStickyNotes.ownerId, ownerId)))
      .run();
  } else {
    db.insert(sqliteStickyNotes)
      .values({
        id,
        ownerId,
        businessId: null,
        title,
        body,
        color,
        noteDate,
        pinned,
        archived,
        sortOrder,
        clientUpdatedAt,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  const saved = await getStickyNoteById(ownerId, id);
  if (!saved) throw new Error("Falha ao salvar nota.");
  return saved;
}

export async function deleteStickyNote(ownerId: string, id: string): Promise<boolean> {
  const existing = await getStickyNoteById(ownerId, id);
  if (!existing) return false;

  if (isPostgres()) {
    const db = await getPostgresDb();
    await queryRun(
      db
        .delete(pgStickyNotes)
        .where(and(eq(pgStickyNotes.id, id), eq(pgStickyNotes.ownerId, ownerId))),
    );
    return true;
  }

  getSqliteDb()
    .delete(sqliteStickyNotes)
    .where(and(eq(sqliteStickyNotes.id, id), eq(sqliteStickyNotes.ownerId, ownerId)))
    .run();
  return true;
}

/**
 * Garante um bloco vazio em cada dia do ano anterior a 27/10/2026 que ainda não tem nota.
 * Datas dessa data em diante ficam sem bloco automático.
 * Também tira a data digitada no topo: a data oficial é noteDate.
 */
export async function ensureYearDayBlocks(ownerId: string, year = new Date().getFullYear()): Promise<number> {
  const existing = await listStickyNotes(ownerId, { includeArchived: true });
  const seeded = existing.filter((note) => isSeededFutureNote(note));
  if (seeded.length > 0) {
    for (const note of seeded) {
      await deleteStickyNote(ownerId, note.id);
    }
  }
  const removed = new Set(seeded.map((note) => note.id));
  const kept = existing.filter((note) => !removed.has(note.id));
  const taken = new Set(
    kept.filter((n) => !n.archived && n.noteDate).map((n) => n.noteDate as string),
  );
  const now = new Date();
  const template = buildWeekdayDraftTemplate();
  const missing = operationalDatesOfYear(year).filter(
    (date) => date < SEEDED_NOTE_CUTOFF && !taken.has(date),
  );

  if (isPostgres()) {
    const db = await getPostgresDb();
    for (let i = 0; i < missing.length; i += 40) {
      const chunk = missing.slice(i, i + 40).map((date) => ({
        id: generateId(),
        ownerId,
        title: officialDraftNoteTitle(date),
        body: template,
        color: "mint",
        noteDate: date,
        pinned: false,
        archived: false,
        sortOrder: 0,
        clientUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      }));
      if (chunk.length > 0) {
        await queryRun(db.insert(pgStickyNotes).values(chunk));
      }
    }

    for (const note of kept) {
      if (!note.noteDate) continue;
      const next = stripLeadingDraftDate(note.body);
      if (next === note.body) continue;
      await queryRun(
        db
          .update(pgStickyNotes)
          .set({ body: next, updatedAt: now })
          .where(and(eq(pgStickyNotes.id, note.id), eq(pgStickyNotes.ownerId, ownerId))),
      );
    }
    return missing.length;
  }

  const db = getSqliteDb();
  for (const date of missing) {
    db.insert(sqliteStickyNotes)
      .values({
        id: generateId(),
        ownerId,
        businessId: null,
        title: officialDraftNoteTitle(date),
        body: template,
        color: "mint",
        noteDate: date,
        pinned: false,
        archived: false,
        sortOrder: 0,
        clientUpdatedAt: now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .run();
  }
  for (const note of kept) {
    if (!note.noteDate) continue;
    const next = stripLeadingDraftDate(note.body);
    if (next === note.body) continue;
    db.update(sqliteStickyNotes)
      .set({ body: next, updatedAt: now.toISOString() })
      .where(and(eq(sqliteStickyNotes.id, note.id), eq(sqliteStickyNotes.ownerId, ownerId)))
      .run();
  }
  return missing.length;
}
