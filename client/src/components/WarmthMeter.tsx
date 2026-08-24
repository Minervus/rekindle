import { cn } from "@/lib/utils";
import { WARMTH_LABELS, type WarmthLevel } from "@shared/warmth";

const LEVEL_COLOR: Record<WarmthLevel, string> = {
  cold: "bg-blue-500",
  cool: "bg-cyan-500",
  warm: "bg-orange-500",
  hot: "bg-red-500",
};

export default function WarmthMeter({
  score,
  level,
  className,
}: {
  score: number;
  level: WarmthLevel;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)} title={`Warmth: ${WARMTH_LABELS[level]} (${score}/100)`}>
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-[width]", LEVEL_COLOR[level])} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{WARMTH_LABELS[level]}</span>
    </div>
  );
}
