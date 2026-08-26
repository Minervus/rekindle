import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import PersonAvatar from "@/components/PersonAvatar";
import WarmthMeter from "@/components/WarmthMeter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  RELATIONSHIP_TIERS,
  RELATIONSHIP_TIER_LABELS,
  computeNextReconnectAt,
  computeDaysOverdue,
  reconnectIntervalsFrom,
  type RelationshipTier,
} from "@shared/relationshipTiers";
import { matchSearchFields, personSearchFields, searchTerms, type SearchField } from "@shared/personSearch";
import type { AppSettings, Person } from "@shared/schema";
import type { Warmth } from "@shared/warmth";

// Fields already visible on the row — repeating them as a "why this
// matched" line would just be noise.
const IMPLICIT_FIELDS = new Set(["Name", "Role", "Company", "Location", "Tier"]);

// Sentinels for the location dropdown. Prefixed with a NUL so they can't
// collide with a real place name, and non-empty because Radix's Select
// rejects "" as an item value.
const ANY_LOCATION = "\u0000any";
const NO_LOCATION = "\u0000none";

// Location is free text, so "Sydney" and "sydney" are the same place typed
// twice. Group case-insensitively and display whichever spelling turns up
// first rather than inventing a canonical one.
function locationKey(location: string | null): string {
  const trimmed = location?.trim();
  return trimmed ? trimmed.toLowerCase() : NO_LOCATION;
}

export default function People() {
  const [search, setSearch] = useState("");
  // null = every tier. Narrowing by tier is the one filter that maps onto how
  // often you're meant to reach out, so it earns a permanent control here.
  const [tier, setTier] = useState<RelationshipTier | null>(null);
  // A location key (lowercased), NO_LOCATION for people with none, or
  // ANY_LOCATION for no filter.
  const [location, setLocation] = useState<string>(ANY_LOCATION);

  const { data: people, isLoading } = useQuery<(Person & { warmth: Warmth })[]>({ queryKey: ["/api/people"] });
  // Falls back to the defaults until settings land, so the overdue dots show
  // the stock cadence for a beat rather than nothing at all.
  const { data: settings } = useQuery<AppSettings>({ queryKey: ["/api/settings"] });
  const intervals = reconnectIntervalsFrom(settings);

  // Matches any field on the profile, not just the name — see
  // shared/personSearch.ts, which the header's global search also uses.
  const searchMatched = useMemo(() => {
    const terms = searchTerms(search);
    const out: { person: Person & { warmth: Warmth }; reasons: SearchField[] }[] = [];

    for (const person of people ?? []) {
      const matches = matchSearchFields(personSearchFields(person), terms);
      if (!matches) continue;
      out.push({ person, reasons: matches.filter((m) => !IMPLICIT_FIELDS.has(m.label)) });
    }

    return out;
  }, [people, search]);

  const matchesTier = (person: Person) => !tier || person.relationshipTier === tier;
  const matchesLocation = (person: Person) => location === ANY_LOCATION || locationKey(person.location) === location;

  const filtered = useMemo(
    () => searchMatched.filter(({ person }) => matchesTier(person) && matchesLocation(person)),
    [searchMatched, tier, location],
  );

  // Faceted counts: each control is counted against everything *except*
  // itself, so the numbers show what you'd get by switching to that option
  // rather than every other one collapsing to zero the moment you pick one.
  const tierCounts = useMemo(() => {
    const counts = new Map<RelationshipTier, number>();
    for (const { person } of searchMatched) {
      if (!matchesLocation(person)) continue;
      counts.set(person.relationshipTier, (counts.get(person.relationshipTier) ?? 0) + 1);
    }
    return counts;
  }, [searchMatched, location]);

  // Built from everyone, not the filtered set, so a key always has a display
  // spelling even when nothing currently matches it.
  const locationLabels = useMemo(() => {
    const labels = new Map<string, string>([[NO_LOCATION, "No location set"]]);
    for (const person of people ?? []) {
      const key = locationKey(person.location);
      if (key !== NO_LOCATION && !labels.has(key)) labels.set(key, person.location!.trim());
    }
    return labels;
  }, [people]);

  const locationOptions = useMemo(() => {
    const counts = new Map<string, number>();

    for (const { person } of searchMatched) {
      if (!matchesTier(person)) continue;
      const key = locationKey(person.location);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    // The selected place stays listed at zero rather than disappearing —
    // dropping it would leave the trigger rendering a value with no matching
    // item, i.e. blank.
    if (location !== ANY_LOCATION && !counts.has(location)) counts.set(location, 0);

    const options = Array.from(counts, ([key, count]) => ({ key, label: locationLabels.get(key) ?? key, count }));

    // Unset last, real places alphabetically — a long list is scanned by
    // name, not by popularity.
    const none = options.find((o) => o.key === NO_LOCATION);
    const places = options.filter((o) => o.key !== NO_LOCATION).sort((a, b) => a.label.localeCompare(b.label));
    return none ? [...places, none] : places;
  }, [searchMatched, tier, location, locationLabels]);

  const tierTotal = useMemo(() => searchMatched.filter(({ person }) => matchesLocation(person)).length, [searchMatched, location]);
  const filtersActive = tier !== null || location !== ANY_LOCATION;

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">People</h1>
      </div>

      <div className="relative mb-3 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search name, tag, company, location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <button
          type="button"
          onClick={() => setTier(null)}
          aria-pressed={tier === null}
          className={cn(
            "text-sm rounded-full border px-3 py-1",
            tier === null ? "bg-accent text-accent-foreground border-transparent" : "text-muted-foreground hover-elevate",
          )}
        >
          All
          <span className="text-xs text-muted-foreground ml-1.5 tabular-nums">{tierTotal}</span>
        </button>

        {RELATIONSHIP_TIERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTier((current) => (current === t ? null : t))}
            aria-pressed={tier === t}
            className={cn(
              "text-sm rounded-full border px-3 py-1",
              tier === t ? "bg-accent text-accent-foreground border-transparent" : "text-muted-foreground hover-elevate",
            )}
          >
            {RELATIONSHIP_TIER_LABELS[t]}
            <span className="text-xs text-muted-foreground ml-1.5 tabular-nums">{tierCounts.get(t) ?? 0}</span>
          </button>
        ))}

        {/* A dropdown rather than chips: tiers are three fixed values,
            locations are however many places your contacts live. */}
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="h-8 w-auto min-w-[11rem] rounded-full text-sm" aria-label="Filter by location">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_LOCATION}>All locations</SelectItem>
            {locationOptions.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label} ({option.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setTier(null);
              setLocation(ANY_LOCATION);
            }}
            className="text-sm text-muted-foreground rounded-full px-3 py-1 hover-elevate"
          >
            Clear
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {search.trim()
            ? `No one matches “${search.trim()}”${filtersActive ? " with those filters" : ""}.`
            : filtersActive
              ? "No one matches those filters."
              : "No one here yet."}
        </p>
      )}

      <div className="space-y-2">
        {filtered.map(({ person, reasons }) => {
          const nextReconnectAt = computeNextReconnectAt(
            person.lastInteractionAt ? new Date(person.lastInteractionAt) : null,
            new Date(person.createdAt),
            person.relationshipTier,
            intervals,
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
