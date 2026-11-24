import { boolean, numeric, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

// A parent row is one bank deposit, such as a Venmo Standard Transfer.
// transaction_id is the source id. A later upload of the same id is refused.
export const outsideDepositsTable = pgTable("outside_deposits", {
  id: serial("id").primaryKey(),
  transactionId: text("transaction_id").notNull(),
  template: text("template").notNull(),
  standardTransferId: text("standard_transfer_id").notNull(),
  txnDate: text("txn_date").notNull().default(""),
  timeUtc: text("time_utc").notNull().default(""),
  type: text("type").notNull().default(""),
  status: text("status").notNull().default(""),
  fromParty: text("from_party").notNull().default(""),
  toParty: text("to_party").notNull().default(""),
  noteInvoice: text("note_invoice").notNull().default(""),
  amountTotal: numeric("amount_total", { precision: 14, scale: 2 }),
  amountFee: numeric("amount_fee", { precision: 14, scale: 2 }),
  amountNet: numeric("amount_net", { precision: 14, scale: 2 }),
  fundingSource: text("funding_source").notNull().default(""),
  destination: text("destination").notNull().default(""),
  matchedInQuickbooks: boolean("matched_in_quickbooks").notNull().default(false),
  depositId: text("deposit_id").notNull().default(""),
  storedAt: timestamp("stored_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("outside_deposits_transaction_id").on(table.transactionId),
  unique("outside_deposits_standard_transfer_id").on(table.standardTransferId),
]);

// Rows that belong to a deposit. standard_transfer_id points at the parent deposit.
export const outsideDepositTransactionsTable = pgTable("outside_deposit_transactions", {
  id: serial("id").primaryKey(),
  transactionId: text("transaction_id").notNull(),
  template: text("template").notNull(),
  standardTransferId: text("standard_transfer_id").references(() => outsideDepositsTable.standardTransferId),
  txnDate: text("txn_date").notNull().default(""),
  timeUtc: text("time_utc").notNull().default(""),
  type: text("type").notNull().default(""),
  status: text("status").notNull().default(""),
  fromParty: text("from_party").notNull().default(""),
  toParty: text("to_party").notNull().default(""),
  noteInvoice: text("note_invoice").notNull().default(""),
  amountTotal: numeric("amount_total", { precision: 14, scale: 2 }),
  amountFee: numeric("amount_fee", { precision: 14, scale: 2 }),
  amountNet: numeric("amount_net", { precision: 14, scale: 2 }),
  fundingSource: text("funding_source").notNull().default(""),
  destination: text("destination").notNull().default(""),
  matchedInQuickbooks: boolean("matched_in_quickbooks").notNull().default(false),
  depositId: text("deposit_id").notNull().default(""),
  storedAt: timestamp("stored_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("outside_deposit_transactions_transaction_id").on(table.transactionId),
]);

export type OutsideDeposit = typeof outsideDepositsTable.$inferSelect;
export type OutsideDepositTransaction = typeof outsideDepositTransactionsTable.$inferSelect;
