import { eq, desc, max, count, gte } from "drizzle-orm";
import { getDb } from "./db";
import {
  people,
  interactions,
  reconnectSuggestions,
  type Person,
  type InsertPerson,
  type UpdatePerson,
  type Interaction,
  type InsertInteraction,
  type UpdateInteraction,
  type ReconnectSuggestion,
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
  const rows = await getDb().select().from(people).orderBy(desc(people.createdAt));
  return attachWarmth(rows);
}

export async function getPerson(id: string): Promise<PersonWithWarmth | undefined> {
  const [row] = await getDb().select().from(people).where(eq(people.id, id));
  if (!row) return undefined;
  const [withWarmth] = await attachWarmth([row]);
  return withWarmth;
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
