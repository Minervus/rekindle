import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { getToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { ReconnectSuggestion } from "@shared/schema";

export default function SuggestionPanel({ personId }: { personId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: latest, isLoading } = useQuery<ReconnectSuggestion | null>({
    queryKey: ["/api/people", personId, "suggestions", "latest"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch(`/api/people/${personId}/suggestions/latest`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/people/${personId}/suggestions`);
      return res.json() as Promise<ReconnectSuggestion>;
    },
    onSuccess: (suggestion) => {
      queryClient.setQueryData(["/api/people", personId, "suggestions", "latest"], suggestion);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Couldn't generate suggestions", description: err.message });
    },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Reconnect suggestions</CardTitle>
        <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? "Generating..." : latest ? "Regenerate" : "Generate"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Skeleton className="h-20 w-full" />}
        {!isLoading && !latest && !generate.isPending && (
          <p className="text-sm text-muted-foreground">No suggestions yet — generate some based on your interaction history.</p>
        )}
        {latest && (
          <div className="space-y-3">
            <p className="text-sm italic">&ldquo;{latest.openingLine}&rdquo;</p>
            <ul className="space-y-2">
              {latest.talkingPoints.map((tp, i) => (
                <li key={i} className="text-sm">
                  <span>{tp.point}</span>
                  {tp.basedOn && <span className="block text-xs text-muted-foreground">Based on: {tp.basedOn}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
