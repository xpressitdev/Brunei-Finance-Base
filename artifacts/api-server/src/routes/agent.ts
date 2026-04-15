import { Router, type IRouter, type Response } from "express";
import { eq, and, desc, isNull, gte, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
type ChatCompletionContentPartText = { type: "text"; text: string };
type ChatCompletionContentPartImage = {
  type: "image_url";
  image_url: { url: string; detail: "high" | "low" | "auto" };
};
type ChatCompletionContentPart = ChatCompletionContentPartText | ChatCompletionContentPartImage;
type ChatCompletionMessageParam =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ChatCompletionContentPart[] }
  | { role: "assistant"; content: string };
import {
  db,
  agentConversations,
  agentMessages,
  transactionsTable,
  accountsTable,
  profilesTable,
  categoriesTable,
  uploadedDocumentsTable,
  importedTransactionRowsTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

const AGENT_UPLOAD_PREFIX = "/objects/agent-uploads/";

function validateAttachmentOwnership(storageUrl: string, userId: string): string | null {
  const pathMatch = storageUrl.match(/\/api\/storage\/objects\/(.+)/);
  if (!pathMatch) return null;
  const objectPath = `/objects/${pathMatch[1]}`;

  if (!objectPath.startsWith(AGENT_UPLOAD_PREFIX)) {
    return null;
  }

  const owner = objectStorage.extractAgentUploadOwner(objectPath);
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!owner || owner !== safeUserId) {
    return null;
  }

  return objectPath;
}

async function downloadStorageFileAsBuffer(storageUrl: string, userId: string): Promise<Buffer | null> {
  const objectPath = validateAttachmentOwnership(storageUrl, userId);
  if (!objectPath) return null;
  try {
    const objectFile = await objectStorage.getObjectEntityFile(objectPath);
    const response = await objectStorage.downloadObject(objectFile);
    if (!response.body) return null;
    const chunks: Uint8Array[] = [];
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks.map(c => Buffer.from(c)));
  } catch (err) {
    if (err instanceof ObjectNotFoundError) return null;
    throw err;
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfMod = await import("pdf-parse");
  const pdfParse = (pdfMod as unknown as { default: (b: Buffer) => Promise<{ text: string }> }).default
    ?? (pdfMod as unknown as (b: Buffer) => Promise<{ text: string }>);
  const data = await pdfParse(buffer);
  return data.text || "";
}

interface SpendingByCategoryRow { categoryName: string; total: number }
interface ContextData {
  profile: { monthlyIncome?: string; fullName?: string } | null;
  accounts: Array<{ name: string; balance: string; bankName: string | null }>;
  recentTransactions: Array<{ date: Date; amount: string; type: string; description: string | null; categoryId: string | null }>;
  uncategorizedCount: number;
  spendingByCategory: SpendingByCategoryRow[];
  currentMonthSpend: number;
  currentMonthIncome: number;
}

function buildSystemPrompt(ctx: ContextData): string {
  const income = ctx.profile?.monthlyIncome
    ? `BND ${parseFloat(ctx.profile.monthlyIncome).toFixed(2)}`
    : "unknown";
  const name = ctx.profile?.fullName || "the user";

  const accountsSummary = ctx.accounts.length > 0
    ? ctx.accounts.map(a =>
        `  - ${a.name} (${a.bankName || "Bank"}): BND ${parseFloat(a.balance).toFixed(2)}`
      ).join("\n")
    : "  No accounts on record.";

  const recentTxns = ctx.recentTransactions.slice(0, 15).map(t =>
    `  - ${t.date.toISOString().split("T")[0]}: ${t.description || "Transaction"} — ` +
    `${t.type === "debit" ? "-" : "+"}BND ${parseFloat(t.amount).toFixed(2)}` +
    (t.categoryId ? "" : " [uncategorized]")
  ).join("\n") || "  No recent transactions.";

  const spendingLines = ctx.spendingByCategory.length > 0
    ? ctx.spendingByCategory.map(r =>
        `  - ${r.categoryName}: BND ${r.total.toFixed(2)}`
      ).join("\n")
    : "  No spending data yet.";

  const thisMonth = new Date().toLocaleString("en-BN", { month: "long", year: "numeric" });

  return `You are DuitPlan AI, a friendly and knowledgeable personal finance assistant for ${name} based in Brunei Darussalam (currency: BND).

=== USER'S FINANCIAL CONTEXT ===

Monthly Income (profile): ${income}
Accounts (current balances):
${accountsSummary}

${thisMonth} Summary:
  Total spent this month: BND ${ctx.currentMonthSpend.toFixed(2)}
  Total received this month: BND ${ctx.currentMonthIncome.toFixed(2)}
  Uncategorized transactions: ${ctx.uncategorizedCount}

Spending by Category (${thisMonth}):
${spendingLines}

Recent Transactions (last 15, [uncategorized] = needs a category):
${recentTxns}

=== YOUR OPERATING MODES ===

You automatically select one of three modes per message:

MODE 1 — DOCUMENT MODE: Triggered when the user attaches an image or provides PDF text.
  • Parse every line item you can find in the document
  • Show the user a concise summary first (e.g., "I found 3 transactions totalling BND 47.50")
  • ALWAYS output the structured \`\`\`transactions\`\`\` block below so items can be staged for import
  • Then ask: "Shall I add these to your records?" — wait for confirmation before telling the user the import is in progress

MODE 2 — BALANCE CHECK MODE: Triggered when a screenshot shows a bank balance figure.
  • Identify the account name from the screenshot text  
  • Cross-reference with accounts listed above
  • If the balance differs by more than BND 0.01, output the \`\`\`discrepancy\`\`\` block below
  • Explain the difference and suggest reconciling via Settings → Accounts

MODE 3 — CONVERSATION MODE: All other questions.
  • Answer financial questions using the context above
  • Proactively flag ${ctx.uncategorizedCount} uncategorized transactions if relevant
  • Suggest practical tips specific to Brunei (e.g., Baiduri, BIBD, BND amounts)
  • When sharing a notable finding, output the \`\`\`insight\`\`\` block below

=== SPECIAL RESPONSE FORMATS ===
(Use EXACTLY as shown — the app renders these as interactive cards)

For balance discrepancies (Mode 2):
\`\`\`discrepancy
{"account":"ACCOUNT_NAME","recorded":"0.00","seen":"0.00","delta":"0.00"}
\`\`\`
(delta = seen − recorded; use the exact account name from the Accounts list above)

For extracted transactions (Mode 1 — REQUIRED when parsing a document):
\`\`\`transactions
[{"date":"YYYY-MM-DD","description":"Merchant Name","amount":"0.00","type":"debit","category":"food"}]
\`\`\`
(type: "debit"=expense / "credit"=income; category one of: food, transport, shopping, utilities, healthcare, entertainment, education, other)

For shareable insights (Mode 3, optional):
\`\`\`insight
{"headline":"TEXT","subheadline":"TEXT","metric":"BND 0.00","period":"${thisMonth}"}
\`\`\`

Today: ${new Date().toISOString().split("T")[0]}.`;
}

const ALLOWED_AGENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
const MAX_AGENT_FILE_BYTES = 10 * 1024 * 1024;

router.post("/agent/uploads/request-url", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, size, contentType } = req.body as { name?: string; size?: number; contentType?: string };
  if (!name || !contentType) {
    res.status(400).json({ error: "name and contentType are required" });
    return;
  }
  if (!ALLOWED_AGENT_MIME_TYPES.has(contentType)) {
    res.status(422).json({ error: `File type "${contentType}" is not allowed. Supported: JPEG, PNG, WebP, HEIC, PDF.` });
    return;
  }
  if (typeof size === "number" && size > MAX_AGENT_FILE_BYTES) {
    res.status(422).json({ error: `File exceeds the 10 MB limit (${(size / 1024 / 1024).toFixed(1)} MB sent).` });
    return;
  }
  try {
    const { uploadURL, objectPath } = await objectStorage.getAgentUploadURL(req.userId!);
    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.get("/agent/conversations", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const convos = await db
    .select()
    .from(agentConversations)
    .where(eq(agentConversations.userId, req.userId!))
    .orderBy(desc(agentConversations.updatedAt))
    .limit(20);

  res.json(convos.map(c => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  })));
});

router.post("/agent/conversations", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = uuidv4();
  const [convo] = await db.insert(agentConversations).values({
    id,
    userId: req.userId!,
    title: req.body.title || "New Chat",
  }).returning();

  res.status(201).json({
    id: convo.id,
    title: convo.title,
    createdAt: convo.createdAt.toISOString(),
    updatedAt: convo.updatedAt.toISOString(),
  });
});

router.get("/agent/conversations/:id/messages", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [convo] = await db
    .select()
    .from(agentConversations)
    .where(and(eq(agentConversations.id, req.params.id), eq(agentConversations.userId, req.userId!)))
    .limit(1);

  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const msgs = await db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.conversationId, req.params.id))
    .orderBy(agentMessages.createdAt);

  res.json(msgs.map(m => ({
    id: m.id,
    conversationId: m.conversationId,
    role: m.role,
    content: m.content,
    attachments: m.attachments ?? [],
    createdAt: m.createdAt.toISOString(),
  })));
});

router.post("/agent/conversations/:id/messages", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [convo] = await db
    .select()
    .from(agentConversations)
    .where(and(eq(agentConversations.id, req.params.id), eq(agentConversations.userId, req.userId!)))
    .limit(1);

  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const { role, content, attachments } = req.body as {
    role: "user" | "assistant";
    content: string;
    attachments?: Array<{ url: string; name: string; mimeType: string }>;
  };

  if (!role || !content) {
    res.status(400).json({ error: "role and content are required" });
    return;
  }

  const msgId = uuidv4();
  const [msg] = await db.insert(agentMessages).values({
    id: msgId,
    conversationId: req.params.id,
    role,
    content,
    attachments: attachments && attachments.length > 0 ? attachments : null,
  }).returning();

  await db.update(agentConversations)
    .set({ updatedAt: new Date() })
    .where(eq(agentConversations.id, req.params.id));

  res.status(201).json({
    id: msg.id,
    conversationId: msg.conversationId,
    role: msg.role,
    content: msg.content,
    attachments: msg.attachments ?? [],
    createdAt: msg.createdAt.toISOString(),
  });
});

interface IncomingAttachment {
  url: string;
  name: string;
  mimeType: string;
  type: "image" | "pdf";
}

router.post("/agent/chat", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { conversationId, message, attachments = [] } = req.body as {
    conversationId: string;
    message: string;
    attachments?: IncomingAttachment[];
  };

  if (!conversationId || !message) {
    res.status(400).json({ error: "conversationId and message are required" });
    return;
  }

  const [convo] = await db
    .select()
    .from(agentConversations)
    .where(and(eq(agentConversations.id, conversationId), eq(agentConversations.userId, req.userId!)))
    .limit(1);

  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    [profile],
    accounts,
    recentTxns,
    spendingRows,
    history,
  ] = await Promise.all([
    db.select().from(profilesTable).where(eq(profilesTable.userId, req.userId!)).limit(1),
    db.select().from(accountsTable).where(eq(accountsTable.userId, req.userId!)),
    db
      .select({
        date: transactionsTable.date,
        amount: transactionsTable.amount,
        type: transactionsTable.type,
        description: transactionsTable.description,
        categoryId: transactionsTable.categoryId,
      })
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, req.userId!))
      .orderBy(desc(transactionsTable.date))
      .limit(15),
    db
      .select({
        categoryId: transactionsTable.categoryId,
        categoryName: categoriesTable.name,
        total: sql<number>`sum(${transactionsTable.amount}::numeric)`,
      })
      .from(transactionsTable)
      .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
      .where(and(
        eq(transactionsTable.userId, req.userId!),
        eq(transactionsTable.type, "debit"),
        gte(transactionsTable.date, monthStart),
      ))
      .groupBy(transactionsTable.categoryId, categoriesTable.name),
    db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.conversationId, conversationId))
      .orderBy(agentMessages.createdAt)
      .limit(20),
  ]);

  const [uncatRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.userId, req.userId!),
      isNull(transactionsTable.categoryId),
    ));
  const uncategorizedCount = Number(uncatRow?.count ?? 0);

  const spendingByCategory: Array<{ categoryName: string; total: number }> = spendingRows
    .map(r => ({ categoryName: r.categoryName ?? "Uncategorized", total: Number(r.total) }))
    .sort((a, b) => b.total - a.total);

  const currentMonthSpend = spendingRows.reduce((s, r) => s + Number(r.total), 0);

  const incomeRows = await db
    .select({ total: sql<number>`sum(${transactionsTable.amount}::numeric)` })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.userId, req.userId!),
      eq(transactionsTable.type, "credit"),
      gte(transactionsTable.date, monthStart),
    ));
  const currentMonthIncome = Number(incomeRows[0]?.total ?? 0);

  const systemPrompt = buildSystemPrompt({
    profile: profile ? { monthlyIncome: profile.monthlyIncome, fullName: profile.fullName } : null,
    accounts: accounts.map(a => ({ name: a.name, balance: a.balance, bankName: a.bankName })),
    recentTransactions: recentTxns,
    uncategorizedCount,
    spendingByCategory,
    currentMonthSpend,
    currentMonthIncome,
  });

  const historyMessages: ChatCompletionMessageParam[] = history.map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let userTextContent = message;
  const userContentParts: ChatCompletionContentPart[] = [];

  for (const att of attachments) {
    if (att.type === "image" && att.url) {
      const buffer = await downloadStorageFileAsBuffer(att.url, req.userId!).catch(() => null);
      if (buffer) {
        const base64 = buffer.toString("base64");
        userContentParts.push({
          type: "image_url",
          image_url: {
            url: `data:${att.mimeType};base64,${base64}`,
            detail: "high",
          },
        });
      }
    } else if (att.type === "pdf" && att.url) {
      const buffer = await downloadStorageFileAsBuffer(att.url, req.userId!).catch(() => null);
      if (buffer) {
        const pdfText = await extractPdfText(buffer).catch(() => "");
        if (pdfText) {
          userTextContent += `\n\n--- PDF: ${att.name} ---\n${pdfText.substring(0, 4000)}\n--- End PDF ---`;
        } else {
          userTextContent += `\n\n[PDF attached: ${att.name} — content could not be extracted]`;
        }
      } else {
        userTextContent += `\n\n[PDF attached: ${att.name}]`;
      }
    }
  }

  const userContentFinal: ChatCompletionContentPart[] | string =
    userContentParts.length > 0
      ? [{ type: "text", text: userTextContent }, ...userContentParts]
      : userTextContent;

  const persistAttachments = attachments.map(a => ({
    url: a.url,
    name: a.name,
    mimeType: a.mimeType,
  }));

  const userMsgId = uuidv4();
  await db.insert(agentMessages).values({
    id: userMsgId,
    conversationId,
    role: "user",
    content: message,
    attachments: persistAttachments.length > 0 ? persistAttachments : null,
  });

  const openaiMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: userContentFinal },
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent({ type: "userMessageId", userMessageId: userMsgId });

  let assistantContent = "";

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 1024,
      messages: openaiMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        assistantContent += delta;
        sendEvent({ type: "delta", delta });
      }
    }

    const assistantMsgId = uuidv4();
    await db.insert(agentMessages).values({
      id: assistantMsgId,
      conversationId,
      role: "assistant",
      content: assistantContent,
      attachments: null,
    });

    await db.update(agentConversations)
      .set({ updatedAt: new Date() })
      .where(eq(agentConversations.id, conversationId));

    if (convo.title === "New Chat" && message.length > 5) {
      const shortTitle = message.length > 40 ? message.substring(0, 37) + "..." : message;
      await db.update(agentConversations)
        .set({ title: shortTitle })
        .where(eq(agentConversations.id, conversationId));
    }

    let uploadId: string | null = null;

    const txnsMatch = assistantContent.match(/```transactions\n([\s\S]*?)\n```/);
    if (txnsMatch) {
      try {
        const extractedTxns: Array<{
          date: string;
          description: string;
          amount: string;
          type: string;
          category: string;
        }> = JSON.parse(txnsMatch[1]);

        if (extractedTxns.length > 0) {
          const docId = uuidv4();
          const fileName = `agent_extracted_${Date.now()}.json`;

          await db.insert(uploadedDocumentsTable).values({
            id: docId,
            userId: req.userId!,
            fileName,
            storagePath: `/agent/${docId}/${fileName}`,
            bankType: "agent",
            parseStatus: "parsed",
          });

          const rowValues = extractedTxns.map(txn => ({
            id: uuidv4(),
            uploadedDocumentId: docId,
            rawDate: txn.date,
            rawDescription: txn.description,
            rawAmount: txn.amount,
            normalizedDate: new Date(txn.date),
            normalizedDescription: txn.description,
            normalizedAmount: txn.amount,
            type: txn.type || "debit",
            categorySuggestion: txn.category || "other",
            confidence: "0.85",
            status: "parsed",
          }));

          await db.insert(importedTransactionRowsTable).values(rowValues);
          uploadId = docId;
        }
      } catch {
        // skip staging on parse error
      }
    }

    sendEvent({ type: "done", messageId: assistantMsgId, uploadId });
  } catch (err) {
    sendEvent({ type: "error", error: "Failed to generate response" });
  }

  res.end();
});

router.post("/agent/share-card", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { messageId } = req.body as { messageId: string };

  if (!messageId) {
    res.status(400).json({ error: "messageId is required" });
    return;
  }

  const [msg] = await db
    .select({
      id: agentMessages.id,
      content: agentMessages.content,
      conversationId: agentMessages.conversationId,
      userId: agentConversations.userId,
    })
    .from(agentMessages)
    .innerJoin(agentConversations, eq(agentMessages.conversationId, agentConversations.id))
    .where(and(
      eq(agentMessages.id, messageId),
      eq(agentConversations.userId, req.userId!),
    ))
    .limit(1);

  if (!msg) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  const recentTxns = await db
    .select({
      amount: transactionsTable.amount,
      type: transactionsTable.type,
      categoryId: transactionsTable.categoryId,
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, req.userId!))
    .orderBy(desc(transactionsTable.date))
    .limit(30);

  const categorySpend: Record<string, number> = {};
  for (const txn of recentTxns.filter(t => t.type === "debit")) {
    const key = txn.categoryId ?? "Other";
    categorySpend[key] = (categorySpend[key] ?? 0) + parseFloat(txn.amount);
  }

  const chartData = Object.entries(categorySpend)
    .map(([label, value]) => ({ label, value: parseFloat(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const insightMatch = msg.content.match(/```insight\n([\s\S]*?)\n```/);
  let cardData: {
    headline: string;
    subheadline: string;
    metric: string;
    period: string;
    colorTheme: string;
    chartData: Array<{ label: string; value: number }>;
  };

  if (insightMatch) {
    try {
      const parsed = JSON.parse(insightMatch[1]) as {
        headline?: string;
        subheadline?: string;
        metric?: string;
        period?: string;
      };
      cardData = {
        headline: parsed.headline ?? "Financial Insight",
        subheadline: parsed.subheadline ?? "From DuitPlan AI",
        metric: parsed.metric ?? "",
        period: parsed.period ?? new Date().toLocaleDateString("en-BN", { month: "long", year: "numeric" }),
        colorTheme: "purple",
        chartData,
      };
    } catch {
      cardData = extractCardFromContent(msg.content, chartData);
    }
  } else {
    cardData = extractCardFromContent(msg.content, chartData);
  }

  res.json(cardData);
});

function extractCardFromContent(
  content: string,
  chartData: Array<{ label: string; value: number }>,
): {
  headline: string;
  subheadline: string;
  metric: string;
  period: string;
  colorTheme: string;
  chartData: Array<{ label: string; value: number }>;
} {
  const bndMatch = content.match(/BND\s*([\d,]+(?:\.\d{2})?)/i);
  const metric = bndMatch ? `BND ${bndMatch[1]}` : "";
  const lines = content.split("\n").filter(l => l.trim());
  const headline = lines[0]?.replace(/^#+\s*/, "").substring(0, 60) ?? "Financial Summary";

  return {
    headline,
    subheadline: "Your DuitPlan AI Insight",
    metric,
    period: new Date().toLocaleDateString("en-BN", { month: "long", year: "numeric" }),
    colorTheme: "purple",
    chartData,
  };
}

export default router;
