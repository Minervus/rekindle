import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const logout = useLogout();

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={cn(
        "text-sm font-medium px-3 py-1.5 rounded-md hover-elevate",
        location === href ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold">
            Rekindle
          </Link>
          <nav className="flex items-center gap-1">
            {navLink("/", "Dashboard")}
            {navLink("/people", "People")}
            <Button variant="ghost" size="sm" onClick={logout}>
              Log out
            </Button>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
