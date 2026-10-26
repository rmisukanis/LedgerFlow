// Field lists for the Batch builder. Required flags follow the Intuit docs
// (https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/<entity>).
export type FieldKind = "text" | "number" | "bool" | "ref" | "email" | "phone" | "json"

export interface BatchField {
  name: string
  kind: FieldKind
  required?: boolean
  hint?: string
}

export interface EntitySchema {
  fields: BatchField[]
  lineFields?: BatchField[]
}

const common: BatchField[] = [
  { name: "TxnDate", kind: "text", hint: "YYYY-MM-DD" },
  { name: "DueDate", kind: "text", hint: "YYYY-MM-DD" },
  { name: "DocNumber", kind: "text" },
  { name: "PrivateNote", kind: "text" },
  { name: "CurrencyRef", kind: "ref", hint: "Currency code, e.g. USD (required if multicurrency is on)" },
  { name: "DepartmentRef", kind: "ref", hint: "Department Id" },
  { name: "SalesTermRef", kind: "ref", hint: "Term Id" },
  { name: "ExchangeRate", kind: "number" },
]

const contact: BatchField[] = [
  { name: "Title", kind: "text" },
  { name: "GivenName", kind: "text" },
  { name: "MiddleName", kind: "text" },
  { name: "FamilyName", kind: "text" },
  { name: "Suffix", kind: "text" },
  { name: "CompanyName", kind: "text" },
  { name: "PrimaryEmailAddr", kind: "email", hint: "Email address" },
  { name: "PrimaryPhone", kind: "phone", hint: "Phone number" },
  { name: "Mobile", kind: "phone" },
  { name: "Fax", kind: "phone" },
  { name: "PrintOnCheckName", kind: "text" },
  { name: "Active", kind: "bool", hint: "TRUE / FALSE" },
  { name: "BillAddr", kind: "json", hint: 'JSON, e.g. {"Line1":"1 Main St","City":"Austin"}' },
]

export const BATCH_SCHEMAS: Record<string, EntitySchema> = {
  Bill: {
    fields: [
      { name: "VendorRef", kind: "ref", required: true, hint: "Vendor Id" },
      { name: "APAccountRef", kind: "ref", hint: "Accounts Payable account Id" },
      ...common,
    ],
    lineFields: [
      { name: "Line.Amount", kind: "number", required: true },
      { name: "Line.AccountRef", kind: "ref", required: true, hint: "Expense account Id" },
      { name: "Line.CustomerRef", kind: "ref", hint: "Customer Id — required when the account is Accounts Receivable" },
      { name: "Line.Description", kind: "text" },
    ],
  },
  Purchase: {
    fields: [
      { name: "PaymentType", kind: "text", required: true, hint: "Cash, Check or CreditCard" },
      { name: "AccountRef", kind: "ref", required: true, hint: "Bank or credit card account paid from" },
      { name: "EntityRef", kind: "ref", hint: "Payee (vendor) Id" },
      { name: "TxnDate", kind: "text", hint: "YYYY-MM-DD" },
      { name: "DocNumber", kind: "text" },
      { name: "PrivateNote", kind: "text" },
      { name: "PaymentMethodRef", kind: "ref", hint: "Payment method Id" },
      { name: "CurrencyRef", kind: "ref", hint: "Currency code, e.g. USD (required if multicurrency is on)" },
      { name: "DepartmentRef", kind: "ref", hint: "Department Id" },
      { name: "ExchangeRate", kind: "number" },
    ],
    lineFields: [
      { name: "Line.Amount", kind: "number", required: true },
      { name: "Line.AccountRef", kind: "ref", required: true, hint: "Expense account Id" },
      { name: "Line.CustomerRef", kind: "ref", hint: "Customer Id — required when the account is Accounts Receivable" },
      { name: "Line.Description", kind: "text" },
    ],
  },
  Invoice: {
    fields: [
      { name: "CustomerRef", kind: "ref", required: true, hint: "Customer Id" },
      { name: "ShipDate", kind: "text", hint: "YYYY-MM-DD" },
      { name: "TrackingNum", kind: "text" },
      { name: "BillEmail", kind: "email" },
      ...common,
    ],
    lineFields: [
      { name: "Line.Amount", kind: "number", required: true },
      { name: "Line.ItemRef", kind: "ref", required: true, hint: "Item Id" },
      { name: "Line.Qty", kind: "number" },
      { name: "Line.UnitPrice", kind: "number" },
      { name: "Line.Description", kind: "text" },
    ],
  },
  Customer: {
    fields: [
      { name: "DisplayName", kind: "text", required: true, hint: "Must be unique" },
      ...contact,
      { name: "Taxable", kind: "bool" },
      { name: "Notes", kind: "text" },
      { name: "ParentRef", kind: "ref", hint: "Parent customer Id" },
      { name: "PaymentMethodRef", kind: "ref" },
    ],
  },
  Vendor: {
    fields: [
      { name: "DisplayName", kind: "text", required: true, hint: "Must be unique" },
      ...contact,
      { name: "AcctNum", kind: "text" },
      { name: "TaxIdentifier", kind: "text" },
      { name: "TermRef", kind: "ref", hint: "Term Id" },
    ],
  },
}
