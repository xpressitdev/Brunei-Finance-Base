import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useGetProfile, useUpdateProfile, useListCategories, useCreateCategory } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, User, Tag, Globe, Shield, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useRegion } from "@/hooks/useRegion";
import i18n from "@/i18n";

export default function Settings() {
  const { t } = useTranslation();
  const { region, decimalStep } = useRegion();
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useGetProfile();
  const { data: categories, isLoading: categoriesLoading, refetch: refetchCategories } = useListCategories();
  
  const updateProfileMutation = useUpdateProfile();
  const createCategoryMutation = useCreateCategory();
  const { toast } = useToast();

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
          <TabsTrigger value="privacy" className="flex gap-2">
            <Shield className="w-4 h-4"/> {t("settings.tabs.privacy", "Privacy")}
          </TabsTrigger>
        </TabsList>

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
                      value={formData.monthlyIncome} 
                      onChange={(e) => setFormData({...formData, monthlyIncome: e.target.value})} 
                    />
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
                <Button type="submit" disabled={updateProfileMutation.isPending}>
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

        <TabsContent value="preferences">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
