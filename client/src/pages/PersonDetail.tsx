import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import PersonForm from "@/components/PersonForm";
import InteractionForm from "@/components/InteractionForm";
import SuggestionPanel from "@/components/SuggestionPanel";
import PersonAvatar from "@/components/PersonAvatar";
import WarmthMeter from "@/components/WarmthMeter";
import PipelineCard from "@/components/PipelineCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { InsertInteraction, InsertPerson, Interaction, Person, Lead } from "@shared/schema";
import type { Warmth } from "@shared/warmth";

type PersonDetailData = Person & { warmth: Warmth; lead: Lead | null };

export default function PersonDetail({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: person, isLoading } = useQuery<PersonDetailData>({ queryKey: ["/api/people", id] });
  const { data: interactions, isLoading: interactionsLoading } = useQuery<Interaction[]>({
    queryKey: ["/api/people", id, "interactions"],
  });

  const updatePerson = useMutation({
    mutationFn: async (input: InsertPerson) => {
      const res = await apiRequest("PATCH", `/api/people/${id}`, input);
      return res.json() as Promise<Person>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      setEditing(false);
      toast({ title: "Profile updated" });
    },
  });

  const deletePerson = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/people/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      navigate("/people");
    },
  });

  const addInteraction = useMutation({
    mutationFn: async (input: Pick<InsertInteraction, "occurredAt" | "notes" | "kind">) => {
      const res = await apiRequest("POST", `/api/people/${id}/interactions`, input);
      return res.json() as Promise<Interaction>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people", id, "interactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/due"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", "touches"] });
    },
  });

  const addToPersonalContacts = useMutation({
    mutationFn: async () => apiRequest("PATCH", `/api/people/${id}`, { isPersonalContact: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      toast({ title: "Added to personal contacts" });
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <Skeleton className="h-40 w-full" />
      </AppShell>
    );
  }

  if (!person) {
    return (
      <AppShell>
        <p className="text-muted-foreground text-sm">Person not found.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <PersonAvatar name={person.name} photoUrl={person.photoUrl} className="h-12 w-12" />
              <div>
                <CardTitle className="text-xl">{person.name}</CardTitle>
                <WarmthMeter score={person.warmth.score} level={person.warmth.level} className="mt-1" />
              </div>
            </div>
            <div className="flex gap-2">
              {!person.isPersonalContact && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addToPersonalContacts.mutate()}
                  disabled={addToPersonalContacts.isPending}
                >
                  Add to personal contacts
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
                {editing ? "Cancel" : "Edit"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm(`Delete ${person.name}? This can't be undone.`)) deletePerson.mutate();
                }}
              >
                Delete
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {editing ? (
              <PersonForm person={person} onSubmit={(input) => updatePerson.mutate(input)} isSubmitting={updatePerson.isPending} />
            ) : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">How we met</dt>
                  <dd>{person.howMet || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Work</dt>
                  <dd>{[person.role, person.company].filter(Boolean).join(" at ") || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Location</dt>
                  <dd>{person.location || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Birthday</dt>
                  <dd>{person.birthday || "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Tags</dt>
                  <dd>{person.tags.length ? person.tags.join(", ") : "—"}</dd>
                </div>
                {(person.facebookUrl || person.instagramUrl || person.linkedinUrl) && (
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Profiles</dt>
                    <dd className="flex flex-wrap gap-3">
                      {person.facebookUrl && (
                        <a href={person.facebookUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
                          Facebook
                        </a>
                      )}
                      {person.instagramUrl && (
                        <a href={person.instagramUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
                          Instagram
                        </a>
                      )}
                      {person.linkedinUrl && (
                        <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
                          LinkedIn
                        </a>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>

        <PipelineCard personId={person.id} lead={person.lead} />

        <SuggestionPanel personId={person.id} />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Interactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <InteractionForm
              defaultKind={person.lead ? "outreach" : "personal"}
              showKindToggle={!!person.lead}
              onSubmit={(input) => addInteraction.mutate(input)}
              isSubmitting={addInteraction.isPending}
            />

            {interactionsLoading && <Skeleton className="h-16 w-full" />}

            {!interactionsLoading && interactions?.length === 0 && (
              <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
            )}

            <ul className="space-y-3">
              {interactions?.map((interaction) => (
                <li key={interaction.id} className="border-b pb-3 last:border-b-0">
                  <div className="text-xs text-muted-foreground">{format(new Date(interaction.occurredAt), "MMM d, yyyy")}</div>
                  <div className="text-sm whitespace-pre-wrap">{interaction.notes}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
