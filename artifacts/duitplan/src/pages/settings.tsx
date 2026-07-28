import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useGetProfile, useUpdateProfile, useListCategories, useCreateCategory, useResetUserData, useChangePassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, User, Tag, Globe, Shield, ArrowRight, Trash2, AlertTriangle, Lock } from "lucide-react";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { checkPasswordPolicy, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useRegion } from "@/hooks/useRegion";
import i18n from "@/i18n";

// Keep in sync with MIN/MAX_MONTHLY_INCOME in artifacts/api-server/src/routes/profile.ts
const MIN_MONTHLY_INCOME = 0.01;
const MAX_MONTHLY_INCOME = 1_000_000;

function validateMonthlyIncome(raw: string): string | null {
  if (!raw) return "Please enter your monthly salary.";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "Please enter a number.";
  if (n < MIN_MONTHLY_INCOME) return "Salary must be a positive amount.";
  if (n > MAX_MONTHLY_INCOME) return `That looks too high. Please enter a value up to ${MAX_MONTHLY_INCOME.toLocaleString()}.`;
  return null;
}

export default function Settings() {
  const { t } = useTranslation();
  const { region, decimalStep } = useRegion();
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useGetProfile();
  const { data: categories, isLoading: categoriesLoading, refetch: refetchCategories } = useListCategories();
  
  const updateProfileMutation = useUpdateProfile();
  const createCategoryMutation = useCreateCategory();
  const resetDataMutation = useResetUserData();
  const changePasswordMutation = useChangePassword();
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwTouched, setPwTouched] = useState({ newPassword: false, confirm: false });
  const pwPolicy = checkPasswordPolicy(pwForm.newPassword);
  const pwConfirmError = pwForm.confirm && pwForm.confirm !== pwForm.newPassword ? "Passwords don't match." : "";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    monthlyIncome: "",
    payday: "",
  });

  const [language, setLanguage] = useState("en");
  const [newCatName, setNewCatName] = useState("");
  const [newCatKind, setNewCatKind] = useState("expense");

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || "",
        monthlyIncome: profile.monthlyIncome || "",
        payday: profile.payday?.toString() || "",
      });
      setLanguage(profile.language ?? "en");
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const incomeError = validateMonthlyIncome(formData.monthlyIncome);
    if (incomeError) {
      toast({ title: incomeError, variant: "destructive" });
      return;
    }
    try {
      await updateProfileMutation.mutateAsync({
        data: {
          fullName: formData.fullName,
          monthlyIncome: formData.monthlyIncome,
          payday: formData.payday ? parseInt(formData.payday, 10) : undefined
        }
      });
      toast({ title: t("settings.toasts.profileUpdated") });
      refetchProfile();
    } catch (err) {
      toast({ title: t("settings.toasts.profileFailed"), variant: "destructive" });
    }
  };

  const handleLanguageChange = async (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    try {
      await updateProfileMutation.mutateAsync({ data: { language: lang } });
    } catch {
      // silent — language change already applied locally
    }
  };

  const handleResetData = async () => {
    if (resetConfirmText !== "RESET") return;
    try {
      const result = await resetDataMutation.mutateAsync();
      const total = Object.values(result.deleted).reduce((a, b) => a + b, 0);
      toast({
        title: t("settings.privacy.resetSuccessTitle", "Your data has been reset"),
        description: t("settings.privacy.resetSuccessDesc", { count: total, defaultValue: "{{count}} records cleared. Your account, profile, and language are intact." }),
      });
      setResetConfirmText("");
      setResetDialogOpen(false);
      await queryClient.invalidateQueries();
    } catch (err) {
      toast({
        title: t("settings.privacy.resetFailedTitle", "Reset failed"),
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwTouched({ newPassword: true, confirm: true });
    if (!pwPolicy.ok || pwConfirmError || !pwForm.currentPassword) return;
    try {
      await changePasswordMutation.mutateAsync({
        data: { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword },
      });
      toast({ title: "Password updated", description: "Use your new password the next time you sign in." });
      setPwForm({ currentPassword: "", newPassword: "", confirm: "" });
      setPwTouched({ newPassword: false, confirm: false });
    } catch (err: any) {
      toast({
        title: "Couldn't update password",
        description: err?.error || "Check your current password and try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    try {
      await createCategoryMutation.mutateAsync({
        data: {
          name: newCatName,
          kind: newCatKind
        }
      });
      setNewCatName("");
      toast({ title: t("settings.toasts.categoryAdded") });
      refetchCategories();
    } catch (err) {
      toast({ title: t("settings.toasts.categoryFailed"), variant: "destructive" });
    }
  };

  if (profileLoading || categoriesLoading) return <div className="p-8">{t("common.loading")}</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile" className="flex gap-2">
            <User className="w-4 h-4"/> {t("settings.tabs.profile")}
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex gap-2">
            <Tag className="w-4 h-4"/> {t("settings.tabs.categories")}
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex gap-2">
            <Globe className="w-4 h-4"/> {t("settings.tabs.preferences")}
          </TabsTrigger>
          <TabsTrigger value="security" className="flex gap-2">
            <Lock className="w-4 h-4"/> {t("settings.tabs.security", "Security")}
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex gap-2">
            <Shield className="w-4 h-4"/> {t("settings.tabs.privacy", "Privacy")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>
                Use at least {PASSWORD_MIN_LENGTH} characters with at least one digit. After updating, you'll stay signed in on this device.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword">Current password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    value={pwForm.currentPassword}
                    onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))}
                    data-testid="input-current-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={PASSWORD_MIN_LENGTH}
                    value={pwForm.newPassword}
                    onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
                    onBlur={() => setPwTouched((s) => ({ ...s, newPassword: true }))}
                    aria-invalid={pwTouched.newPassword && !pwPolicy.ok ? true : undefined}
                    className={pwTouched.newPassword && !pwPolicy.ok ? "border-rose-400 focus-visible:ring-rose-300" : undefined}
                    data-testid="input-new-password"
                  />
                  <PasswordStrengthMeter password={pwForm.newPassword} />
                  {pwTouched.newPassword && !pwPolicy.ok && (
                    <p className="text-xs text-rose-600">{pwPolicy.reason}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={pwForm.confirm}
                    onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                    onBlur={() => setPwTouched((s) => ({ ...s, confirm: true }))}
                    aria-invalid={pwTouched.confirm && !!pwConfirmError ? true : undefined}
                    className={pwTouched.confirm && pwConfirmError ? "border-rose-400 focus-visible:ring-rose-300" : undefined}
                    data-testid="input-confirm-password"
                  />
                  {pwTouched.confirm && pwConfirmError && (
                    <p className="text-xs text-rose-600">{pwConfirmError}</p>
                  )}
                </div>
                <Button type="submit" disabled={changePasswordMutation.isPending} data-testid="button-change-password">
                  {changePasswordMutation.isPending ? "Updating…" : "Update password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.profile.title")}</CardTitle>
              <CardDescription>{t("settings.profile.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <Label>{t("settings.profile.fullName")}</Label>
                  <Input 
                    value={formData.fullName} 
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("settings.profile.monthlyIncome", { currency: region.currency })}</Label>
                    <Input
                      type="number"
                      step={decimalStep}
                      min={MIN_MONTHLY_INCOME}
                      max={MAX_MONTHLY_INCOME}
                      aria-invalid={validateMonthlyIncome(formData.monthlyIncome) ? true : undefined}
                      className={validateMonthlyIncome(formData.monthlyIncome) ? "border-rose-400 focus-visible:ring-rose-300" : undefined}
                      value={formData.monthlyIncome}
                      onChange={(e) => setFormData({...formData, monthlyIncome: e.target.value})}
                    />
                    {validateMonthlyIncome(formData.monthlyIncome) && (
                      <p className="text-xs text-rose-600" data-testid="error-monthly-income">
                        {validateMonthlyIncome(formData.monthlyIncome)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.profile.payday")}</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      max="31" 
                      value={formData.payday} 
                      onChange={(e) => setFormData({...formData, payday: e.target.value})} 
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending || validateMonthlyIncome(formData.monthlyIncome) !== null}
                >
                  {updateProfileMutation.isPending ? t("common.saving") : t("common.saveChanges")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.categories.title")}</CardTitle>
              <CardDescription>{t("settings.categories.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleAddCategory} className="flex items-end gap-4">
                <div className="space-y-2 flex-1">
                  <Label>{t("settings.categories.nameLabel")}</Label>
                  <Input 
                    value={newCatName} 
                    onChange={(e) => setNewCatName(e.target.value)} 
                    placeholder={t("settings.categories.namePlaceholder")}
                    required
                  />
                </div>
                <div className="space-y-2 w-48">
                  <Label>{t("settings.categories.typeLabel")}</Label>
                  <Select value={newCatKind} onValueChange={setNewCatKind}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">{t("settings.categories.expense")}</SelectItem>
                      <SelectItem value="income">{t("settings.categories.income")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={createCategoryMutation.isPending}>
                  <Plus className="w-4 h-4 mr-2" /> {t("settings.categories.add")}
                </Button>
              </form>

              <div className="mt-8">
                <h3 className="font-semibold mb-4">{t("settings.categories.yourCategories")}</h3>
                <div className="flex flex-wrap gap-2">
                  {categories?.map(c => (
                    <div key={c.id} className="bg-muted px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 border">
                      {c.name}
                      <span className="text-[10px] uppercase text-muted-foreground bg-background px-1.5 rounded">{c.kind}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.language.title")}</CardTitle>
              <CardDescription>{t("settings.language.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-xs">
                <Select value={language} onValueChange={handleLanguageChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t("settings.language.en")}</SelectItem>
                    <SelectItem value="ms">{t("settings.language.ms")}</SelectItem>
                    <SelectItem value="id">{t("settings.language.id")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.incomeType.title")}</CardTitle>
              <CardDescription>{t("settings.incomeType.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-md">
                <Select
                  value={profile?.incomeType ?? "fixed"}
                  onValueChange={async (v) => {
                    try {
                      await updateProfileMutation.mutateAsync({ data: { incomeType: v as "fixed" | "variable" } });
                      toast({ title: t("settings.incomeType.toastUpdated") });
                      refetchProfile();
                    } catch {
                      toast({ title: t("settings.toasts.profileFailed"), variant: "destructive" });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{t("settings.incomeType.fixed")}</SelectItem>
                    <SelectItem value="variable">{t("settings.incomeType.variable")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  {profile?.incomeType === "variable"
                    ? t("settings.incomeType.variableHint")
                    : t("settings.incomeType.fixedHint")}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-700" />
                {t("settings.privacy.title", "Privacy & Trust")}
              </CardTitle>
              <CardDescription>
                {t(
                  "settings.privacy.description",
                  "How DuitPlan handles your data — in plain language.",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>• {t("settings.privacy.point1", "Your data is never sold or shared with advertisers.")}</li>
                <li>• {t("settings.privacy.point2", "Encrypted in transit (HTTPS) and at rest.")}</li>
                <li>• {t("settings.privacy.point3", "DuitPlan AI reads only your data, and AI provider terms forbid training on it.")}</li>
                <li>• {t("settings.privacy.point4", "Want your data deleted or exported? Email hello@duitplan.com — we'll handle it.")}</li>
              </ul>
              <Link href="/privacy">
                <Button variant="outline" className="gap-2">
                  {t("settings.privacy.readFull", "Read the full Privacy & Trust page")}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-destructive/50 mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                {t("settings.privacy.dangerTitle", "Danger zone")}
              </CardTitle>
              <CardDescription>
                {t(
                  "settings.privacy.dangerDescription",
                  "Wipe all your financial data and start fresh. Your login, profile, and language stay the same.",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-muted/40 p-4 text-sm space-y-2 border">
                <p className="font-medium">{t("settings.privacy.willDeleteTitle", "What gets deleted:")}</p>
                <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                  <li>{t("settings.privacy.willDelete1", "All transactions, accounts, and balances")}</li>
                  <li>{t("settings.privacy.willDelete2", "All debts, goals, monthly bills, and budgets")}</li>
                  <li>{t("settings.privacy.willDelete3", "Net worth history and asset entries")}</li>
                  <li>{t("settings.privacy.willDelete4", "Insights, achievements, and AI chat history")}</li>
                  <li>{t("settings.privacy.willDelete5", "Uploaded statements and import history")}</li>
                </ul>
                <p className="font-medium pt-2">{t("settings.privacy.willKeepTitle", "What is kept:")}</p>
                <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                  <li>{t("settings.privacy.willKeep1", "Your account and login")}</li>
                  <li>{t("settings.privacy.willKeep2", "Your name, region, and language")}</li>
                  <li>{t("settings.privacy.willKeep3", "Your category list (shared across all users)")}</li>
                </ul>
              </div>

              <AlertDialog open={resetDialogOpen} onOpenChange={(open) => { setResetDialogOpen(open); if (!open) setResetConfirmText(""); }}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2" data-testid="button-open-reset-dialog">
                    <Trash2 className="w-4 h-4" />
                    {t("settings.privacy.resetButton", "Reset my data")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      {t("settings.privacy.resetDialogTitle", "Reset all your data?")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t(
                        "settings.privacy.resetDialogDesc",
                        "This permanently deletes every transaction, account, debt, goal, budget, commitment, insight, achievement, and AI conversation tied to your account. This cannot be undone.",
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-2 py-2">
                    <Label htmlFor="reset-confirm">
                      {t("settings.privacy.resetConfirmLabel", "Type RESET to confirm")}
                    </Label>
                    <Input
                      id="reset-confirm"
                      value={resetConfirmText}
                      onChange={(e) => setResetConfirmText(e.target.value)}
                      placeholder="RESET"
                      autoComplete="off"
                      data-testid="input-reset-confirm"
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={resetDataMutation.isPending} data-testid="button-cancel-reset">
                      {t("common.cancel", "Cancel")}
                    </AlertDialogCancel>
                    <Button
                      onClick={handleResetData}
                      disabled={resetConfirmText !== "RESET" || resetDataMutation.isPending}
                      variant="destructive"
                      data-testid="button-confirm-reset"
                    >
                      {resetDataMutation.isPending
                        ? t("settings.privacy.resetting", "Resetting…")
                        : t("settings.privacy.resetConfirm", "Yes, reset everything")}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
