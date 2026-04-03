import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, PieChart, TrendingUp } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="px-6 py-4 flex items-center justify-between border-b bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl">D</div>
          <span className="text-xl font-bold text-foreground">DuitPlan</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" className="hidden sm:inline-flex">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button>Get Started</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="px-6 py-20 md:py-32 flex flex-col items-center text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6">
            Take control of your <span className="text-primary">salary</span>.
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl">
            A quiet, organized space to manage your money in Brunei. Track spending, plan budgets, and pay down debt without the stress.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-xl">
                Start Planning Free <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg rounded-xl bg-white">
                Sign In
              </Button>
            </Link>
          </div>
        </section>

        <section className="px-6 py-20 bg-muted/50 border-t">
          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl border shadow-sm flex flex-col items-start text-left">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Quiet Authority</h3>
              <p className="text-muted-foreground">Your financial companion that's always composed and organized. Never alarming.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl border shadow-sm flex flex-col items-start text-left">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                <PieChart className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Clear Budgeting</h3>
              <p className="text-muted-foreground">Allocate every dollar of your salary to categories that matter. See exactly where your money goes.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl border shadow-sm flex flex-col items-start text-left">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Debt Payoff</h3>
              <p className="text-muted-foreground">Simulate extra payments and see how much interest and time you can save on your loans.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t bg-white text-center text-muted-foreground">
        <p>Built for Brunei Professionals. &copy; {new Date().getFullYear()} DuitPlan.</p>
      </footer>
    </div>
  );
}
