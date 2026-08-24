import { eq, desc, max } from "drizzle-orm";
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

export async function listPeople(): Promise<Person[]> {
  return getDb().select().from(people).orderBy(desc(people.createdAt));
}

export async function getPerson(id: string): Promise<Person | undefined> {
  const [row] = await getDb().select().from(people).where(eq(people.id, id));
  return row;
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
  person: Person;
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
