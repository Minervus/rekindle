import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Person } from "@shared/schema";

// Notes get their own card with in-place editing rather than living in the
// profile card's all-or-nothing edit form — they're the field you amend
// most often, usually right after talking to someone.
export default function PersonNotes({ personId, notes }: { personId: string; notes: string | null }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Keeps the draft honest if the person is refetched while not editing
  // (e.g. after a save elsewhere on the page). Deliberately skipped while
  // editing so a background refetch can't clobber what's being typed.
  useEffect(() => {
    if (!editing) setDraft(notes ?? "");
  }, [notes, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    // Cursor at the end, not the start — you're almost always appending.
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const save = useMutation({
    mutationFn: async (value: string) => apiRequest("PATCH", `/api/people/${personId}`, { notes: value.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people"] });
      setEditing(false);
      toast({ title: "Notes saved" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Couldn't save notes", description: err.message.replace(/^\d+:\s*/, "") });
    },
  });

  const dirty = draft !== (notes ?? "");

  const cancel = () => {
    setDraft(notes ?? "");
    setEditing(false);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (dirty) save.mutate(draft);
      else setEditing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Notes</CardTitle>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            {notes ? "Edit" : "Add notes"}
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {editing ? (
          <div className="space-y-2">
            <Textarea
              ref={textareaRef}
              rows={6}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Background worth remembering — family, injuries, what they're training for, how they like to be contacted."
              aria-label="Notes"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => save.mutate(draft)} disabled={save.isPending || !dirty}>
                {save.isPending ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel} disabled={save.isPending}>
                Cancel
              </Button>
              <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">⌘↵ to save · Esc to cancel</span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full text-left rounded-md -mx-2 px-2 py-1 hover-elevate"
            aria-label="Edit notes"
          >
            {notes ? (
              <p className="text-sm whitespace-pre-wrap">{notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing noted yet — what do you know about them that the interaction log shouldn't hold?
              </p>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
