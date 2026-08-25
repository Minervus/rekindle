import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PersonAvatar from "@/components/PersonAvatar";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { FREQUENCY_WINDOW_DAYS, WARMTH_LABELS } from "@shared/warmth";
import type { Person } from "@shared/schema";
import type { Warmth } from "@shared/warmth";

const LEADERBOARD_SIZE = 10;
export const TOP_CONTACTS_QUERY_KEY = ["/api/people", "top"];

interface TopContact {
  person: Person & { warmth: Warmth };
  interactionCount: number;
}

// Standings, not a podium — the top three are only weighted enough to find
// the eye. Anything louder reads as a competition between friends.
function rankClass(rank: number): string {
  if (rank === 1) return "text-foreground font-semibold";
  if (rank <= 3) return "text-foreground";
  return "text-muted-foreground";
}

// A running leaderboard of who you're actually in touch with, ranked over
// the same trailing window that feeds the warmth meters so a name near the
// top and a cold meter on their profile can't contradict each other.
export default function TopContactsCard() {
  const { data: top, isLoading } = useQuery<TopContact[]>({
    queryKey: TOP_CONTACTS_QUERY_KEY,
    // Hand-rolled because the shared queryFn joins the key into a path and
    // has nowhere to put a query string — same reason useWeeklyAccountability
    // does this for /api/leads/touches.
    queryFn: async () => {
      const token = getToken();
      const res = await fetch(`/api/people/top?limit=${LEADERBOARD_SIZE}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  // Bars are scaled against the leader rather than the window total, so the
  // shape of the ranking stays readable whether the top score is 3 or 30.
  const leadCount = top?.[0]?.interactionCount ?? 0;

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Top contacts</CardTitle>
        <span className="text-xs text-muted-foreground">last {FREQUENCY_WINDOW_DAYS}d</span>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}

        {!isLoading && top?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing logged in the last {FREQUENCY_WINDOW_DAYS} days — the board fills in as you log interactions.
          </p>
        )}

        <ol className="space-y-0.5">
          {top?.map((entry, i) => {
            const rank = i + 1;
            const share = leadCount > 0 ? (entry.interactionCount / leadCount) * 100 : 0;

            return (
              <li key={entry.person.id}>
                <Link
                  href={`/people/${entry.person.id}`}
                  className="block rounded-md -mx-2 px-2 py-1.5 hover-elevate"
                  title={`${entry.person.name} — ${entry.interactionCount} interaction${
                    entry.interactionCount === 1 ? "" : "s"
                  }, ${WARMTH_LABELS[entry.person.warmth.level].toLowerCase()}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs w-4 shrink-0 tabular-nums text-right", rankClass(rank))}>{rank}</span>
                    <PersonAvatar name={entry.person.name} photoUrl={entry.person.photoUrl} className="h-6 w-6 text-[10px]" />
                    <span className="text-sm truncate flex-1 min-w-0">{entry.person.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">{entry.interactionCount}</span>
                  </div>
                  {/* Offset to line up under the name, not the rank number. */}
                  <div className="h-1 rounded-full bg-muted overflow-hidden ml-8 mt-1">
                    <div
                      className={cn("h-full rounded-full", rank === 1 ? "bg-primary" : "bg-primary/50")}
                      style={{ width: `${Math.max(share, 4)}%` }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
