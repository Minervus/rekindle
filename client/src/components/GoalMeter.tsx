import { cn } from "@/lib/utils";

export default function GoalMeter({
  current,
  goal,
  className,
}: {
  current: number;
  goal: number;
  className?: string;
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  const met = current >= goal;

  return (
    <div className={cn("h-2 w-full rounded-full bg-muted overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-[width]", met ? "bg-primary" : "bg-primary/60")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
