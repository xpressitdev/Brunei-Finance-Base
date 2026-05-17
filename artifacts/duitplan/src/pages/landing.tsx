import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Check, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import i18n, { STORAGE_KEY } from "@/i18n";
import { REGIONS, type RegionCode, DEFAULT_REGION } from "@/config/regions";

function detectRegionFromHostname(): RegionCode {
  if (typeof window === "undefined") return DEFAULT_REGION;
  const params = new URLSearchParams(window.location.search);
  const override = params.get("region")?.toUpperCase();
  if (override === "BN" || override === "MY" || override === "ID") return override;
  const host = window.location.hostname.toLowerCase();
  if (host.startsWith("my.")) return "MY";
  if (host.startsWith("id.")) return "ID";
  return "BN";
}

type LandingDemo = {
  region: RegionCode;
  currency: string;
  bank: string;
  hero: { remaining: number; income: number; loan: number; goal: number };
  zakat: { cash: number; investments: number; nisab: number; owed: number };
  fmt: (n: number) => string;
  fmtSigned: (n: number, sign: "+" | "−") => string;
};

const DEMO_BY_REGION: Record<RegionCode, Omit<LandingDemo, "fmt" | "fmtSigned">> = {
  BN: {
    region: "BN",
    currency: "BND",
    bank: "BIBD",
    hero: { remaining: 1289.5, income: 4250, loan: 520, goal: 200 },
    zakat: { cash: 8420.55, investments: 1200, nisab: 7820, owed: 240.51 },
  },
  MY: {
    region: "MY",
    currency: "MYR",
    bank: "Maybank",
    hero: { remaining: 1650, income: 5500, loan: 850, goal: 300 },
    zakat: { cash: 14800, investments: 2200, nisab: 23500, owed: 425 },
  },
  ID: {
    region: "ID",
    currency: "IDR",
    bank: "BCA",
    hero: { remaining: 3850000, income: 12000000, loan: 1500000, goal: 600000 },
    zakat: { cash: 28500000, investments: 5500000, nisab: 78000000, owed: 850000 },
  },
};

function useLandingDemo(): LandingDemo {
  return useMemo(() => {
    const region = detectRegionFromHostname();
    const base = DEMO_BY_REGION[region];
    const cfg = REGIONS[region];
    const formatter = new Intl.NumberFormat(cfg.locale, {
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
    });
    const fmt = (n: number) => `${base.currency} ${formatter.format(n)}`;
    const fmtSigned = (n: number, sign: "+" | "−") => `${sign}${base.currency} ${formatter.format(n)}`;
    return { ...base, fmt, fmtSigned };
  }, []);
}

const LANGUAGES = [
  { code: "en", nativeLabel: "English" },
  { code: "ms", nativeLabel: "Bahasa Melayu" },
  { code: "id", nativeLabel: "Bahasa Indonesia" },
] as const;

function LanguageSwitcher() {
  const { i18n: i18nInstance } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = i18nInstance.language?.substring(0, 2) ?? "en";
  const currentCode = currentLang.toUpperCase();

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem(STORAGE_KEY, code);
    setOpen(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <Globe className="w-4 h-4" />
        <span>{currentCode}</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1.5 bg-white border border-border rounded-xl shadow-lg py-1 z-50 min-w-[190px]"
        >
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              role="option"
              aria-selected={currentLang === lang.code}
              onClick={() => handleSelect(lang.code)}
              className={cn(
                "w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors",
                currentLang === lang.code ? "text-primary font-semibold" : "text-foreground"
              )}
            >
              {lang.nativeLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Landing() {
  const { t } = useTranslation();
  const demo = useLandingDemo();

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">

      {/* Header */}
      <header className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold tracking-tight">DuitPlan</span>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#zakat" className="hover:text-foreground transition-colors">Zakat</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">{t('landing.header.signIn')}</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="inline-flex items-center gap-1.5">
                {t('landing.header.getStarted')}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">

        {/* Hero */}
        <section className="relative">
          <div className="max-w-6xl mx-auto px-6 pt-20 pb-24">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold mb-6">
                  🇧🇳 Built for Brunei · 🇲🇾 Malaysia · 🇮🇩 Indonesia
                </span>
                <h1 className="text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mb-5">
                  {(() => {
                    const headline = t('landing.hero.headline');
                    const parts = headline.split('gaji');
                    if (parts.length >= 2) {
                      return <>{parts[0]}<span className="text-primary">gaji</span>{parts.slice(1).join('gaji')}</>;
                    }
                    return headline;
                  })()}
                  <br />
                  {(() => {
                    const sub = "Plan every duit.";
                    const parts = sub.split('duit');
                    return <>{parts[0]}<span className="text-primary">duit</span>{parts.slice(1).join('duit')}</>;
                  })()}
                </h1>
                <p className="text-lg text-muted-foreground max-w-md mb-7 leading-relaxed">
                  {t('landing.hero.subheadline')}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/register">
                    <Button size="lg" className="h-12 px-7 inline-flex items-center gap-2">
                      {t('landing.hero.ctaStart')}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link href="/upload">
                    <Button size="lg" variant="outline" className="h-12 px-6 bg-white inline-flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      {t('landing.hero.ctaImport')}
                    </Button>
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-8 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    {t('landing.hero.trustFree')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    {t('landing.hero.trustNoBank')}
                  </div>
                </div>
              </div>

              {/* Hero card mockup */}
              <div className="relative hidden lg:block">
                <div className="absolute inset-0 bg-primary/[0.08] rounded-3xl rotate-1" />
                <div className="relative bg-white border border-card-border rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-5">
                    <div className="text-sm font-semibold">
                      {new Date().toLocaleString('en', { month: 'long', year: 'numeric' })}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground font-semibold">{demo.currency}</span>
                  </div>
                  <div className="rounded-xl bg-primary/[0.05] border border-primary/20 p-4 mb-4">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-primary">Remaining</div>
                    <div className="text-3xl font-bold text-primary tabular-nums mt-1">{demo.fmt(demo.hero.remaining)}</div>
                    <div className="text-xs text-muted-foreground mt-1">After commitments and spending</div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <img src="/illustration-payslip.png" className="w-10 h-10 object-contain" alt="" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">Hari Gaji — {new Date().toLocaleString('en', { month: 'long' })}</div>
                        <div className="text-xs text-muted-foreground">25 {new Date().toLocaleString('en', { month: 'short' })} · {demo.bank}</div>
                      </div>
                      <div className="text-sm font-semibold text-emerald-600 tabular-nums">{demo.fmtSigned(demo.hero.income, "+")}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <img src="/illustration-bank.png" className="w-10 h-10 object-contain" alt="" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">Toyota Hilux — auto</div>
                        <div className="text-xs text-muted-foreground">Loan · 4.2% APR</div>
                      </div>
                      <div className="text-sm font-semibold tabular-nums text-foreground">{demo.fmtSigned(demo.hero.loan, "−")}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <img src="/illustration-vault.png" className="w-10 h-10 object-contain" alt="" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">Umrah fund</div>
                        <div className="text-xs text-muted-foreground">Goal · 68% complete</div>
                      </div>
                      <div className="text-sm font-semibold tabular-nums text-foreground">{demo.fmtSigned(demo.hero.goal, "−")}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-6 py-20 bg-muted/40 border-t">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold mb-3">{t('landing.features.title')}</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">{t('landing.features.subtitle')}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white border border-card-border rounded-2xl p-7">
                <img src="/illustration-payslip.png" className="w-16 h-16 object-contain mb-4" alt="" />
                <h3 className="text-lg font-semibold mb-2">{t('landing.features.card1.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('landing.features.card1.desc')}
                </p>
              </div>
              <div className="bg-white border border-card-border rounded-2xl p-7">
                <img src="/illustration-bank.png" className="w-16 h-16 object-contain mb-4" alt="" />
                <h3 className="text-lg font-semibold mb-2">{t('landing.features.card2.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('landing.features.card2.desc')}
                </p>
              </div>
              <div className="bg-white border border-card-border rounded-2xl p-7">
                <img src="/illustration-vault.png" className="w-16 h-16 object-contain mb-4" alt="" />
                <h3 className="text-lg font-semibold mb-2">{t('landing.features.card3.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('landing.features.card3.desc')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="px-6 py-20 border-t">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-center mb-12">
              {t('landing.steps.title')}
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {([
                { num: "1", title: t('landing.steps.step1.title'), desc: t('landing.steps.step1.desc') },
                { num: "2", title: t('landing.steps.step2.title'), desc: t('landing.steps.step2.desc') },
                { num: "3", title: t('landing.steps.step3.title'), desc: t('landing.steps.step3.desc') },
              ] as const).map(step => (
                <div key={step.num}>
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold mb-4">
                    {step.num}
                  </div>
                  <h3 className="text-base font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Zakat */}
        <section id="zakat" className="px-6 py-20 bg-muted/40 border-t">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mb-5">
                  {t('landing.zakatSection.eyebrow')}
                </span>
                <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
                  {t('landing.zakatSection.title')}
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-8">
                  {t('landing.zakatSection.subtitle')}
                </p>
                <ul className="space-y-5 mb-8">
                  {([
                    { title: t('landing.zakatSection.feature1Title'), desc: t('landing.zakatSection.feature1Desc') },
                    { title: t('landing.zakatSection.feature2Title'), desc: t('landing.zakatSection.feature2Desc') },
                    { title: t('landing.zakatSection.feature3Title'), desc: t('landing.zakatSection.feature3Desc') },
                  ] as const).map((feat) => (
                    <li key={feat.title} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm mb-0.5">{feat.title}</div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link href="/zakat">
                  <Button size="lg" className="bg-emerald-700 hover:bg-emerald-800 text-white inline-flex items-center gap-2">
                    {t('landing.zakatSection.cta')}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>

              {/* Zakat card mockup */}
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-200/40 rounded-3xl -rotate-1" />
                <div className="relative bg-white border border-card-border rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700">Zakat al-Mal</div>
                      <div className="text-sm font-semibold mt-0.5">1447 H</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold">Above nisab</span>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cash & savings</span>
                      <span className="font-medium tabular-nums">{demo.fmt(demo.zakat.cash)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Investments</span>
                      <span className="font-medium tabular-nums">{demo.fmt(demo.zakat.investments)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="text-muted-foreground">Nisab (85g gold)</span>
                      <span className="font-medium tabular-nums">{demo.fmt(demo.zakat.nisab)}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 mb-5">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700">Zakat owed (2.5%)</div>
                    <div className="text-3xl font-bold text-emerald-700 tabular-nums mt-1">{demo.fmt(demo.zakat.owed)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                      {t('landing.zakatSection.authoritiesTitle')}
                    </div>
                    <ul className="space-y-1.5 text-xs">
                      <li className="flex items-center gap-2">
                        <span aria-hidden>🇧🇳</span>
                        <span className="text-muted-foreground">{t('landing.zakatSection.authorityBn')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span aria-hidden>🇲🇾</span>
                        <span className="text-muted-foreground">{t('landing.zakatSection.authorityMy')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span aria-hidden>🇮🇩</span>
                        <span className="text-muted-foreground">{t('landing.zakatSection.authorityId')}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="bg-primary py-16">
          <div className="max-w-4xl mx-auto px-6 text-center text-white">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
              {t('landing.cta.title')}
            </h2>
            <p className="text-white/85 max-w-xl mx-auto mb-7">
              {t('landing.cta.subtitle')}
            </p>
            <Link href="/register">
              <Button size="lg" variant="secondary" className="h-12 px-7 font-semibold inline-flex items-center gap-2">
                {t('landing.cta.button')}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-10 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" className="w-7 h-7 object-contain" alt="" />
            <span className="font-bold">DuitPlan</span>
            <span className="text-xs text-muted-foreground ml-2">
              {t('landing.footer.tagline', { year: new Date().getFullYear() })}
            </span>
          </div>
          <div className="flex gap-5 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="mailto:hello@duitplan.com" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
