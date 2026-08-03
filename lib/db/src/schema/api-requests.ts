import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const apiRequestsTable = pgTable("api_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  method: text("method").notNull().default("GET"),
  url: text("url").notNull(),
  headers: text("headers"),
  queryParams: text("query_params"),
  body: text("body"),
  bodyType: text("body_type").notNull().default("none"),
  codeSnippet: text("code_snippet"),
  language: text("language").notNull().default("javascript"),
  collectionId: integer("collection_id"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastStatusCode: integer("last_status_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertApiRequestSchema = createInsertSchema(apiRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApiRequest = z.infer<typeof insertApiRequestSchema>;
export type ApiRequest = typeof apiRequestsTable.$inferSelect;
