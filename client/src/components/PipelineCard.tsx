import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LeadStageSelect from "@/components/LeadStageSelect";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { computeLeadStaleness } from "@shared/leadStages";
import type { Lead, StageConfig } from "@shared/schema";

interface PromoteFormValues {
  stage: string;
  source: string;
  fitnessGoal: string;
}

export default function PipelineCard({ personId, lead, stages }: { personId: string; lead: Lead | null; stages: StageConfig[] }) {
  const [promoting, setPromoting] = useState(false);
  const [form, setForm] = useState<PromoteFormValues>({ stage: stages[0]?.key ?? "", source: "", fitnessGoal: "" });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/people", personId] });
    queryClient.invalidateQueries({ queryKey: ["/api/people"] });
    queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
  };

  const promote = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/leads", {
        personId,
        stage: form.stage,
        source: form.source.trim() || null,
        fitnessGoal: form.fitnessGoal.trim() || null,
      }),
    onSuccess: () => {
      invalidate();
      setPromoting(false);
      toast({ title: "Added to pipeline" });
    },
  });

  const changeStage = useMutation({
    mutationFn: async (stage: string) => apiRequest("PATCH", `/api/leads/${lead!.id}`, { stage }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Stage updated" });
    },
  });

  const remove = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/leads/${lead!.id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Removed from pipeline" });
    },
  });

  if (!lead) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Pipeline</CardTitle>
          {!promoting && (
            <Button
              size="sm"
              onClick={() => {
                setForm((f) => ({ ...f, stage: stages[0]?.key ?? f.stage }));
                setPromoting(true);
              }}
            >
              Add to pipeline
            </Button>
          )}
        </CardHeader>
        {promoting && (
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Stage</Label>
                <LeadStageSelect value={form.stage} onChange={(stage) => setForm((f) => ({ ...f, stage }))} stages={stages} className="w-full" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="promote-source">Source</Label>
                <Input
                  id="promote-source"
                  placeholder="Instagram DM, referral..."
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="promote-goal">Fitness goal</Label>
                <Textarea
                  id="promote-goal"
                  placeholder="What are they hoping to achieve?"
                  value={form.fitnessGoal}
                  onChange={(e) => setForm((f) => ({ ...f, fitnessGoal: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={promote.isPending} onClick={() => promote.mutate()}>
                {promote.isPending ? "Adding..." : "Add to pipeline"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPromoting(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  const currentStage = stages.find((s) => s.key === lead.stage);
  const staleness = computeLeadStaleness(
    lead.lastOutreachAt ? new Date(lead.lastOutreachAt) : null,
    new Date(lead.stageEnteredAt),
    currentStage?.touchIntervalDays ?? null,
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Pipeline</CardTitle>
        <Button size="sm" variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
          Remove from pipeline
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-3">
          <LeadStageSelect value={lead.stage} onChange={(stage) => changeStage.mutate(stage)} stages={stages} className="w-[9.5rem]" />
          <span className="text-muted-foreground">
            {staleness.daysSinceTouch === null ? "No outreach yet" : `${staleness.daysSinceTouch}d since last touch`}
            {staleness.isOverdue && <span className="text-primary font-medium"> · needs a follow-up</span>}
          </span>
        </div>
        {lead.source && (
          <div>
            <span className="text-muted-foreground">Source: </span>
            {lead.source}
          </div>
        )}
        {lead.fitnessGoal && (
          <div>
            <span className="text-muted-foreground">Goal: </span>
            {lead.fitnessGoal}
          </div>
        )}
        {lead.nextAction && (
          <div className="border-l-2 pl-2 text-muted-foreground">
            Next: {lead.nextAction}
            {lead.nextActionAt && ` — ${new Date(lead.nextActionAt).toLocaleDateString()}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
