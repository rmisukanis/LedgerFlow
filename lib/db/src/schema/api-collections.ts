import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const apiCollectionsTable = pgTable("api_collections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertApiCollectionSchema = createInsertSchema(apiCollectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApiCollection = z.infer<typeof insertApiCollectionSchema>;
export type ApiCollection = typeof apiCollectionsTable.$inferSelect;
