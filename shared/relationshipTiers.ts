export const RELATIONSHIP_TIERS = ["close", "friend", "acquaintance"] as const;
export type RelationshipTier = (typeof RELATIONSHIP_TIERS)[number];

export const RELATIONSHIP_TIER_LABELS: Record<RelationshipTier, string> = {
  close: "Close",
  friend: "Friend",
  acquaintance: "Acquaintance",
};

export type ReconnectIntervals = Record<RelationshipTier, number>;

// Seeds the app_settings columns and stands in until settings load. Editable
// afterward under Settings → Reconnect cadence — a starting point, not a
// hardcoded constraint (same arrangement as DEFAULT_STAGE_SEEDS).
export const DEFAULT_RECONNECT_INTERVAL_DAYS: ReconnectIntervals = {
  close: 30,
  friend: 90,
  acquaintance: 180,
};

// Which app_settings column backs each tier. Declared here so the Settings
// UI can iterate tiers instead of hardcoding three fields, and kept as bare
// string literals rather than `keyof AppSettings` — schema.ts imports this
// module, so pointing back at it would be circular.
export const RECONNECT_SETTING_KEYS = {
  close: "reconnectDaysClose",
  friend: "reconnectDaysFriend",
  acquaintance: "reconnectDaysAcquaintance",
} as const satisfies Record<RelationshipTier, string>;

export type ReconnectSettingKey = (typeof RECONNECT_SETTING_KEYS)[RelationshipTier];

// Structurally typed rather than taking AppSettings, for the same
// no-circular-import reason.
export function reconnectIntervalsFrom(
  settings: Record<ReconnectSettingKey, number> | undefined | null,
): ReconnectIntervals {
  if (!settings) return DEFAULT_RECONNECT_INTERVAL_DAYS;
  return {
    close: settings.reconnectDaysClose,
    friend: settings.reconnectDaysFriend,
    acquaintance: settings.reconnectDaysAcquaintance,
  };
}

const DAY_MS = 86_400_000;

export function computeNextReconnectAt(
  lastInteractionAt: Date | null,
  createdAt: Date,
  tier: RelationshipTier,
  intervals: ReconnectIntervals = DEFAULT_RECONNECT_INTERVAL_DAYS,
): Date {
  // Someone never contacted still has a clock — it runs from when you added
  // them, so they can't sit invisible forever.
  const base = lastInteractionAt ?? createdAt;
  return new Date(base.getTime() + intervals[tier] * DAY_MS);
}

export function computeDaysOverdue(nextReconnectAt: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - nextReconnectAt.getTime()) / DAY_MS);
}
