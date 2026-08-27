import { useQuery } from "@tanstack/react-query";
import type { AppSettings } from "@shared/schema";

/**
 * Whether the lead pipeline is switched on (Settings → Lead pipeline).
 *
 * Defaults to `false` while settings are in flight rather than `true`: the
 * pipeline is the bigger, noisier surface, so flashing it up for a beat and
 * then tearing it away is worse than showing it a moment late. `isReady`
 * lets callers tell "off" apart from "not known yet" when that matters.
 */
export function useLeadsEnabled(): { enabled: boolean; isReady: boolean } {
  const { data: settings } = useQuery<AppSettings>({ queryKey: ["/api/settings"] });
  return { enabled: settings?.showLeads ?? false, isReady: settings !== undefined };
}
