import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import PersonForm from "@/components/PersonForm";
import InteractionForm from "@/components/InteractionForm";
import PersonAvatar from "@/components/PersonAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLeadsEnabled } from "@/hooks/useLeadsEnabled";
import { cn } from "@/lib/utils";
import type { InsertInteraction, InsertPerson, Lead, Person } from "@shared/schema";
import type { Warmth } from "@shared/warmth";

const MAX_PICKER_RESULTS = 6;

type Mode = "person" | "interaction";
type PersonRow = Person & { warmth: Warmth };

function LogInteractionPanel({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PersonRow | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { enabled: leadsEnabled } = useLeadsEnabled();

  const { data: people } = useQuery<PersonRow[]>({ queryKey: ["/api/people"] });
  // Lead-only people aren't in /api/people, but you still log outreach
  // against them — so they're merged in when the pipeline is switched on.
  const { data: leads } = useQuery<(Lead & { person: PersonRow })[]>({
    queryKey: ["/api/leads"],
    enabled: leadsEnabled,
  });

  const candidates = useMemo(() => {
    const byId = new Map<string, PersonRow>();
    for (const p of people ?? []) byId.set(p.id, p);
    for (const l of leads ?? []) byId.set(l.personId, l.person);
    return Array.from(byId.values());
  }, [people, leads]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return candidates.filter((p) => p.name.toLowerCase().includes(q)).slice(0, MAX_PICKER_RESULTS);
  }, [candidates, query]);

  const isLead = useMemo(
    () => (selected ? (leads ?? []).some((l) => l.personId === selected.id) : false),
    [leads, selected],
  );

  const add = useMutation({
    mutationFn: async (input: Pick<InsertInteraction, "occurredAt" | "notes" | "kind">) =>
      apiRequest("POST", `/api/people/${selected!.id}/interactions`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/due"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", "touches"] });
      toast({ title: `Logged an interaction with ${selected!.name}` });
      onDone();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Couldn't log interaction", description: err.message.replace(/^\d+:\s*/, "") });
    },
  });

  if (!selected) {
    return (
      <div className="space-y-2">
        <Label htmlFor="quick-interaction-person">Who did you talk to?</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="quick-interaction-person"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people by name…"
            className="pl-9"
            autoFocus
          />
        </div>

        {query.trim() && matches.length === 0 && <p className="text-sm text-muted-foreground">No one matches that name.</p>}

        <ul className="space-y-0.5">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelected(p)}
                className="w-full text-left rounded-md px-2 py-2 hover-elevate flex items-center gap-3"
              >
                <PersonAvatar name={p.name} photoUrl={p.photoUrl} className="h-8 w-8 text-xs" />
                <span className="text-sm truncate flex-1">{p.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {[p.role, p.company].filter(Boolean).join(" at ") || p.location || ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PersonAvatar name={selected.name} photoUrl={selected.photoUrl} className="h-8 w-8 text-xs" />
        <span className="text-sm font-medium flex-1 truncate">{selected.name}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
          Change
        </Button>
      </div>

      <InteractionForm
        // The outreach/personal split only means something with a pipeline,
        // and only for someone actually in it.
        defaultKind={isLead ? "outreach" : "personal"}
        showKindToggle={leadsEnabled && isLead}
        onSubmit={(input) => add.mutate(input)}
        isSubmitting={add.isPending}
        submitLabel="Log interaction"
      />
    </div>
  );
}

// A floating add button on every page inside the shell. Follows
// GlobalSearch's hand-rolled overlay rather than pulling in a dialog
// library — same escape/scroll-lock/focus-return behaviour, no new
// dependency.
export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("person");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const openWith = (next: Mode) => {
    setMode(next);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const createPerson = useMutation({
    mutationFn: async (input: InsertPerson) => {
      const res = await apiRequest("POST", "/api/people", input);
      return res.json() as Promise<Person>;
    },
    onSuccess: (person) => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      setOpen(false);
      // Deliberately stays on the current page — this is a quick capture you
      // reach for mid-task, so yanking you to the new profile would cost more
      // than it saves.
      toast({ title: `Added ${person.name}` });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Couldn't add person", description: err.message.replace(/^\d+:\s*/, "") });
    },
  });

  return (
    <>
      <Button
        ref={triggerRef}
        onClick={() => openWith("person")}
        aria-label="Add"
        title="Add a person or log an interaction"
        aria-haspopup="dialog"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg p-0"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-center px-4 py-[6vh] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Quick add"
        >
          <button type="button" className="fixed inset-0 bg-black/50 cursor-default" aria-hidden="true" tabIndex={-1} onClick={close} />

          <div className="relative w-full max-w-2xl h-fit rounded-lg border bg-background shadow-lg">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              {/* Two entry points behind one button: adding someone and
                  recording that you spoke to them are the two things you
                  reach for mid-task. */}
              <div className="flex gap-1" role="tablist" aria-label="What to add">
                {(["person", "interaction"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "text-sm font-medium rounded-md px-3 py-1.5",
                      mode === m ? "bg-accent text-accent-foreground" : "text-muted-foreground hover-elevate",
                    )}
                  >
                    {m === "person" ? "New person" : "Log interaction"}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={close} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4">
              {mode === "person" ? (
                <PersonForm
                  onSubmit={(input) => createPerson.mutate(input)}
                  isSubmitting={createPerson.isPending}
                  submitLabel="Add person"
                />
              ) : (
                <LogInteractionPanel onDone={close} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
