import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import AppShell from "@/components/layout/AppShell";
import ReconnectCard from "@/components/ReconnectCard";
import PipelineStrip from "@/components/PipelineStrip";
import UpcomingMilestones from "@/components/UpcomingMilestones";
import TopContactsCard from "@/components/TopContactsCard";
import { useLeadsEnabled } from "@/hooks/useLeadsEnabled";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Person } from "@shared/schema";
import type { Warmth } from "@shared/warmth";

interface DueContact {
  person: Person & { warmth: Warmth };
  nextReconnectAt: string;
  daysOverdue: number;
}

export default function Dashboard() {
  const { data: due, isLoading } = useQuery<DueContact[]>({ queryKey: ["/api/reminders/due"] });
  const { enabled: leadsEnabled } = useLeadsEnabled();

  return (
    <AppShell aside={<TopContactsCard />}>
      {leadsEnabled && <PipelineStrip />}

      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">Due for reconnect</h1>
        <Link href="/people">
          <Button variant="outline">View all people</Button>
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!isLoading && due?.length === 0 && <p className="text-muted-foreground text-sm">You're all caught up — no one's due for reconnect.</p>}

      <div className="space-y-2">
        {due?.map((entry) => (
          <ReconnectCard key={entry.person.id} person={entry.person} daysOverdue={entry.daysOverdue} />
        ))}
      </div>

      <div className="mt-6">
        <UpcomingMilestones />
      </div>
    </AppShell>
  );
}
