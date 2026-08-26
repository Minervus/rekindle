import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import PersonAvatar from "@/components/PersonAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStageConfigs } from "@/hooks/useStageConfigs";
import { useLeadsEnabled } from "@/hooks/useLeadsEnabled";
import { cn } from "@/lib/utils";
import { matchSearchFields, personSearchFields, searchTerms, type SearchField } from "@shared/personSearch";
import { RELATIONSHIP_TIER_LABELS } from "@shared/relationshipTiers";
import type { Lead, Person } from "@shared/schema";
import type { Warmth } from "@shared/warmth";

type PersonRow = Person & { warmth: Warmth };
type LeadRow = Lead & { person: PersonRow };

const MAX_RESULTS = 8;
// Match reasons shown under a result, beyond the name itself.
const MAX_REASONS = 3;

interface Result {
  person: PersonRow;
  lead: LeadRow | null;
  stageLabel: string | null;
  matches: SearchField[];
  nameMatched: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bolds every search term inside a field value so the reason for a match reads at a glance. */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        // split() with a capture group puts the delimiters at odd indexes.
        i % 2 === 1 ? (
          <mark key={i} className="bg-transparent text-foreground font-medium">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function subtitle(person: PersonRow): string {
  const work = [person.role, person.company].filter(Boolean).join(" at ");
  return [work, person.location].filter(Boolean).join(" · ");
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { byKey } = useStageConfigs();
  const { enabled: leadsEnabled } = useLeadsEnabled();
  // Both lists are already cached by the People/Leads pages under the same
  // keys; fetching only once opened keeps the palette off the critical path
  // for pages that need neither.
  const { data: people } = useQuery<PersonRow[]>({ queryKey: ["/api/people"], enabled: open });
  // Not fetched at all with the pipeline hidden, so results fall back to the
  // relationship-tier badge and pipeline fields drop out of the search index.
  const { data: leads } = useQuery<LeadRow[]>({ queryKey: ["/api/leads"], enabled: open && leadsEnabled });

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    triggerRef.current?.focus();
  }, []);

  // ⌘K / Ctrl+K from anywhere in the app.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const terms = useMemo(() => searchTerms(query), [query]);

  // One entry per person, whether they're a personal contact, a lead, or
  // both — leads win the merge so their pipeline fields are searchable.
  const entries = useMemo(() => {
    const byPersonId = new Map<string, { person: PersonRow; lead: LeadRow | null }>();
    for (const person of people ?? []) byPersonId.set(person.id, { person, lead: null });
    for (const lead of leads ?? []) byPersonId.set(lead.personId, { person: lead.person, lead });
    return Array.from(byPersonId.values());
  }, [people, leads]);

  const results = useMemo<Result[]>(() => {
    if (terms.length === 0) return [];

    const matched: Result[] = [];

    for (const { person, lead } of entries) {
      const stageLabel = lead ? (byKey.get(lead.stage)?.label ?? lead.stage) : null;
      const fields = personSearchFields(person, lead ? { ...lead, stageLabel } : null);
      const matches = matchSearchFields(fields, terms);
      if (!matches) continue;

      matched.push({
        person,
        lead,
        stageLabel,
        matches,
        nameMatched: matches.some((m) => m.label === "Name"),
      });
    }

    // Name hits first — searching "maya" should surface Maya before someone
    // whose notes happen to mention her.
    return matched.sort((a, b) => {
      if (a.nameMatched !== b.nameMatched) return a.nameMatched ? -1 : 1;
      return a.person.name.localeCompare(b.person.name);
    });
  }, [entries, terms, byKey]);

  const visible = results.slice(0, MAX_RESULTS);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const select = (result: Result) => {
    navigate(`/people/${result.person.id}`);
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  };

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (visible.length === 0 ? 0 : (i + 1) % visible.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (visible.length === 0 ? 0 : (i - 1 + visible.length) % visible.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const result = visible[activeIndex];
      if (result) select(result);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="h-9 gap-2 px-2 sm:px-3 text-muted-foreground font-normal sm:w-56 sm:justify-start"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden sm:inline ml-auto text-[10px] text-muted-foreground border rounded px-1 py-0.5">⌘K</kbd>
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-center px-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Search profiles">
          <button type="button" className="fixed inset-0 bg-black/50 cursor-default" aria-hidden="true" tabIndex={-1} onClick={close} />

          <div className="relative w-full max-w-lg h-fit max-h-[80vh] flex flex-col rounded-lg border bg-popover text-popover-foreground shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search name, tag, company, location, notes…"
                aria-label="Search profiles"
                className="flex-1 h-11 bg-transparent text-base md:text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={close} aria-label="Close search">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="overflow-y-auto p-1">
              {terms.length === 0 && (
                <p className="px-3 py-6 text-sm text-muted-foreground">
                  Search everyone — personal contacts and leads — by any detail on their profile.
                </p>
              )}

              {terms.length > 0 && visible.length === 0 && (
                <p className="px-3 py-6 text-sm text-muted-foreground">No matches for “{query.trim()}”.</p>
              )}

              {visible.map((result, i) => {
                const reasons = result.matches.filter((m) => m.label !== "Name").slice(0, MAX_REASONS);

                return (
                  <button
                    key={result.person.id}
                    ref={(el) => {
                      itemRefs.current[i] = el;
                    }}
                    type="button"
                    onClick={() => select(result)}
                    onMouseMove={() => setActiveIndex(i)}
                    className={cn(
                      "w-full text-left rounded-md px-2 py-2 flex items-start gap-3",
                      i === activeIndex ? "bg-accent text-accent-foreground" : "hover-elevate",
                    )}
                  >
                    <PersonAvatar name={result.person.name} photoUrl={result.person.photoUrl} className="h-8 w-8" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">
                          <Highlight text={result.person.name} terms={terms} />
                        </span>
                        <Badge variant={result.lead ? "default" : "secondary"} className="shrink-0">
                          {result.lead ? `Lead · ${result.stageLabel}` : RELATIONSHIP_TIER_LABELS[result.person.relationshipTier]}
                        </Badge>
                      </div>

                      {subtitle(result.person) && (
                        <div className="text-sm text-muted-foreground truncate">
                          <Highlight text={subtitle(result.person)} terms={terms} />
                        </div>
                      )}

                      {reasons.length > 0 && (
                        <div className="text-xs text-muted-foreground truncate">
                          {reasons.map((reason, ri) => (
                            <span key={`${reason.label}-${ri}`}>
                              {ri > 0 && " · "}
                              {reason.label}: <Highlight text={reason.value} terms={terms} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              {results.length > visible.length && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  Showing {visible.length} of {results.length} — keep typing to narrow it down.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
