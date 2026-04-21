import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Bot, Send, Paperclip, X, Download, Copy, Share2, Plus,
  AlertTriangle, ChevronRight, Loader2, FileText, CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRegion } from "@/hooks/useRegion";
import html2canvas from "html2canvas";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

interface AttachmentMeta {
  name: string;
  mimeType: string;
  type: "image" | "pdf";
  previewUrl?: string;
  storageUrl?: string;
  file: File;
  uploading: boolean;
  uploadError?: string;
}

interface StoredAttachment {
  url: string;
  name: string;
  mimeType: string;
}

interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  attachments: StoredAttachment[];
  createdAt: string;
  isStreaming?: boolean;
  pendingUploadId?: string | null;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface DiscrepancyData {
  account: string;
  recorded: string;
  seen: string;
  delta: string;
}

interface InsightData {
  headline: string;
  subheadline: string;
  metric: string;
  period: string;
  colorTheme: string;
  chartData?: Array<{ label: string; value: number }>;
}

interface UploadUrlResponse {
  uploadURL: string;
  objectPath: string;
  metadata: { name: string; size: number; contentType: string };
}

async function uploadFileToStorage(file: File): Promise<string> {
  const urlRes = await fetch("/api/agent/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!urlRes.ok) {
    const errJson = await urlRes.json().catch(() => null) as { error?: string } | null;
    throw new Error(errJson?.error ?? "Failed to request upload URL");
  }
  const { uploadURL, objectPath } = (await urlRes.json()) as UploadUrlResponse;

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!putRes.ok) throw new Error("File upload to storage failed");

  const wildcardPart = objectPath.replace(/^\/objects/, "");
  return `/api/storage/objects${wildcardPart}`;
}

async function apiPost(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiGet(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function parseDiscrepancy(content: string): DiscrepancyData | null {
  const match = content.match(/```discrepancy\n([\s\S]*?)\n```/);
  if (!match) return null;
  try { return JSON.parse(match[1]) as DiscrepancyData; } catch { return null; }
}

function parseInsight(content: string): InsightData | null {
  const match = content.match(/```insight\n([\s\S]*?)\n```/);
  if (!match) return null;
  try { return JSON.parse(match[1]) as InsightData; } catch { return null; }
}

function stripSpecialBlocks(content: string): string {
  return content
    .replace(/```discrepancy\n[\s\S]*?\n```/g, "")
    .replace(/```insight\n[\s\S]*?\n```/g, "")
    .replace(/```transactions\n[\s\S]*?\n```/g, "")
    .trim();
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="bg-muted px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function renderMarkdownContent(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-base font-semibold mt-3 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-lg font-bold mt-3 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-xl font-bold mt-3 mb-2">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2">
          {items.map((item, j) => <li key={j} className="text-sm">{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1 my-2">
          {items.map((item, j) => <li key={j} className="text-sm">{renderInline(item)}</li>)}
        </ol>
      );
      continue;
    } else if (line === "") {
      if (elements.length > 0) elements.push(<div key={`gap-${i}`} className="h-1.5" />);
    } else if (line.startsWith("|") && line.endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!lines[i].match(/^\|[-\s|]+\|$/)) tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length > 0) {
        const headers = tableLines[0].split("|").filter(c => c.trim()).map(c => c.trim());
        const rows = tableLines.slice(1).map(r => r.split("|").filter(c => c.trim()).map(c => c.trim()));
        elements.push(
          <div key={`table-${i}`} className="overflow-x-auto my-3">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  {headers.map((h, j) => <th key={j} className="px-3 py-2 text-left font-medium border border-border">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "" : "bg-muted/20"}>
                    {row.map((cell, ci) => <td key={ci} className="px-3 py-2 border border-border">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    } else {
      elements.push(<p key={i} className="text-sm leading-relaxed">{renderInline(line)}</p>);
    }
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function DiscrepancyCard({ data }: { data: DiscrepancyData }) {
  const { formatCurrency } = useRegion();
  const delta = parseFloat(data.delta);
  const isNegative = delta < 0;

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/20 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <span className="font-semibold text-amber-800 dark:text-amber-300">Balance Discrepancy — {data.account}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="rounded-lg bg-white dark:bg-background p-3 border border-amber-100 dark:border-amber-900">
          <div className="text-xs text-muted-foreground mb-1">You have</div>
          <div className="text-xl font-bold text-foreground">{formatCurrency(parseFloat(data.seen))}</div>
          <div className="text-xs text-muted-foreground">From screenshot</div>
        </div>
        <div className="rounded-lg bg-white dark:bg-background p-3 border border-amber-100 dark:border-amber-900">
          <div className="text-xs text-muted-foreground mb-1">We recorded</div>
          <div className="text-xl font-bold text-foreground">{formatCurrency(parseFloat(data.recorded))}</div>
          <div className="text-xs text-muted-foreground">In DuitPlan</div>
        </div>
      </div>
      <div className={cn(
        "rounded-lg p-3 flex items-center justify-between",
        isNegative ? "bg-red-100 dark:bg-red-950/30" : "bg-green-100 dark:bg-green-950/30"
      )}>
        <span className="text-sm font-medium">
          {isNegative ? "Missing" : "Extra"}: <span className={cn("font-bold", isNegative ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400")}>{formatCurrency(Math.abs(delta))}</span>
        </span>
        <Link href={`/accounts?account=${encodeURIComponent(data.account)}`}>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
            Reconcile now <ChevronRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function TransactionReviewCard({ uploadId }: { uploadId: string }) {
  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:bg-blue-950/20 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-2">
        <CheckSquare className="w-5 h-5 text-blue-600" />
        <span className="font-semibold text-blue-800 dark:text-blue-300">Transactions Staged for Review</span>
      </div>
      <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
        The transactions extracted from your document have been saved as pending. Review and confirm each one before they are added to your records.
      </p>
      <Link href={`/upload/${uploadId}/review`}>
        <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">
          Review extracted transactions <ChevronRight className="w-3 h-3" />
        </Button>
      </Link>
    </div>
  );
}

function MiniChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const { formatCurrency } = useRegion();
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="mt-4">
      <div className="text-xs text-white/60 mb-2">Spending Breakdown</div>
      <div className="space-y-1.5">
        {data.slice(0, 4).map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="text-xs text-white/70 w-16 truncate">{item.label}</div>
            <div className="flex-1 bg-white/20 rounded-full h-1.5">
              <div
                className="bg-white/80 h-1.5 rounded-full"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
            <div className="text-xs text-white/70 w-14 text-right">{formatCurrency(item.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShareCardModal({ insight, onClose }: { insight: InsightData; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true });
    const link = document.createElement("a");
    link.download = "duitplan-insight.jpg";
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  };

  const handleCopy = async () => {
    if (!cardRef.current) return;
    setCopying(true);
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true });
      canvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        }
        setCopying(false);
      }, "image/png");
    } catch {
      setCopying(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Share your insight</DialogTitle>
        </DialogHeader>
        <div
          ref={cardRef}
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #6d28d9 0%, #7c3aed 40%, #4f46e5 100%)",
            padding: "2rem",
            minHeight: "300px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-sm">DuitPlan AI</span>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {insight.metric && (
              <div className="text-4xl font-black text-white mb-2 leading-none">{insight.metric}</div>
            )}
            <div className="text-lg font-bold text-white mb-1 leading-tight">{insight.headline}</div>
            <div className="text-white/80 text-sm">{insight.subheadline}</div>
            {insight.chartData && <MiniChart data={insight.chartData} />}
          </div>

          <div className="mt-6 pt-4 border-t border-white/20 flex items-center justify-between">
            <span className="text-white/60 text-xs">{insight.period}</span>
            <span className="text-white font-bold text-sm">DuitPlan</span>
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={handleDownload}>
            <Download className="w-4 h-4" /> Download
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={handleCopy} disabled={copying}>
            <Copy className="w-4 h-4" /> {copying ? "Copying..." : "Copy"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MessageBubble({ message, onShare }: { message: Message; onShare?: (id: string) => void }) {
  const isUser = message.role === "user";
  const discrepancy = !isUser ? parseDiscrepancy(message.content) : null;
  const insight = !isUser ? parseInsight(message.content) : null;
  const displayContent = !isUser ? stripSpecialBlocks(message.content) : message.content;

  return (
    <div className={cn("flex gap-3 max-w-3xl", isUser ? "ml-auto flex-row-reverse" : "mr-auto")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start", "max-w-[85%]")}>
        {message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((att, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden border bg-muted/20">
                {att.mimeType.startsWith("image/") ? (
                  <img src={att.url} alt={att.name} className="max-w-[200px] max-h-[200px] object-cover" />
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{att.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className={cn(
          "rounded-2xl px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted/60 dark:bg-muted/30 text-foreground rounded-tl-sm border"
        )}>
          {message.isStreaming && !displayContent ? (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          ) : isUser ? (
            <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
          ) : (
            renderMarkdownContent(displayContent)
          )}
        </div>

        {discrepancy && <DiscrepancyCard data={discrepancy} />}

        {message.pendingUploadId && !message.isStreaming && (
          <TransactionReviewCard uploadId={message.pendingUploadId} />
        )}

        {insight && !isUser && (
          <div className="flex items-start gap-3 rounded-xl border bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 p-4 border-violet-200 dark:border-violet-800 w-full">
            <div className="flex-1">
              {insight.metric && <div className="text-2xl font-black text-violet-700 dark:text-violet-300">{insight.metric}</div>}
              <div className="font-semibold text-sm text-foreground">{insight.headline}</div>
              <div className="text-xs text-muted-foreground">{insight.period}</div>
            </div>
            {onShare && !message.isStreaming && (
              <Button size="sm" variant="outline" className="gap-1 h-8 text-xs shrink-0" onClick={() => onShare(message.id)}>
                <Share2 className="w-3 h-3" /> Share
              </Button>
            )}
          </div>
        )}

        {!isUser && !insight && !message.isStreaming && onShare && (
          <button
            onClick={() => onShare(message.id)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Share2 className="w-3 h-3" /> Share insight
          </button>
        )}
      </div>
    </div>
  );
}

export default function AgentPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentMeta[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [fileError, setFileError] = useState<string>("");
  const [shareCardData, setShareCardData] = useState<InsightData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { region } = useRegion();

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const data = (await apiGet("/api/agent/conversations")) as Conversation[];
      setConversations(data);
      if (data.length > 0) {
        selectConversation(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load conversations", err);
    }
  };

  const selectConversation = async (id: string) => {
    setActiveConversationId(id);
    setIsLoadingMessages(true);
    try {
      const data = (await apiGet(`/api/agent/conversations/${id}/messages`)) as Message[];
      setMessages(data);
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const createNewConversation = async (title = "New Chat") => {
    const convo = (await apiPost("/api/agent/conversations", { title })) as Conversation;
    setConversations(prev => [convo, ...prev]);
    setActiveConversationId(convo.id);
    setMessages([]);
    return convo;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFileError("");
    const newFiles = Array.from(e.target.files);

    for (const file of newFiles) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setFileError(`"${file.name}" exceeds the 10 MB limit.`);
        continue;
      }
      const fileType: "image" | "pdf" = file.type.startsWith("image/") ? "image" : "pdf";
      const previewUrl = fileType === "image" ? URL.createObjectURL(file) : undefined;

      const meta: AttachmentMeta = {
        name: file.name,
        mimeType: file.type,
        type: fileType,
        previewUrl,
        file,
        uploading: true,
      };

      setPendingAttachments(prev => {
        if (prev.length >= 5) return prev;
        return [...prev, meta];
      });

      uploadFileToStorage(file)
        .then((storageUrl) => {
          setPendingAttachments(prev =>
            prev.map(a =>
              a.file === file ? { ...a, storageUrl, uploading: false } : a
            )
          );
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Upload failed";
          setFileError(msg);
          setPendingAttachments(prev =>
            prev.map(a =>
              a.file === file ? { ...a, uploading: false, uploadError: msg } : a
            )
          );
        });
    }

    e.target.value = "";
  };

  const removeAttachment = (idx: number) => {
    setPendingAttachments(prev => {
      const att = prev[idx];
      if (att?.previewUrl) URL.revokeObjectURL(att.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const sendMessage = async (conversationId: string, text: string, attachments: AttachmentMeta[]) => {
    setIsSending(true);

    const readyAttachments = attachments.filter(a => a.storageUrl && !a.uploadError);

    const storedAttachments: StoredAttachment[] = readyAttachments.map(a => ({
      url: a.previewUrl ?? a.storageUrl ?? a.name,
      name: a.name,
      mimeType: a.mimeType,
    }));

    const optimisticUserMsgId = `temp-${Date.now()}`;
    const optimisticUserMsg: Message = {
      id: optimisticUserMsgId,
      conversationId,
      role: "user",
      content: text || "Attached file for analysis.",
      attachments: storedAttachments,
      createdAt: new Date().toISOString(),
    };

    const streamingMsgId = `streaming-${Date.now()}`;
    const streamingMsg: Message = {
      id: streamingMsgId,
      conversationId,
      role: "assistant",
      content: "",
      attachments: [],
      createdAt: new Date().toISOString(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, optimisticUserMsg, streamingMsg]);
    setPendingAttachments([]);

    try {
      interface ChatAttachment {
        url: string;
        name: string;
        mimeType: string;
        type: "image" | "pdf";
      }

      const chatAttachments: ChatAttachment[] = readyAttachments.map(a => ({
        url: a.storageUrl!,
        name: a.name,
        mimeType: a.mimeType,
        type: a.type,
      }));

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: text || "Please analyze the attached file.",
          attachments: chatAttachments,
        }),
        credentials: "include",
      });

      if (!response.ok || !response.body) throw new Error("Stream request failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalMessageId = streamingMsgId;
      let userMessageId = optimisticUserMsgId;
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            interface SSEEvent {
              type: string;
              userMessageId?: string;
              delta?: string;
              messageId?: string;
              uploadId?: string | null;
              error?: string;
            }
            const event = JSON.parse(jsonStr) as SSEEvent;
            if (event.type === "userMessageId" && event.userMessageId) {
              userMessageId = event.userMessageId;
              setMessages(prev => prev.map(m =>
                m.id === optimisticUserMsgId ? { ...m, id: userMessageId } : m
              ));
            } else if (event.type === "delta" && event.delta) {
              accumulated += event.delta;
              const snap = accumulated;
              setMessages(prev => prev.map(m =>
                m.id === streamingMsgId ? { ...m, content: snap } : m
              ));
            } else if (event.type === "done" && event.messageId) {
              finalMessageId = event.messageId;
              setMessages(prev => prev.map(m =>
                m.id === streamingMsgId
                  ? { ...m, id: finalMessageId, isStreaming: false, pendingUploadId: event.uploadId ?? null }
                  : m
              ));
            } else if (event.type === "error") {
              throw new Error(event.error ?? "Unknown error");
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }

      setConversations(prev => prev.map(c =>
        c.id === conversationId ? { ...c, updatedAt: new Date().toISOString() } : c
      ));
    } catch (err) {
      console.error("Send failed", err);
      setMessages(prev => prev.filter(m => m.id !== streamingMsgId && m.id !== optimisticUserMsgId));
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() && pendingAttachments.length === 0) return;
    if (pendingAttachments.some(a => a.uploading)) return;

    const text = inputText.trim();
    const attachments = [...pendingAttachments];
    setInputText("");

    let conversationId = activeConversationId;
    if (!conversationId) {
      try {
        const title = text.substring(0, 40) || "New Chat";
        const convo = await createNewConversation(title);
        conversationId = convo.id;
      } catch (err) {
        console.error("Failed to create conversation", err);
        return;
      }
    }

    await sendMessage(conversationId, text, attachments);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleShare = async (messageId: string) => {
    try {
      const data = (await apiPost("/api/agent/share-card", { messageId })) as InsightData;
      setShareCardData(data);
    } catch (err) {
      console.error("Share failed", err);
    }
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const anyUploading = pendingAttachments.some(a => a.uploading);

  return (
    <div className="flex h-[calc(100dvh-64px)] md:h-screen -m-4 md:-m-8">
      <div className="hidden md:flex w-64 flex-col border-r bg-muted/20">
        <div className="p-4 border-b">
          <Button className="w-full gap-2" onClick={() => createNewConversation()}>
            <Plus className="w-4 h-4" /> New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No conversations yet</p>
            ) : conversations.map(convo => (
              <button
                key={convo.id}
                onClick={() => selectConversation(convo.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  convo.id === activeConversationId
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted/50"
                )}
              >
                <div className="truncate">{convo.title}</div>
                <div className="text-xs text-muted-foreground">{new Date(convo.updatedAt).toLocaleDateString(region.locale)}</div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-4 py-3 bg-background flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-sm">DuitPlan AI</div>
            <div className="text-xs text-muted-foreground">
              {activeConversation?.title || "Your financial assistant"}
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" className="gap-1 md:hidden" onClick={() => createNewConversation()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {!activeConversationId ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">DuitPlan AI</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Your personal finance assistant. Upload receipts, check balances, ask questions, and get smart insights about your money.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full">
                {[
                  "How much did I spend this month?",
                  "Analyze this receipt",
                  "What's my biggest spending category?",
                  "Give me tips to save more money",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInputText(prompt)}
                    className="text-left px-4 py-3 rounded-xl border bg-background hover:bg-muted/50 transition-colors text-sm"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : isLoadingMessages ? (
            <div className="flex items-center justify-center h-full py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <p className="text-muted-foreground text-sm">Start the conversation — ask a question or attach a receipt or bank statement screenshot.</p>
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {messages.map(message => (
                <MessageBubble key={message.id} message={message} onShare={handleShare} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-4 bg-background shrink-0">
          {fileError && (
            <div className="mb-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" /> {fileError}
              <button onClick={() => setFileError("")} className="ml-auto"><X className="w-3 h-3" /></button>
            </div>
          )}

          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {pendingAttachments.map((att, i) => (
                <div key={i} className="relative group">
                  {att.type === "image" && att.previewUrl ? (
                    <div className="relative rounded-lg overflow-hidden border w-14 h-14">
                      <img src={att.previewUrl} alt={att.name} className="w-full h-full object-cover" />
                      {att.uploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        </div>
                      )}
                      {att.uploadError && (
                        <div className="absolute inset-0 bg-red-500/60 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <button
                        onClick={() => removeAttachment(i)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5 text-sm">
                      {att.uploading ? (
                        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="max-w-[100px] truncate text-xs">{att.name}</span>
                      <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic,.pdf,application/pdf"
              onChange={handleFileChange}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => { setFileError(""); fileInputRef.current?.click(); }}
              disabled={isSending}
              title="Attach images or PDFs (max 10 MB each)"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeConversationId ? "Ask DuitPlan AI anything..." : "Start a conversation..."}
              className="min-h-[44px] max-h-32 resize-none rounded-xl py-2.5"
              rows={1}
              disabled={isSending}
            />
            <Button
              className="h-10 w-10 shrink-0"
              size="icon"
              onClick={handleSend}
              disabled={isSending || anyUploading || (!inputText.trim() && pendingAttachments.length === 0)}
              title={anyUploading ? "Uploading files..." : "Send"}
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {anyUploading ? "Uploading files to secure storage..." : "Attach receipts or bank screenshots for automatic analysis · Max 10 MB per file"}
          </p>
        </div>
      </div>

      {shareCardData && (
        <ShareCardModal insight={shareCardData} onClose={() => setShareCardData(null)} />
      )}
    </div>
  );
}
