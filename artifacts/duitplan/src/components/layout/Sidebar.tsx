import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Menu, X, LayoutDashboard, Receipt, PieChart, CalendarDays, Wallet, Upload, Lightbulb, Settings, Trophy, Target, TrendingUp, ScanLine, Building2, Bot, HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { key: "duitplanAi", href: "/agent", icon: Bot },
  { key: "expenseTracker", href: "/expenses", icon: ScanLine },
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "accounts", href: "/accounts", icon: Building2 },
  { key: "transactions", href: "/transactions", icon: Receipt },
  { key: "budgets", href: "/budgets", icon: PieChart },
  { key: "commitments", href: "/commitments", icon: CalendarDays },
  { key: "debts", href: "/debts", icon: Wallet },
  { key: "goals", href: "/goals", icon: Target },
  { key: "zakat", href: "/zakat", icon: HandCoins },
  { key: "netWorth", href: "/net-worth", icon: TrendingUp },
  { key: "upload", href: "/upload", icon: Upload },
  { key: "insights", href: "/insights", icon: Lightbulb },
  { key: "achievements", href: "/achievements", icon: Trophy },
  { key: "settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-background">
        <Link href="/dashboard" className="text-xl font-bold text-primary">DuitPlan</Link>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:flex",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 hidden md:block">
          <Link href="/dashboard" className="text-2xl font-bold text-primary">DuitPlan</Link>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {t(`nav.${item.key}`)}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-sidebar-foreground truncate max-w-[150px]">{user?.profile?.fullName || user?.email}</span>
              <span className="text-xs text-sidebar-foreground/70 truncate max-w-[150px]">{user?.email}</span>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start" onClick={() => logout()}>
            {t('auth.signOut')}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
    </>
  );
}
