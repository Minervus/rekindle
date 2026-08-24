import { useQuery } from "@tanstack/react-query";
import { startOfWeek } from "date-fns";
import { getToken } from "@/lib/auth";
import { bucketByWeek, computeStreak, daysLeftInWeek, type TouchPoint } from "@shared/weeklyAccountability";
import { ACTIVE_LEAD_STAGES } from "@shared/leadStages";
import type { AppSettings } from "@shared/schema";
import type { LeadWithPerson } from "@/components/LeadCard";

const WEEKS_TRACKED = 8;
export const TOUCHES_QUERY_KEY = ["/api/leads", "touches"];

export function useWeeklyAccountability() {
  const { data: settings } = useQuery<AppSettings>({ queryKey: ["/api/settings"] });
  const { data: leads } = useQuery<LeadWithPerson[]>({ queryKey: ["/api/leads"] });
  const { data: touches } = useQuery<TouchPoint[]>({
    queryKey: TOUCHES_QUERY_KEY,
    queryFn: async () => {
      const token = getToken();
      const res = await fetch(`/api/leads/touches?weeks=${WEEKS_TRACKED}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  if (!settings || !leads || !touches) {
    return { isReady: false as const };
  }

  const goal = settings.weeklyOutreachGoal;
  const buckets = bucketByWeek(touches, goal, WEEKS_TRACKED);
  const currentWeek = buckets[buckets.length - 1];
  const streak = computeStreak(buckets);
  const daysLeft = daysLeftInWeek();

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const touchedThisWeek = new Set(touches.filter((t) => new Date(t.occurredAt) >= currentWeekStart).map((t) => t.personId));
  const untouched = leads.filter(
    (l) => (ACTIVE_LEAD_STAGES as readonly string[]).includes(l.stage) && !touchedThisWeek.has(l.personId),
  );

  return {
    isReady: true as const,
    settings,
    leads,
    touches,
    goal,
    buckets,
    currentWeek,
    streak,
    daysLeft,
    untouched,
  };
}
