import { useListSubscriptionPlans } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Star } from "lucide-react";

export default function Premium() {
  const { data: plans, isLoading } = useListSubscriptionPlans();

  if (isLoading) return <div className="p-8">Loading plans...</div>;

  return (
    <div className="space-y-12 max-w-5xl mx-auto animate-in fade-in duration-500 py-8">
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Star className="w-8 h-8 fill-primary" />
        </div>
        <h1 className="text-4xl font-bold text-foreground tracking-tight">Upgrade to DuitPlan Premium</h1>
        <p className="text-lg text-muted-foreground">Unlock advanced insights, unlimited document parsing, and more powerful debt simulators.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <Card className="border-muted bg-white/50">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-xl">Basic</CardTitle>
            <CardDescription>For simple budgeting</CardDescription>
            <div className="mt-6 flex items-baseline justify-center gap-x-2">
              <span className="text-5xl font-bold tracking-tight text-foreground">$0</span>
              <span className="text-sm font-semibold leading-6 text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4 text-sm leading-6 text-muted-foreground">
              <li className="flex gap-x-3">
                <Check className="h-6 w-5 flex-none text-primary" />
                Manual transaction entry
              </li>
              <li className="flex gap-x-3">
                <Check className="h-6 w-5 flex-none text-primary" />
                Basic monthly budgeting
              </li>
              <li className="flex gap-x-3">
                <Check className="h-6 w-5 flex-none text-primary" />
                Track up to 3 debts
              </li>
              <li className="flex gap-x-3">
                <Check className="h-6 w-5 flex-none text-primary" />
                1 Statement upload per month
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" disabled>Current Plan</Button>
          </CardFooter>
        </Card>

        <Card className="border-primary shadow-xl relative">
          <div className="absolute -top-4 left-0 right-0 flex justify-center">
            <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Most Popular
            </span>
          </div>
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-xl text-primary">Premium</CardTitle>
            <CardDescription>For serious financial planning</CardDescription>
            <div className="mt-6 flex items-baseline justify-center gap-x-2">
              <span className="text-5xl font-bold tracking-tight text-foreground">$4.99</span>
              <span className="text-sm font-semibold leading-6 text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4 text-sm leading-6 text-muted-foreground">
              <li className="flex gap-x-3">
                <Check className="h-6 w-5 flex-none text-primary" />
                <span className="text-foreground font-medium">Unlimited</span> statement uploads
              </li>
              <li className="flex gap-x-3">
                <Check className="h-6 w-5 flex-none text-primary" />
                AI-driven financial insights
              </li>
              <li className="flex gap-x-3">
                <Check className="h-6 w-5 flex-none text-primary" />
                Advanced debt payoff simulator
              </li>
              <li className="flex gap-x-3">
                <Check className="h-6 w-5 flex-none text-primary" />
                Custom categories and rules
              </li>
              <li className="flex gap-x-3">
                <Check className="h-6 w-5 flex-none text-primary" />
                Priority support
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Upgrade Now</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
