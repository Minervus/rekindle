import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Cake, CalendarClock, Repeat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { daysUntilOccurrence, formatDaysUntil } from "@shared/milestones";
import type { Milestone } from "@shared/schema";

interface Draft {
  label: string;
  occursOn: string;
  recursAnnually: boolean;
}

const EMPTY_DRAFT: Draft = { label: "", occursOn: "", recursAnnually: false };

function MilestoneForm({
  initial,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (draft: Draft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  // The add form and a row's edit form can be open at the same time, so
  // these ids have to be per-instance or the labels point at the wrong input.
  const fieldId = useId();

  return (
    <form
      className="border rounded-md p-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.label.trim() && draft.occursOn) onSubmit({ ...draft, label: draft.label.trim() });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${fieldId}-label`}>What's happening</Label>
        <Input
          id={`${fieldId}-label`}
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          placeholder="e.g. Moving to Melbourne"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${fieldId}-date`}>Date</Label>
        <Input
          id={`${fieldId}-date`}
          type="date"
          value={draft.occursOn}
          onChange={(e) => setDraft((d) => ({ ...d, occursOn: e.target.value }))}
          className="w-44"
        />
      </div>
      <div className="flex items-center gap-2">
        <Label className="mr-1">Repeats every year</Label>
        <Button
          type="button"
          size="sm"
          variant={draft.recursAnnually ? "default" : "outline"}
          onClick={() => setDraft((d) => ({ ...d, recursAnnually: true }))}
        >
          Yes
        </Button>
        <Button
          type="button"
          size="sm"
          variant={!draft.recursAnnually ? "default" : "outline"}
          onClick={() => setDraft((d) => ({ ...d, recursAnnually: false }))}
        >
          No
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        One-off milestones like a move date drop off the dashboard once they pass. Yearly ones — anniversaries, sobriety
        dates — roll forward.
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting || !draft.label.trim() || !draft.occursOn}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function MilestoneRow({ personId, milestone }: { personId: string; milestone: Milestone }) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/people", personId, "milestones"] });
    queryClient.invalidateQueries({ queryKey: ["/api/reminders/milestones"] });
  };

  const save = useMutation({
    mutationFn: async (draft: Draft) => apiRequest("PATCH", `/api/people/${personId}/milestones/${milestone.id}`, draft),
    onSuccess: () => {
      invalidate();
      setEditing(false);
      toast({ title: "Milestone updated" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Couldn't save", description: err.message.replace(/^\d+:\s*/, "") });
    },
  });

  const remove = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/people/${personId}/milestones/${milestone.id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Milestone removed" });
    },
  });

  if (editing) {
    return (
      <MilestoneForm
        initial={{ label: milestone.label, occursOn: milestone.occursOn, recursAnnually: milestone.recursAnnually }}
        submitLabel="Save"
        isSubmitting={save.isPending}
        onSubmit={(draft) => save.mutate(draft)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const daysUntil = daysUntilOccurrence(milestone.occursOn, milestone.recursAnnually);
  const passed = daysUntil < 0;

  return (
    <div className="flex items-center justify-between gap-3 border rounded-md p-3">
      <div className="min-w-0">
        <div className="font-medium text-sm truncate flex items-center gap-1.5">
          {milestone.label}
          {milestone.recursAnnually && <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />}
        </div>
        <div className={`text-xs ${passed ? "text-muted-foreground" : ""}`}>
          {format(parseISO(milestone.occursOn), milestone.recursAnnually ? "d MMMM" : "d MMMM yyyy")}
          {" · "}
          {passed ? "passed" : formatDaysUntil(daysUntil).toLowerCase()}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={remove.isPending}
          onClick={() => {
            if (confirm(`Remove "${milestone.label}"?`)) remove.mutate();
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

// Dated things worth reaching out around. Separate from notes (undated
// background) and interactions (a log of what already happened) — this is
// the only one of the three that looks forward.
export default function PersonMilestones({ personId, birthday }: { personId: string; birthday: string | null }) {
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: milestones, isLoading } = useQuery<Milestone[]>({
    queryKey: ["/api/people", personId, "milestones"],
  });

  const create = useMutation({
    mutationFn: async (draft: Draft) => apiRequest("POST", `/api/people/${personId}/milestones`, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people", personId, "milestones"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/milestones"] });
      setAdding(false);
      toast({ title: "Milestone added" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Couldn't add milestone", description: err.message.replace(/^\d+:\s*/, "") });
    },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Milestones</CardTitle>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <CalendarClock className="h-3.5 w-3.5" />
            Add milestone
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {adding && (
          <MilestoneForm
            initial={EMPTY_DRAFT}
            submitLabel="Add milestone"
            isSubmitting={create.isPending}
            onSubmit={(draft) => create.mutate(draft)}
            onCancel={() => setAdding(false)}
          />
        )}

        {isLoading && <Skeleton className="h-16 w-full" />}

        {!isLoading && milestones?.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            Nothing dated yet — a move date, a race, a work anniversary. These show on the dashboard as they approach.
          </p>
        )}

        {milestones?.map((milestone) => (
          <MilestoneRow key={milestone.id} personId={personId} milestone={milestone} />
        ))}

        {/* The birthday lives on the profile, not here, but it feeds the same
            dashboard list — so say so rather than leaving it looking missing. */}
        {birthday && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
            <Cake className="h-3 w-3 shrink-0" />
            Their birthday ({birthday}) is tracked from the profile above and shows here too as it approaches.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
