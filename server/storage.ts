import { eq, desc, max, count, gte, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  people,
  interactions,
  reconnectSuggestions,
  leads,
  appSettings,
  type Person,
  type InsertPerson,
  type UpdatePerson,
  type Interaction,
  type InsertInteraction,
  type UpdateInteraction,
  type ReconnectSuggestion,
  type Lead,
  type InsertLead,
  type UpdateLead,
  type AppSettings,
} from "@shared/schema";
import { computeNextReconnectAt, computeDaysOverdue } from "@shared/relationshipTiers";
import { computeWarmth, FREQUENCY_WINDOW_DAYS, type Warmth } from "@shared/warmth";

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
  const all = await listPeople();
  const now = new Date();

  return all
    .map((person) => {
      const nextReconnectAt = computeNextReconnectAt(person.lastInteractionAt, person.createdAt, person.relationshipTier);
      return { person, nextReconnectAt, daysOverdue: computeDaysOverdue(nextReconnectAt, now) };
    })
    .filter((entry) => entry.daysOverdue >= 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
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

export async function updateSettings(input: { weeklyOutreachGoal: number }): Promise<AppSettings> {
  await getSettings(); // ensure the singleton row exists before updating it
  const [row] = await getDb()
    .update(appSettings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(appSettings.id, SETTINGS_ID))
    .returning();
  return row;
}
