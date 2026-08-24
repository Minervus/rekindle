import { useEffect } from "react";
import { useLocation } from "wouter";
import { useSession } from "@/hooks/useAuth";
import { getToken } from "@/lib/auth";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useSession();
  const [, navigate] = useLocation();

  const authenticated = !!getToken() && data?.authenticated;

  useEffect(() => {
    if (!isLoading && !authenticated) {
      navigate("/login");
    }
  }, [isLoading, authenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return <>{children}</>;
}
