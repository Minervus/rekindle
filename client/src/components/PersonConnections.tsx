import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Users, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import PersonAvatar from "@/components/PersonAvatar";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { LINK_TYPES, LINK_TYPE_LABELS, type LinkType } from "@shared/personLinks";
import { RELATIONSHIP_TIER_LABELS } from "@shared/relationshipTiers";
import type { Person } from "@shared/schema";
import type { Warmth } from "@shared/warmth";

const MAX_PICKER_RESULTS = 6;

interface LinkedPerson {
  id: string;
  type: LinkType;
  note: string | null;
  person: Pick<Person, "id" | "name" | "photoUrl" | "relationshipTier">;
}

function AddLinkForm({ personId, linkedIds, onDone }: { personId: string; linkedIds: Set<string>; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Person | null>(null);
  const [type, setType] = useState<LinkType>("spouse");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: people } = useQuery<(Person & { warmth: Warmth })[]>({ queryKey: ["/api/people"] });

  // Already-linked people and the person themselves are filtered out of the
  // picker rather than left to fail on submit.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (people ?? [])
      .filter((p) => p.id !== personId && !linkedIds.has(p.id) && p.name.toLowerCase().includes(q))
      .slice(0, MAX_PICKER_RESULTS);
  }, [people, query, personId, linkedIds]);

  const create = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/people/${personId}/links`, {
        relatedPersonId: selected!.id,
        type,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      // Both profiles show this link, so the other end's cache is stale too.
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      toast({ title: `Linked to ${selected!.name}` });
      onDone();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Couldn't link", description: err.message.replace(/^\d+:\s*/, "") });
    },
  });

  return (
    <form
      className="border rounded-md p-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (selected) create.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="link-person">Who</Label>
        {selected ? (
          <div className="flex items-center gap-2">
            <PersonAvatar name={selected.name} photoUrl={selected.photoUrl} className="h-7 w-7 text-xs" />
            <span className="text-sm font-medium flex-1 truncate">{selected.name}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Change
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="link-person"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people by name…"
                className="pl-9"
                autoFocus
              />
            </div>
            {query.trim() && matches.length === 0 && (
              <p className="text-xs text-muted-foreground">No one matches — they may already be linked.</p>
            )}
            <ul className="space-y-0.5">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(p);
                      setQuery("");
                    }}
                    className="w-full text-left rounded-md px-2 py-1.5 hover-elevate flex items-center gap-2"
                  >
                    <PersonAvatar name={p.name} photoUrl={p.photoUrl} className="h-6 w-6 text-[10px]" />
                    <span className="text-sm truncate flex-1">{p.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {RELATIONSHIP_TIER_LABELS[p.relationshipTier]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="link-type">They are this person's…</Label>
        <Select value={type} onValueChange={(v) => setType(v as LinkType)}>
          <SelectTrigger id="link-type" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LINK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {LINK_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="link-note">Note (optional)</Label>
        <Input
          id="link-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="e.g. met through the climbing club"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!selected || create.isPending}>
          {create.isPending ? "Linking..." : "Add link"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={create.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// Who this person is connected to. A link is stored once and shown on both
// profiles, with the wording flipped on the other end — so "Ana is Ben's
// parent" reads as "Ben — Child" when you're looking at Ana.
export default function PersonConnections({ personId }: { personId: string }) {
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: links, isLoading } = useQuery<LinkedPerson[]>({ queryKey: ["/api/people", personId, "links"] });

  const remove = useMutation({
    mutationFn: async (linkId: string) => apiRequest("DELETE", `/api/people/${personId}/links/${linkId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      toast({ title: "Link removed" });
    },
  });

  const linkedIds = useMemo(() => new Set((links ?? []).map((l) => l.person.id)), [links]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Connections</CardTitle>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Users className="h-3.5 w-3.5" />
            Link someone
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {adding && <AddLinkForm personId={personId} linkedIds={linkedIds} onDone={() => setAdding(false)} />}

        {isLoading && <Skeleton className="h-14 w-full" />}

        {!isLoading && links?.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            No one linked yet — spouses, siblings, or whoever referred them. Links show on both profiles.
          </p>
        )}

        {links?.map((link) => (
          <div key={link.id} className="flex items-center gap-3 border rounded-md p-2 pr-1">
            <Link href={`/people/${link.person.id}`} className="flex items-center gap-3 min-w-0 flex-1 rounded-md px-1 py-1 hover-elevate">
              <PersonAvatar name={link.person.name} photoUrl={link.person.photoUrl} className="h-8 w-8 text-xs" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{link.person.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {LINK_TYPE_LABELS[link.type]}
                  {link.note && ` · ${link.note}`}
                </div>
              </div>
            </Link>
            <Button
              size="icon"
              variant="ghost"
              className={cn("h-7 w-7 shrink-0")}
              disabled={remove.isPending}
              aria-label={`Unlink ${link.person.name}`}
              title={`Unlink ${link.person.name}`}
              onClick={() => {
                if (confirm(`Unlink ${link.person.name}?`)) remove.mutate(link.id);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
