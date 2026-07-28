import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { DevRegionProvider } from "@/lib/devRegion";
import { DevRegionIndicator } from "@/components/DevRegionIndicator";
import { I18nProvider } from "@/i18n/I18nProvider";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { MigrationNoticeBanner } from "@/components/MigrationNoticeBanner";

// Pages
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import MagicLinkSent from "@/pages/magic-link-sent";
import VerifyEmail from "@/pages/verify-email";
import Onboarding from "@/pages/onboarding";
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Budgets from "@/pages/budgets";
import Categories from "@/pages/categories";
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
import AgentPage from "@/pages/agent";
import ZakatPage from "@/pages/zakat";
import IncomeSourcesPage from "@/pages/income-sources";
import PrivacyPage from "@/pages/privacy";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/magic-link-sent" component={MagicLinkSent} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/privacy" component={PrivacyPage} />
      
      {/* Old payment return pages — app is free now */}
      <Route path="/subscription/success"><Redirect to="/dashboard" /></Route>
      <Route path="/subscription/failed"><Redirect to="/dashboard" /></Route>

      {/* Protected Routes inside AppLayout */}
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/transactions" component={Transactions} />
      <ProtectedRoute path="/budgets" component={Budgets} />
      <ProtectedRoute path="/categories" component={Categories} />
      {/* Commitments collapsed into Budgets per Claude Design redesign */}
      <Route path="/commitments"><Redirect to="/budgets" /></Route>
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
      <ProtectedRoute path="/income-sources" component={IncomeSourcesPage} />
      
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
                <MigrationNoticeBanner />
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
