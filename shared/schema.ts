import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";
import { RELATIONSHIP_TIERS } from "./relationshipTiers";

// JSON requests always send timestamps as ISO strings, never Date
// instances — coerce so insert/update schemas accept wire data.
const { createInsertSchema } = createSchemaFactory({ coerce: { date: true } });

export const relationshipTierEnum = pgEnum("relationship_tier", RELATIONSHIP_TIERS);

export const people = pgTable("people", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  howMet: text("how_met"),
  company: text("company"),
  role: text("role"),
  location: text("location"),
  tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`).$type<string[]>(),
  // Stored as "MM-DD" so a birth year isn't required.
  birthday: text("birthday"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  linkedinUrl: text("linkedin_url"),
  relationshipTier: relationshipTierEnum("relationship_tier").notNull().default("acquaintance"),
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
  tags: true,
  birthday: true,
  facebookUrl: true,
  instagramUrl: true,
  linkedinUrl: true,
  relationshipTier: true,
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInteractionSchema = createInsertSchema(interactions).pick({
  personId: true,
  occurredAt: true,
  notes: true,
});
export const updateInteractionSchema = createInsertSchema(interactions).pick({ occurredAt: true, notes: true }).partial();

export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type UpdateInteraction = z.infer<typeof updateInteractionSchema>;
export type Interaction = typeof interactions.$inferSelect;

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

export const loginSchema = z.object({
  passphrase: z.string().min(1),
});
