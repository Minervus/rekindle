import { RELATIONSHIP_TIER_LABELS, type RelationshipTier } from "./relationshipTiers";

// A single searchable value off a profile, carrying the human-facing label
// so the UI can show *why* a result matched ("Tag · sydney-gym") rather than
// just asserting that it did.
export interface SearchField {
  label: string;
  value: string;
}

// Structural rather than `Person`/`Lead` from schema.ts on purpose: those
// types have Date fields that arrive over the wire as strings, and search
// only ever touches the string columns. Keeping it structural means both the
// server rows and the JSON the client holds satisfy it.
export interface SearchablePerson {
  name: string;
  company?: string | null;
  role?: string | null;
  location?: string | null;
  howMet?: string | null;
  notes?: string | null;
  birthday?: string | null;
  tags?: string[] | null;
  relationshipTier?: RelationshipTier | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
}

export interface SearchableLead {
  source?: string | null;
  fitnessGoal?: string | null;
  nextAction?: string | null;
  notes?: string | null;
  /** Resolved label, not the raw key — stage keys are user-defined and opaque. */
  stageLabel?: string | null;
}

function push(fields: SearchField[], label: string, value: string | null | undefined): void {
  const trimmed = value?.trim();
  if (trimmed) fields.push({ label, value: trimmed });
}

/**
 * Every piece of text on a profile that search should look at, in the order
 * matches are worth showing. Pass `lead` for people in the pipeline so their
 * pipeline fields are searchable too.
 */
export function personSearchFields(person: SearchablePerson, lead?: SearchableLead | null): SearchField[] {
  const fields: SearchField[] = [];

  push(fields, "Name", person.name);
  push(fields, "Company", person.company);
  push(fields, "Role", person.role);
  push(fields, "Location", person.location);
  push(fields, "How we met", person.howMet);
  push(fields, "Notes", person.notes);
  for (const tag of person.tags ?? []) push(fields, "Tag", tag);
  push(fields, "Birthday", person.birthday);
  if (person.relationshipTier) push(fields, "Tier", RELATIONSHIP_TIER_LABELS[person.relationshipTier]);
  push(fields, "Facebook", person.facebookUrl);
  push(fields, "Instagram", person.instagramUrl);
  push(fields, "LinkedIn", person.linkedinUrl);

  if (lead) {
    push(fields, "Stage", lead.stageLabel);
    push(fields, "Source", lead.source);
    push(fields, "Goal", lead.fitnessGoal);
    push(fields, "Next action", lead.nextAction);
    // Labelled distinctly from the person's own notes so a match reason
    // says which of the two it came from.
    push(fields, "Lead notes", lead.notes);
  }

  return fields;
}

export function searchTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Terms are ANDed, fields are ORed: "sydney coach" matches someone located
 * in Sydney whose role is Coach, even though no single field holds both.
 *
 * Returns the fields that matched (deduped, in `fields` order), or null if
 * the profile doesn't match. An empty query matches everything and returns
 * an empty match list — callers show their unfiltered list in that case.
 */
export function matchSearchFields(fields: SearchField[], terms: string[]): SearchField[] | null {
  if (terms.length === 0) return [];

  const matchedIndexes = new Set<number>();

  for (const term of terms) {
    let hit = false;
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].value.toLowerCase().includes(term)) {
        matchedIndexes.add(i);
        hit = true;
      }
    }
    if (!hit) return null;
  }

  return Array.from(matchedIndexes)
    .sort((a, b) => a - b)
    .map((i) => fields[i]);
}

/** Convenience wrapper for callers that don't need the field list twice. */
export function matchesPerson(person: SearchablePerson, lead: SearchableLead | null | undefined, query: string): boolean {
  return matchSearchFields(personSearchFields(person, lead), searchTerms(query)) !== null;
}
