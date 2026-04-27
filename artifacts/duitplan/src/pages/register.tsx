import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Register() {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const registerMutation = useRegister();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await registerMutation.mutateAsync({ data: { fullName, email, password } });
      window.location.href = "/onboarding";
    } catch (err: any) {
      setError(err?.error || t('auth.errors.registrationFailed'));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <img src="/logo-mark.png" alt="" className="h-9 w-9 object-contain" />
        <span className="font-bold text-xl tracking-tight">DuitPlan</span>
      </Link>
      
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8">
        <h1 className="text-2xl font-semibold mb-2 text-center">{t('auth.register.title')}</h1>
        <p className="text-muted-foreground mb-8 text-center">{t('auth.register.subtitle')}</p>
        
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">{t('auth.register.fullNameLabel')}</Label>
            <Input 
              id="fullName" 
              type="text" 
              placeholder={t('auth.register.fullNamePlaceholder')}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.register.emailLabel')}</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="name@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.register.passwordLabel')}</Label>
            <Input 
              id="password" 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              minLength={6}
            />
          </div>
          <Button 
            type="submit" 
            className="w-full h-11 text-base mt-2" 
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? t('auth.register.creating') : t('auth.register.submit')}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          {t('auth.register.hasAccount')}{' '}
          <Link href="/login">
            <span className="text-primary font-medium hover:underline cursor-pointer">{t('auth.register.signIn')}</span>
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t(
            'auth.register.privacyNote',
            'Your data is encrypted and never sold.',
          )}{' '}
          <Link href="/privacy">
            <span className="text-emerald-700 font-medium hover:underline cursor-pointer">
              {t('auth.register.privacyLink', 'Privacy & Trust')}
            </span>
          </Link>
        </p>
      </div>
    </div>
  );
}
