import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, ChevronDown } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStageConfigs } from "@/hooks/useStageConfigs";
import type { AppSettings, StageConfig } from "@shared/schema";

function StageRow({ stage, isFirst, isLast, onMove }: { stage: StageConfig; isFirst: boolean; isLast: boolean; onMove: (dir: -1 | 1) => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(stage.label);
  const [hint, setHint] = useState(stage.hint ?? "");
  const [interval, setInterval] = useState(stage.touchIntervalDays?.toString() ?? "");
  const [isActive, setIsActive] = useState(stage.isActive);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/stages"] });

  const save = useMutation({
    mutationFn: async () =>
      apiRequest("PATCH", `/api/stages/${stage.key}`, {
        label: label.trim(),
        hint: hint.trim() || null,
        touchIntervalDays: interval.trim() ? parseInt(interval, 10) : null,
        isActive,
      }),
    onSuccess: () => {
      invalidate();
      setEditing(false);
      toast({ title: "Stage updated" });
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/stages/${stage.key}`);
      return res;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Stage deleted" });
    },
    onError: (err: Error) => {
      const message = err.message.replace(/^\d+:\s*/, "");
      toast({ variant: "destructive", title: "Can't delete this stage", description: message });
    },
  });

  if (editing) {
    return (
      <div className="border rounded-md p-3 space-y-3">
        <div className="space-y-1.5">
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Hint (optional)</Label>
          <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="What does this stage mean?" />
        </div>
        <div className="space-y-1.5">
          <Label>Follow-up after (days — blank means never flagged)</Label>
          <Input type="number" min={1} value={interval} onChange={(e) => setInterval(e.target.value)} className="w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Label className="mr-1">Counts as active pipeline stage</Label>
          <Button type="button" size="sm" variant={isActive ? "default" : "outline"} onClick={() => setIsActive(true)}>
            Yes
          </Button>
          <Button type="button" size="sm" variant={!isActive ? "default" : "outline"} onClick={() => setIsActive(false)}>
            No
          </Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !label.trim()}>
            {save.isPending ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border rounded-md p-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex flex-col shrink-0">
          <Button size="icon" variant="ghost" className="h-5 w-6" disabled={isFirst} onClick={() => onMove(-1)}>
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-5 w-6" disabled={isLast} onClick={() => onMove(1)}>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="min-w-0">
          <div className="font-medium truncate">
            {stage.label}
            {!stage.isActive && <span className="text-xs text-muted-foreground font-normal"> · inactive</span>}
          </div>
          {stage.hint && <div className="text-xs text-muted-foreground truncate">{stage.hint}</div>}
          <div className="text-xs text-muted-foreground">
            {stage.touchIntervalDays ? `Follow up after ${stage.touchIntervalDays}d of silence` : "No follow-up cadence"}
          </div>
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
            if (confirm(`Delete "${stage.label}"?`)) remove.mutate();
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

function AddStageForm({ onDone }: { onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [hint, setHint] = useState("");
  const [interval, setInterval] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const create = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/stages", {
        label: label.trim(),
        hint: hint.trim() || null,
        touchIntervalDays: interval.trim() ? parseInt(interval, 10) : null,
        isActive: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stages"] });
      toast({ title: "Stage added" });
      onDone();
    },
  });

  return (
    <div className="border rounded-md p-3 space-y-3">
      <div className="space-y-1.5">
        <Label>Label</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Waitlisted" autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label>Hint (optional)</Label>
        <Input value={hint} onChange={(e) => setHint(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Follow-up after (days — blank means never flagged)</Label>
        <Input type="number" min={1} value={interval} onChange={(e) => setInterval(e.target.value)} className="w-24" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || !label.trim()}>
          {create.isPending ? "Adding..." : "Add stage"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function GoalSetting() {
  const [editing, setEditing] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useQuery<AppSettings>({ queryKey: ["/api/settings"] });

  const updateGoal = useMutation({
    mutationFn: async (weeklyOutreachGoal: number) => apiRequest("PATCH", "/api/settings", { weeklyOutreachGoal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setEditing(false);
      toast({ title: "Goal updated" });
    },
  });

  if (!settings) return <Skeleton className="h-9 w-32" />;

  if (editing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = parseInt(goalInput, 10);
          if (n > 0) updateGoal.mutate(n);
        }}
      >
        <Input type="number" min={1} max={200} value={goalInput} onChange={(e) => setGoalInput(e.target.value)} className="w-20" autoFocus />
        <Button type="submit" size="sm" disabled={updateGoal.isPending}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl font-semibold">{settings.weeklyOutreachGoal}</span>
      <span className="text-sm text-muted-foreground">outreach touches / week</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setGoalInput(String(settings.weeklyOutreachGoal));
          setEditing(true);
        }}
      >
        Edit
      </Button>
    </div>
  );
}

export default function Settings() {
  const [addingStage, setAddingStage] = useState(false);
  const { stages, isLoading } = useStageConfigs();
  const queryClient = useQueryClient();

  const reorder = useMutation({
    mutationFn: async (orderedKeys: string[]) => apiRequest("PUT", "/api/stages/order", orderedKeys),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/stages"] }),
  });

  const move = (index: number, dir: -1 | 1) => {
    const keys = stages.map((s) => s.key);
    const target = index + dir;
    if (target < 0 || target >= keys.length) return;
    [keys[index], keys[target]] = [keys[target], keys[index]];
    reorder.mutate(keys);
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Weekly outreach goal</CardTitle>
        </CardHeader>
        <CardContent>
          <GoalSetting />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Pipeline stages</CardTitle>
          {!addingStage && (
            <Button size="sm" onClick={() => setAddingStage(true)}>
              Add stage
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <Skeleton className="h-16 w-full" />}
          {addingStage && <AddStageForm onDone={() => setAddingStage(false)} />}
          {stages.map((stage, i) => (
            <StageRow key={stage.key} stage={stage} isFirst={i === 0} isLast={i === stages.length - 1} onMove={(dir) => move(i, dir)} />
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
