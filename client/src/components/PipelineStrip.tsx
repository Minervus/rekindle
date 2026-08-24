import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { useWeeklyAccountability } from "@/hooks/useWeeklyAccountability";

export default function PipelineStrip() {
  const accountability = useWeeklyAccountability();
  if (!accountability.isReady) return null;
  const { goal, currentWeek, streak, daysLeft, untouched, leads } = accountability;
  if (leads.length === 0) return null;

  return (
    <Link href="/leads">
      <Card className="hover-elevate cursor-pointer mb-6">
        <CardContent className="py-3 px-4 flex items-center justify-between gap-4 text-sm">
          <div>
            <span className="font-medium">Pipeline</span>
            <span className="text-muted-foreground">
              {" "}
              · {currentWeek.touches}/{goal} touches this week · {daysLeft}d left
              {streak.weeks > 0 && ` · ${streak.weeks}-week streak`}
            </span>
            {untouched.length > 0 && (
              <div className="text-muted-foreground">
                {untouched.length} lead{untouched.length === 1 ? "" : "s"} need{untouched.length === 1 ? "s" : ""} a follow-up
              </div>
            )}
          </div>
          <span className="text-primary whitespace-nowrap">Open pipeline →</span>
        </CardContent>
      </Card>
    </Link>
  );
}
