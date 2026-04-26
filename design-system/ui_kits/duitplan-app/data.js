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
    { id: "a1", name: "BIBD Personal Savings",  bank: "BIBD",     last4: "4421", balance: 8420.55,  available: 8420.55, type: "savings", color: "#0a8a6e", trend: [7800, 7900, 8050, 8100, 8200, 8420], lastTx: "2026-04-25", txCount30d: 8 },
    { id: "a2", name: "BIBD Salary Account",    bank: "BIBD",     last4: "1108", balance: 1289.50,  available: 1289.50, type: "current", color: "#0a8a6e", trend: [200, 4450, 4100, 3200, 2100, 1289], lastTx: "2026-04-25", txCount30d: 24 },
    { id: "a3", name: "Baiduri Visa Platinum",  bank: "Baiduri",  last4: "8842", balance: -612.40,  available: 9387.60, limit: 10000, type: "credit", color: "#1f3a5f", trend: [-220, -310, -480, -520, -610, -612], lastTx: "2026-04-23", txCount30d: 14, dueDate: "2026-05-15" },
    { id: "a4", name: "Cash Wallet",            bank: "Cash",     last4: null,   balance: 110.00,   available: 110.00,  type: "wallet",  color: "#6b7280", trend: [180, 150, 220, 180, 140, 110], lastTx: "2026-04-22", txCount30d: 5 },
  ],

  spending: [
    { categoryName: "Groceries",  totalSpent: 240.10, color: "hsl(162 70% 40%)" },
    { categoryName: "Transport",  totalSpent: 132.50, color: "hsl(175 60% 45%)" },
    { categoryName: "Eating out", totalSpent: 118.40, color: "hsl(150 50% 50%)" },
    { categoryName: "Utilities",  totalSpent:  76.20, color: "hsl(190 60% 40%)" },
    { categoryName: "Other",      totalSpent:  45.20, color: "hsl(140 40% 60%)" },
  ],

  recentTransactions: [
    // April 2026 (current month)
    { id: "t1",  description: "Hari Gaji — April",         merchant: "BIBD Payroll",        date: "2026-04-25", type: "credit", amount: 4250.00, categoryName: "Salary",     accountName: "BIBD",    accountId: "a2", note: null },
    { id: "t2",  description: "Toyota Hilux loan",         merchant: "BIBD Auto Finance",   date: "2026-04-25", type: "debit",  amount:  580.50, categoryName: "Loan",       accountName: "BIBD",    accountId: "a2", note: "Auto-deducted on Hari Gaji", auto: true },
    { id: "t3",  description: "House financing",           merchant: "Baiduri Mortgage",    date: "2026-04-25", type: "debit",  amount:  920.00, categoryName: "Loan",       accountName: "Baiduri", accountId: "a3", note: "Auto-deducted on Hari Gaji", auto: true },
    { id: "t4",  description: "Shell — petrol",            merchant: "Shell Tutong",        date: "2026-04-24", type: "debit",  amount:   48.50, categoryName: "Transport",  accountName: "BIBD",    accountId: "a2", note: null },
    { id: "t5",  description: "Hua Ho Mata-Mata",          merchant: "Hua Ho Department",   date: "2026-04-23", type: "debit",  amount:  132.40, categoryName: "Groceries",  accountName: "Baiduri", accountId: "a3", note: "Weekly grocery run" },
    { id: "t6",  description: "Kopi Mam — Gadong",         merchant: "Kopi Mam",            date: "2026-04-22", type: "debit",  amount:   12.80, categoryName: "Eating out", accountName: "Baiduri", accountId: "a3", note: null },
    { id: "t7",  description: "DST monthly bill",          merchant: "DST",                 date: "2026-04-21", type: "debit",  amount:   38.00, categoryName: "Utilities",  accountName: "BIBD",    accountId: "a2", note: "Auto-pay", auto: true },
    { id: "t8",  description: "Excapade Sushi",            merchant: "Excapade",            date: "2026-04-20", type: "debit",  amount:   85.20, categoryName: "Eating out", accountName: "Baiduri", accountId: "a3", note: "Family dinner" },
    { id: "t9",  description: "Soon Lee Megamart",         merchant: "Soon Lee",            date: "2026-04-19", type: "debit",  amount:   67.30, categoryName: "Groceries",  accountName: "Baiduri", accountId: "a3", note: null },
    { id: "t10", description: "Grab — airport run",        merchant: "Grab",                date: "2026-04-18", type: "debit",  amount:   24.00, categoryName: "Transport",  accountName: "Baiduri", accountId: "a3", note: null },
    { id: "t11", description: "Chip Mong cafe",            merchant: "Chip Mong",           date: "2026-04-17", type: "debit",  amount:    8.50, categoryName: "Eating out", accountName: "Cash",    accountId: "a4", note: "Morning kopi" },
    { id: "t12", description: "Jollibee Times Square",     merchant: "Jollibee",            date: "2026-04-16", type: "debit",  amount:   28.40, categoryName: "Eating out", accountName: "Baiduri", accountId: "a3", note: null },
    { id: "t13", description: "Shell — petrol",            merchant: "Shell Berakas",       date: "2026-04-15", type: "debit",  amount:   42.00, categoryName: "Transport",  accountName: "BIBD",    accountId: "a2", note: null },
    { id: "t14", description: "PB Pharmacy",               merchant: "PB Pharmacy",         date: "2026-04-14", type: "debit",  amount:   23.50, categoryName: "Health",     accountName: "Baiduri", accountId: "a3", note: "Vitamins" },
    { id: "t15", description: "Refund — Lazada",           merchant: "Lazada",              date: "2026-04-13", type: "credit", amount:   45.00, categoryName: "Refund",     accountName: "Baiduri", accountId: "a3", note: "Wrong size returned" },
    { id: "t16", description: "Hua Ho Manggis",            merchant: "Hua Ho Department",   date: "2026-04-12", type: "debit",  amount:   88.20, categoryName: "Groceries",  accountName: "Baiduri", accountId: "a3", note: null },
    { id: "t17", description: "Kianggeh wet market",       merchant: "Kianggeh Market",     date: "2026-04-11", type: "debit",  amount:   34.50, categoryName: "Groceries",  accountName: "Cash",    accountId: "a4", note: "Fresh fish" },
    { id: "t18", description: "Family transfer — Mama",    merchant: "BIBD Transfer",       date: "2026-04-10", type: "debit",  amount:  350.00, categoryName: "Family",     accountName: "BIBD",    accountId: "a2", note: "Monthly support", auto: true },
    { id: "t19", description: "Insurance premium",         merchant: "Takaful Brunei",      date: "2026-04-08", type: "debit",  amount:  135.00, categoryName: "Insurance",  accountName: "BIBD",    accountId: "a2", note: "Auto-pay", auto: true },
    { id: "t20", description: "Rent — Beribi",             merchant: "Landlord",            date: "2026-04-05", type: "debit",  amount:  600.00, categoryName: "Housing",    accountName: "BIBD",    accountId: "a2", note: "April rent", auto: true },
    { id: "t21", description: "Excapade Sushi",            merchant: "Excapade",            date: "2026-04-03", type: "debit",  amount:   62.10, categoryName: "Eating out", accountName: "Baiduri", accountId: "a3", note: null },
    { id: "t22", description: "Personal loan",             merchant: "BIBD Personal",       date: "2026-04-25", type: "debit",  amount:  320.00, categoryName: "Loan",       accountName: "BIBD",    accountId: "a2", note: "Auto-deducted", auto: true },
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
