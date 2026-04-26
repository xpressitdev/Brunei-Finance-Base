import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Upload, CreditCard, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import i18n, { STORAGE_KEY } from "@/i18n";

// ── Language Switcher ─────────────────────────────────────────────────────────

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

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
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
                currentLang === lang.code
                  ? "text-primary font-semibold"
                  : "text-foreground"
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

// ── Landing Page ──────────────────────────────────────────────────────────────

export default function Landing() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl">D</div>
          <span className="text-xl font-bold text-foreground">DuitPlan</span>
        </div>
        <nav className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link href="/login">
            <Button variant="ghost" className="hidden sm:inline-flex">{t('landing.header.signIn')}</Button>
          </Link>
          <Link href="/register">
            <Button>{t('landing.header.getStarted')}</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero */}
        <section className="px-6 py-20 md:py-32 flex flex-col items-center text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            {t('landing.hero.badge')}
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6">
            {(() => {
              const headline = t('landing.hero.headline');
              const parts = headline.split('gaji');
              if (parts.length >= 2) {
                return <>{parts[0]}<span className="text-primary">gaji</span>{parts.slice(1).join('gaji')}</>;
              }
              return headline;
            })()}
          </h1>
          <p className="text-xl text-muted-foreground mb-4 max-w-2xl">
            {t('landing.hero.subheadline')}
          </p>
          <p className="text-sm text-muted-foreground mb-10">
            {t('landing.hero.tagline')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base rounded-xl">
                {t('landing.hero.ctaStart')} <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base rounded-xl bg-white">
                {t('landing.hero.ctaSignIn')}
              </Button>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-20 bg-muted/40 border-t">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold mb-3">{t('landing.features.title')}</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">{t('landing.features.subtitle')}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-2xl border shadow-sm flex flex-col items-start">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('landing.features.card1.title')}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t('landing.features.card1.desc')}
                </p>
              </div>
              <div className="bg-white p-8 rounded-2xl border shadow-sm flex flex-col items-start">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('landing.features.card2.title')}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t('landing.features.card2.desc')}
                </p>
              </div>
              <div className="bg-white p-8 rounded-2xl border shadow-sm flex flex-col items-start">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('landing.features.card3.title')}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t('landing.features.card3.desc')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-20 border-t">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold mb-3">{t('landing.steps.title')}</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-8">
              {([
                { num: "1", title: t('landing.steps.step1.title'), desc: t('landing.steps.step1.desc') },
                { num: "2", title: t('landing.steps.step2.title'), desc: t('landing.steps.step2.desc') },
                { num: "3", title: t('landing.steps.step3.title'), desc: t('landing.steps.step3.desc') },
              ] as const).map(step => (
                <div key={step.num} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">
                    {step.num}
                  </div>
                  <h3 className="font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA banner */}
        <section className="px-6 py-16 bg-primary text-white">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">{t('landing.cta.title')}</h2>
            <p className="text-primary-foreground/80 mb-8">
              {t('landing.cta.subtitle')}
            </p>
            <Link href="/register">
              <Button size="lg" variant="secondary" className="px-8 h-12 text-base rounded-xl">
                {t('landing.cta.button')} <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-white font-bold text-xs">D</div>
            <span className="font-semibold text-sm">DuitPlan</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('landing.footer.tagline', { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
    </div>
  );
}
