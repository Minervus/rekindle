import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { InsertInteraction } from "@shared/schema";

type Kind = "personal" | "outreach";

interface FormValues {
  occurredAt: string;
  notes: string;
  kind: Kind;
}

function todayLocalDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export default function InteractionForm({
  onSubmit,
  isSubmitting,
  defaultKind = "personal",
  showKindToggle = false,
  compact = false,
  submitLabel = "Add interaction",
}: {
  onSubmit: (input: Pick<InsertInteraction, "occurredAt" | "notes" | "kind">) => void;
  isSubmitting?: boolean;
  defaultKind?: Kind;
  showKindToggle?: boolean;
  compact?: boolean;
  submitLabel?: string;
}) {
  const form = useForm<FormValues>({ defaultValues: { occurredAt: todayLocalDate(), notes: "", kind: defaultKind } });
  const kind = form.watch("kind");

  const handleSubmit = (values: FormValues) => {
    if (!values.notes.trim()) return;
    onSubmit({ occurredAt: new Date(`${values.occurredAt}T12:00:00`), notes: values.notes.trim(), kind: values.kind });
    form.reset({ occurredAt: todayLocalDate(), notes: "", kind: defaultKind });
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className={cn("space-y-3", compact && "space-y-2")}>
      {showKindToggle && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={kind === "personal" ? "default" : "outline"}
            onClick={() => form.setValue("kind", "personal")}
          >
            Personal
          </Button>
          <Button
            type="button"
            size="sm"
            variant={kind === "outreach" ? "default" : "outline"}
            onClick={() => form.setValue("kind", "outreach")}
          >
            Outreach
          </Button>
        </div>
      )}
      <div className="space-y-1.5">
        {!compact && <Label htmlFor="occurredAt">Date</Label>}
        <Input id="occurredAt" type="date" className="max-w-[10rem]" {...form.register("occurredAt", { required: true })} />
      </div>
      <div className="space-y-1.5">
        {!compact && <Label htmlFor="notes">Notes</Label>}
        <Textarea
          id="notes"
          placeholder={kind === "outreach" ? "What did you reach out about?" : "What did you talk about?"}
          rows={compact ? 2 : undefined}
          {...form.register("notes", { required: true })}
        />
      </div>
      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting ? "Adding..." : submitLabel}
      </Button>
    </form>
  );
}
