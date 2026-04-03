import { useState } from "react";
import { useLocation } from "wouter";
import { useUploadStatement } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload as UploadIcon, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [bankType, setBankType] = useState<string>("bibd");
  const [error, setError] = useState<string>("");
  const [, setLocation] = useLocation();
  
  const uploadMutation = useUploadStatement();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }
    
    try {
      const result = await uploadMutation.mutateAsync({
        data: {
          file,
          bankType
        }
      });
      setLocation(`/upload/${result.id}/review`);
    } catch (e: any) {
      setError(e?.error || "Failed to upload file. Please try again.");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Upload Statement</h1>
        <p className="text-muted-foreground">Import your transactions automatically from bank PDFs.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import Transactions</CardTitle>
          <CardDescription>We currently support statements from BIBD and Baiduri.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Bank</Label>
            <Select value={bankType} onValueChange={setBankType}>
              <SelectTrigger>
                <SelectValue placeholder="Select bank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bibd">BIBD</SelectItem>
                <SelectItem value="baiduri">Baiduri</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Statement File (PDF)</Label>
            <div className="border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                {file ? <FileText className="w-8 h-8" /> : <UploadIcon className="w-8 h-8" />}
              </div>
              <div className="text-sm font-medium mb-1">
                {file ? file.name : "Click to upload or drag and drop"}
              </div>
              <div className="text-xs text-muted-foreground mb-4">
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF up to 5MB"}
              </div>
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".pdf"
                onChange={handleFileChange}
              />
              <Button asChild variant={file ? "outline" : "default"}>
                <label htmlFor="file-upload" className="cursor-pointer">
                  {file ? "Change File" : "Select File"}
                </label>
              </Button>
            </div>
          </div>

          <Button 
            className="w-full" 
            onClick={handleUpload} 
            disabled={!file || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? "Uploading and Parsing..." : "Upload and Review"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
