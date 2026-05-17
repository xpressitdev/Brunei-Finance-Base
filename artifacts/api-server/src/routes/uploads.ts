import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, and, gte, lte } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, uploadedDocumentsTable, importedTransactionRowsTable, transactionsTable, categoriesTable } from "@workspace/db";
import { GetImportedRowsParams, ConfirmImportParams, ConfirmImportBody } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { requireAccess } from "../lib/access";
import { parseBibdStatement, type ParsedRow as BibdParsedRow } from "../lib/parsers/bibd.js";

const router: IRouter = Router();

// Multipart parser for /uploads. 20MB cap is plenty for a monthly statement
// PDF or a handful of phone screenshots. We keep the file in memory because
// the mock parser doesn't need disk persistence (real parser will read the
// buffer directly when wired up).
const uploadMw = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Mock parser for BIBD and Baiduri — generates placeholder transaction rows
function mockParseStatement(bankType: string, fileName: string): Array<{
  rawDate: string; rawDescription: string; rawAmount: string;
  normalizedDate: Date; normalizedDescription: string; normalizedAmount: string;
  type: string; categorySuggestion: string; confidence: string;
}> {
  const rows = [];
  const baseDate = new Date();
  const merchants = bankType === "bibd"
    ? ["GIANT SUPERSTORE", "PETRONAS SERIA", "KFC KIULAP", "MYDIN BATU", "COFFEE BEAN KB"]
    : ["JAYA HYPERMART", "SHELL TUTONG", "McDonalds BSB", "GUARDIAN YAYASAN", "BANDAR SERI CINEPLEX"];

  const cats = ["Groceries", "Fuel", "Dining", "Health", "Entertainment"];

  for (let i = 0; i < 5; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i * 3);
    const amount = (Math.random() * 80 + 5).toFixed(2);
    rows.push({
      rawDate: d.toLocaleDateString("en-GB"),
      rawDescription: merchants[i],
      rawAmount: amount,
      normalizedDate: d,
      normalizedDescription: merchants[i],
      normalizedAmount: amount,
      type: "debit",
      categorySuggestion: cats[i],
      confidence: (0.75 + Math.random() * 0.25).toFixed(4),
    });
  }
  return rows;
}

router.post("/uploads", requireAuth, requireAccess, uploadMw.single("file"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { bankType, inputMethod } = req.body as { bankType?: string; inputMethod?: string };
  if (!bankType || !["bibd", "baiduri"].includes(bankType)) {
    res.status(400).json({ error: "bankType must be 'bibd' or 'baiduri'" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "file is required" });
    return;
  }

  // Infer extension from the uploaded mime type; fall back to the bank
  // statement default (pdf) or screenshot (jpg) if mime is missing.
  const mime = req.file.mimetype ?? "";
  const isScreenshot = inputMethod === "screenshot" || mime.startsWith("image/");
  const ext = mime === "application/pdf"
    ? "pdf"
    : isScreenshot ? "jpg" : "pdf";
  const fileName = req.file.originalname || `statement_${bankType}_${Date.now()}.${ext}`;
  const docId = uuidv4();

  // Real parser for BIBD PDFs; Baiduri and screenshot uploads still use the
  // mock parser for now until those parsers are implemented.
  let parsedRows: BibdParsedRow[] | ReturnType<typeof mockParseStatement> = [];
  let parseStatus: "parsed" | "failed" = "parsed";
  let parseError: string | null = null;
  if (bankType === "bibd" && mime === "application/pdf") {
    try {
      parsedRows = await parseBibdStatement(req.file.buffer);
      if (parsedRows.length === 0) {
        parseStatus = "failed";
        parseError = "No transactions detected in the PDF";
      }
    } catch (e) {
      req.log.error({ err: e }, "BIBD PDF parse failed");
      parseStatus = "failed";
      parseError = e instanceof Error ? e.message : "Failed to read PDF";
    }
  } else {
    parsedRows = mockParseStatement(bankType, fileName);
  }

  if (parseStatus === "failed") {
    res.status(422).json({ error: parseError ?? "Could not parse statement" });
    return;
  }

  const [doc] = await db.insert(uploadedDocumentsTable).values({
    id: docId,
    userId: req.userId!,
    fileName,
    storagePath: `/uploads/${docId}/${fileName}`,
    bankType,
    parseStatus,
  }).returning();

  const rowValues = parsedRows.map(row => ({
    id: uuidv4(),
    uploadedDocumentId: docId,
    rawDate: row.rawDate,
    rawDescription: row.rawDescription,
    rawAmount: row.rawAmount,
    normalizedDate: row.normalizedDate,
    normalizedDescription: row.normalizedDescription,
    normalizedAmount: row.normalizedAmount,
    type: row.type,
    categorySuggestion: row.categorySuggestion,
    confidence: row.confidence,
    status: "parsed",
  }));

  await db.insert(importedTransactionRowsTable).values(rowValues);

  res.status(201).json({
    id: doc.id,
    userId: doc.userId,
    fileName: doc.fileName,
    storagePath: doc.storagePath,
    bankType: doc.bankType,
    parseStatus: doc.parseStatus,
    uploadedAt: doc.uploadedAt.toISOString(),
    rowCount: rowValues.length,
  });
});

router.get("/uploads/:id/rows", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetImportedRowsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const rows = await db.select().from(importedTransactionRowsTable)
    .where(eq(importedTransactionRowsTable.uploadedDocumentId, params.data.id));

  // Duplicate detection: pull all existing transactions for this user across
  // the date range covered by this import, then flag any imported row that
  // matches an existing row on (date, amount, type). We compare by Y-M-D so
  // a manual entry on 2026-04-12 collides with an import that says 2026-04-12
  // regardless of timezone artefacts.
  const dates = rows.map(r => r.normalizedDate).filter((d): d is Date => !!d);
  let existingKeys = new Set<string>();
  if (dates.length > 0) {
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    // Widen the window by a day on each side to dodge timezone edge cases.
    minDate.setUTCDate(minDate.getUTCDate() - 1);
    maxDate.setUTCDate(maxDate.getUTCDate() + 1);
    const existing = await db.select({
      date: transactionsTable.date,
      amount: transactionsTable.amount,
      type: transactionsTable.type,
    }).from(transactionsTable).where(and(
      eq(transactionsTable.userId, req.userId!),
      gte(transactionsTable.date, minDate),
      lte(transactionsTable.date, maxDate),
    ));
    existingKeys = new Set(existing.map(t => makeDupKey(t.date, t.amount, t.type)));
  }

  res.json(rows.map(r => {
    const isPossibleDuplicate = !!(r.normalizedDate && r.normalizedAmount && r.type
      && existingKeys.has(makeDupKey(r.normalizedDate, r.normalizedAmount, r.type)));
    return {
      id: r.id,
      uploadedDocumentId: r.uploadedDocumentId,
      rawDate: r.rawDate,
      rawDescription: r.rawDescription,
      rawAmount: r.rawAmount,
      normalizedDate: r.normalizedDate?.toISOString() ?? null,
      normalizedDescription: r.normalizedDescription,
      normalizedAmount: r.normalizedAmount,
      type: r.type,
      categorySuggestion: r.categorySuggestion,
      confidence: r.confidence,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      isPossibleDuplicate,
    };
  }));
});

// Build a stable comparison key from (date, amount, type). We normalise the
// date to YYYY-MM-DD (UTC) and the amount to a fixed-2dp string so a numeric
// "20" matches "20.00".
function makeDupKey(date: Date, amount: string, type: string): string {
  const d = date.toISOString().slice(0, 10);
  const a = Number(amount).toFixed(2);
  return `${d}|${a}|${type}`;
}

router.post("/uploads/:id/confirm", requireAuth, requireAccess, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = ConfirmImportParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = ConfirmImportBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  let imported = 0;
  let skipped = 0;

  for (const rowConf of body.data.rows) {
    if (rowConf.skip) {
      await db.update(importedTransactionRowsTable).set({ status: "skipped" })
        .where(eq(importedTransactionRowsTable.id, rowConf.rowId));
      skipped++;
      continue;
    }

    const [row] = await db.select().from(importedTransactionRowsTable)
      .where(eq(importedTransactionRowsTable.id, rowConf.rowId)).limit(1);

    if (!row || !row.normalizedDate || !row.normalizedAmount) {
      skipped++;
      continue;
    }

    if (row.status === "imported" || row.status === "skipped") {
      skipped++;
      continue;
    }

    // Defense in depth: even if the client ticked a row, refuse to insert it
    // if an identical transaction (same date+amount+type) already exists.
    // This protects against a user who edits the same statement twice or
    // clicks confirm after manually adding the row on another tab.
    if (row.normalizedDate && row.normalizedAmount && row.type) {
      const dayStart = new Date(row.normalizedDate);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(row.normalizedDate);
      dayEnd.setUTCHours(23, 59, 59, 999);
      const dup = await db.select({ id: transactionsTable.id }).from(transactionsTable).where(and(
        eq(transactionsTable.userId, req.userId!),
        eq(transactionsTable.amount, row.normalizedAmount),
        eq(transactionsTable.type, row.type),
        gte(transactionsTable.date, dayStart),
        lte(transactionsTable.date, dayEnd),
      )).limit(1);
      if (dup.length > 0) {
        await db.update(importedTransactionRowsTable).set({ status: "skipped" })
          .where(eq(importedTransactionRowsTable.id, row.id));
        skipped++;
        continue;
      }
    }

    let categoryId = rowConf.categoryId ?? null;
    if (!categoryId && row.categorySuggestion) {
      const [cat] = await db.select().from(categoriesTable)
        .where(eq(categoriesTable.name, row.categorySuggestion)).limit(1);
      categoryId = cat?.id ?? null;
    }

    await db.insert(transactionsTable).values({
      id: uuidv4(),
      userId: req.userId!,
      date: row.normalizedDate,
      amount: row.normalizedAmount,
      type: row.type ?? "debit",
      description: row.normalizedDescription ?? row.rawDescription ?? "Imported transaction",
      source: "import",
      categoryId,
      importedRowId: row.id,
    });

    await db.update(importedTransactionRowsTable).set({ status: "imported" })
      .where(eq(importedTransactionRowsTable.id, row.id));

    imported++;
  }

  res.json({ imported, skipped });
});

export default router;
