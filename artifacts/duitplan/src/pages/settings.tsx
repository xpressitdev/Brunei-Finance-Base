import { useState, useEffect } from "react";
import { useGetProfile, useUpdateProfile, useListCategories, useCreateCategory } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, User, Tag, Settings as SettingsIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
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

  const [newCatName, setNewCatName] = useState("");
  const [newCatKind, setNewCatKind] = useState("expense");

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || "",
        monthlyIncome: profile.monthlyIncome || "",
        payday: profile.payday?.toString() || "",
      });
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
      toast({ title: "Profile updated successfully" });
      refetchProfile();
    } catch (err) {
      toast({ title: "Failed to update profile", variant: "destructive" });
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
      toast({ title: "Category added" });
      refetchCategories();
    } catch (err) {
      toast({ title: "Failed to add category", variant: "destructive" });
    }
  };

  if (profileLoading || categoriesLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your profile and app preferences.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile" className="flex gap-2"><User className="w-4 h-4"/> Profile</TabsTrigger>
          <TabsTrigger value="categories" className="flex gap-2"><Tag className="w-4 h-4"/> Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details and income settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    value={formData.fullName} 
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monthly Income (BND)</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={formData.monthlyIncome} 
                      onChange={(e) => setFormData({...formData, monthlyIncome: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Payday (1-31)</Label>
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
                  {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>Custom Categories</CardTitle>
              <CardDescription>Add new categories to organize your transactions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleAddCategory} className="flex items-end gap-4">
                <div className="space-y-2 flex-1">
                  <Label>Name</Label>
                  <Input 
                    value={newCatName} 
                    onChange={(e) => setNewCatName(e.target.value)} 
                    placeholder="e.g. Travel, Gym"
                    required
                  />
                </div>
                <div className="space-y-2 w-48">
                  <Label>Type</Label>
                  <Select value={newCatKind} onValueChange={setNewCatKind}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={createCategoryMutation.isPending}>
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
              </form>

              <div className="mt-8">
                <h3 className="font-semibold mb-4">Your Categories</h3>
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
      </Tabs>
    </div>
  );
}
