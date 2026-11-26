import { numeric, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

// One bank-statement line uploaded on Banking Feed. It is not a QuickBooks deposit until a person accepts it and a later step posts it.
export const bankingFeedLinesTable = pgTable("banking_feed_lines", {
  id: serial("id").primaryKey(),
  bankAccountId: text("bank_account_id").notNull(),
  bankAccountName: text("bank_account_name").notNull().default(""),
  txnDate: text("txn_date").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  lineKey: text("line_key").notNull(),
  // unmatched, matched, needs_review, excluded, accepted
  status: text("status").notNull().default("unmatched"),
  // already_on_register, link_payment, bill_payment, or blank
  action: text("action").notNull().default(""),
  qbEntity: text("qb_entity").notNull().default(""),
  qbId: text("qb_id").notNull().default(""),
  reason: text("reason").notNull().default(""),
  storedAt: timestamp("stored_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("banking_feed_lines_line_key").on(table.lineKey),
]);

export type BankingFeedLine = typeof bankingFeedLinesTable.$inferSelect;
