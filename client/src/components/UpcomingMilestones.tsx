import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Cake, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PersonAvatar from "@/components/PersonAvatar";
import { formatDaysUntil, upcomingMilestones, type MilestoneRecord } from "@shared/milestones";
import type { AppSettings } from "@shared/schema";

export default function UpcomingMilestones() {
  const { data: settings } = useQuery<AppSettings>({ queryKey: ["/api/settings"] });
  const { data: records, isLoading } = useQuery<MilestoneRecord[]>({ queryKey: ["/api/reminders/milestones"] });

  const lookaheadDays = settings?.milestoneLookaheadDays ?? 30;
  // Filtered here rather than server-side: "within the next N days" is
  // relative to the browser's today, which can be a day off from the
  // server's UTC date.
  const upcoming = records ? upcomingMilestones(records, lookaheadDays) : [];

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between space-y-0 pb-3">
        <CardTitle className="text-lg">Coming up</CardTitle>
        <Link href="/settings" className="text-xs text-muted-foreground hover-elevate rounded px-1.5 py-1">
          next {lookaheadDays} days
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {!isLoading && upcoming.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No milestones in the next {lookaheadDays} days. Add move dates, anniversaries and race days on someone's profile.
          </p>
        )}

        <ul className="space-y-1">
          {upcoming.map((milestone) => {
            const Icon = milestone.kind === "birthday" ? Cake : CalendarClock;
            return (
              <li key={milestone.id}>
                <Link
                  href={`/people/${milestone.personId}`}
                  className="flex items-center gap-3 rounded-md -mx-2 px-2 py-1.5 hover-elevate"
                >
                  <PersonAvatar
                    name={milestone.personName}
                    photoUrl={milestone.personPhotoUrl}
                    className="h-8 w-8 text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{milestone.personName}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
                      <Icon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{milestone.label}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-medium">{formatDaysUntil(milestone.daysUntil)}</div>
                    <div className="text-xs text-muted-foreground">{format(milestone.nextOccurrence, "EEE d MMM")}</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
