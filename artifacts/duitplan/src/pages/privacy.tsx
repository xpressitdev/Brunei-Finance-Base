import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Shield,
  Lock,
  EyeOff,
  Database,
  Bot,
  Trash2,
  Download,
  Mail,
  Check,
  X,
  ArrowLeft,
} from "lucide-react";

const LAST_UPDATED = "April 2026";

export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header bar */}
      <header className="border-b border-border bg-white">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="" className="h-7 w-7 object-contain" />
            <span className="font-bold text-base tracking-tight">DuitPlan</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("privacy.back", "Back")}
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-emerald-50/60 to-transparent">
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 mb-5">
            <Shield className="h-7 w-7 text-emerald-700" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            {t("privacy.title", "Your data, your business.")}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            {t(
              "privacy.subtitle",
              "DuitPlan helps you manage your money — not the other way around. Here's exactly what we do, what we don't do, and how your information is protected.",
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            {t("privacy.lastUpdated", "Last updated")}: {LAST_UPDATED}
          </p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-6 pb-16 space-y-10">
        {/* Promise cards */}
        <section>
          <div className="grid sm:grid-cols-2 gap-4">
            <PromiseCard
              icon={<Lock className="h-5 w-5" />}
              title={t("privacy.cards.encrypted.title", "Encrypted in transit and at rest")}
              body={t(
                "privacy.cards.encrypted.body",
                "Every connection uses HTTPS. Your data is stored on encrypted disks managed by our database provider.",
              )}
            />
            <PromiseCard
              icon={<EyeOff className="h-5 w-5" />}
              title={t("privacy.cards.notForSale.title", "Never sold, never shared")}
              body={t(
                "privacy.cards.notForSale.body",
                "We do not sell, rent, or share your financial data with advertisers, data brokers, or any third party for marketing.",
              )}
            />
            <PromiseCard
              icon={<Database className="h-5 w-5" />}
              title={t("privacy.cards.isolated.title", "Isolated to your account")}
              body={t(
                "privacy.cards.isolated.body",
                "Every transaction, account, and goal is tagged to your user ID. Other users of DuitPlan cannot see any of your data.",
              )}
            />
            <PromiseCard
              icon={<Bot className="h-5 w-5" />}
              title={t("privacy.cards.aiTraining.title", "Not used to train AI")}
              body={t(
                "privacy.cards.aiTraining.body",
                "Your transactions and chats with DuitPlan AI are not used to train any third-party AI model.",
              )}
            />
          </div>
        </section>

        {/* Who can see your data */}
        <Section title={t("privacy.who.title", "Who can see your data")}>
          <ul className="space-y-3 text-sm">
            <Bullet ok>
              {t("privacy.who.you", "You — when you sign in to your DuitPlan account.")}
            </Bullet>
            <Bullet ok>
              {t(
                "privacy.who.aiYou",
                "DuitPlan AI — when you chat with it, it reads your data to give you advice. It only sees your data, never anyone else's.",
              )}
            </Bullet>
            <Bullet>
              {t(
                "privacy.who.support",
                "Our support team — only if you ask us for help with a specific issue and explicitly grant access. We do not browse individual accounts.",
              )}
            </Bullet>
            <Bullet>
              {t(
                "privacy.who.government",
                "The Government of Brunei Darussalam — DuitPlan is free to use, and in return anonymised, aggregated data may be shared with and used by the Government of Brunei Darussalam. This data is never tied to your name or account.",
              )}
            </Bullet>
            <Bullet bad>
              {t("privacy.who.advertisers", "Advertisers, data brokers, employers, banks, anyone else.")}
            </Bullet>
          </ul>
        </Section>

        {/* How we protect it */}
        <Section title={t("privacy.protection.title", "How we protect it")}>
          <div className="space-y-4 text-sm">
            <ProtectionItem
              label={t("privacy.protection.transit.label", "In transit")}
              body={t(
                "privacy.protection.transit.body",
                "All traffic between your phone or browser and DuitPlan goes over HTTPS (TLS).",
              )}
            />
            <ProtectionItem
              label={t("privacy.protection.atRest.label", "At rest")}
              body={t(
                "privacy.protection.atRest.body",
                "Our database lives on encrypted storage managed by Replit. Backups are encrypted too.",
              )}
            />
            <ProtectionItem
              label={t("privacy.protection.passwords.label", "Passwords")}
              body={t(
                "privacy.protection.passwords.body",
                "We never store your password directly. Only a one-way hash (bcrypt) — even we cannot reverse it.",
              )}
            />
            <ProtectionItem
              label={t("privacy.protection.sessions.label", "Sessions")}
              body={t(
                "privacy.protection.sessions.body",
                "Sign-in cookies are HTTP-only and signed, so they cannot be read or forged by another website.",
              )}
            />
            <ProtectionItem
              label={t("privacy.protection.access.label", "Internal access")}
              body={t(
                "privacy.protection.access.body",
                "Only a small number of engineers can access the production database, and only when fixing a real issue.",
              )}
            />
          </div>
        </Section>

        {/* DuitPlan AI specifically */}
        <Section title={t("privacy.ai.title", "About DuitPlan AI")}>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              {t(
                "privacy.ai.p1",
                "DuitPlan AI is your personal money assistant. To answer your questions, it needs to read the data you have already entered into the app — your accounts, transactions, debts, and goals.",
              )}
            </p>
            <p>
              {t(
                "privacy.ai.p2",
                "Your messages and your data are sent to a language-model provider (OpenAI / Anthropic) only to generate that one reply. Under the providers' enterprise API terms, data sent through the API is not used to train their models.",
              )}
            </p>
            <p>
              {t(
                "privacy.ai.p3",
                "If you do not want to use DuitPlan AI at all, you can simply not visit the AI tab — it never runs unless you ask it to.",
              )}
            </p>
          </div>
        </Section>

        {/* What we don't do */}
        <Section title={t("privacy.noNo.title", "What we don't do")}>
          <ul className="space-y-2.5 text-sm">
            <Bullet bad>{t("privacy.noNo.sell", "Sell your data to anyone.")}</Bullet>
            <Bullet bad>{t("privacy.noNo.ads", "Show you ads inside DuitPlan.")}</Bullet>
            <Bullet bad>
              {t("privacy.noNo.share", "Share your transactions with banks or employers.")}
            </Bullet>
            <Bullet bad>
              {t("privacy.noNo.scrape", "Scrape your bank accounts. We never ask for your online-banking password.")}
            </Bullet>
            <Bullet bad>
              {t("privacy.noNo.profile", "Build advertising profiles or sell aggregated insights to third parties.")}
            </Bullet>
          </ul>
        </Section>

        {/* Your rights */}
        <Section title={t("privacy.rights.title", "Your rights")}>
          <p className="text-sm text-muted-foreground mb-4">
            {t(
              "privacy.rights.subtitle",
              "You are in control. You can leave DuitPlan at any time and take your data with you. Self-serve buttons for these are on our roadmap — for now, just email us and we'll handle it within a few business days.",
            )}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <RightCard
              icon={<Download className="h-5 w-5" />}
              title={t("privacy.rights.exportTitle", "Get a copy of your data")}
              body={t(
                "privacy.rights.exportBody",
                "Email us and we'll send you a CSV of your transactions, accounts, debts, and goals.",
              )}
              ctaHref="mailto:hello@duitplan.com?subject=Data%20export%20request"
              cta={t("privacy.rights.emailExport", "Email to request export")}
            />
            <RightCard
              icon={<Trash2 className="h-5 w-5" />}
              title={t("privacy.rights.deleteTitle", "Delete your account")}
              body={t(
                "privacy.rights.deleteBody",
                "Email us from the address on your account. We'll permanently remove every row tied to your user ID — accounts, transactions, debts, goals, uploads — from our live database.",
              )}
              ctaHref="mailto:hello@duitplan.com?subject=Account%20deletion%20request"
              cta={t("privacy.rights.emailDelete", "Email to delete account")}
            />
          </div>
        </Section>

        {/* Contact */}
        <Section title={t("privacy.contact.title", "Questions?")}>
          <div className="rounded-xl border border-border bg-emerald-50/40 p-5 flex items-start gap-4">
            <div className="mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-border">
              <Mail className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="flex-1 text-sm">
              <p className="text-foreground">
                {t(
                  "privacy.contact.body",
                  "Privacy questions, data requests, or concerns? Reach the team directly:",
                )}
              </p>
              <a
                href="mailto:hello@duitplan.com"
                className="font-medium text-emerald-700 hover:text-emerald-800"
              >
                hello@duitplan.com
              </a>
            </div>
          </div>
        </Section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-white">
        <div className="max-w-4xl mx-auto px-6 py-6 text-xs text-muted-foreground text-center">
          {t(
            "privacy.footer",
            "DuitPlan is built in Brunei. We take the trust you put in us seriously — if anything on this page ever stops being true, we will tell you, not hide it.",
          )}
        </div>
      </footer>
    </div>
  );
}

function PromiseCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex-shrink-0">
            {icon}
          </div>
          <CardTitle className="text-base leading-snug">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Bullet({
  children,
  ok,
  bad,
}: {
  children: React.ReactNode;
  ok?: boolean;
  bad?: boolean;
}) {
  const Icon = bad ? X : Check;
  const colour = bad
    ? "bg-red-100 text-red-700"
    : ok
      ? "bg-emerald-100 text-emerald-700"
      : "bg-muted text-muted-foreground";
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 ${colour}`}
      >
        <Icon className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className="text-foreground">{children}</span>
    </li>
  );
}

function ProtectionItem({ label, body }: { label: string; body: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 border-b border-border pb-4 last:border-b-0 last:pb-0">
      <div className="sm:w-32 flex-shrink-0">
        <span className="text-xs uppercase tracking-wider font-semibold text-emerald-700">
          {label}
        </span>
      </div>
      <p className="flex-1 text-muted-foreground">{body}</p>
    </div>
  );
}

function RightCard({
  icon,
  title,
  body,
  ctaHref,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  ctaHref: string;
  cta: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex-shrink-0">
            {icon}
          </div>
          <CardTitle className="text-base leading-snug">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{body}</p>
        <Link href={ctaHref}>
          <Button size="sm" variant="outline" className="w-full">
            {cta}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
