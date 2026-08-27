import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, pgEnum, boolean, integer, date, unique } from "drizzle-orm/pg-core";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";
import { RELATIONSHIP_TIERS, DEFAULT_RECONNECT_INTERVAL_DAYS } from "./relationshipTiers";
import { LINK_TYPES } from "./personLinks";

// JSON requests always send timestamps as ISO strings, never Date
// instances — coerce so insert/update schemas accept wire data.
const { createInsertSchema } = createSchemaFactory({ coerce: { date: true } });

export const relationshipTierEnum = pgEnum("relationship_tier", RELATIONSHIP_TIERS);
export const interactionKindEnum = pgEnum("interaction_kind", ["personal", "outreach"]);
export const linkTypeEnum = pgEnum("link_type", LINK_TYPES);

export const people = pgTable("people", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  howMet: text("how_met"),
  company: text("company"),
  role: text("role"),
  location: text("location"),
  // Standing background on someone — kids' names, injuries, what they're
  // training for. Deliberately separate from `interactions`, which stays a
  // dated log of what actually happened; this is the durable summary you'd
  // want to skim before reaching out.
  notes: text("notes"),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`).$type<string[]>(),
  // Stored as "MM-DD" so a birth year isn't required.
  birthday: text("birthday"),
  // Either an external image URL or a client-resized data: URI (uploads are
  // downscaled in the browser before submit — see client/src/lib/image.ts —
  // so this stays small even without a dedicated file-storage backend).
  photoUrl: text("photo_url"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  linkedinUrl: text("linkedin_url"),
  relationshipTier: relationshipTierEnum("relationship_tier").notNull().default("acquaintance"),
  // false for leads entered directly into the pipeline who were never a
  // personal contact — keeps them out of the People tab and reconnect
  // reminders while still being a full person row (interactions, warmth,
  // photo) for the lead pipeline to use.
  isPersonalContact: boolean("is_personal_contact").notNull().default(true),
  // Denormalized from `interactions` for cheap reminder queries — kept in
  // sync by storage.ts on every interaction insert/update/delete.
  lastInteractionAt: timestamp("last_interaction_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPersonSchema = createInsertSchema(people).pick({
  name: true,
  howMet: true,
  company: true,
  role: true,
  location: true,
  notes: true,
  tags: true,
  birthday: true,
  photoUrl: true,
  facebookUrl: true,
  instagramUrl: true,
  linkedinUrl: true,
  relationshipTier: true,
  isPersonalContact: true,
});
export const updatePersonSchema = insertPersonSchema.partial();

export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type UpdatePerson = z.infer<typeof updatePersonSchema>;
export type Person = typeof people.$inferSelect;

export const interactions = pgTable("interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: varchar("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  occurredAt: timestamp("occurred_at").notNull(),
  notes: text("notes").notNull(),
  // "outreach" = a sales touchpoint toward a lead; counts toward the weekly
  // accountability goal. "personal" = everything else, including catch-ups
  // with someone who happens to also be a lead — kept distinct so casual
  // contact doesn't inflate the outreach count.
  kind: interactionKindEnum("kind").notNull().default("personal"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInteractionSchema = createInsertSchema(interactions).pick({
  personId: true,
  occurredAt: true,
  notes: true,
  kind: true,
});
export const updateInteractionSchema = createInsertSchema(interactions).pick({ occurredAt: true, notes: true, kind: true }).partial();

export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type UpdateInteraction = z.infer<typeof updateInteractionSchema>;
export type Interaction = typeof interactions.$inferSelect;

// Dated life events worth reaching out around — a move date, a race, a work
// anniversary. Kept as its own table rather than more columns on `people`
// because someone can have several, and each needs its own recurrence rule.
export const milestones = pgTable("milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: varchar("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  // A calendar day, not an instant — "moving on the 14th" means the 14th
  // wherever you are. Stored as YYYY-MM-DD and compared against the
  // viewer's local today, so it never slides a day across timezones the
  // way a timestamp would.
  occursOn: date("occurs_on", { mode: "string" }).notNull(),
  // One-off (a move) vs. yearly (an anniversary). One-off milestones drop
  // off the dashboard once the date passes; recurring ones roll forward.
  recursAnnually: boolean("recurs_annually").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMilestoneSchema = createInsertSchema(milestones)
  .pick({ personId: true, label: true, occursOn: true, recursAnnually: true })
  .extend({
    label: z.string().trim().min(1, "Give the milestone a label"),
    occursOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date"),
  });
export const updateMilestoneSchema = insertMilestoneSchema.omit({ personId: true }).partial();

export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type UpdateMilestone = z.infer<typeof updateMilestoneSchema>;
export type Milestone = typeof milestones.$inferSelect;

// Links between two people — spouses, siblings, who referred whom. One row
// per relationship, not two: `type` is recorded from `personId`'s side and
// flipped via LINK_TYPE_INVERSE when rendering the other profile, so the
// two ends can't disagree.
export const personLinks = pgTable(
  "person_links",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    personId: varchar("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    relatedPersonId: varchar("related_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    type: linkTypeEnum("type").notNull().default("other"),
    // Free-text qualifier for the vaguer types — "met through climbing club"
    // next to a plain "Connected to".
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  // Stops the same pair being linked twice in the same direction. The
  // reverse direction is caught in storage.ts, which can't be expressed as
  // a column constraint.
  (table) => ({ uniquePair: unique("person_links_pair").on(table.personId, table.relatedPersonId) }),
);

export const insertPersonLinkSchema = createInsertSchema(personLinks)
  .pick({ personId: true, relatedPersonId: true, type: true, note: true })
  .extend({ note: z.string().trim().max(200).nullish() });

export type InsertPersonLink = z.infer<typeof insertPersonLinkSchema>;
export type PersonLink = typeof personLinks.$inferSelect;

const talkingPointSchema = z.object({
  point: z.string(),
  basedOn: z.string().optional(),
});

export const reconnectSuggestions = pgTable("reconnect_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: varchar("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  openingLine: text("opening_line").notNull(),
  talkingPoints: jsonb("talking_points").notNull().$type<z.infer<typeof talkingPointSchema>[]>(),
  model: text("model").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ReconnectSuggestion = typeof reconnectSuggestions.$inferSelect;

// Stage keys are user-editable (see leadStageConfigs below), so this is a
// plain text column rather than a Postgres enum — enums can't have values
// removed, and app-level validation against the current stage list gives
// the same safety with none of that rigidity. Deleting a stage config is
// blocked (FK-less, checked in storage.ts) while any lead still references
// its key, so this column never points at a config that no longer exists.
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: varchar("person_id")
    .notNull()
    .unique()
    .references(() => people.id, { onDelete: "cascade" }),
  stage: text("stage").notNull().default("new"),
  // Reset whenever `stage` changes — drives per-stage staleness for leads
  // with no outreach yet, and shows how long someone's sat in a stage.
  stageEnteredAt: timestamp("stage_entered_at").defaultNow().notNull(),
  source: text("source"), // e.g. "Instagram DM", "referral — Dan"
  fitnessGoal: text("fitness_goal"),
  nextAction: text("next_action"),
  nextActionAt: timestamp("next_action_at"),
  notes: text("notes"),
  // Denormalized max(occurredAt) where kind='outreach' — kept in sync by
  // storage.ts's recomputeLastInteractionAt alongside people.lastInteractionAt.
  lastOutreachAt: timestamp("last_outreach_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLeadSchema = createInsertSchema(leads).pick({
  personId: true,
  stage: true,
  source: true,
  fitnessGoal: true,
  nextAction: true,
  nextActionAt: true,
  notes: true,
});
export const updateLeadSchema = insertLeadSchema.omit({ personId: true }).partial();

// A lead is created either by promoting an existing person (personId) or by
// entering a net-new prospect (person) — never both.
export const createLeadRequestSchema = z.union([
  insertLeadSchema.extend({ personId: z.string() }),
  insertLeadSchema.omit({ personId: true }).extend({ person: insertPersonSchema }),
]);

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type UpdateLead = z.infer<typeof updateLeadSchema>;
export type CreateLeadRequest = z.infer<typeof createLeadRequestSchema>;
export type Lead = typeof leads.$inferSelect;

// User-editable pipeline stages. `key` is the value stored in leads.stage.
// Lazily seeded from shared/leadStages.ts's DEFAULT_STAGE_SEEDS the first
// time this table is read empty — see storage.ts's listStageConfigs.
export const leadStageConfigs = pgTable("lead_stage_configs", {
  key: varchar("key").primaryKey().default(sql`gen_random_uuid()`),
  label: text("label").notNull(),
  hint: text("hint"),
  sortOrder: integer("sort_order").notNull(),
  // Days of silence before a lead in this stage is flagged as needing a
  // touch. null = never flagged.
  touchIntervalDays: integer("touch_interval_days"),
  // Counts toward the weekly accountability "untouched leads" list and the
  // Dashboard pipeline strip — off for terminal stages like Client.
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStageConfigSchema = createInsertSchema(leadStageConfigs).pick({
  label: true,
  hint: true,
  touchIntervalDays: true,
  isActive: true,
});
export const updateStageConfigSchema = insertStageConfigSchema.partial();
export const reorderStagesSchema = z.array(z.string()).min(1);

export type InsertStageConfig = z.infer<typeof insertStageConfigSchema>;
export type UpdateStageConfig = z.infer<typeof updateStageConfigSchema>;
export type StageConfig = typeof leadStageConfigs.$inferSelect;

export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default("singleton"),
  weeklyOutreachGoal: integer("weekly_outreach_goal").notNull().default(10),
  // How far ahead a milestone starts showing on the dashboard.
  milestoneLookaheadDays: integer("milestone_lookahead_days").notNull().default(30),
  // Days of silence before someone in each relationship tier is due for a
  // reconnect. One column per tier rather than a jsonb map: the tiers are a
  // fixed pgEnum, so adding one is already a schema change either way, and
  // columns keep the values typed and cheap to validate.
  reconnectDaysClose: integer("reconnect_days_close").notNull().default(DEFAULT_RECONNECT_INTERVAL_DAYS.close),
  reconnectDaysFriend: integer("reconnect_days_friend").notNull().default(DEFAULT_RECONNECT_INTERVAL_DAYS.friend),
  reconnectDaysAcquaintance: integer("reconnect_days_acquaintance")
    .notNull()
    .default(DEFAULT_RECONNECT_INTERVAL_DAYS.acquaintance),
  // Off hides the whole lead pipeline — nav, dashboard strip, per-person
  // pipeline card, outreach toggle, stage settings. The data stays put, so
  // turning it back on restores everything untouched.
  showLeads: boolean("show_leads").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Capped at five years — long enough for "barely keep in touch", short
// enough that a stray keystroke can't push someone past a human lifetime.
const reconnectDays = z.coerce.number().int().min(1).max(1825);

// Every field optional so the Settings page can PATCH one control at a
// time without echoing back values it isn't editing.
export const updateSettingsSchema = z
  .object({
    weeklyOutreachGoal: z.coerce.number().int().min(1).max(200).optional(),
    milestoneLookaheadDays: z.coerce.number().int().min(1).max(365).optional(),
    reconnectDaysClose: reconnectDays.optional(),
    reconnectDaysFriend: reconnectDays.optional(),
    reconnectDaysAcquaintance: reconnectDays.optional(),
    showLeads: z.boolean().optional(),
  })
  // Strict so an unknown field fails by name. Without it Zod strips it
  // silently, the object comes out empty, and the refine below reports
  // "Nothing to update" — which reads like a UI bug when the real cause is
  // a client sending a field this server build doesn't have yet.
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
export type AppSettings = typeof appSettings.$inferSelect;

export const loginSchema = z.object({
  passphrase: z.string().min(1),
});
