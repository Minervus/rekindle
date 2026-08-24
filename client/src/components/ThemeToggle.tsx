import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";

// Header control: a plain light/dark flip. The three-way choice that
// includes "system" lives in Settings → Appearance.
export default function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const label = resolved === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button variant="ghost" size="icon" onClick={toggle} className={className} title={label} aria-label={label}>
      {resolved === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
