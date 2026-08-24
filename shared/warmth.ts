export const WARMTH_LEVELS = ["cold", "cool", "warm", "hot"] as const;
export type WarmthLevel = (typeof WARMTH_LEVELS)[number];

export const WARMTH_LABELS: Record<WarmthLevel, string> = {
  cold: "Cold",
  cool: "Cool",
  warm: "Warm",
  hot: "Hot",
};

export interface Warmth {
  score: number; // 0-100
  level: WarmthLevel;
}

// Recency fades to 0 after this many days of silence.
const RECENCY_DECAY_DAYS = 60;
// Frequency is interaction count within this trailing window, saturating at
// FREQUENCY_SATURATION_COUNT (more interactions than that don't add warmth).
export const FREQUENCY_WINDOW_DAYS = 90;
const FREQUENCY_SATURATION_COUNT = 6;

export function computeWarmth(daysSinceLastInteraction: number | null, interactionsInWindow: number): Warmth {
  const recencyScore = daysSinceLastInteraction === null ? 0 : Math.max(0, 1 - daysSinceLastInteraction / RECENCY_DECAY_DAYS);
  const frequencyScore = Math.min(1, interactionsInWindow / FREQUENCY_SATURATION_COUNT);
  const score = Math.round((recencyScore * 0.6 + frequencyScore * 0.4) * 100);
  const level: WarmthLevel = score >= 75 ? "hot" : score >= 50 ? "warm" : score >= 25 ? "cool" : "cold";
  return { score, level };
}
