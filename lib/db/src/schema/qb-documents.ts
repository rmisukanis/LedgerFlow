import { jsonb, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

// One row is one QuickBooks record. payload is the full response, not the columns shown on Analysis.
export const qbDocumentsTable = pgTable("qb_documents", {
  id: serial("id").primaryKey(),
  realmId: text("realm_id").notNull(),
  entity: text("entity").notNull(),
  qbId: text("qb_id").notNull(),
  lastUpdatedTime: text("last_updated_time").notNull().default(""),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  storedAt: timestamp("stored_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("qb_documents_realm_entity_id").on(table.realmId, table.entity, table.qbId),
]);

export type QbDocument = typeof qbDocumentsTable.$inferSelect;
