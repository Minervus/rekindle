import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEAD_STAGES, LEAD_STAGE_LABELS, type LeadStage } from "@shared/leadStages";

export default function LeadStageSelect({
  value,
  onChange,
  className,
}: {
  value: LeadStage;
  onChange: (stage: LeadStage) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as LeadStage)}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LEAD_STAGES.map((stage) => (
          <SelectItem key={stage} value={stage}>
            {LEAD_STAGE_LABELS[stage]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
