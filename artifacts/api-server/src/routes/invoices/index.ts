import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db, invoicesTable } from "@workspace/db";
import { eq, ilike, or, sql } from "drizzle-orm";
import {
  ListInvoicesQueryParams,
  CreateInvoiceBody,
  GetInvoiceParams,
  UpdateInvoiceParams,
  UpdateInvoiceBody,
  DeleteInvoiceParams,
  ListInvoicesResponse,
  GetInvoiceResponse,
  CreateInvoiceResponse,
  UpdateInvoiceResponse,
  GetInvoiceSummaryResponse,
  BulkUploadInvoicesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function serializeInvoice(inv: Record<string, unknown>) {
  return {
    ...inv,
    amount: Number(inv.amount),
    taxAmount: inv.taxAmount != null ? Number(inv.taxAmount) : null,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate ?? null,
    qbInvoiceId: inv.qbInvoiceId ?? null,
    qbSyncedAt: inv.qbSyncedAt instanceof Date ? inv.qbSyncedAt.toISOString() : (inv.qbSyncedAt ?? null),
    createdAt: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : inv.createdAt,
    updatedAt: inv.updatedAt instanceof Date ? inv.updatedAt.toISOString() : inv.updatedAt,
  };
}

// GET /invoices
router.get("/invoices", async (req, res): Promise<void> => {
  const queryParams = ListInvoicesQueryParams.safeParse(req.query);
  const { status, search } = queryParams.success ? queryParams.data : { status: undefined, search: undefined };

  let query = db.select().from(invoicesTable).$dynamic();

  if (status && status !== "all") {
    query = query.where(eq(invoicesTable.status, status));
  } else if (search) {
    query = query.where(
      or(
        ilike(invoicesTable.customerName, `%${search}%`),
        ilike(invoicesTable.invoiceNumber, `%${search}%`)
      )
    );
  }

  const invoices = await query.orderBy(sql`${invoicesTable.createdAt} DESC`);
  res.json(ListInvoicesResponse.parse(invoices.map(serializeInvoice)));
});

// GET /invoices/summary
router.get("/invoices/summary", async (req, res): Promise<void> => {
  const all = await db.select().from(invoicesTable);
  const total = all.length;
  const totalAmount = all.reduce((s, i) => s + Number(i.amount), 0);
  const paid = all.filter((i) => i.status === "paid");
  const overdue = all.filter((i) => i.status === "overdue");
  const draft = all.filter((i) => i.status === "draft").length;
  const sent = all.filter((i) => i.status === "sent").length;

  res.json(
    GetInvoiceSummaryResponse.parse({
      total,
      totalAmount,
      paid: paid.length,
      paidAmount: paid.reduce((s, i) => s + Number(i.amount), 0),
      overdue: overdue.length,
      overdueAmount: overdue.reduce((s, i) => s + Number(i.amount), 0),
      draft,
      sent,
    })
  );
});

// POST /invoices/bulk-upload
router.post("/invoices/bulk-upload", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const amount = parseFloat(String(row["amount"] ?? row["Amount"] ?? 0));
        const issueDate = String(row["issueDate"] ?? row["issue_date"] ?? row["Issue Date"] ?? "").trim();
        const customerName = String(row["customerName"] ?? row["customer_name"] ?? row["Customer Name"] ?? "").trim();
        const invoiceNumber = String(row["invoiceNumber"] ?? row["invoice_number"] ?? row["Invoice Number"] ?? "").trim();

        if (!customerName || !invoiceNumber || !issueDate || isNaN(amount)) {
          errors.push(`Row ${i + 2}: missing required fields (invoiceNumber, customerName, amount, issueDate)`);
          failed++;
          continue;
        }

        await db.insert(invoicesTable).values({
          invoiceNumber,
          customerName,
          customerEmail: String(row["customerEmail"] ?? row["email"] ?? "") || undefined,
          description: String(row["description"] ?? "") || undefined,
          amount: String(amount),
          status: (String(row["status"] ?? "draft").toLowerCase() as "draft" | "sent" | "paid" | "overdue" | "cancelled") || "draft",
          issueDate,
          dueDate: String(row["dueDate"] ?? row["due_date"] ?? row["Due Date"] ?? "") || undefined,
        });
        created++;
      } catch (err) {
        errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : "unknown error"}`);
        failed++;
      }
    }

    res.json(BulkUploadInvoicesResponse.parse({ created, failed, errors }));
  } catch (err) {
    req.log.error({ err }, "Bulk upload failed");
    res.status(400).json({ error: "Failed to parse file" });
  }
});

// POST /invoices
router.post("/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      ...parsed.data,
      amount: String(parsed.data.amount),
      taxAmount: parsed.data.taxAmount != null ? String(parsed.data.taxAmount) : undefined,
    })
    .returning();

  res.status(201).json(CreateInvoiceResponse.parse(serializeInvoice(invoice as unknown as Record<string, unknown>)));
});

// GET /invoices/:id
router.get("/invoices/:id", async (req, res): Promise<void> => {
  const params = GetInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.json(GetInvoiceResponse.parse(serializeInvoice(invoice as unknown as Record<string, unknown>)));
});

// PATCH /invoices/:id
router.patch("/invoices/:id", async (req, res): Promise<void> => {
  const params = UpdateInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.amount != null) updateData.amount = String(parsed.data.amount);
  if (parsed.data.taxAmount != null) updateData.taxAmount = String(parsed.data.taxAmount);

  const [invoice] = await db
    .update(invoicesTable)
    .set(updateData)
    .where(eq(invoicesTable.id, params.data.id))
    .returning();

  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.json(UpdateInvoiceResponse.parse(serializeInvoice(invoice as unknown as Record<string, unknown>)));
});

// DELETE /invoices/:id
router.delete("/invoices/:id", async (req, res): Promise<void> => {
  const params = DeleteInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(invoicesTable).where(eq(invoicesTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
