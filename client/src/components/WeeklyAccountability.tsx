import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GoalMeter from "@/components/GoalMeter";
import { useWeeklyAccountability } from "@/hooks/useWeeklyAccountability";
import { useStageConfigs } from "@/hooks/useStageConfigs";

export default function WeeklyAccountability() {
  const { label: stageLabel } = useStageConfigs();
  const accountability = useWeeklyAccountability();

  if (!accountability.isReady) return null;
  const { goal, buckets, currentWeek, streak, daysLeft, untouched, leads } = accountability;
  if (leads.length === 0) return null;

  const maxTouches = Math.max(goal, ...buckets.map((b) => b.touches), 1);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">This week</CardTitle>
        <Link href="/settings" className="text-xs text-muted-foreground hover-elevate rounded px-1.5 py-1">
          goal: {goal}
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <GoalMeter current={currentWeek.touches} goal={goal} />
          <div className="flex items-center justify-between text-sm">
            <span>
              {currentWeek.touches} / {goal} touches · {currentWeek.leadsTouched} lead{currentWeek.leadsTouched === 1 ? "" : "s"} reached
            </span>
            {streak.weeks > 0 && (
              <span className="text-muted-foreground">
                {streak.weeks}-week streak
                {!streak.includesCurrent && currentWeek.touches < goal ? ` · ${goal - currentWeek.touches} to keep it alive` : ""}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {daysLeft === 1 ? "Last day of the week" : `${daysLeft} days left`}
            {currentWeek.touches < goal && ` — ${goal - currentWeek.touches} to go`}
          </div>
        </div>

        <div className="flex items-end gap-1 h-10">
          {buckets.map((b, i) => (
            <div
              key={i}
              className={`flex-1 rounded-sm ${b.goalMet ? "bg-primary" : "bg-muted"}`}
              style={{ height: `${Math.max(8, (b.touches / maxTouches) * 100)}%` }}
              title={`Week of ${b.weekStart.toLocaleDateString()} — ${b.touches} touch${b.touches === 1 ? "" : "es"}, ${b.leadsTouched} lead${b.leadsTouched === 1 ? "" : "s"}`}
            />
          ))}
        </div>

        {untouched.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t">
            <div className="text-sm text-muted-foreground pt-3">
              {untouched.length} active lead{untouched.length === 1 ? "" : "s"} untouched this week
            </div>
            <ul className="space-y-1">
              {untouched.slice(0, 5).map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={`/people/${lead.personId}`}
                    className="text-sm hover-elevate rounded px-1.5 py-1 -mx-1.5 flex items-center justify-between"
                  >
                    <span>{lead.person.name}</span>
                    <span className="text-xs text-muted-foreground">{stageLabel(lead.stage)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
