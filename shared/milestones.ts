import { differenceInCalendarDays, getDaysInMonth, parseISO, startOfDay } from "date-fns";

// A milestone as it travels to the client: the row itself plus enough of the
// person to render a link, and a `kind` marking the two sources that feed the
// dashboard — real milestone rows, and birthdays derived from people.birthday.
export interface MilestoneRecord {
  id: string;
  personId: string;
  personName: string;
  personPhotoUrl: string | null;
  label: string;
  occursOn: string; // YYYY-MM-DD
  recursAnnually: boolean;
  kind: "milestone" | "birthday";
}

export interface UpcomingMilestone extends MilestoneRecord {
  nextOccurrence: Date;
  daysUntil: number;
}

// Same calendar day in a different year, clamped to the month's real length
// so a Feb 29 milestone lands on Feb 28 in common years rather than silently
// rolling over into March.
function occurrenceInYear(base: Date, year: number): Date {
  const month = base.getMonth();
  const day = Math.min(base.getDate(), getDaysInMonth(new Date(year, month, 1)));
  return new Date(year, month, day);
}

// The next date this milestone lands on, at or after `today`. One-off
// milestones just return their own date — including past ones, so callers can
// tell "already happened" apart from "coming up".
export function nextOccurrence(occursOn: string, recursAnnually: boolean, today: Date = new Date()): Date {
  const base = startOfDay(parseISO(occursOn));
  if (!recursAnnually) return base;

  const start = startOfDay(today);
  const thisYear = occurrenceInYear(base, start.getFullYear());
  return thisYear >= start ? thisYear : occurrenceInYear(base, start.getFullYear() + 1);
}

export function daysUntilOccurrence(occursOn: string, recursAnnually: boolean, today: Date = new Date()): number {
  return differenceInCalendarDays(nextOccurrence(occursOn, recursAnnually, today), startOfDay(today));
}

// people.birthday is "MM-DD" (no birth year required). Pinned to a leap year
// so Feb 29 survives the round-trip; the year is irrelevant either way since
// birthdays always recur.
export function birthdayToOccursOn(birthday: string | null): string | null {
  if (!birthday) return null;
  const match = birthday.trim().match(/^(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, month, day] = match;
  const monthNum = Number(month);
  const dayNum = Number(day);
  if (monthNum < 1 || monthNum > 12) return null;
  if (dayNum < 1 || dayNum > getDaysInMonth(new Date(2000, monthNum - 1, 1))) return null;

  return `2000-${month}-${day}`;
}

// Deliberately computed client-side, like weeklyAccountability's bucketing:
// "is this within the next 30 days" depends on the viewer's today, and the
// server's UTC date can be a day off from theirs.
export function upcomingMilestones(
  records: MilestoneRecord[],
  lookaheadDays: number,
  today: Date = new Date(),
): UpcomingMilestone[] {
  return records
    .map((record) => {
      const next = nextOccurrence(record.occursOn, record.recursAnnually, today);
      return { ...record, nextOccurrence: next, daysUntil: differenceInCalendarDays(next, startOfDay(today)) };
    })
    .filter((m) => m.daysUntil >= 0 && m.daysUntil <= lookaheadDays)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.personName.localeCompare(b.personName));
}

export function formatDaysUntil(daysUntil: number): string {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil < 7) return `In ${daysUntil} days`;
  if (daysUntil < 14) return "Next week";
  return `In ${Math.round(daysUntil / 7)} weeks`;
}
