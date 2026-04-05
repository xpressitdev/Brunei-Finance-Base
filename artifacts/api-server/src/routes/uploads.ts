import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db, uploadedDocumentsTable, importedTransactionRowsTable, transactionsTable, categoriesTable } from "@workspace/db";
import { GetImportedRowsParams, ConfirmImportParams, ConfirmImportBody } from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

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

router.post("/uploads", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { bankType, inputMethod } = req.body as { bankType?: string; inputMethod?: string };
  if (!bankType || !["bibd", "baiduri"].includes(bankType)) {
    res.status(400).json({ error: "bankType must be 'bibd' or 'baiduri'" });
    return;
  }

  const isScreenshot = inputMethod === "screenshot";
  const ext = isScreenshot ? "jpg" : "pdf";
  const fileName = `statement_${bankType}_${Date.now()}.${ext}`;
  const docId = uuidv4();

  const [doc] = await db.insert(uploadedDocumentsTable).values({
    id: docId,
    userId: req.userId!,
    fileName,
    storagePath: `/uploads/${docId}/${fileName}`,
    bankType,
    parseStatus: "parsed",
  }).returning();

  const parsedRows = mockParseStatement(bankType, fileName);

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
    status: "pending_review",
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

  res.json(rows.map(r => ({
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
  })));
});

router.post("/uploads/:id/confirm", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
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
