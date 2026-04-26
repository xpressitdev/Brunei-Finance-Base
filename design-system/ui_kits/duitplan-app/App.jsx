const App = () => {
  const [active, setActive] = React.useState("dashboard");
  const [hariGajiOpen, setHariGajiOpen] = React.useState(true);

  const titleMap = {
    dashboard: "Dashboard", expenses: "Transactions", budgets: "Budgets",
    debts: "Debts", goals: "Goals", accounts: "Accounts",
    transactions: "Transactions", commitments: "Budgets",
    networth: "Net Worth",
  };
  const realKey = titleMap[active] ? active : "dashboard";

  let page;
  switch (realKey) {
    case "expenses": case "transactions": page = <Expenses/>; break;
    case "budgets": case "commitments":   page = <Budgets/>; break;
    case "debts":                         page = <Debts/>; break;
    case "goals":                         page = <Goals/>; break;
    case "accounts":                      page = <Accounts/>; break;
    case "networth":                      page = <NetWorth/>; break;
    default: page = <Dashboard onNav={setActive} hariGajiOpen={hariGajiOpen} setHariGajiOpen={setHariGajiOpen}/>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--background))]">
      <Sidebar active={realKey} onNav={setActive}/>
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">{page}</div>
      </main>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
