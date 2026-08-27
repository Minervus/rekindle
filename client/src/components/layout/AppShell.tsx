import { Link, useLocation } from "wouter";
import { Flame, LayoutDashboard, LogOut, Settings, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlobalSearch from "@/components/GlobalSearch";
import ThemeToggle from "@/components/ThemeToggle";
import QuickAdd from "@/components/QuickAdd";
import { useLogout } from "@/hooks/useAuth";
import { useLeadsEnabled } from "@/hooks/useLeadsEnabled";
import { cn } from "@/lib/utils";

// `leadsOnly` items disappear entirely when the pipeline is switched off in
// Settings — see useLeadsEnabled.
const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; leadsOnly?: boolean }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/people", label: "People", icon: Users },
  { href: "/leads", label: "Leads", icon: Flame, leadsOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  const [location] = useLocation();
  const logout = useLogout();
  const { enabled: leadsEnabled } = useLeadsEnabled();
  const navItems = NAV_ITEMS.filter((item) => !item.leadsOnly || leadsEnabled);

  // Pages with a side rail need room for it. 5xl rather than something
  // wider keeps the main column near its usual reading width once the rail
  // is subtracted, so moving between a railed page and a plain one is a
  // nudge rather than a jump. The header tracks the same width so the logo
  // and nav stay flush with the content edges either way.
  const container = aside ? "max-w-5xl" : "max-w-3xl";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className={cn(container, "mx-auto flex items-center gap-2 px-4 py-3")}>
          <Link href="/" className="font-semibold shrink-0">
            Rekindle
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <GlobalSearch />

            {/* Labels collapse below `sm` so four items plus search still fit
                on a phone — the icon carries the meaning there. */}
            <nav className="flex items-center gap-0.5">
              {navItems.map(({ href, label, icon: Icon }) => (
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
      <main className={cn(container, "mx-auto px-4 py-6")}>
        {aside ? (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-6 lg:items-start">
            <div className="min-w-0">{children}</div>
            {/* Below lg the rail drops under the main column rather than
                squeezing both — a 288px sidebar next to content doesn't fit
                a phone. Sticky above it so the standings stay in view while
                the reconnect list scrolls. */}
            <aside className="mt-6 lg:mt-0 lg:sticky lg:top-6">{aside}</aside>
          </div>
        ) : (
          children
        )}
      </main>

      <QuickAdd />
    </div>
  );
}
