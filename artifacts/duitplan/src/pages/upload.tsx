import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useUploadStatement } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload as UploadIcon, FileText, Image, AlertCircle, CheckCircle2, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrialExpiredPrompt } from "@/components/subscription/TrialExpiredPrompt";
import { isTrialExpiredError } from "@/lib/trialExpired";

export default function Upload() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"pdf" | "screenshot">("screenshot");
  const [file, setFile] = useState<File | null>(null);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [bankType, setBankType] = useState<string>("bibd");
  const [error, setError] = useState<string>("");
  const [trialExpiredError, setTrialExpiredError] = useState(false);
  const [, setLocation] = useLocation();
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadStatement();

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setScreenshots(prev => [...prev, ...newFiles].slice(0, 10));
      setError("");
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(screenshots.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    const uploadFile = tab === "pdf" ? file : screenshots[0] ?? null;
    if (!uploadFile) {
      setError(tab === "pdf" ? t("upload.errors.noPdf") : t("upload.errors.noScreenshots"));
      return;
    }

    setTrialExpiredError(false);
    try {
      const result = await uploadMutation.mutateAsync({
        data: { file: uploadFile, bankType },
      });
      setLocation(`/upload/${result.id}/review`);
    } catch (err) {
      if (isTrialExpiredError(err)) {
        setTrialExpiredError(true);
      } else {
        setError(t("upload.errors.uploadFailed"));
      }
    }
  };

  const dragProps = (setter: (f: File) => void) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files[0]) setter(e.dataTransfer.files[0]);
    },
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("upload.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("upload.subtitle")}</p>
      </div>

      {trialExpiredError && (
        <TrialExpiredPrompt action="import transactions" />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("upload.card.title")}</CardTitle>
          <CardDescription>{t("upload.card.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bank selector */}
          <div className="space-y-2">
            <Label>{t("upload.bankLabel")}</Label>
            <Select value={bankType} onValueChange={setBankType}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder={t("upload.bankPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bibd">🏦 BIBD</SelectItem>
                <SelectItem value="baiduri">🏦 Baiduri</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tab toggle */}
          <Tabs value={tab} onValueChange={v => { setTab(v as "pdf" | "screenshot"); setError(""); }}>
            <TabsList className="grid w-full grid-cols-2 max-w-sm">
              <TabsTrigger value="screenshot" className="flex items-center gap-2">
                <Image className="w-4 h-4" /> {t("upload.tabs.screenshots")}
              </TabsTrigger>
              <TabsTrigger value="pdf" className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> {t("upload.tabs.pdf")}
              </TabsTrigger>
            </TabsList>

            {/* ── Screenshots Tab ──────────────────────────────────────── */}
            <TabsContent value="screenshot" className="mt-4 space-y-4">
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                <p className="text-sm font-medium text-primary mb-1">{t("upload.screenshots.howToTitle")}</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>{t("upload.screenshots.step1", { bank: bankType === "bibd" ? "BIBD" : "Baiduri" })}</li>
                  <li>{t("upload.screenshots.step2")}</li>
                  <li>{t("upload.screenshots.step3")}</li>
                  <li>{t("upload.screenshots.step4")}</li>
                </ol>
              </div>

              <input
                ref={screenshotInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic"
                className="hidden"
                onChange={handleScreenshotChange}
              />

              {screenshots.length === 0 ? (
                <div
                  className="border-2 border-dashed rounded-xl p-10 text-center flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => screenshotInputRef.current?.click()}
                  {...dragProps(f => setScreenshots([f]))}
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                    <Image className="w-8 h-8" />
                  </div>
                  <p className="font-medium mb-1">{t("upload.screenshots.tapToAdd")}</p>
                  <p className="text-sm text-muted-foreground">{t("upload.screenshots.formats")}</p>
                  <Button className="mt-4" variant="default" size="sm" type="button">
                    <Plus className="w-4 h-4 mr-2" /> {t("upload.screenshots.addScreenshots")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {screenshots.map((f, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border bg-muted/20 aspect-[9/16]">
                        <img
                          src={URL.createObjectURL(f)}
                          alt={`Screenshot ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removeScreenshot(i)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-xs truncate">
                          {f.name}
                        </div>
                      </div>
                    ))}
                    {screenshots.length < 10 && (
                      <button
                        onClick={() => screenshotInputRef.current?.click()}
                        className="rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all aspect-[9/16]"
                      >
                        <Plus className="w-6 h-6" />
                        <span className="text-xs">{t("upload.screenshots.addMore")}</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    {t("upload.screenshots.ready", { count: screenshots.length })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── PDF Tab ──────────────────────────────────────────────── */}
            <TabsContent value="pdf" className="mt-4 space-y-4">
              <div className="rounded-xl bg-muted/30 border p-4">
                <p className="text-sm font-medium mb-1">{t("upload.pdf.howToTitle")}</p>
                <p className="text-xs text-muted-foreground">
                  {bankType === "bibd"
                    ? "Log in to BIBD Online Banking → Accounts → Statement → Download as PDF."
                    : "Log in to Baiduri iBank → Accounts → e-Statement → Download PDF."}
                </p>
              </div>

              <input
                type="file"
                id="pdf-upload"
                className="hidden"
                accept=".pdf,application/pdf"
                onChange={handlePdfChange}
              />

              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-colors",
                  file ? "bg-primary/5 border-primary/40" : "bg-muted/20 hover:bg-muted/30"
                )}
                {...dragProps(f => { setFile(f); setError(""); })}
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                  {file ? <CheckCircle2 className="w-8 h-8 text-primary" /> : <UploadIcon className="w-8 h-8" />}
                </div>
                <div className="font-medium mb-1 text-sm">
                  {file ? file.name : t("upload.pdf.dropzone")}
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : t("upload.pdf.sizeLimit")}
                </div>
                <Button asChild variant={file ? "outline" : "default"} size="sm">
                  <label htmlFor="pdf-upload" className="cursor-pointer">
                    {file ? t("upload.pdf.changeFile") : t("upload.pdf.selectPdf")}
                  </label>
                </Button>
              </div>

              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                {t("upload.pdf.tip")}
              </div>
            </TabsContent>
          </Tabs>

          <Button
            className="w-full h-11"
            onClick={handleUpload}
            disabled={uploadMutation.isPending || (tab === "pdf" ? !file : screenshots.length === 0)}
          >
            {uploadMutation.isPending
              ? (tab === "screenshot"
                  ? t("upload.processing.readingScreenshots")
                  : t("upload.processing.parsingStatement"))
              : (tab === "screenshot"
                  ? t("upload.processing.processScreenshots", { count: screenshots.length || 0 })
                  : t("upload.processing.uploadAndReview"))}
          </Button>
        </CardContent>
      </Card>

      {/* Trust note */}
      <div className="flex items-start gap-3 text-sm text-muted-foreground px-1">
        <span className="text-lg mt-0.5">🔒</span>
        <p>{t("upload.trustNote")}</p>
      </div>
    </div>
  );
}
