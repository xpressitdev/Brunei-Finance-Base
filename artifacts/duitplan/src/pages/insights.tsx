import { useState } from "react";
import { format } from "date-fns";
import { useListInsights, useGenerateInsights } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lightbulb, Info, AlertTriangle, CheckCircle, Sparkles } from "lucide-react";

export default function Insights() {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [month, setMonth] = useState(currentMonth);

  const { data: insights, isLoading, refetch } = useListInsights({ month });
  const generateMutation = useGenerateInsights();

  const handleGenerate = async () => {
    await generateMutation.mutateAsync({ data: { month } });
    refetch();
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'warning': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-primary" />;
      case 'info':
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Insights</h1>
          <p className="text-muted-foreground">Smart observations about your spending habits.</p>
        </div>
        <div className="flex items-center gap-4">
          <Input 
            type="month" 
            value={month} 
            onChange={(e) => setMonth(e.target.value)} 
            className="w-48 bg-white"
          />
          <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
            <Sparkles className="w-4 h-4 mr-2" />
            {generateMutation.isPending ? "Analyzing..." : "Generate Insights"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Analyzing your data...</div>
      ) : (!insights || insights.length === 0) ? (
        <div className="bg-white border rounded-xl p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Lightbulb className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No insights yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            We need more transaction data for this month to generate meaningful insights. Add some transactions and try again.
          </p>
          <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
            Generate Now
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {insights.map((insight) => (
            <Card key={insight.id} className={`border-l-4 ${
              insight.severity === 'warning' ? 'border-l-orange-500' :
              insight.severity === 'success' ? 'border-l-primary' :
              'border-l-blue-500'
            }`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {getIcon(insight.severity)}
                  {insight.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{insight.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
