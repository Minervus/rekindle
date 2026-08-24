import { startOfWeek, addWeeks } from "date-fns";

const WEEK_STARTS_ON = 1; // Monday

export interface TouchPoint {
  id: string;
  occurredAt: string; // ISO
  personId: string;
  personName: string;
}

export interface WeekBucket {
  weekStart: Date;
  touches: number;
  leadsTouched: number;
  goalMet: boolean;
}

// Buckets touches into `weeks` trailing weeks (oldest first, current
// in-progress week last). Deliberately run client-side in the browser's
// local timezone — touches are stored as local-noon timestamps, and
// bucketing in server UTC would misfile early-morning/late-night touches
// into the wrong week for users outside UTC.
export function bucketByWeek(touches: TouchPoint[], goal: number, weeks: number, now: Date = new Date()): WeekBucket[] {
  const currentWeekStart = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  const buckets: WeekBucket[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addWeeks(currentWeekStart, -i);
    const weekEnd = addWeeks(weekStart, 1);
    const inWeek = touches.filter((t) => {
      const occurred = new Date(t.occurredAt);
      return occurred >= weekStart && occurred < weekEnd;
    });

    buckets.push({
      weekStart,
      touches: inWeek.length,
      leadsTouched: new Set(inWeek.map((t) => t.personId)).size,
      goalMet: inWeek.length >= goal,
    });
  }

  return buckets;
}

// Consecutive completed weeks meeting goal, walking backward from the most
// recent completed week. The current (in-progress) week never breaks a
// streak — it's only added on top once it independently meets goal.
export function computeStreak(buckets: WeekBucket[]): { weeks: number; includesCurrent: boolean } {
  if (buckets.length === 0) return { weeks: 0, includesCurrent: false };

  const current = buckets[buckets.length - 1];
  const completed = buckets.slice(0, -1);

  let weeks = 0;
  for (let i = completed.length - 1; i >= 0; i--) {
    if (!completed[i].goalMet) break;
    weeks++;
  }

  const includesCurrent = current.goalMet;
  return { weeks: weeks + (includesCurrent ? 1 : 0), includesCurrent };
}

export function daysLeftInWeek(now: Date = new Date()): number {
  const weekStart = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  const daysSinceStart = Math.floor((now.getTime() - weekStart.getTime()) / 86_400_000);
  return 7 - daysSinceStart;
}
