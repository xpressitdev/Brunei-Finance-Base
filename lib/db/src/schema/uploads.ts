import { pgTable, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const uploadedDocumentsTable = pgTable("uploaded_documents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  storagePath: text("storage_path").notNull(),
  bankType: text("bank_type").notNull(),
  parseStatus: text("parse_status").notNull().default("pending"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const importedTransactionRowsTable = pgTable("imported_transaction_rows", {
  id: text("id").primaryKey(),
  uploadedDocumentId: text("uploaded_document_id").notNull().references(() => uploadedDocumentsTable.id, { onDelete: "cascade" }),
  rawDate: text("raw_date"),
  rawDescription: text("raw_description"),
  rawAmount: text("raw_amount"),
  normalizedDate: timestamp("normalized_date", { withTimezone: true }),
  normalizedDescription: text("normalized_description"),
  normalizedAmount: numeric("normalized_amount", { precision: 12, scale: 2 }),
  type: text("type"),
  categorySuggestion: text("category_suggestion"),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  status: text("status").notNull().default("pending_review"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const merchantRulesTable = pgTable("merchant_rules", {
  id: text("id").primaryKey(),
  pattern: text("pattern").notNull(),
  categoryName: text("category_name").notNull(),
  priority: integer("priority").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUploadedDocumentSchema = createInsertSchema(uploadedDocumentsTable).omit({ uploadedAt: true });
export type InsertUploadedDocument = z.infer<typeof insertUploadedDocumentSchema>;
export type UploadedDocument = typeof uploadedDocumentsTable.$inferSelect;

export const insertImportedRowSchema = createInsertSchema(importedTransactionRowsTable).omit({ createdAt: true });
export type InsertImportedRow = z.infer<typeof insertImportedRowSchema>;
export type ImportedTransactionRow = typeof importedTransactionRowsTable.$inferSelect;
