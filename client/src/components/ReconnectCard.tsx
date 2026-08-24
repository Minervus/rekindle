import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PersonAvatar from "@/components/PersonAvatar";
import { RELATIONSHIP_TIER_LABELS } from "@shared/relationshipTiers";
import type { Person } from "@shared/schema";

export default function ReconnectCard({ person, daysOverdue }: { person: Person; daysOverdue: number }) {
  return (
    <Link href={`/people/${person.id}`}>
      <Card className="hover-elevate cursor-pointer">
        <CardContent className="py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <PersonAvatar name={person.name} photoUrl={person.photoUrl} />
            <div>
              <div className="font-medium">{person.name}</div>
              <div className="text-sm text-muted-foreground">
                {daysOverdue === 0 ? "Due today" : `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`}
              </div>
            </div>
          </div>
          <Badge variant="secondary">{RELATIONSHIP_TIER_LABELS[person.relationshipTier]}</Badge>
        </CardContent>
      </Card>
    </Link>
  );
}
