import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { InsertInteraction } from "@shared/schema";

interface FormValues {
  occurredAt: string;
  notes: string;
}

function todayLocalDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export default function InteractionForm({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (input: Pick<InsertInteraction, "occurredAt" | "notes">) => void;
  isSubmitting?: boolean;
}) {
  const form = useForm<FormValues>({ defaultValues: { occurredAt: todayLocalDate(), notes: "" } });

  const handleSubmit = (values: FormValues) => {
    if (!values.notes.trim()) return;
    onSubmit({ occurredAt: new Date(`${values.occurredAt}T12:00:00`), notes: values.notes.trim() });
    form.reset({ occurredAt: todayLocalDate(), notes: "" });
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="occurredAt">Date</Label>
        <Input id="occurredAt" type="date" className="max-w-[10rem]" {...form.register("occurredAt", { required: true })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" placeholder="What did you talk about?" {...form.register("notes", { required: true })} />
      </div>
      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting ? "Adding..." : "Add interaction"}
      </Button>
    </form>
  );
}
