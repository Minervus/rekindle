import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import PersonForm from "@/components/PersonForm";
import PersonAvatar from "@/components/PersonAvatar";
import WarmthMeter from "@/components/WarmthMeter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RELATIONSHIP_TIER_LABELS, computeNextReconnectAt, computeDaysOverdue } from "@shared/relationshipTiers";
import { matchSearchFields, personSearchFields, searchTerms, type SearchField } from "@shared/personSearch";
import type { InsertPerson, Person } from "@shared/schema";
import type { Warmth } from "@shared/warmth";

// Fields already visible on the row — repeating them as a "why this
// matched" line would just be noise.
const IMPLICIT_FIELDS = new Set(["Name", "Role", "Company", "Location", "Tier"]);

export default function People() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: people, isLoading } = useQuery<(Person & { warmth: Warmth })[]>({ queryKey: ["/api/people"] });

  const createPerson = useMutation({
    mutationFn: async (input: InsertPerson) => {
      const res = await apiRequest("POST", "/api/people", input);
      return res.json() as Promise<Person>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      setShowForm(false);
      toast({ title: "Person added" });
    },
  });

  // Matches any field on the profile, not just the name — see
  // shared/personSearch.ts, which the header's global search also uses.
  const filtered = useMemo(() => {
    const terms = searchTerms(search);
    const out: { person: Person & { warmth: Warmth }; reasons: SearchField[] }[] = [];

    for (const person of people ?? []) {
      const matches = matchSearchFields(personSearchFields(person), terms);
      if (!matches) continue;
      out.push({ person, reasons: matches.filter((m) => !IMPLICIT_FIELDS.has(m.label)) });
    }

    return out;
  }, [people, search]);

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">People</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add person"}</Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <PersonForm onSubmit={(input) => createPerson.mutate(input)} isSubmitting={createPerson.isPending} submitLabel="Add person" />
          </CardContent>
        </Card>
      )}

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search name, tag, company, location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {search.trim() ? `No one matches “${search.trim()}”.` : "No one here yet."}
        </p>
      )}

      <div className="space-y-2">
        {filtered.map(({ person, reasons }) => {
          const nextReconnectAt = computeNextReconnectAt(
            person.lastInteractionAt ? new Date(person.lastInteractionAt) : null,
            new Date(person.createdAt),
            person.relationshipTier,
          );
          const overdue = computeDaysOverdue(nextReconnectAt) >= 0;

          return (
            <Link key={person.id} href={`/people/${person.id}`}>
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <PersonAvatar name={person.name} photoUrl={person.photoUrl} />
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {person.name}
                        {overdue && <span className="h-2 w-2 rounded-full bg-primary" title="Due for reconnect" />}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {[person.role, person.company].filter(Boolean).join(" at ") || person.location || "—"}
                      </div>
                      {reasons.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {reasons
                            .slice(0, 3)
                            .map((r) => `${r.label}: ${r.value}`)
                            .join(" · ")}
                        </div>
                      )}
                      <WarmthMeter score={person.warmth.score} level={person.warmth.level} className="mt-1" />
                    </div>
                  </div>
                  <Badge variant="secondary">{RELATIONSHIP_TIER_LABELS[person.relationshipTier]}</Badge>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
