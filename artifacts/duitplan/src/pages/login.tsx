import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const loginMutation = useLogin();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await loginMutation.mutateAsync({ data: { email, password } });
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err?.error || t('auth.errors.invalidCredentials'));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <Link href="/" className="mb-8">
        <img src="/logo-horizontal.png" alt="DuitPlan" className="h-9 w-auto" />
      </Link>
      
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8">
        <h1 className="text-2xl font-semibold mb-2 text-center">{t('auth.login.title')}</h1>
        <p className="text-muted-foreground mb-8 text-center">{t('auth.login.subtitle')}</p>
        
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.login.emailLabel')}</Label>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('auth.login.passwordLabel')}</Label>
            </div>
            <Input 
              id="password" 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          <Button 
            type="submit" 
            className="w-full h-11 text-base mt-2" 
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? t('auth.login.signingIn') : t('auth.login.submit')}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          {t('auth.login.noAccount')}{' '}
          <Link href="/register">
            <span className="text-primary font-medium hover:underline cursor-pointer">{t('auth.login.signUp')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
