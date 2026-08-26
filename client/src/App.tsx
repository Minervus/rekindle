import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/hooks/useTheme";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useLeadsEnabled } from "@/hooks/useLeadsEnabled";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import People from "@/pages/People";
import PersonDetail from "@/pages/PersonDetail";
import Leads from "@/pages/Leads";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

// Hiding the nav item isn't enough — a bookmark or a back button would
// still land on the pipeline. Held until settings load so a hard refresh on
// /leads doesn't bounce you off a page you're allowed to be on.
//
// Nested inside ProtectedRoute, not wrapped around it: /api/settings needs a
// token, so reading it before auth resolves would 401 on a logged-out visit
// and strand the page instead of sending it to the login screen.
function LeadsGate() {
  const { enabled, isReady } = useLeadsEnabled();
  if (!isReady) return null;
  if (!enabled) return <Redirect to="/" />;
  return <Leads />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/people">
        {() => (
          <ProtectedRoute>
            <People />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/people/:id">
        {(params) => (
          <ProtectedRoute>
            <PersonDetail id={params.id} />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/leads">
        {() => (
          <ProtectedRoute>
            <LeadsGate />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/settings">
        {() => (
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Toaster />
        <Router />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
