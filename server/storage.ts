import { eq, desc, asc, max, count, gte, and, or, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "./db";
import {
  people,
  interactions,
  milestones,
  personLinks,
  reconnectSuggestions,
  leads,
  appSettings,
  leadStageConfigs,
  type Person,
  type InsertPerson,
  type UpdatePerson,
  type Interaction,
  type InsertInteraction,
  type UpdateInteraction,
  type Milestone,
  type InsertMilestone,
  type UpdateMilestone,
  type PersonLink,
  type InsertPersonLink,
  type ReconnectSuggestion,
  type Lead,
  type InsertLead,
  type UpdateLead,
  type AppSettings,
  type StageConfig,
  type InsertStageConfig,
  type UpdateStageConfig,
  type UpdateSettings,
} from "@shared/schema";
import { computeNextReconnectAt, computeDaysOverdue, reconnectIntervalsFrom } from "@shared/relationshipTiers";
import { computeWarmth, FREQUENCY_WINDOW_DAYS, type Warmth } from "@shared/warmth";
import { birthdayToOccursOn, type MilestoneRecord } from "@shared/milestones";
import { linkTypeFor, type LinkType } from "@shared/personLinks";
import { DEFAULT_STAGE_SEEDS } from "@shared/leadStages";

export type PersonWithWarmth = Person & { warmth: Warmth };

function daysSince(date: Date | null, now: Date): number | null {
  if (!date) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

// One grouped query for however many people are being annotated — avoids an
// interaction-count query per person.
async function attachWarmth(rows: Person[]): Promise<PersonWithWarmth[]> {
  const since = new Date(Date.now() - FREQUENCY_WINDOW_DAYS * 86_400_000);
  const counts = await getDb()
    .select({ personId: interactions.personId, count: count() })
    .from(interactions)
    .where(gte(interactions.occurredAt, since))
    .groupBy(interactions.personId);
  const countByPerson = new Map(counts.map((c) => [c.personId, Number(c.count)]));

  const now = new Date();
  return rows.map((person) => ({
    ...person,
    warmth: computeWarmth(daysSince(person.lastInteractionAt, now), countByPerson.get(person.id) ?? 0),
  }));
}

export async function listPeople(): Promise<PersonWithWarmth[]> {
  // Lead-only people (never a personal contact) stay out of the People tab
  // and reconnect reminders — they're surfaced via the leads endpoints.
  const rows = await getDb()
    .select()
    .from(people)
    .where(eq(people.isPersonalContact, true))
    .orderBy(desc(people.createdAt));
  return attachWarmth(rows);
}

export type PersonWithWarmthAndLead = PersonWithWarmth & { lead: Lead | null };

export async function getPerson(id: string): Promise<PersonWithWarmthAndLead | undefined> {
  const [row] = await getDb().select().from(people).where(eq(people.id, id));
  if (!row) return undefined;
  const [withWarmth] = await attachWarmth([row]);
  const lead = await getLeadByPersonId(id);
  return { ...withWarmth, lead: lead ?? null };
}

export async function createPerson(input: InsertPerson): Promise<Person> {
  const [row] = await getDb().insert(people).values(input).returning();
  return row;
}

export async function updatePerson(id: string, input: UpdatePerson): Promise<Person | undefined> {
  const [row] = await getDb()
    .update(people)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(people.id, id))
    .returning();
  return row;
}

export async function deletePerson(id: string): Promise<void> {
  await getDb().delete(people).where(eq(people.id, id));
}

export async function listInteractions(personId: string): Promise<Interaction[]> {
  return getDb()
    .select()
    .from(interactions)
    .where(eq(interactions.personId, personId))
    .orderBy(desc(interactions.occurredAt));
}

async function recomputeLastInteractionAt(personId: string): Promise<void> {
  const [row] = await getDb()
    .select({ latest: max(interactions.occurredAt) })
    .from(interactions)
    .where(eq(interactions.personId, personId));

  await getDb()
    .update(people)
    .set({ lastInteractionAt: row?.latest ?? null, updatedAt: new Date() })
    .where(eq(people.id, personId));

  // Mirrors the above for leads.lastOutreachAt — only "outreach"-kind
  // interactions count. No-op (0 rows updated) if this person isn't a lead.
  const [outreachRow] = await getDb()
    .select({ latest: max(interactions.occurredAt) })
    .from(interactions)
    .where(and(eq(interactions.personId, personId), eq(interactions.kind, "outreach")));

  await getDb()
    .update(leads)
    .set({ lastOutreachAt: outreachRow?.latest ?? null, updatedAt: new Date() })
    .where(eq(leads.personId, personId));
}

export async function createInteraction(input: InsertInteraction): Promise<Interaction> {
  const [row] = await getDb().insert(interactions).values(input).returning();
  await recomputeLastInteractionAt(input.personId);
  return row;
}

export async function updateInteraction(
  id: string,
  personId: string,
  input: UpdateInteraction,
): Promise<Interaction | undefined> {
  const [row] = await getDb().update(interactions).set(input).where(eq(interactions.id, id)).returning();
  await recomputeLastInteractionAt(personId);
  return row;
}

export async function deleteInteraction(id: string, personId: string): Promise<void> {
  await getDb().delete(interactions).where(eq(interactions.id, id));
  await recomputeLastInteractionAt(personId);
}

export interface DueContact {
  person: PersonWithWarmth;
  nextReconnectAt: Date;
  daysOverdue: number;
}

export async function listDueForReconnect(): Promise<DueContact[]> {
  const [all, settings] = await Promise.all([listPeople(), getSettings()]);
  const intervals = reconnectIntervalsFrom(settings);
  const now = new Date();

  return all
    .map((person) => {
      const nextReconnectAt = computeNextReconnectAt(person.lastInteractionAt, person.createdAt, person.relationshipTier, intervals);
      return { person, nextReconnectAt, daysOverdue: computeDaysOverdue(nextReconnectAt, now) };
    })
    .filter((entry) => entry.daysOverdue >= 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export interface TopContact {
  person: PersonWithWarmth;
  interactionCount: number;
}

// "Who am I actually in touch with" — ranked by interaction count over the
// same trailing window warmth uses, so the card and the warmth meters on it
// are telling the same story. Lead-only people are excluded for consistency
// with listPeople and the reconnect reminders.
export async function listTopContacts(
  limit = 5,
  windowDays: number = FREQUENCY_WINDOW_DAYS,
): Promise<TopContact[]> {
  const since = new Date(Date.now() - windowDays * 86_400_000);

  const rows = await getDb()
    .select({ person: people, interactionCount: count(interactions.id) })
    .from(interactions)
    .innerJoin(people, eq(interactions.personId, people.id))
    .where(and(gte(interactions.occurredAt, since), eq(people.isPersonalContact, true)))
    .groupBy(people.id)
    // Recency breaks ties so the order is stable between requests rather
    // than left to whatever the planner returns.
    .orderBy(desc(count(interactions.id)), desc(people.lastInteractionAt))
    .limit(limit);

  const withWarmth = await attachWarmth(rows.map((r) => r.person));
  const warmthById = new Map(withWarmth.map((p) => [p.id, p]));

  return rows.map((r) => ({ person: warmthById.get(r.person.id)!, interactionCount: Number(r.interactionCount) }));
}

// ─── Milestones ─────────────────────────────────────────────────────────

export async function listMilestones(personId: string): Promise<Milestone[]> {
  return getDb().select().from(milestones).where(eq(milestones.personId, personId)).orderBy(asc(milestones.occursOn));
}

export async function createMilestone(input: InsertMilestone): Promise<Milestone> {
  const [row] = await getDb().insert(milestones).values(input).returning();
  return row;
}

// personId is part of the predicate, not just the route — a milestone id from
// one person can never be used to edit another's.
export async function updateMilestone(id: string, personId: string, input: UpdateMilestone): Promise<Milestone | undefined> {
  const [row] = await getDb()
    .update(milestones)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(milestones.id, id), eq(milestones.personId, personId)))
    .returning();
  return row;
}

export async function deleteMilestone(id: string, personId: string): Promise<void> {
  await getDb().delete(milestones).where(and(eq(milestones.id, id), eq(milestones.personId, personId)));
}

// Everything the dashboard needs to work out what's coming up. Returns all
// milestones rather than pre-filtering to a lookahead window: whether a date
// is "within 30 days" depends on the viewer's local today, so the cut is made
// client-side (see shared/milestones.ts).
export async function listMilestoneRecords(): Promise<MilestoneRecord[]> {
  const rows = await getDb()
    .select({
      id: milestones.id,
      personId: milestones.personId,
      personName: people.name,
      personPhotoUrl: people.photoUrl,
      label: milestones.label,
      occursOn: milestones.occursOn,
      recursAnnually: milestones.recursAnnually,
    })
    .from(milestones)
    .innerJoin(people, eq(milestones.personId, people.id))
    .where(eq(people.isPersonalContact, true));

  const records: MilestoneRecord[] = rows.map((r) => ({ ...r, kind: "milestone" as const }));

  // Birthdays already live on the person as "MM-DD"; surfacing them here
  // means the dashboard shows one merged "what's coming up" list instead of
  // making birthdays a second thing to remember to check.
  const birthdayRows = await getDb()
    .select({ id: people.id, name: people.name, photoUrl: people.photoUrl, birthday: people.birthday })
    .from(people)
    .where(and(eq(people.isPersonalContact, true), isNotNull(people.birthday)));

  for (const row of birthdayRows) {
    const occursOn = birthdayToOccursOn(row.birthday);
    if (!occursOn) continue; // free-text field — skip anything that isn't MM-DD
    records.push({
      id: `birthday:${row.id}`,
      personId: row.id,
      personName: row.name,
      personPhotoUrl: row.photoUrl,
      label: "Birthday",
      occursOn,
      recursAnnually: true,
      kind: "birthday",
    });
  }

  return records;
}

export async function createSuggestion(input: {
  personId: string;
  openingLine: string;
  talkingPoints: { point: string; basedOn?: string }[];
  model: string;
}): Promise<ReconnectSuggestion> {
  const [row] = await getDb().insert(reconnectSuggestions).values(input).returning();
  return row;
}

export async function getLatestSuggestion(personId: string): Promise<ReconnectSuggestion | undefined> {
  const [row] = await getDb()
    .select()
    .from(reconnectSuggestions)
    .where(eq(reconnectSuggestions.personId, personId))
    .orderBy(desc(reconnectSuggestions.createdAt))
    .limit(1);
  return row;
}

// ─── Person links ───────────────────────────────────────────────────────

export interface LinkedPerson {
  id: string; // the link row's id, not the person's
  type: LinkType; // already flipped to read from this person's side
  note: string | null;
  person: Pick<Person, "id" | "name" | "photoUrl" | "relationshipTier">;
}

// Both directions in one pass: a link is stored once, so this person can be
// either end of it. Whichever end they are, the other person is returned and
// the type is oriented to read from this person's side.
export async function listLinksForPerson(personId: string): Promise<LinkedPerson[]> {
  const rows = await getDb()
    .select()
    .from(personLinks)
    .where(or(eq(personLinks.personId, personId), eq(personLinks.relatedPersonId, personId)));

  if (rows.length === 0) return [];

  const otherIds = rows.map((r) => (r.personId === personId ? r.relatedPersonId : r.personId));
  const others = await getDb()
    .select({ id: people.id, name: people.name, photoUrl: people.photoUrl, relationshipTier: people.relationshipTier })
    .from(people)
    .where(inArray(people.id, otherIds));
  const byId = new Map(others.map((p) => [p.id, p]));

  return rows
    .map((row) => {
      const other = byId.get(row.personId === personId ? row.relatedPersonId : row.personId);
      // The FK cascades, so a missing row here shouldn't happen — but a
      // dangling link is not worth a 500.
      if (!other) return null;
      return { id: row.id, type: linkTypeFor(personId, row), note: row.note, person: other };
    })
    .filter((l): l is LinkedPerson => l !== null)
    .sort((a, b) => a.person.name.localeCompare(b.person.name));
}

export type CreateLinkResult =
  | { ok: true; link: PersonLink }
  | { ok: false; reason: "self" | "duplicate" | "missing" };

export async function createPersonLink(input: InsertPersonLink): Promise<CreateLinkResult> {
  if (input.personId === input.relatedPersonId) return { ok: false, reason: "self" };

  const both = await getDb()
    .select({ id: people.id })
    .from(people)
    .where(inArray(people.id, [input.personId, input.relatedPersonId]));
  if (both.length < 2) return { ok: false, reason: "missing" };

  // The unique index only covers (personId, relatedPersonId); a link stored
  // the other way round is the same relationship, so it's checked here.
  const [existing] = await getDb()
    .select({ id: personLinks.id })
    .from(personLinks)
    .where(
      or(
        and(eq(personLinks.personId, input.personId), eq(personLinks.relatedPersonId, input.relatedPersonId)),
        and(eq(personLinks.personId, input.relatedPersonId), eq(personLinks.relatedPersonId, input.personId)),
      ),
    );
  if (existing) return { ok: false, reason: "duplicate" };

  const [link] = await getDb().insert(personLinks).values(input).returning();
  return { ok: true, link };
}

// personId scopes the delete so a link id from one profile can't be used to
// unlink a pair the caller isn't part of.
export async function deletePersonLink(id: string, personId: string): Promise<void> {
  await getDb()
    .delete(personLinks)
    .where(
      and(
        eq(personLinks.id, id),
        or(eq(personLinks.personId, personId), eq(personLinks.relatedPersonId, personId)),
      ),
    );
}

// ─── Lead pipeline ──────────────────────────────────────────────────────

export type LeadWithPerson = Lead & { person: PersonWithWarmth };

export async function listLeads(): Promise<LeadWithPerson[]> {
  const rows = await getDb()
    .select({ lead: leads, person: people })
    .from(leads)
    .innerJoin(people, eq(leads.personId, people.id))
    .orderBy(desc(leads.updatedAt));

  const peopleWithWarmth = await attachWarmth(rows.map((r) => r.person));
  const warmthByPersonId = new Map(peopleWithWarmth.map((p) => [p.id, p]));

  return rows.map((r) => ({ ...r.lead, person: warmthByPersonId.get(r.person.id)! }));
}

export async function getLeadByPersonId(personId: string): Promise<Lead | undefined> {
  const [row] = await getDb().select().from(leads).where(eq(leads.personId, personId));
  return row;
}

export async function getLeadWithPersonByPersonId(personId: string): Promise<LeadWithPerson | undefined> {
  const [row] = await getDb()
    .select({ lead: leads, person: people })
    .from(leads)
    .innerJoin(people, eq(leads.personId, people.id))
    .where(eq(leads.personId, personId));
  if (!row) return undefined;

  const [personWithWarmth] = await attachWarmth([row.person]);
  return { ...row.lead, person: personWithWarmth };
}

export async function createLead(input: InsertLead): Promise<Lead> {
  const [row] = await getDb().insert(leads).values(input).returning();
  return row;
}

// Net-new lead: creates the person (flagged out of the personal People tab)
// and the lead row in one transaction so a failure never leaves an orphaned
// person with no lead, or vice versa.
export async function createLeadWithPerson(
  personInput: InsertPerson,
  leadInput: Omit<InsertLead, "personId">,
): Promise<{ person: Person; lead: Lead }> {
  return getDb().transaction(async (tx) => {
    const [person] = await tx
      .insert(people)
      .values({ ...personInput, isPersonalContact: false })
      .returning();
    const [lead] = await tx
      .insert(leads)
      .values({ ...leadInput, personId: person.id })
      .returning();
    return { person, lead };
  });
}

export async function updateLead(id: string, input: UpdateLead): Promise<Lead | undefined> {
  const [current] = await getDb().select().from(leads).where(eq(leads.id, id));
  if (!current) return undefined;

  const stageChanged = input.stage !== undefined && input.stage !== current.stage;

  const [row] = await getDb()
    .update(leads)
    .set({
      ...input,
      ...(stageChanged ? { stageEnteredAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id))
    .returning();
  return row;
}

// Removes someone from the pipeline. By default the person survives as a
// personal contact (isPersonalContact flips to true) so a lead-only person
// can never be silently orphaned out of both tabs; pass deletePerson to
// remove them entirely instead.
export async function deleteLead(id: string, options: { deletePerson?: boolean } = {}): Promise<void> {
  const [lead] = await getDb().select().from(leads).where(eq(leads.id, id));
  if (!lead) return;

  await getDb().delete(leads).where(eq(leads.id, id));

  if (options.deletePerson) {
    await getDb().delete(people).where(eq(people.id, lead.personId));
  } else {
    await getDb()
      .update(people)
      .set({ isPersonalContact: true, updatedAt: new Date() })
      .where(eq(people.id, lead.personId));
  }
}

export interface OutreachTouch {
  id: string;
  occurredAt: Date;
  personId: string;
  personName: string;
}

export async function listOutreachTouches(weeks: number): Promise<OutreachTouch[]> {
  const since = new Date(Date.now() - weeks * 7 * 86_400_000);
  return getDb()
    .select({
      id: interactions.id,
      occurredAt: interactions.occurredAt,
      personId: interactions.personId,
      personName: people.name,
    })
    .from(interactions)
    .innerJoin(people, eq(interactions.personId, people.id))
    .where(and(eq(interactions.kind, "outreach"), gte(interactions.occurredAt, since)))
    .orderBy(desc(interactions.occurredAt));
}

// ─── Settings ───────────────────────────────────────────────────────────

const SETTINGS_ID = "singleton";

export async function getSettings(): Promise<AppSettings> {
  const [existing] = await getDb().select().from(appSettings).where(eq(appSettings.id, SETTINGS_ID));
  if (existing) return existing;

  const [created] = await getDb().insert(appSettings).values({ id: SETTINGS_ID }).onConflictDoNothing().returning();
  if (created) return created;

  // Lost a race with a concurrent request that created the row first.
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.id, SETTINGS_ID));
  return row;
}

export async function updateSettings(input: UpdateSettings): Promise<AppSettings> {
  const current = await getSettings(); // ensure the singleton row exists before updating it
  if (Object.keys(input).length === 0) return current;

  const [row] = await getDb()
    .update(appSettings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(appSettings.id, SETTINGS_ID))
    .returning();
  return row;
}

// ─── Pipeline stage configs ─────────────────────────────────────────────

export async function listStageConfigs(): Promise<StageConfig[]> {
  const rows = await getDb().select().from(leadStageConfigs).orderBy(asc(leadStageConfigs.sortOrder));
  if (rows.length > 0) return rows;

  // Lazily seed on first read — a fresh DB, or one where every stage has
  // been deleted. onConflictDoNothing guards a race with a concurrent
  // request also seeding.
  const seeded = await getDb()
    .insert(leadStageConfigs)
    .values(
      DEFAULT_STAGE_SEEDS.map((s, i) => ({
        key: s.key,
        label: s.label,
        hint: s.hint,
        sortOrder: i,
        touchIntervalDays: s.touchIntervalDays,
        isActive: s.isActive,
      })),
    )
    .onConflictDoNothing()
    .returning();
  if (seeded.length > 0) return seeded.sort((a, b) => a.sortOrder - b.sortOrder);

  return getDb().select().from(leadStageConfigs).orderBy(asc(leadStageConfigs.sortOrder));
}

export async function createStageConfig(input: InsertStageConfig): Promise<StageConfig> {
  const [{ maxOrder }] = await getDb().select({ maxOrder: max(leadStageConfigs.sortOrder) }).from(leadStageConfigs);
  const [row] = await getDb()
    .insert(leadStageConfigs)
    .values({ ...input, sortOrder: (maxOrder ?? -1) + 1 })
    .returning();
  return row;
}

export async function updateStageConfig(key: string, input: UpdateStageConfig): Promise<StageConfig | undefined> {
  const [row] = await getDb()
    .update(leadStageConfigs)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(leadStageConfigs.key, key))
    .returning();
  return row;
}

// Persists a new top-to-bottom order in one transaction.
export async function reorderStageConfigs(orderedKeys: string[]): Promise<void> {
  await getDb().transaction(async (tx) => {
    for (let i = 0; i < orderedKeys.length; i++) {
      await tx.update(leadStageConfigs).set({ sortOrder: i, updatedAt: new Date() }).where(eq(leadStageConfigs.key, orderedKeys[i]));
    }
  });
}

export type DeleteStageResult = { blocked: false } | { blocked: true; leadNames: string[] };

// Refuses to delete a stage that any lead currently references — the
// caller (routes.ts) surfaces the blocking leads so the user can move them
// first, per the "prompt me to reassign" choice over silent auto-migration.
export async function deleteStageConfig(key: string): Promise<DeleteStageResult> {
  const blocking = await getDb()
    .select({ personName: people.name })
    .from(leads)
    .innerJoin(people, eq(leads.personId, people.id))
    .where(eq(leads.stage, key));

  if (blocking.length > 0) {
    return { blocked: true, leadNames: blocking.map((l) => l.personName) };
  }

  await getDb().delete(leadStageConfigs).where(eq(leadStageConfigs.key, key));
  return { blocked: false };
}
