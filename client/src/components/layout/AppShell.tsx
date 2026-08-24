import { Link, useLocation } from "wouter";
import { Flame, LayoutDashboard, LogOut, Settings, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlobalSearch from "@/components/GlobalSearch";
import ThemeToggle from "@/components/ThemeToggle";
import { useLogout } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/people", label: "People", icon: Users },
  { href: "/leads", label: "Leads", icon: Flame },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto flex items-center gap-2 px-4 py-3">
          <Link href="/" className="font-semibold shrink-0">
            Rekindle
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <GlobalSearch />

            {/* Labels collapse below `sm` so four items plus search still fit
                on a phone — the icon carries the meaning there. */}
            <nav className="flex items-center gap-0.5">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-label={label}
                  aria-current={location === href ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-medium rounded-md hover-elevate px-2 py-1.5 sm:px-3",
                    location === href ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              ))}
            </nav>

            <ThemeToggle />

            <Button variant="ghost" size="icon" onClick={logout} title="Log out" aria-label="Log out">
              <LogOut />
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
