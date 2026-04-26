import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SubscriptionProvider } from "@/lib/subscription";
import { AppLayout } from "@/components/layout/AppLayout";
import { DevRegionProvider } from "@/lib/devRegion";
import { DevRegionIndicator } from "@/components/DevRegionIndicator";
import { I18nProvider } from "@/i18n/I18nProvider";
import { FeedbackWidget } from "@/components/FeedbackWidget";

// Pages
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Onboarding from "@/pages/onboarding";
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Budgets from "@/pages/budgets";
import Commitments from "@/pages/commitments";
import Debts from "@/pages/debts";
import DebtDetail from "@/pages/debts/[id]";
import Upload from "@/pages/upload";
import ReviewImport from "@/pages/review";
import Insights from "@/pages/insights";
import Settings from "@/pages/settings";
import Achievements from "@/pages/achievements";
import Goals from "@/pages/goals";
import NetWorth from "@/pages/net-worth";
import Expenses from "@/pages/expenses";
import AccountsPage from "@/pages/accounts";
import SubscriptionSuccess from "@/pages/subscription/success";
import SubscriptionFailed from "@/pages/subscription/failed";
import AgentPage from "@/pages/agent";
import ZakatPage from "@/pages/zakat";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen bg-background" />;
  if (!user) return null; // AuthProvider will redirect to /login

  return (
    <Route {...rest}>
      <AppLayout>
        <Component />
      </AppLayout>
    </Route>
  );
}

function SubscriptionCallbackRoute({ component: Component, path }: { component: React.ComponentType; path: string }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen bg-background" />;
  if (!user) return null;

  return (
    <Route path={path}>
      <SubscriptionProvider>
        <Component />
      </SubscriptionProvider>
    </Route>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/onboarding" component={Onboarding} />
      
      {/* Payment return pages */}
      <SubscriptionCallbackRoute path="/subscription/success" component={SubscriptionSuccess} />
      <SubscriptionCallbackRoute path="/subscription/failed" component={SubscriptionFailed} />

      {/* Protected Routes inside AppLayout */}
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/transactions" component={Transactions} />
      <ProtectedRoute path="/budgets" component={Budgets} />
      <ProtectedRoute path="/commitments" component={Commitments} />
      <ProtectedRoute path="/debts" component={Debts} />
      <ProtectedRoute path="/debts/:id" component={DebtDetail} />
      <ProtectedRoute path="/upload" component={Upload} />
      <ProtectedRoute path="/upload/:id/review" component={ReviewImport} />
      <ProtectedRoute path="/insights" component={Insights} />
      <ProtectedRoute path="/settings" component={Settings} />
      <Route path="/premium"><Redirect to="/dashboard" /></Route>
      <ProtectedRoute path="/achievements" component={Achievements} />
      <ProtectedRoute path="/goals" component={Goals} />
      <ProtectedRoute path="/net-worth" component={NetWorth} />
      <ProtectedRoute path="/expenses" component={Expenses} />
      <ProtectedRoute path="/accounts" component={AccountsPage} />
      <ProtectedRoute path="/agent" component={AgentPage} />
      <ProtectedRoute path="/zakat" component={ZakatPage} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DevRegionProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <I18nProvider>
                <Router />
                <FeedbackWidget />
              </I18nProvider>
            </AuthProvider>
          </WouterRouter>
          <Toaster />
          <DevRegionIndicator />
        </DevRegionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
