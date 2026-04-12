import React, { useState } from "react";
import { ChevronLeft, ChevronRight, ArrowDown, Wallet, CreditCard, PieChart, Droplets, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Hardcoded Data
const DATA = {
  user: "Hakem Shah",
  salary: 3500.00,
  payday: "25th",
  month: "April 2026",
  fixed: [
    { name: "Car Loan", amount: 450.00 },
    { name: "Housing Loan", amount: 380.00 },
    { name: "OGDC Electricity", amount: 95.00 },
    { name: "DST Postpaid", amount: 45.00 },
    { name: "DST Broadband", amount: 58.00 },
    { name: "School Fees", amount: 120.00 },
    { name: "Gym Membership", amount: 55.00 },
    { name: "Netflix", amount: 22.00 },
  ],
  variable: [
    { name: "Food & Dining", amount: 350.00 },
    { name: "Transport", amount: 100.00 },
    { name: "Groceries", amount: 200.00 },
    { name: "Entertainment", amount: 80.00 },
    { name: "Clothing", amount: 50.00 },
    { name: "Health", amount: 75.00 },
    { name: "Personal Care", amount: 40.00 },
    { name: "Miscellaneous", amount: 60.00 },
  ]
};

const formatBND = (amount: number) => {
  return `BND ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function WaterfallFlow() {
  const [mode, setMode] = useState<"plan" | "actual">("plan");

  const totalFixed = DATA.fixed.reduce((sum, item) => sum + item.amount, 0);
  const totalVariable = DATA.variable.reduce((sum, item) => sum + item.amount, 0);
  const availablePool = DATA.salary - totalFixed - totalVariable; // 3500 - 1225 - 955 = 1320

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-50 font-sans selection:bg-neutral-700">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-10 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-neutral-100">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium text-sm tracking-wide uppercase">{DATA.month}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-neutral-100">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex bg-neutral-800 p-1 rounded-lg">
          <button
            onClick={() => setMode("plan")}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === "plan" ? "bg-neutral-600 text-white shadow-sm" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Plan
          </button>
          <button
            onClick={() => setMode("actual")}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === "actual" ? "bg-neutral-600 text-white shadow-sm" : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Actual
          </button>
        </div>
      </header>

      <main className="pb-24 flex flex-col items-center">
        {/* Intro */}
        <div className="w-full max-w-2xl px-6 py-8 text-center">
          <h1 className="text-2xl font-light text-neutral-300">Cash Flow Plan</h1>
          <p className="text-neutral-500 text-sm mt-1">Watch your money cascade.</p>
        </div>

        {/* --- STAGE 1: INCOME --- */}
        <section className="w-full bg-green-600 relative z-10 py-12 px-6 flex flex-col items-center justify-center text-center shadow-[0_10px_40px_-10px_rgba(22,163,74,0.4)]">
          <div className="flex items-center gap-2 text-green-100 mb-2 uppercase tracking-widest text-xs font-semibold">
            <Wallet className="w-4 h-4" />
            <span>Monthly Income</span>
          </div>
          <div className="text-5xl md:text-6xl font-light tracking-tight text-white mb-2">
            {formatBND(DATA.salary)}
          </div>
          <div className="text-green-200 text-sm font-medium">
            Payday: {DATA.payday}
          </div>
        </section>

        {/* Connector */}
        <div className="relative w-full h-16 flex justify-center items-center -my-2 z-20 pointer-events-none">
          <div className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center border-4 border-green-600 shadow-lg">
            <ArrowDown className="w-5 h-5 text-green-500 animate-bounce" />
          </div>
        </div>

        {/* --- STAGE 2: FIXED COMMITMENTS --- */}
        <section className="w-full bg-orange-500 relative z-10 py-12 px-6 flex flex-col items-center justify-center text-center shadow-[0_10px_40px_-10px_rgba(249,115,22,0.4)]">
           <div className="flex items-center gap-2 text-orange-100 mb-2 uppercase tracking-widest text-xs font-semibold">
            <CreditCard className="w-4 h-4" />
            <span>Fixed Commitments</span>
          </div>
          <div className="text-4xl md:text-5xl font-light tracking-tight text-white mb-6">
            -{formatBND(totalFixed)}
          </div>
          
          <div className="w-full max-w-3xl flex flex-wrap justify-center gap-2 md:gap-3">
            {DATA.fixed.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-black/15 hover:bg-black/25 transition-colors rounded-full px-4 py-2 border border-orange-400/30 backdrop-blur-sm">
                <span className="text-orange-50 font-medium text-sm">{item.name}</span>
                <span className="text-orange-200 text-xs">{formatBND(item.amount)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Connector */}
        <div className="relative w-full h-16 flex justify-center items-center -my-2 z-20 pointer-events-none">
          <div className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center border-4 border-orange-500 shadow-lg">
            <ArrowDown className="w-5 h-5 text-orange-500 animate-bounce" />
          </div>
        </div>

        {/* --- STAGE 3: VARIABLE BUDGET --- */}
        <section className="w-full bg-blue-600 relative z-10 py-12 px-6 flex flex-col items-center justify-center text-center shadow-[0_10px_40px_-10px_rgba(37,99,235,0.4)]">
           <div className="flex items-center gap-2 text-blue-100 mb-2 uppercase tracking-widest text-xs font-semibold">
            <PieChart className="w-4 h-4" />
            <span>Variable Budget</span>
          </div>
          <div className="text-4xl md:text-5xl font-light tracking-tight text-white mb-6">
            -{formatBND(totalVariable)}
          </div>
          
          <div className="w-full max-w-3xl flex flex-wrap justify-center gap-2 md:gap-3">
            {DATA.variable.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-black/15 hover:bg-black/25 transition-colors rounded-full px-4 py-2 border border-blue-400/30 backdrop-blur-sm cursor-pointer group">
                <span className="text-blue-50 font-medium text-sm group-hover:text-white transition-colors">{item.name}</span>
                <span className="text-blue-200 text-xs bg-black/20 px-2 py-0.5 rounded-full">{formatBND(item.amount)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Connector */}
        <div className="relative w-full h-16 flex justify-center items-center -my-2 z-20 pointer-events-none">
          <div className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center border-4 border-blue-600 shadow-lg">
            <ArrowDown className="w-5 h-5 text-blue-500 animate-bounce" />
          </div>
        </div>

        {/* --- STAGE 4: POOL --- */}
        <section className="w-full bg-emerald-500 relative z-10 py-16 px-6 flex flex-col items-center justify-center text-center shadow-[0_-10px_40px_-10px_rgba(16,185,129,0.3)]">
           <div className="flex items-center gap-2 text-emerald-100 mb-2 uppercase tracking-widest text-xs font-semibold">
            <Droplets className="w-4 h-4" />
            <span>Available Pool</span>
          </div>
          <div className="text-6xl md:text-7xl font-light tracking-tight text-white mb-4 drop-shadow-sm">
            {formatBND(availablePool)}
          </div>
          <div className="flex items-center gap-2 text-emerald-100 text-sm font-medium bg-black/10 px-4 py-2 rounded-full border border-emerald-400/30">
            <CheckCircle2 className="w-4 h-4" />
            <span>Safe to spend or save</span>
          </div>
        </section>
      </main>
    </div>
  );
}
