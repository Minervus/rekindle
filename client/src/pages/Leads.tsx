import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import LeadCard, { type LeadWithPerson } from "@/components/LeadCard";
import LeadForm from "@/components/LeadForm";
import WeeklyAccountability from "@/components/WeeklyAccountability";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LEAD_STAGES, LEAD_STAGE_LABELS, LEAD_STAGE_HINTS } from "@shared/leadStages";
import type { CreateLeadRequest } from "@shared/schema";

const COLLAPSED_BY_DEFAULT = new Set(["client", "not_now"]);

export default function Leads() {
  const [showForm, setShowForm] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(COLLAPSED_BY_DEFAULT));
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: leads, isLoading } = useQuery<LeadWithPerson[]>({ queryKey: ["/api/leads"] });

  const createLead = useMutation({
    mutationFn: async (input: CreateLeadRequest) => {
      const res = await apiRequest("POST", "/api/leads", input);
      return res.json() as Promise<LeadWithPerson>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setShowForm(false);
      toast({ title: "Lead added" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Couldn't add lead", description: err.message });
    },
  });

  const toggleCollapsed = (stage: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add lead"}</Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <LeadForm onSubmit={(input) => createLead.mutate(input)} isSubmitting={createLead.isPending} />
          </CardContent>
        </Card>
      )}

      <div className="mb-6">
        <WeeklyAccountability />
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!isLoading && leads?.length === 0 && (
        <p className="text-muted-foreground text-sm">No leads yet — add one, or promote a personal contact from their profile.</p>
      )}

      <div className="space-y-6">
        {LEAD_STAGES.map((stage) => {
          const inStage = (leads ?? []).filter((l) => l.stage === stage);
          if (inStage.length === 0) return null;
          const isCollapsed = collapsed.has(stage);

          return (
            <div key={stage}>
              <button
                type="button"
                onClick={() => toggleCollapsed(stage)}
                className="w-full flex items-baseline justify-between gap-2 mb-2 text-left hover-elevate rounded-md px-1 py-0.5 -mx-1"
              >
                <div className="flex items-baseline gap-2">
                  <h2 className="font-semibold">{LEAD_STAGE_LABELS[stage]}</h2>
                  <span className="text-sm text-muted-foreground">{inStage.length}</span>
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">{LEAD_STAGE_HINTS[stage]}</span>
              </button>
              {!isCollapsed && (
                <div className="space-y-2">
                  {inStage.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
