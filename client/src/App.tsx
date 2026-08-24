import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import People from "@/pages/People";
import PersonDetail from "@/pages/PersonDetail";
import Leads from "@/pages/Leads";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

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
            <Leads />
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
      <Toaster />
      <Router />
    </QueryClientProvider>
  );
}

export default App;
