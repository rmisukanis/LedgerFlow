import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// One row is one saved fix: the payment account change and the deposit created for it. changed_at is when that fix was saved.
export const qbAuditTable = pgTable("qb_audit", {
  id: serial("id").primaryKey(),
  realmId: text("realm_id").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
  memo: text("memo").notNull().default(""),
  paymentId: text("payment_id").notNull(),
  txnDate: text("txn_date").notNull(),
  totalAmt: text("total_amt").notNull(),
  originalDepositAccount: text("original_deposit_account").notNull(),
  updatedDepositAccount: text("updated_deposit_account").notNull(),
  depositId: text("deposit_id").notNull().default(""),
  depositToAccountRef: text("deposit_to_account_ref").notNull(),
  depositToAccountRefName: text("deposit_to_account_ref_name").notNull().default(""),
  lineAmount: text("line_amount").notNull(),
  linkedTxnId: text("linked_txn_id").notNull(),
  linkedTxnType: text("linked_txn_type").notNull(),
  // Set when Reverse deletes the deposit and puts the payment back on its original account.
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
}, (table) => [
  index("qb_audit_realm_changed_at").on(table.realmId, table.changedAt),
]);

export type QbAudit = typeof qbAuditTable.$inferSelect;
