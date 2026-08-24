import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StageConfig } from "@shared/schema";

const EMPTY: StageConfig[] = [];

export function useStageConfigs() {
  const { data, isLoading } = useQuery<StageConfig[]>({ queryKey: ["/api/stages"] });
  const stages = data ?? EMPTY;

  // Memoized on `stages` (stable across renders once react-query's cached
  // data reference stops changing) — without this, consumers that use
  // `stages`/`activeKeys` as a useEffect dependency re-fire every render.
  return useMemo(() => {
    const byKey = new Map(stages.map((s) => [s.key, s]));
    return {
      stages,
      isLoading,
      byKey,
      activeKeys: new Set(stages.filter((s) => s.isActive).map((s) => s.key)),
      label: (key: string) => byKey.get(key)?.label ?? key,
    };
  }, [stages, isLoading]);
}
