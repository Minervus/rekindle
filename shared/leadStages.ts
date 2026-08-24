// Stage keys are now user-defined (see the leadStageConfigs table) rather
// than a fixed enum — this alias just documents intent at call sites.
export type LeadStage = string;

export interface StageSeed {
  key: string;
  label: string;
  hint: string;
  isActive: boolean;
  // Days of silence before a lead in this stage is flagged as needing a
  // touch. null = never flagged (e.g. a client doesn't need chasing).
  touchIntervalDays: number | null;
}

// Seeded into leadStageConfigs the first time it's read empty (fresh DB, or
// after a user deletes every stage). Editable afterward via /api/stages —
// this is a starting point, not a hardcoded constraint.
export const DEFAULT_STAGE_SEEDS: StageSeed[] = [
  { key: "new", label: "New", hint: "Identified, not spoken to about coaching yet", isActive: true, touchIntervalDays: 3 },
  {
    key: "nurturing",
    label: "Nurturing",
    hint: "In conversation, building rapport — no pitch yet",
    isActive: true,
    touchIntervalDays: 7,
  },
  { key: "interested", label: "Interested", hint: "They've signalled interest in coaching", isActive: true, touchIntervalDays: 3 },
  { key: "consult", label: "Consult", hint: "Discovery call booked or held", isActive: true, touchIntervalDays: 2 },
  { key: "offer", label: "Offer sent", hint: "Package and price shared, awaiting a decision", isActive: true, touchIntervalDays: 3 },
  { key: "client", label: "Client", hint: "Signed up", isActive: false, touchIntervalDays: null },
  { key: "not_now", label: "Not now", hint: "Soft no or went quiet — revisit later", isActive: false, touchIntervalDays: 60 },
];

export interface LeadStaleness {
  daysSinceTouch: number | null;
  daysOverdue: number | null;
  isOverdue: boolean;
}

export function computeLeadStaleness(
  lastOutreachAt: Date | null,
  stageEnteredAt: Date,
  touchIntervalDays: number | null,
  now: Date = new Date(),
): LeadStaleness {
  const base = lastOutreachAt ?? stageEnteredAt;
  const daysSinceTouch = Math.floor((now.getTime() - base.getTime()) / 86_400_000);

  if (touchIntervalDays === null) {
    return { daysSinceTouch, daysOverdue: null, isOverdue: false };
  }

  const daysOverdue = daysSinceTouch - touchIntervalDays;
  return { daysSinceTouch, daysOverdue, isOverdue: daysOverdue >= 0 };
}
