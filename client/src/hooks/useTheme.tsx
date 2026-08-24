import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

// Shared with the pre-paint script in client/index.html — both read and
// write this key, so changing it means changing both.
export const THEME_STORAGE_KEY = "rekindle:theme";

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : "system";
  } catch {
    // Private-mode Safari and friends throw on localStorage access.
    return "system";
  }
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

interface ThemeContextValue {
  mode: ThemeMode;
  /** What `mode` actually renders as right now — "system" collapsed to one or the other. */
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  /** Flips to the opposite of what's currently on screen, leaving "system" behind. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemDark, setSystemDark] = useState(prefersDark);

  // Only matters while mode is "system", but the listener is cheap and
  // subscribing unconditionally keeps `systemDark` correct the moment the
  // user switches back to "system".
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved: "light" | "dark" = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    // Keeps native form controls, scrollbars and browser chrome in step with
    // the palette.
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const persist = useCallback((next: ThemeMode) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Non-fatal: the theme still applies for this session.
    }
  }, []);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      persist(next);
    },
    [persist],
  );

  const toggle = useCallback(() => {
    const next: ThemeMode = resolved === "dark" ? "light" : "dark";
    setModeState(next);
    persist(next);
  }, [resolved, persist]);

  const value = useMemo(() => ({ mode, resolved, setMode, toggle }), [mode, resolved, setMode, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
