import { numeric, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

// One row is one outside deposit transaction. transaction_id is the source id, so a later upload of the same transaction replaces the row.
export const outsideDepositsTable = pgTable("outside_deposits", {
  id: serial("id").primaryKey(),
  transactionId: text("transaction_id").notNull(),
  template: text("template").notNull(),
  standardTransferId: text("standard_transfer_id").notNull().default(""),
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
  storedAt: timestamp("stored_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("outside_deposits_transaction_id").on(table.transactionId),
]);

export type OutsideDeposit = typeof outsideDepositsTable.$inferSelect;
