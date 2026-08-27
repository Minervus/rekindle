import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStageConfigs } from "@/hooks/useStageConfigs";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { useLeadsEnabled } from "@/hooks/useLeadsEnabled";
import {
  RELATIONSHIP_TIERS,
  RELATIONSHIP_TIER_LABELS,
  RECONNECT_SETTING_KEYS,
  type RelationshipTier,
} from "@shared/relationshipTiers";
import type { AppSettings, StageConfig } from "@shared/schema";

// Theme lives in localStorage, not the settings table — it's per-device, so
// it never round-trips through /api/settings.
const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "System", icon: Monitor },
];

function AppearanceSetting() {
  const { mode, resolved, setMode } = useTheme();

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {THEME_OPTIONS.map(({ mode: option, label, icon: Icon }) => (
          <Button key={option} size="sm" variant={mode === option ? "default" : "outline"} onClick={() => setMode(option)}>
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>
      {mode === "system" && (
        <p className="text-xs text-muted-foreground">Following your device — currently {resolved}.</p>
      )}
    </div>
  );
}

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

function MilestoneLookaheadSetting() {
  const [editing, setEditing] = useState(false);
  const [daysInput, setDaysInput] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useQuery<AppSettings>({ queryKey: ["/api/settings"] });

  const updateLookahead = useMutation({
    mutationFn: async (milestoneLookaheadDays: number) => apiRequest("PATCH", "/api/settings", { milestoneLookaheadDays }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setEditing(false);
      toast({ title: "Lookahead updated" });
    },
  });

  if (!settings) return <Skeleton className="h-9 w-32" />;

  if (editing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = parseInt(daysInput, 10);
          if (n > 0) updateLookahead.mutate(n);
        }}
      >
        <Input
          type="number"
          min={1}
          max={365}
          value={daysInput}
          onChange={(e) => setDaysInput(e.target.value)}
          className="w-20"
          autoFocus
        />
        <Button type="submit" size="sm" disabled={updateLookahead.isPending}>
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
      <span className="text-2xl font-semibold">{settings.milestoneLookaheadDays}</span>
      <span className="text-sm text-muted-foreground">days of warning before a milestone</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setDaysInput(String(settings.milestoneLookaheadDays));
          setEditing(true);
        }}
      >
        Edit
      </Button>
    </div>
  );
}

// One form for all three tiers rather than three independent edit toggles —
// these get set relative to each other ("close should be twice as often as
// friend"), so you want them on screen together.
function ReconnectCadenceSetting() {
  const [drafts, setDrafts] = useState<Record<RelationshipTier, string> | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useQuery<AppSettings>({ queryKey: ["/api/settings"] });

  const save = useMutation({
    mutationFn: async (values: Record<RelationshipTier, number>) =>
      apiRequest("PATCH", "/api/settings", {
        reconnectDaysClose: values.close,
        reconnectDaysFriend: values.friend,
        reconnectDaysAcquaintance: values.acquaintance,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      // The dashboard list and the People overdue dots are both derived from
      // these, so they're stale the moment this saves.
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/due"] });
      setDrafts(null);
      toast({ title: "Reconnect cadence updated" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Couldn't save cadence", description: err.message.replace(/^\d+:\s*/, "") });
    },
  });

  if (!settings) return <Skeleton className="h-24 w-full" />;

  const saved: Record<RelationshipTier, string> = {
    close: String(settings[RECONNECT_SETTING_KEYS.close]),
    friend: String(settings[RECONNECT_SETTING_KEYS.friend]),
    acquaintance: String(settings[RECONNECT_SETTING_KEYS.acquaintance]),
  };
  const current = drafts ?? saved;
  const parsed = {
    close: parseInt(current.close, 10),
    friend: parseInt(current.friend, 10),
    acquaintance: parseInt(current.acquaintance, 10),
  };
  const allValid = RELATIONSHIP_TIERS.every((t) => Number.isInteger(parsed[t]) && parsed[t] >= 1 && parsed[t] <= 1825);
  const dirty = RELATIONSHIP_TIERS.some((t) => current[t] !== saved[t]);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty && allValid) save.mutate(parsed);
      }}
    >
      {RELATIONSHIP_TIERS.map((tier) => (
        <div key={tier} className="flex items-center gap-3">
          <Label htmlFor={`reconnect-${tier}`} className="w-28 shrink-0">
            {RELATIONSHIP_TIER_LABELS[tier]}
          </Label>
          <Input
            id={`reconnect-${tier}`}
            type="number"
            min={1}
            max={1825}
            className="w-24"
            value={current[tier]}
            onChange={(e) => setDrafts({ ...current, [tier]: e.target.value })}
          />
          <span className="text-sm text-muted-foreground">days of silence</span>
        </div>
      ))}

      {dirty && (
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" size="sm" disabled={save.isPending || !allValid}>
            {save.isPending ? "Saving..." : "Save cadence"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setDrafts(null)} disabled={save.isPending}>
            Cancel
          </Button>
        </div>
      )}
    </form>
  );
}

function LeadPipelineSetting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useQuery<AppSettings>({ queryKey: ["/api/settings"] });

  const update = useMutation({
    mutationFn: async (showLeads: boolean) => apiRequest("PATCH", "/api/settings", { showLeads }),
    onSuccess: (_res, showLeads) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: showLeads ? "Lead pipeline shown" : "Lead pipeline hidden" });
    },
  });

  if (!settings) return <Skeleton className="h-9 w-40" />;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant={settings.showLeads ? "default" : "outline"} onClick={() => update.mutate(true)} disabled={update.isPending}>
          Shown
        </Button>
        <Button size="sm" variant={!settings.showLeads ? "default" : "outline"} onClick={() => update.mutate(false)} disabled={update.isPending}>
          Hidden
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Hiding it removes the Leads tab, the dashboard pipeline strip, the pipeline card on each profile, and the
        personal/outreach toggle when logging interactions. Nothing is deleted — every lead, stage and outreach touch is
        still there when you switch it back on.
      </p>
    </div>
  );
}

export default function Settings() {
  const [addingStage, setAddingStage] = useState(false);
  const { stages, isLoading } = useStageConfigs();
  const { enabled: leadsEnabled } = useLeadsEnabled();
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
          <CardTitle className="text-lg">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <AppearanceSetting />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Weekly outreach goal</CardTitle>
        </CardHeader>
        <CardContent>
          <GoalSetting />
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Reconnect cadence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ReconnectCadenceSetting />
          <p className="text-xs text-muted-foreground">
            How long someone in each tier can go without contact before they show under "Due for reconnect". The clock
            runs from their last interaction — or from when you added them, if there isn't one yet.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Milestone reminders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <MilestoneLookaheadSetting />
          <p className="text-xs text-muted-foreground">
            How far ahead move dates, anniversaries and birthdays appear under "Coming up" on the dashboard.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Lead pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadPipelineSetting />
        </CardContent>
      </Card>

      <Card className={leadsEnabled ? "" : "hidden"}>
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
