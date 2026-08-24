import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StageConfig } from "@shared/schema";

export default function LeadStageSelect({
  value,
  onChange,
  stages,
  className,
}: {
  value: string;
  onChange: (stage: string) => void;
  stages: StageConfig[];
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {stages.map((stage) => (
          <SelectItem key={stage.key} value={stage.key}>
            {stage.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
