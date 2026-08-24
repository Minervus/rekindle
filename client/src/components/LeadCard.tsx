import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PersonAvatar from "@/components/PersonAvatar";
import LeadStageSelect from "@/components/LeadStageSelect";
import InteractionForm from "@/components/InteractionForm";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { computeLeadStaleness, type LeadStage } from "@shared/leadStages";
import type { Lead, Person, InsertInteraction } from "@shared/schema";
import type { Warmth } from "@shared/warmth";

export type LeadWithPerson = Lead & { person: Person & { warmth: Warmth } };

export default function LeadCard({ lead }: { lead: LeadWithPerson }) {
  const [loggingTouch, setLoggingTouch] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const staleness = computeLeadStaleness(
    lead.lastOutreachAt ? new Date(lead.lastOutreachAt) : null,
    new Date(lead.stageEnteredAt),
    lead.stage,
  );

  const changeStage = useMutation({
    mutationFn: async (stage: LeadStage) => apiRequest("PATCH", `/api/leads/${lead.id}`, { stage }),
    onSuccess: (_data, stage) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/people", lead.personId] });
      toast(stage === "client" ? { title: `${lead.person.name} is now a client!` } : { title: "Stage updated" });
    },
  });

  const logTouch = useMutation({
    mutationFn: async (input: Pick<InsertInteraction, "occurredAt" | "notes" | "kind">) => {
      const res = await apiRequest("POST", `/api/people/${lead.personId}/interactions`, input);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", "touches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/people", lead.personId] });
      queryClient.invalidateQueries({ queryKey: ["/api/people", lead.personId, "interactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/due"] });
      setLoggingTouch(false);
      toast({ title: "Touch logged" });
    },
  });

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Link href={`/people/${lead.personId}`} className="flex items-center gap-3 min-w-0">
            <PersonAvatar name={lead.person.name} photoUrl={lead.person.photoUrl} />
            <div className="min-w-0">
              <div className="font-medium truncate">{lead.person.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {staleness.daysSinceTouch === null
                  ? "No outreach yet"
                  : `${staleness.daysSinceTouch}d since last touch`}
                {staleness.isOverdue && <span className="text-primary font-medium"> · needs a follow-up</span>}
              </div>
            </div>
          </Link>
          <LeadStageSelect value={lead.stage} onChange={(stage) => changeStage.mutate(stage)} className="w-[9.5rem] shrink-0" />
        </div>

        {lead.nextAction && (
          <div className="text-sm text-muted-foreground border-l-2 pl-2">
            Next: {lead.nextAction}
            {lead.nextActionAt && ` — ${new Date(lead.nextActionAt).toLocaleDateString()}`}
          </div>
        )}

        {loggingTouch ? (
          <InteractionForm
            compact
            defaultKind="outreach"
            submitLabel="Log touch"
            isSubmitting={logTouch.isPending}
            onSubmit={(input) => logTouch.mutate(input)}
          />
        ) : (
          <Button variant="outline" size="sm" onClick={() => setLoggingTouch(true)}>
            Log touch
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
