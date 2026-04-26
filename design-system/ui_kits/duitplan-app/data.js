// Seed data for the UI kit demo. All values are made-up but plausible
// for a Brunei salaried professional matching the founder profile.

const fmtBND = (v) => `BND ${Number(v).toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const data = {
  user: {
    firstName: "Hakem",
    fullName: "Pengiran Abdul Hakem",
    email: "hakem@duitplan.com",
    region: "BN",
    payday: 25,
  },

  summary: {
    monthlyIncome: 4250,
    actualIncomeThisMonth: 4250,
    totalCommitments: 1180,
    totalDebtMonthlyPayment: 1820.5,
    totalDebtPayments: 1820.5,
    totalSpent: 612.4,
    remaining: 637.1,
    debtToIncomeRatio: 42.8,
  },

  accounts: [
    { id: "a1", name: "BIBD Personal Savings",  bank: "BIBD",     balance: 8420.55, type: "savings" },
    { id: "a2", name: "BIBD Salary Account",    bank: "BIBD",     balance: 1289.5,  type: "current" },
    { id: "a3", name: "Baiduri Visa",           bank: "Baiduri",  balance: -612.40, type: "credit"  },
    { id: "a4", name: "Cash Wallet",            bank: "Cash",     balance: 110.0,   type: "wallet"  },
  ],

  spending: [
    { categoryName: "Groceries",  totalSpent: 240.10, color: "hsl(162 70% 40%)" },
    { categoryName: "Transport",  totalSpent: 132.50, color: "hsl(175 60% 45%)" },
    { categoryName: "Eating out", totalSpent: 118.40, color: "hsl(150 50% 50%)" },
    { categoryName: "Utilities",  totalSpent:  76.20, color: "hsl(190 60% 40%)" },
    { categoryName: "Other",      totalSpent:  45.20, color: "hsl(140 40% 60%)" },
  ],

  recentTransactions: [
    { id: "t1", description: "Hari Gaji — April",       date: "2026-04-25", type: "credit", amount: 4250.00, categoryName: "Salary",     accountName: "BIBD" },
    { id: "t2", description: "Shell — Petrol Tutong",   date: "2026-04-24", type: "debit",  amount:   48.50, categoryName: "Transport",  accountName: "BIBD" },
    { id: "t3", description: "Hua Ho Mata-Mata",        date: "2026-04-23", type: "debit",  amount:  132.40, categoryName: "Groceries",  accountName: "Baiduri" },
    { id: "t4", description: "Kopi Mam — Gadong",       date: "2026-04-22", type: "debit",  amount:   12.80, categoryName: "Eating out", accountName: "Baiduri" },
    { id: "t5", description: "DST monthly bill",        date: "2026-04-21", type: "debit",  amount:   38.00, categoryName: "Utilities",  accountName: "BIBD" },
    { id: "t6", description: "Personal Loan — auto",    date: "2026-04-25", type: "debit",  amount:  420.00, categoryName: "Loan",       accountName: "BIBD" },
  ],

  commitments: [
    { id: "c1", name: "Rent — Beribi",   amount: 600,  category: "Housing"   },
    { id: "c2", name: "DST + Internet",  amount: 95,   category: "Utilities" },
    { id: "c3", name: "Family support",  amount: 350,  category: "Family"    },
    { id: "c4", name: "Insurance",       amount: 135,  category: "Insurance" },
  ],

  debts: [
    { id: "d1", name: "Toyota Hilux car loan", balance: 18420, monthlyPayment: 580.50, rate: 4.2, lender: "BIBD",    progress: 0.42 },
    { id: "d2", name: "House financing",       balance: 142000,monthlyPayment: 920.00, rate: 3.8, lender: "Baiduri", progress: 0.18 },
    { id: "d3", name: "Personal loan",         balance: 4200,  monthlyPayment: 320.00, rate: 6.0, lender: "BIBD",    progress: 0.65 },
  ],

  budgets: [
    { id: "b1", category: "Groceries",  spent: 240, planned: 600, color: "ok"     },
    { id: "b2", category: "Eating out", spent: 320, planned: 400, color: "warn"   },
    { id: "b3", category: "Transport",  spent: 580, planned: 500, color: "danger" },
    { id: "b4", category: "Shopping",   spent:  60, planned: 200, color: "ok"     },
    { id: "b5", category: "Health",     spent:   0, planned: 100, color: "ok"     },
    { id: "b6", category: "Family",     spent: 280, planned: 350, color: "ok"     },
  ],

  goals: [
    { id: "g1", name: "Umrah 2027",         target: 12000, saved: 3450, deadline: "2027-09" },
    { id: "g2", name: "Emergency fund",      target:  9000, saved: 6200, deadline: "2026-12" },
    { id: "g3", name: "Kids' education",     target: 25000, saved: 4100, deadline: "2030-01" },
  ],
};

window.duitplanData = data;
window.fmtBND = fmtBND;
