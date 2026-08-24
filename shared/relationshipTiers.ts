export const RELATIONSHIP_TIERS = ["close", "friend", "acquaintance"] as const;
export type RelationshipTier = (typeof RELATIONSHIP_TIERS)[number];

export const RELATIONSHIP_TIER_LABELS: Record<RelationshipTier, string> = {
  close: "Close",
  friend: "Friend",
  acquaintance: "Acquaintance",
};

export const RECONNECT_INTERVAL_DAYS: Record<RelationshipTier, number> = {
  close: 30,
  friend: 90,
  acquaintance: 180,
};

const DAY_MS = 86_400_000;

export function computeNextReconnectAt(
  lastInteractionAt: Date | null,
  createdAt: Date,
  tier: RelationshipTier,
): Date {
  const base = lastInteractionAt ?? createdAt;
  return new Date(base.getTime() + RECONNECT_INTERVAL_DAYS[tier] * DAY_MS);
}

export function computeDaysOverdue(nextReconnectAt: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - nextReconnectAt.getTime()) / DAY_MS);
}
