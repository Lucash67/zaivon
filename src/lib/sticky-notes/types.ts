import { z } from "zod";

export const STICKY_NOTE_COLORS = [
  "default",
  "coral",
  "peach",
  "sand",
  "mint",
  "fog",
  "dusk",
  "lilac",
  "rose",
  "slate",
] as const;

export type StickyNoteColor = (typeof STICKY_NOTE_COLORS)[number];

export const stickyNoteSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid().optional(),
  businessId: z.string().nullable().optional(),
  title: z.string().max(500).default(""),
  body: z.string().max(100_000).default(""),
  color: z.enum(STICKY_NOTE_COLORS).default("default"),
  /** Data de referência da nota (yyyy-MM-dd). Null = Sem data. */
  noteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  pinned: z.boolean().default(false),
  archived: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  clientUpdatedAt: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type StickyNote = z.infer<typeof stickyNoteSchema>;

export const stickyNoteUpsertSchema = stickyNoteSchema.partial().extend({
  id: z.string().uuid().optional(),
  title: z.string().max(500).optional(),
  body: z.string().max(100_000).optional(),
  color: z.enum(STICKY_NOTE_COLORS).optional(),
  noteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  clientUpdatedAt: z.string().min(1),
});

export type StickyNoteUpsert = z.infer<typeof stickyNoteUpsertSchema>;

/** Paleta escura próxima do Google Keep. */
export const STICKY_NOTE_COLOR_STYLES: Record<
  StickyNoteColor,
  { card: string; border: string; swatch: string }
> = {
  default: {
    card: "bg-[#1a1c24]",
    border: "border-z-primary/25",
    swatch: "bg-[#1a1c24] ring-1 ring-z-primary/40",
  },
  coral: {
    card: "bg-[#5c2b29]",
    border: "border-[#5c2b29]",
    swatch: "bg-[#5c2b29]",
  },
  peach: {
    card: "bg-[#614a19]",
    border: "border-[#614a19]",
    swatch: "bg-[#614a19]",
  },
  sand: {
    card: "bg-[#635d19]",
    border: "border-[#635d19]",
    swatch: "bg-[#635d19]",
  },
  mint: {
    card: "bg-[#345920]",
    border: "border-[#345920]",
    swatch: "bg-[#345920]",
  },
  fog: {
    card: "bg-[#0d3d42]",
    border: "border-z-emerald/30",
    swatch: "bg-z-emerald/80",
  },
  dusk: {
    card: "bg-[#1a3550]",
    border: "border-z-info/35",
    swatch: "bg-z-info",
  },
  lilac: {
    card: "bg-[#2a1a45]",
    border: "border-z-primary/35",
    swatch: "bg-z-primary",
  },
  rose: {
    card: "bg-[#5b2245]",
    border: "border-[#5b2245]",
    swatch: "bg-[#5b2245]",
  },
  slate: {
    card: "bg-[#1F2430]",
    border: "border-z-info/30",
    swatch: "bg-[#1F2430] ring-1 ring-z-info/40",
  },
};
