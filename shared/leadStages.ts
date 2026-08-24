export const LEAD_STAGES = ["new", "nurturing", "interested", "consult", "offer", "client", "not_now"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  nurturing: "Nurturing",
  interested: "Interested",
  consult: "Consult",
  offer: "Offer sent",
  client: "Client",
  not_now: "Not now",
};

export const LEAD_STAGE_HINTS: Record<LeadStage, string> = {
  new: "Identified, not spoken to about coaching yet",
  nurturing: "In conversation, building rapport — no pitch yet",
  interested: "They've signalled interest in coaching",
  consult: "Discovery call booked or held",
  offer: "Package and price shared, awaiting a decision",
  client: "Signed up",
  not_now: "Soft no or went quiet — revisit later",
};

// Stages that still represent an active, in-progress sale — used to filter
// the weekly accountability "untouched leads" list and the Dashboard strip.
export const ACTIVE_LEAD_STAGES = ["new", "nurturing", "interested", "consult", "offer"] as const;

// Days of silence before a lead in this stage is flagged as needing a touch.
// null = never flagged (a client doesn't need chasing).
export const LEAD_TOUCH_INTERVAL_DAYS: Record<LeadStage, number | null> = {
  new: 3,
  nurturing: 7,
  interested: 3,
  consult: 2,
  offer: 3,
  client: null,
  not_now: 60,
};

export interface LeadStaleness {
  daysSinceTouch: number | null;
  daysOverdue: number | null;
  isOverdue: boolean;
}

export function computeLeadStaleness(
  lastOutreachAt: Date | null,
  stageEnteredAt: Date,
  stage: LeadStage,
  now: Date = new Date(),
): LeadStaleness {
  const interval = LEAD_TOUCH_INTERVAL_DAYS[stage];
  const base = lastOutreachAt ?? stageEnteredAt;
  const daysSinceTouch = Math.floor((now.getTime() - base.getTime()) / 86_400_000);

  if (interval === null) {
    return { daysSinceTouch, daysOverdue: null, isOverdue: false };
  }

  const daysOverdue = daysSinceTouch - interval;
  return { daysSinceTouch, daysOverdue, isOverdue: daysOverdue >= 0 };
}
