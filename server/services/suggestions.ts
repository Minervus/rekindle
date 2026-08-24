import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// zodOutputFormat() expects a zod/v4 schema specifically — import from the
// v4 subpath here even though the rest of the app uses the v3 classic API
// (drizzle-zod, route validation).
import { z } from "zod/v4";
import type { Person, Interaction } from "@shared/schema";
import { RELATIONSHIP_TIER_LABELS } from "@shared/relationshipTiers";

const DEFAULT_MODEL = "claude-haiku-4-5";

let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set. Add it to your environment to use AI reconnect suggestions.");
    }
    client = new Anthropic();
  }
  return client;
}

function getModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

const SuggestionSchema = z.object({
  openingLine: z.string().describe("A natural, specific opener referencing a past conversation"),
  talkingPoints: z
    .array(
      z.object({
        point: z.string(),
        basedOn: z.string().optional().describe("Which past interaction note this draws from"),
      }),
    )
    .min(2)
    .max(5),
});
export type ReconnectSuggestionOutput = z.infer<typeof SuggestionSchema>;

const SYSTEM_PROMPT = `You help the user reconnect thoughtfully with people in their personal network. You are given a contact's profile, the user's standing notes about them, and a dated log of past interaction notes. Draft an opening line and concrete talking points that reference specific things from the profile notes and the interaction log — not generic advice. If the notes are sparse, say something honest and low-pressure rather than inventing details.`;

function formatHistory(person: Person, personInteractions: Interaction[]): string {
  const header = [
    `Name: ${person.name}`,
    person.howMet ? `How we met: ${person.howMet}` : null,
    person.company || person.role ? `Work: ${[person.role, person.company].filter(Boolean).join(" at ")}` : null,
    person.location ? `Location: ${person.location}` : null,
    person.tags.length ? `Tags: ${person.tags.join(", ")}` : null,
    `Relationship tier: ${RELATIONSHIP_TIER_LABELS[person.relationshipTier]}`,
  ]
    .filter(Boolean)
    .join("\n");

  const log =
    [...personInteractions]
      .reverse()
      .map((i) => `- ${i.occurredAt.toISOString().slice(0, 10)}: ${i.notes}`)
      .join("\n") || "(no interactions logged yet)";

  // Standing notes are undated background the user has accumulated — worth
  // its own section so the model doesn't read it as a recent event.
  const standingNotes = person.notes?.trim() ? `\n\nWhat the user knows about them:\n${person.notes.trim()}` : "";

  return `${header}${standingNotes}\n\nInteraction history (oldest to newest):\n${log}`;
}

export async function generateReconnectSuggestion(
  person: Person,
  personInteractions: Interaction[],
): Promise<{ suggestion: ReconnectSuggestionOutput; model: string }> {
  const model = getModel();
  const response = await getClient().messages.parse({
    model,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    output_config: { format: zodOutputFormat(SuggestionSchema) },
    messages: [{ role: "user", content: formatHistory(person, personInteractions) }],
  });

  if (!response.parsed_output) {
    throw new Error(`Anthropic response did not match the expected schema (stop_reason: ${response.stop_reason}).`);
  }

  return { suggestion: response.parsed_output, model };
}
