export interface QbCatalogEntry{folder:string;name:string;method:string;path:string;query:string;body:string;contentType:string;description:string}
export const QB_CATALOG: QbCatalogEntry[] = [
 {
  "folder": "Account",
  "name": "Create",
  "method": "POST",
  "path": "/account",
  "query": "",
  "body": "{\n  \"AccountType\": \"Accounts Receivable\",\n  \"Name\": \"AR4\"\n}",
  "contentType": "application/json",
  "description": "Create a new Account"
 },
 {
  "folder": "Account",
  "name": "ReadById",
  "method": "GET",
  "path": "/account/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Get the Account which has accountId as 1"
 },
 {
  "folder": "Account",
  "name": "Update",
  "method": "POST",
  "path": "/account",
  "query": "",
  "body": "{\n    \"Name\": \"AR3-Updated111\",\n    \"SubAccount\": false,\n    \"FullyQualifiedName\": \"AR3-Updated\",\n    \"Active\": true,\n    \"Classification\": \"Asset\",\n    \"AccountType\": \"Accounts Receivable\",\n    \"AccountSubType\": \"AccountsReceivable\",\n    \"CurrentBalance\": 0,\n    \"CurrentBalanceWithSubAccounts\": 0,\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"94\",\n    \"SyncToken\": \"3\"\n}\n",
  "contentType": "application/json",
  "description": "Update an account"
 },
 {
  "folder": "Account",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "Select * from Account STARTPOSITION 1 MAXRESULTS 5\n",
  "contentType": "text/plain",
  "description": "Get all customer records using generic 'Query' endpoint."
 },
 {
  "folder": "Attachable",
  "name": "Create",
  "method": "POST",
  "path": "/attachable",
  "query": "",
  "body": "{\n  \"AttachableRef\": [\n    {\n      \"EntityRef\": {\n        \"value\": \"130\",\n        \"type\": \"Invoice\"\n      },\n      \"IncludeOnSend\": \"false\"\n    }\n  ],\n  \"Note\": \"This is an attached note.\"\n}",
  "contentType": "application/json",
  "description": "Create an attachable object"
 },
 {
  "folder": "Attachable",
  "name": "ReadById",
  "method": "GET",
  "path": "/attachable/{id}",
  "query": "",
  "body": "",
  "contentType": "application/json",
  "description": "Retrieve an attachable object by Id"
 },
 {
  "folder": "Attachable",
  "name": "Update",
  "method": "POST",
  "path": "/attachable",
  "query": "",
  "body": "{\n    \"Note\": \"This is an attached note. Updated\",\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"5000000000000029383\",\n    \"SyncToken\": \"0\",\n    \"MetaData\": {\n      \"CreateTime\": \"2016-08-18T00:18:04-07:00\",\n      \"LastUpdatedTime\": \"2016-08-18T00:18:04-07:00\"\n    },\n    \"AttachableRef\": [\n      {\n        \"EntityRef\": {\n          \"value\": \"130\",\n          \"type\": \"Invoice\"\n        },\n        \"IncludeOnSend\": false\n      }\n    ]\n  }",
  "contentType": "application/json",
  "description": "Update an attachable object by Id"
 },
 {
  "folder": "Attachable",
  "name": "Delete",
  "method": "POST",
  "path": "/attachable",
  "query": "operation=delete",
  "body": "{\n    \"Note\": \"This is an attached note. Updated1\",\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"5000000000000029383\",\n    \"SyncToken\": \"2\",\n    \"MetaData\": {\n      \"CreateTime\": \"2016-08-18T00:18:04-07:00\",\n      \"LastUpdatedTime\": \"2016-08-18T00:18:04-07:00\"\n    },\n    \"AttachableRef\": [\n      {\n        \"EntityRef\": {\n          \"value\": \"130\",\n          \"type\": \"Invoice\"\n        },\n        \"IncludeOnSend\": false\n      }\n    ]\n  }",
  "contentType": "application/json",
  "description": "Delete an attachable object by Id"
 },
 {
  "folder": "Attachable",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "Select * from Attachable",
  "contentType": "text/plain",
  "description": "Retrieve all Attachable objects using generic query endpoint"
 },
 {
  "folder": "Batch",
  "name": "Batch",
  "method": "POST",
  "path": "/batch",
  "query": "",
  "body": "{\n    \"BatchItemRequest\": \n[\n   {\n        \"bId\": \"bid1\",\n        \"operation\": \"create\",\n        \"Vendor\": {\n            \"DisplayName\": \"Smith Family Store\"\n        }\n    }, {\n        \"bId\": \"bid2\",\n        \"operation\": \"delete\",\n        \"Invoice\": {\n            \"Id\": \"129\",\n            \"SyncToken\": \"0\"\n        }\n    }, { \n        \"bId\": \"bid3\",\n        \"operation\": \"update\",\n        \"SalesReceipt\": {\n               \"domain\": \"QBO\",\n               \"sparse\": true,\n               \"Id\": \"11\",\n               \"SyncToken\": \"0\",\n               \"PrivateNote\":\"A private note.\"       \n          }\n    }, {\n        \"bId\": \"bid4\",\n        \"Query\": \"select * from SalesReceipt\"\n    }\n]\n}\n",
  "contentType": "application/json",
  "description": "Multiple operations using batch query"
 },
 {
  "folder": "Bill",
  "name": "Create",
  "method": "POST",
  "path": "/bill",
  "query": "",
  "body": "{\n    \"Line\":[\n        {\n            \"Id\":\"1\",\n            \"Amount\": 200.00,\n            \"DetailType\":\"AccountBasedExpenseLineDetail\",\n            \"AccountBasedExpenseLineDetail\":\n            {\n                \"AccountRef\":\n                {\n                    \"value\":\"7\"\n                }\n            }\n        } \n    ],\n    \"VendorRef\":\n    {\n        \"value\":\"56\"\n    }\n}",
  "contentType": "application/json",
  "description": "Create a bill"
 },
 {
  "folder": "Bill",
  "name": "GetById",
  "method": "GET",
  "path": "/bill/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Retrieve a bill by Id"
 },
 {
  "folder": "Bill",
  "name": "Update",
  "method": "POST",
  "path": "/bill",
  "query": "",
  "body": "{\n    \"Line\":[\n        {\n            \"Id\":\"1\",\n            \"Amount\": 240.67,\n            \"DetailType\":\"AccountBasedExpenseLineDetail\",\n            \"AccountBasedExpenseLineDetail\":\n            {\n                \"AccountRef\":\n                {\n                    \"value\":\"7\"\n                }\n            }\n        } \n    ],\n    \"VendorRef\":\n    {\n        \"value\":\"56\"\n    }\n}",
  "contentType": "application/json",
  "description": "Update a bill"
 },
 {
  "folder": "Bill",
  "name": "Delete",
  "method": "POST",
  "path": "/bill",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"149\",\n    \"SyncToken\": \"0\"\n}\n",
  "contentType": "application/json",
  "description": "Update a bill"
 },
 {
  "folder": "Bill",
  "name": "GetAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "Select * from Bill startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Retrieve all bills using generic 'Query' endpoint"
 },
 {
  "folder": "BillPayment",
  "name": "Create",
  "method": "POST",
  "path": "/billpayment",
  "query": "",
  "body": "{\n  \"VendorRef\": {\n          \"value\": \"62\",\n          \"name\": \"Test\"\n  },\n  \"PayType\": \"Check\",\n  \"CheckPayment\": {\n    \"BankAccountRef\": {\n      \"value\": \"35\",\n      \"name\": \"Checking\"\n    }\n  },\n  \"TotalAmt\": 100.00,\n  \"PrivateNote\": \"Acct. 1JK90\",\n  \"Line\": [\n    {\n      \"Amount\": 100.00,\n      \"LinkedTxn\": [\n        {\n          \"TxnId\": \"153\",\n          \"TxnType\": \"Bill\"\n        }\n      ]\n    }\n  ]\n}",
  "contentType": "application/json",
  "description": "Create a BillPayment against a pre-created bill"
 },
 {
  "folder": "BillPayment",
  "name": "ReadById",
  "method": "GET",
  "path": "/billpayment/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Retrieve BillPayment by Id"
 },
 {
  "folder": "BillPayment",
  "name": "Delete",
  "method": "POST",
  "path": "/billpayment",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"154\",\n    \"SyncToken\": \"0\"\n}",
  "contentType": "application/json",
  "description": "Delete a BillPayment object"
 },
 {
  "folder": "BillPayment",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "Select * from BillPayment startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Retrieve all BillPayment objects using generic query endpoint"
 },
 {
  "folder": "BillPayment",
  "name": "Update",
  "method": "POST",
  "path": "/billpayment",
  "query": "",
  "body": "{\n  \"VendorRef\": {\n          \"value\": \"62\",\n          \"name\": \"Test\"\n  },\n  \"PayType\": \"Check\",\n  \"CheckPayment\": {\n    \"BankAccountRef\": {\n      \"value\": \"35\",\n      \"name\": \"Checking\"\n    }\n  },\n  \"TotalAmt\": 100.00,\n  \"PrivateNote\": \"Updated Note\",\n  \"Line\": [\n    {\n      \"Amount\": 100.00,\n      \"LinkedTxn\": [\n        {\n          \"TxnId\": \"153\",\n          \"TxnType\": \"Bill\"\n        }\n      ]\n    }\n  ]\n}",
  "contentType": "application/json",
  "description": "Update a BillPayment"
 },
 {
  "folder": "Budget",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "Select * from Budget startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Retrieve all BillPayment objects using generic query endpoint"
 },
 {
  "folder": "ChangeDataCapture",
  "name": "CDC-Read",
  "method": "GET",
  "path": "/cdc",
  "query": "entities=bill,invoice&changedSince=YYYY-MM-DD",
  "body": "",
  "contentType": "text/plain",
  "description": "Retrive changed Bill and invoice objects since Aug10,2016"
 },
 {
  "folder": "Change Order - New!",
  "name": "Create Change Order",
  "method": "POST",
  "path": "/changeorder",
  "query": "",
  "body": "{\n    \"TxnDate\": \"2024-09-15\",\n    \"ExpirationDate\": \"2024-10-15\",\n    \"TxnStatus\": \"Pending\",\n    \"ProjectRef\": {\n      \"value\": \"39298034\",\n      \"name\": \"Kitchen Renovation - Phase 2\"\n    },\n    \"LinkedTxn\": [\n        { \"TxnId\": \"512\", \"TxnType\": \"Estimate\" }\n    ],\n    \"CustomerRef\": {\n      \"value\": \"58\",\n      \"name\": \"Acme Construction Corp\"\n    },\n    \"CustomerMemo\": {\n      \"value\": \"This change order covers additional structural reinforcement discovered during demolition.\"\n    },\n    \"PrivateNote\": \"Approved verbally by site manager on 2024-09-14.\",\n    \"DocNumber\": \"CO-001\",\n    \"Line\": [\n      {\n        \"LineNum\": 1,\n        \"Description\": \"Structural steel — additional load-bearing beam (LB-200)\",\n        \"Amount\": 2400.00,\n        \"CostAmount\": 600.00,\n        \"DetailType\": \"SalesItemLineDetail\",\n        \"SalesItemLineDetail\": {\n           \"ItemRef\": {\n              \"value\": \"21\",\n              \"name\": \"Structural Materials\"\n            },\n            \"UnitPrice\": 800.00,\n            \"UnitCostPrice\": 200.00,\n        \"Qty\": 3,\n        \"TaxCodeRef\": {\n          \"value\": \"TAX\"\n          }\n        }\n      },\n      {\n        \"LineNum\": 2,\n        \"Description\": \"Labor — structural reinforcement installation (20 hrs)\",\n        \"Amount\": 2000.00,\n        \"CostAmount\": 1000.00,\n        \"DetailType\": \"SalesItemLineDetail\",\n        \"SalesItemLineDetail\": {\n           \"ItemRef\": {\n              \"value\": \"7\",\n              \"name\": \"Labor\"\n            },\n            \"UnitPrice\": 100.00,\n                \"UnitCostPrice\": 50.00,\n            \"Qty\": 20,\n            \"TaxCodeRef\": {\n                \"value\": \"NON\"\n            }\n         }\n      }\n    ],\n  \"EmailStatus\": \"NeedToSend\",\n  \"PrintStatus\": \"NeedToPrint\",\n  \"BillEmail\": {\n      \"Address\": \"client@acmeconstruction.com\"\n  },\n  \"TotalAmt\": 4400.00,\n  \"TotalCostAmount\": 1600.00\n }\n",
  "contentType": "",
  "description": ""
 },
 {
  "folder": "Change Order - New!",
  "name": "Read Change Order",
  "method": "POST",
  "path": "/changeorder/{id}",
  "query": "",
  "body": "{\n  \"SSN\": \"444-55-6666\",\n  \"PrimaryAddr\": {\n    \"Id\": \"50\",\n    \"Line1\": \"45 N. Elm Street\",\n    \"City\": \"Middlefield\",\n    \"CountrySubDivisionCode\": \"CA\",\n    \"PostalCode\": \"93242\"\n  },\n  \"GivenName\": \"John\",\n  \"FamilyName\": \"Meuller\",\n  \"PrimaryPhone\": {\n    \"FreeFormNumber\": \"408-525-1234\"\n  }\n}\n",
  "contentType": "",
  "description": ""
 },
 {
  "folder": "Change Order - New!",
  "name": "Update Change order",
  "method": "POST",
  "path": "/changeorder",
  "query": "",
  "body": "{\n      \"Id\": \"621\",\n      \"SyncToken\": \"1\",\n      \"sparse\": true,\n      \"TxnStatus\": \"Accepted\",\n      \"AcceptedBy\": \"John Smith\",\n      \"AcceptedDate\": \"2024-09-16\",\n      \"LinkedTxn\": [\n          { \"TxnId\": \"512\", \"TxnType\": \"Estimate\" }\n      ],\n      \"Line\": [\n          {\n              \"Id\": \"1\",\n              \"LineNum\": 1,\n              \"Description\": \"Structural steel — additional load-bearing beam (LB-200)\",\n              \"Amount\": 2400.00,\n              \"DetailType\": \"SalesItemLineDetail\",\n              \"SalesItemLineDetail\": {\n                  \"ItemRef\": { \"value\": \"21\", \"name\": \"Structural Materials\" },\n                  \"UnitPrice\": 800.00,\n                  \"Qty\": 3,\n                  \"TaxCodeRef\": { \"value\": \"TAX\" }\n              }\n          },\n          {\n              \"Id\": \"2\",\n              \"LineNum\": 2,\n              \"Description\": \"Labor — structural reinforcement installation (20 hrs)\",\n              \"Amount\": 2000.00,\n              \"DetailType\": \"SalesItemLineDetail\",\n              \"SalesItemLineDetail\": {\n                  \"ItemRef\": { \"value\": \"7\", \"name\": \"Labor\" },\n                  \"UnitPrice\": 100.00,\n                  \"Qty\": 20,\n                  \"TaxCodeRef\": { \"value\": \"NON\" }\n              }\n          },\n          {\n              \"LineNum\": 3,\n              \"Description\": \"Permit fee — structural modification\",\n              \"Amount\": 350.00,\n              \"DetailType\": \"SalesItemLineDetail\",\n              \"SalesItemLineDetail\": {\n                  \"ItemRef\": { \"value\": \"33\", \"name\": \"Permit Fees\" },\n                  \"UnitPrice\": 350.00,\n                  \"Qty\": 1,\n                  \"TaxCodeRef\": { \"value\": \"NON\" }\n              }\n          }\n      ]\n  }",
  "contentType": "",
  "description": ""
 },
 {
  "folder": "Change Order - New!",
  "name": "Delete Change Order",
  "method": "POST",
  "path": "/changeorder",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"621\",\n    \"SyncToken\": \"2\"\n  }",
  "contentType": "",
  "description": ""
 },
 {
  "folder": "Class",
  "name": "Create",
  "method": "POST",
  "path": "/class",
  "query": "",
  "body": "{\n    \"Name\": \"France\"\n}\n",
  "contentType": "application/json",
  "description": "Create a Class object"
 },
 {
  "folder": "Class",
  "name": "ReadById",
  "method": "GET",
  "path": "/class/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read a Class object by Id"
 },
 {
  "folder": "Class",
  "name": "Update",
  "method": "POST",
  "path": "/class",
  "query": "",
  "body": "{\n    \"Name\": \"France-I\",\n    \"SubClass\": false,\n    \"FullyQualifiedName\": \"France\",\n    \"Active\": true,\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"5000000000000018727\",\n    \"SyncToken\": \"0\"\n  }",
  "contentType": "application/json",
  "description": "Update a Class object by Id"
 },
 {
  "folder": "Class",
  "name": "Delete",
  "method": "POST",
  "path": "/class",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"5000000000000018727\",\n    \"SyncToken\": \"1\"\n}",
  "contentType": "application/json",
  "description": "Delete a Class entry"
 },
 {
  "folder": "Class",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "Select * from Class startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all Class using the generic 'Query' endpoint"
 },
 {
  "folder": "CompanyInfo",
  "name": "ReadById",
  "method": "GET",
  "path": "/companyinfo/{{companyid}}",
  "query": "",
  "body": "",
  "contentType": "application/json",
  "description": "Method : GET"
 },
 {
  "folder": "CompanyInfo",
  "name": "Read",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "Select * from CompanyInfo",
  "contentType": "text/plain",
  "description": "Retrieve company using the generic 'Query' endpoint"
 },
 {
  "folder": "CreditMemo",
  "name": "Create",
  "method": "POST",
  "path": "/creditmemo",
  "query": "",
  "body": "{\n    \"Line\": [\n    {\n        \"Amount\": 50,\n        \"DetailType\": \"SalesItemLineDetail\",\n        \"SalesItemLineDetail\":\n        {\n            \"ItemRef\":\n            {\n                \"value\": \"3\",\n                \"name\": \"Concrete\"\n            }\n        }\n    }],\n    \"CustomerRef\":\n    {\n        \"value\": \"3\",\n        \"name\": \"CoolCars\"\n    }\n}\n",
  "contentType": "application/json",
  "description": "Create a credit memo"
 },
 {
  "folder": "CreditMemo",
  "name": "ReadById",
  "method": "GET",
  "path": "/creditmemo/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read a credit memo by Id"
 },
 {
  "folder": "CreditMemo",
  "name": "Update",
  "method": "POST",
  "path": "/creditmemo",
  "query": "",
  "body": "{\n    \"RemainingCredit\": 50,\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"160\",\n    \"SyncToken\": \"0\",\n    \"MetaData\": {\n      \"CreateTime\": \"2016-08-18T13:09:52-07:00\",\n      \"LastUpdatedTime\": \"2016-08-18T13:09:52-07:00\"\n    },\n    \"CustomField\": [\n      {\n        \"DefinitionId\": \"1\",\n        \"Name\": \"Crew #\",\n        \"Type\": \"StringType\"\n      }\n    ],\n    \"DocNumber\": \"1040-Updated\",\n    \"TxnDate\": \"2016-08-18\",\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"ExchangeRate\": 1,\n    \"Line\": [\n      {\n        \"Id\": \"1\",\n        \"LineNum\": 1,\n        \"Amount\": 50,\n        \"DetailType\": \"SalesItemLineDetail\",\n        \"SalesItemLineDetail\": {\n          \"ItemRef\": {\n            \"value\": \"3\",\n            \"name\": \"Concrete\"\n          },\n          \"TaxCodeRef\": {\n            \"value\": \"NON\"\n          }\n        }\n      },\n      {\n        \"Amount\": 50,\n        \"DetailType\": \"SubTotalLineDetail\",\n        \"SubTotalLineDetail\": {}\n      }\n    ],\n    \"TxnTaxDetail\": {\n      \"TotalTax\": 0\n    },\n    \"CustomerRef\": {\n      \"value\": \"3\",\n      \"name\": \"Cool Cars\"\n    },\n    \"BillAddr\": {\n      \"Id\": \"4\",\n      \"Line1\": \"65 Ocean Dr.\",\n      \"City\": \"Half Moon Bay\",\n      \"CountrySubDivisionCode\": \"CA\",\n      \"PostalCode\": \"94213\",\n      \"Lat\": \"37.4300318\",\n      \"Long\": \"-122.4336537\"\n    },\n    \"ShipAddr\": {\n      \"Id\": \"4\",\n      \"Line1\": \"65 Ocean Dr.\",\n      \"City\": \"Half Moon Bay\",\n      \"CountrySubDivisionCode\": \"CA\",\n      \"PostalCode\": \"94213\",\n      \"Lat\": \"37.4300318\",\n      \"Long\": \"-122.4336537\"\n    },\n    \"TotalAmt\": 50,\n    \"HomeTotalAmt\": 50,\n    \"ApplyTaxAfterDiscount\": false,\n    \"PrintStatus\": \"NeedToPrint\",\n    \"EmailStatus\": \"NotSet\",\n    \"Balance\": 50\n  }",
  "contentType": "application/json",
  "description": "Update a credit memo"
 },
 {
  "folder": "CreditMemo",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "Select * from CreditMemo startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Retrieve company using the generic 'Query' endpoint"
 },
 {
  "folder": "CreditMemo",
  "name": "Delete",
  "method": "POST",
  "path": "/creditmemo",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"160\",\n    \"SyncToken\": \"2\"\n}",
  "contentType": "application/json",
  "description": "Delete a credit memo by Id"
 },
 {
  "folder": "Customer",
  "name": "Create",
  "method": "POST",
  "path": "/customer",
  "query": "",
  "body": "{\n    \"BillAddr\": {\n        \"Line1\": \"123 Main Street\",\n        \"City\": \"Mountain View\",\n        \"Country\": \"USA\",\n        \"CountrySubDivisionCode\": \"CA\",\n        \"PostalCode\": \"94042\"\n    },\n    \"Notes\": \"Here are other details.\",\n    \"DisplayName\": \"King's Groceries1\",\n    \"PrimaryPhone\": {\n        \"FreeFormNumber\": \"(555) 555-5555\"\n    },\n    \"PrimaryEmailAddr\": {\n        \"Address\": \"jdrew@myemail.com\"\n    }\n}\n",
  "contentType": "application/json",
  "description": "Create a customer"
 },
 {
  "folder": "Customer",
  "name": "ReadById",
  "method": "GET",
  "path": "/customer/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read a customer entry by Id"
 },
 {
  "folder": "Customer",
  "name": "Update",
  "method": "POST",
  "path": "/customer",
  "query": "",
  "body": "{\n    \"Taxable\": true,\n    \"BillAddr\": {\n      \"Id\": \"100\",\n      \"Line1\": \"123 Main Street\",\n      \"City\": \"Mountain View\",\n      \"Country\": \"USA\",\n      \"CountrySubDivisionCode\": \"CA\",\n      \"PostalCode\": \"94042\"\n    },\n    \"Notes\": \"Here are other details.\",\n    \"Job\": false,\n    \"BillWithParent\": false,\n    \"Balance\": 0,\n    \"BalanceWithJobs\": 0,\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"PreferredDeliveryMethod\": \"Print\",\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"63\",\n    \"SyncToken\": \"2\",\n    \"FullyQualifiedName\": \"King's Groceries-Updated\",\n    \"DisplayName\": \"King's Groceries-Updated\",\n    \"PrintOnCheckName\": \"King's Groceries1\",\n    \"Active\": true,\n    \"PrimaryPhone\": {\n      \"FreeFormNumber\": \"(555) 555-5555\"\n    },\n    \"PrimaryEmailAddr\": {\n      \"Address\": \"jdrew@myemail.com\"\n    },\n    \"DefaultTaxCodeRef\": {\n      \"value\": \"2\"\n    }\n  }",
  "contentType": "application/json",
  "description": "Update a customer"
 },
 {
  "folder": "Customer",
  "name": "Delete",
  "method": "POST",
  "path": "/customer",
  "query": "",
  "body": "{\n    \"domain\": \"QBO\",\n    \"sparse\": true,\n    \"Id\": \"67\",\n    \"SyncToken\": \"0\",\n    \"Active\": false\n}",
  "contentType": "application/json",
  "description": "Delete a customer by Id"
 },
 {
  "folder": "Customer",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "Select * from Customer startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all customer entries using the generic 'Query' endpoint"
 },
 {
  "folder": "Department",
  "name": "Create",
  "method": "POST",
  "path": "/department",
  "query": "",
  "body": "{\n  \"Name\": \"Marketing Department\"\n}",
  "contentType": "application/json",
  "description": "Create a department object"
 },
 {
  "folder": "Department",
  "name": "Update",
  "method": "POST",
  "path": "/department",
  "query": "",
  "body": "{\n    \"Name\": \"Marketing Department-Updated\",\n    \"SubDepartment\": false,\n    \"FullyQualifiedName\": \"Marketing Department\",\n    \"Active\": true,\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"1\",\n    \"SyncToken\": \"0\"\n}",
  "contentType": "application/json",
  "description": "Update a department object"
 },
 {
  "folder": "Department",
  "name": "ReadById",
  "method": "GET",
  "path": "/department/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read a department object"
 },
 {
  "folder": "Department",
  "name": "Delete",
  "method": "POST",
  "path": "/department",
  "query": "",
  "body": "{\n    \"Name\": \"Marketing Department-Updated\",\n    \"SubDepartment\": false,\n    \"FullyQualifiedName\": \"Marketing Department\",\n    \"Active\": false,\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"1\",\n    \"SyncToken\": \"2\"\n}",
  "contentType": "application/json",
  "description": "Delete a department object"
 },
 {
  "folder": "Department",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "Select * from Department startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Real all department objects using the 'Query' endpoint"
 },
 {
  "folder": "Deposit",
  "name": "Create",
  "method": "POST",
  "path": "/deposit",
  "query": "",
  "body": "{\n    \"DepositToAccountRef\":\n    {\n        \"value\": \"35\",\n        \"name\": \"Checking\"\n    },\n    \"Line\": [\n    {\n        \"Amount\": 20.00,\n        \"DetailType\": \"DepositLineDetail\",\n        \"DepositLineDetail\":\n        {\n            \"AccountRef\":\n            {\n                \"value\": \"87\",\n                \"name\": \"Unapplied Cash Payment Income\"\n            }\n        }\n    }]\n}\n",
  "contentType": "application/json",
  "description": "Create a deposit object"
 },
 {
  "folder": "Deposit",
  "name": "ReadById",
  "method": "GET",
  "path": "/deposit/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read a deposit object by Id"
 },
 {
  "folder": "Deposit",
  "name": "Update",
  "method": "POST",
  "path": "/deposit",
  "query": "",
  "body": "{\n    \"DepositToAccountRef\": {\n      \"value\": \"35\",\n      \"name\": \"Checking\"\n    },\n    \"TotalAmt\": 205,\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"162\",\n    \"SyncToken\": \"0\",\n    \"TxnDate\": \"2016-08-18\",\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"ExchangeRate\": 1,\n    \"Line\": [\n      {\n        \"Id\": \"1\",\n        \"LineNum\": 1,\n        \"Amount\": 205,\n        \"DetailType\": \"DepositLineDetail\",\n        \"DepositLineDetail\": {\n          \"AccountRef\": {\n            \"value\": \"87\",\n            \"name\": \"Unapplied Cash Payment Income\"\n          }\n        }\n      }\n    ]\n  }",
  "contentType": "application/json",
  "description": "Update a deposit object"
 },
 {
  "folder": "Deposit",
  "name": "Delete",
  "method": "POST",
  "path": "/deposit",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"162\",\n    \"SyncToken\": \"1\"\n}",
  "contentType": "application/json",
  "description": "Delete a deposit object by Id"
 },
 {
  "folder": "Deposit",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from Deposit startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all Deposit object using standard 'Query' endpoint"
 },
 {
  "folder": "Employee",
  "name": "Create",
  "method": "POST",
  "path": "/employee",
  "query": "",
  "body": "{\n  \"SSN\": \"444-55-6666\",\n  \"PrimaryAddr\": {\n    \"Id\": \"50\",\n    \"Line1\": \"45 N. Elm Street\",\n    \"City\": \"Middlefield\",\n    \"CountrySubDivisionCode\": \"CA\",\n    \"PostalCode\": \"93242\"\n  },\n  \"GivenName\": \"John\",\n  \"FamilyName\": \"Meuller\",\n  \"PrimaryPhone\": {\n    \"FreeFormNumber\": \"408-525-1234\"\n  }\n}\n",
  "contentType": "application/json",
  "description": "Create an employee object"
 },
 {
  "folder": "Employee",
  "name": "ReadById",
  "method": "GET",
  "path": "/employee/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Retrive an employee object by ID"
 },
 {
  "folder": "Employee",
  "name": "Update",
  "method": "POST",
  "path": "/employee",
  "query": "",
  "body": "{\n    \"SSN\": \"XXX-XX-XXXX\",\n    \"PrimaryAddr\": {\n      \"Id\": \"105\",\n      \"Line1\": \"45 N. Elm Street\",\n      \"City\": \"Middlefield\",\n      \"CountrySubDivisionCode\": \"CA\",\n      \"PostalCode\": \"93242\"\n    },\n    \"BillableTime\": false,\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"68\",\n    \"SyncToken\": \"0\",\n    \"MetaData\": {\n      \"CreateTime\": \"2016-08-18T16:04:16-07:00\",\n      \"LastUpdatedTime\": \"2016-08-18T16:04:16-07:00\"\n    },\n    \"GivenName\": \"John\",\n    \"FamilyName\": \"Meuller\",\n    \"DisplayName\": \"John Meuller - Updated\",\n    \"PrintOnCheckName\": \"John Meuller\",\n    \"Active\": true,\n    \"PrimaryPhone\": {\n      \"FreeFormNumber\": \"408-525-1234\"\n    }\n  }",
  "contentType": "application/json",
  "description": "Update an employee object"
 },
 {
  "folder": "Employee",
  "name": "Delete",
  "method": "POST",
  "path": "/employee",
  "query": "",
  "body": "{\n    \"SSN\": \"XXX-XX-XXXX\",\n    \"PrimaryAddr\": {\n      \"Id\": \"105\",\n      \"Line1\": \"45 N. Elm Street\",\n      \"City\": \"Middlefield\",\n      \"CountrySubDivisionCode\": \"CA\",\n      \"PostalCode\": \"93242\"\n    },\n    \"BillableTime\": false,\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"68\",\n    \"SyncToken\": \"2\",\n    \"MetaData\": {\n      \"CreateTime\": \"2016-08-18T16:04:16-07:00\",\n      \"LastUpdatedTime\": \"2016-08-18T16:04:16-07:00\"\n    },\n    \"GivenName\": \"John\",\n    \"FamilyName\": \"Meuller\",\n    \"DisplayName\": \"John Meuller - Updated\",\n    \"PrintOnCheckName\": \"John Meuller\",\n    \"Active\": false,\n    \"PrimaryPhone\": {\n      \"FreeFormNumber\": \"408-525-1234\"\n    }\n  }",
  "contentType": "application/json",
  "description": "Delete an employee object"
 },
 {
  "folder": "Employee",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from employee startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all employee objects using the 'Query' endpoint"
 },
 {
  "folder": "Estimate",
  "name": "Create",
  "method": "POST",
  "path": "/estimate",
  "query": "",
  "body": "{\n    \"Line\": [\n      {\n        \"Id\": \"1\",\n        \"LineNum\": 1,\n        \"Description\": \"Pest Control Services\",\n        \"Amount\": 35.0,\n        \"DetailType\": \"SalesItemLineDetail\",\n        \"SalesItemLineDetail\": {\n          \"ItemRef\": {\n            \"value\": \"10\",\n            \"name\": \"Pest Control\"\n          },\n          \"UnitPrice\": 35,\n          \"Qty\": 1,\n          \"TaxCodeRef\": {\n            \"value\": \"NON\"\n          }\n        }\n      },\n      {\n        \"Amount\": 35.0,\n        \"DetailType\": \"SubTotalLineDetail\",\n        \"SubTotalLineDetail\": {}\n      },\n      {\n        \"Amount\": 3.5,\n        \"DetailType\": \"DiscountLineDetail\",\n        \"DiscountLineDetail\": {\n          \"PercentBased\": true,\n          \"DiscountPercent\": 10,\n          \"DiscountAccountRef\": {\n            \"value\": \"86\",\n            \"name\": \"Discounts given\"\n          }\n        }\n      }\n    ],\n    \"TxnTaxDetail\": {\n      \"TotalTax\": 0\n    },\n    \"CustomerRef\": {\n      \"value\": \"3\",\n      \"name\": \"Cool Cars\"\n    },\n    \"CustomerMemo\": {\n      \"value\": \"Thank you for your business and have a great day!\"\n    },\n    \"TotalAmt\": 31.5,\n    \"ApplyTaxAfterDiscount\": false,\n    \"PrintStatus\": \"NeedToPrint\",\n    \"EmailStatus\": \"NotSet\",\n    \"BillEmail\": {\n      \"Address\": \"Cool_Cars@intuit.com\"\n    }\n  }",
  "contentType": "application/json",
  "description": "Create an Estimate object"
 },
 {
  "folder": "Estimate",
  "name": "Update",
  "method": "POST",
  "path": "/estimate",
  "query": "",
  "body": "{\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"163\",\n    \"SyncToken\": \"0\",\n    \"CustomField\": [\n      {\n        \"DefinitionId\": \"1\",\n        \"Name\": \"Crew #\",\n        \"Type\": \"StringType\"\n      }\n    ],\n    \"DocNumber\": \"1001-Updated\",\n    \"TxnDate\": \"2016-08-18\",\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"ExchangeRate\": 1,\n    \"TxnStatus\": \"Pending\",\n    \"Line\": [\n      {\n        \"Id\": \"1\",\n        \"LineNum\": 1,\n        \"Description\": \"Pest Control Services\",\n        \"Amount\": 35,\n        \"DetailType\": \"SalesItemLineDetail\",\n        \"SalesItemLineDetail\": {\n          \"ItemRef\": {\n            \"value\": \"10\",\n            \"name\": \"Pest Control\"\n          },\n          \"UnitPrice\": 35,\n          \"Qty\": 1,\n          \"TaxCodeRef\": {\n            \"value\": \"NON\"\n          }\n        }\n      },\n      {\n        \"Amount\": 35,\n        \"DetailType\": \"SubTotalLineDetail\",\n        \"SubTotalLineDetail\": {}\n      },\n      {\n        \"Amount\": 3.5,\n        \"DetailType\": \"DiscountLineDetail\",\n        \"DiscountLineDetail\": {\n          \"PercentBased\": true,\n          \"DiscountPercent\": 10,\n          \"DiscountAccountRef\": {\n            \"value\": \"86\",\n            \"name\": \"Discounts given\"\n          }\n        }\n      }\n    ],\n    \"TxnTaxDetail\": {\n      \"TotalTax\": 0\n    },\n    \"CustomerRef\": {\n      \"value\": \"3\",\n      \"name\": \"Cool Cars\"\n    },\n    \"CustomerMemo\": {\n      \"value\": \"Thank you for your business and have a great day!\"\n    },\n    \"BillAddr\": {\n      \"Id\": \"4\",\n      \"Line1\": \"65 Ocean Dr.\",\n      \"City\": \"Half Moon Bay\",\n      \"CountrySubDivisionCode\": \"CA\",\n      \"PostalCode\": \"94213\",\n      \"Lat\": \"37.4300318\",\n      \"Long\": \"-122.4336537\"\n    },\n    \"ShipAddr\": {\n      \"Id\": \"4\",\n      \"Line1\": \"65 Ocean Dr.\",\n      \"City\": \"Half Moon Bay\",\n      \"CountrySubDivisionCode\": \"CA\",\n      \"PostalCode\": \"94213\",\n      \"Lat\": \"37.4300318\",\n      \"Long\": \"-122.4336537\"\n    },\n    \"TotalAmt\": 31.5,\n    \"HomeTotalAmt\": 31.5,\n    \"ApplyTaxAfterDiscount\": false,\n    \"PrintStatus\": \"NeedToPrint\",\n    \"EmailStatus\": \"NotSet\",\n    \"BillEmail\": {\n      \"Address\": \"Cool_Cars@intuit.com\"\n    }\n  }",
  "contentType": "application/json",
  "description": "Update an Estimate object"
 },
 {
  "folder": "Estimate",
  "name": "ReadById",
  "method": "GET",
  "path": "/estimate/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read an Estimate object by Id"
 },
 {
  "folder": "Estimate",
  "name": "Entitlement",
  "method": "GET",
  "path": "/estimate/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read an Estimate object by Id"
 },
 {
  "folder": "Estimate",
  "name": "Delete",
  "method": "POST",
  "path": "/estimate",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"163\",\n    \"SyncToken\": \"1\"\n}",
  "contentType": "application/json",
  "description": "Delete an Estimate object by Id"
 },
 {
  "folder": "Estimate",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from estimate startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all estimate objects using the 'Query' endpoint"
 },
 {
  "folder": "ExchangeRate",
  "name": " - GetDetails",
  "method": "GET",
  "path": "/exchangerate",
  "query": "sourcecurrencycode=USD&asofdate=2017-04-25",
  "body": "",
  "contentType": "application/json",
  "description": "Get ExchangeRate"
 },
 {
  "folder": "ExchangeRate",
  "name": " - Query",
  "method": "POST",
  "path": "/query",
  "query": "query=select * from exchangerate where sourcecurrencycode in ('EUR', 'INR') and asofdate='2017-07-07'",
  "body": "select * from exchangerate where sourcecurrencycode in ('USD', 'INR') and asofdate='2016-07-07'",
  "contentType": "text/plain",
  "description": "Query ExchangeRate"
 },
 {
  "folder": "InventoryAdjustment",
  "name": "CreateInventoryAdjustment",
  "method": "POST",
  "path": "/inventoryadjustment",
  "query": "",
  "body": "{\n  \"AdjustAccountRef\": {\n    \"value\": \"26\"\n  }, \n  \"DocNumber\":\"1234\",\n  \"PrivateNote\": \"Memo 1\", \n  \"Line\": [\n    {\n      \"DetailType\": \"ItemAdjustmentLineDetail\", \n      \"ItemAdjustmentLineDetail\": {\n        \"QtyDiff\": -2, \n        \"ItemRef\": {\n          \"value\": \"8\"\n        }\n      }\n    }\n  ], \n  \"TxnDate\": \"2025-10-01\"\n}",
  "contentType": "application/json",
  "description": ""
 },
 {
  "folder": "InventoryAdjustment",
  "name": "CreateInventoryAdjustment Copy",
  "method": "POST",
  "path": "/inventoryadjustment",
  "query": "",
  "body": "<InventoryAdjustment xmlns=\"http://schema.intuit.com/finance/v3\">\n<AdjustAccountRef>26</AdjustAccountRef>\n<TxnDate>2025-11-08</TxnDate>\n<DocNumber>1234</DocNumber>\n<Line xmlns=\"http://schema.intuit.com/finance/v3\">\n<DetailType>ItemAdjustmentLineDetail</DetailType>\n<ItemAdjustmentLineDetail xmlns=\"http://schema.intuit.com/finance/v3\">\n<ItemRef>8</ItemRef>\n<QtyDiff>-2</QtyDiff>\n</ItemAdjustmentLineDetail>\n</Line>\n</InventoryAdjustment>",
  "contentType": "application/xml",
  "description": ""
 },
 {
  "folder": "Invoice",
  "name": "Create",
  "method": "POST",
  "path": "/invoice",
  "query": "",
  "body": "{\n  \"Line\": [\n    {\n      \"Amount\": 100.00,\n      \"DetailType\": \"SalesItemLineDetail\",\n      \"SalesItemLineDetail\": {\n        \"ItemRef\": {\n          \"value\": \"1\",\n          \"name\": \"Services\"\n        }\n      }\n    }\n  ],\n  \"CustomerRef\": {\n    \"value\": \"1\"\n  }\n}",
  "contentType": "application/json",
  "description": "Create an invoice object"
 },
 {
  "folder": "Invoice",
  "name": "ReadById",
  "method": "GET",
  "path": "/invoice/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read an invoice object by Id"
 },
 {
  "folder": "Invoice",
  "name": "BAS-Read",
  "method": "GET",
  "path": "/invoice/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read an invoice object by Id"
 },
 {
  "folder": "Invoice",
  "name": "Send an Invoice",
  "method": "GET",
  "path": "/invoice/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read an invoice object by Id"
 },
 {
  "folder": "Invoice",
  "name": "Update",
  "method": "POST",
  "path": "/invoice",
  "query": "",
  "body": "{\n    \"Deposit\": 0,\n    \"AllowIPNPayment\": false,\n    \"AllowOnlinePayment\": false,\n    \"AllowOnlineCreditCardPayment\": false,\n    \"AllowOnlineACHPayment\": false,\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"164\",\n    \"SyncToken\": \"0\",\n    \"CustomField\": [\n      {\n        \"DefinitionId\": \"1\",\n        \"Name\": \"Crew #\",\n        \"Type\": \"StringType\"\n      }\n    ],\n    \"DocNumber\": \"1041-Updated\",\n    \"TxnDate\": \"2016-08-18\",\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"ExchangeRate\": 1,\n    \"LinkedTxn\": [],\n    \"Line\": [\n      {\n        \"Id\": \"1\",\n        \"LineNum\": 1,\n        \"Amount\": 100,\n        \"DetailType\": \"SalesItemLineDetail\",\n        \"SalesItemLineDetail\": {\n          \"ItemRef\": {\n            \"value\": \"1\",\n            \"name\": \"Services\"\n          },\n          \"TaxCodeRef\": {\n            \"value\": \"NON\"\n          }\n        }\n      },\n      {\n        \"Amount\": 100,\n        \"DetailType\": \"SubTotalLineDetail\",\n        \"SubTotalLineDetail\": {}\n      }\n    ],\n    \"TxnTaxDetail\": {\n      \"TotalTax\": 0\n    },\n    \"CustomerRef\": {\n      \"value\": \"1\",\n      \"name\": \"Amy's Bird Sanctuary\"\n    },\n    \"BillAddr\": {\n      \"Id\": \"2\",\n      \"Line1\": \"4581 Finch St.\",\n      \"City\": \"Bayshore\",\n      \"CountrySubDivisionCode\": \"CA\",\n      \"PostalCode\": \"94326\",\n      \"Lat\": \"INVALID\",\n      \"Long\": \"INVALID\"\n    },\n    \"ShipAddr\": {\n      \"Id\": \"2\",\n      \"Line1\": \"4581 Finch St.\",\n      \"City\": \"Bayshore\",\n      \"CountrySubDivisionCode\": \"CA\",\n      \"PostalCode\": \"94326\",\n      \"Lat\": \"INVALID\",\n      \"Long\": \"INVALID\"\n    },\n    \"DueDate\": \"2016-09-17\",\n    \"TotalAmt\": 100,\n    \"HomeTotalAmt\": 100,\n    \"ApplyTaxAfterDiscount\": false,\n    \"PrintStatus\": \"NeedToPrint\",\n    \"EmailStatus\": \"NotSet\",\n    \"Balance\": 100\n  }",
  "contentType": "application/json",
  "description": "Update an invoice object"
 },
 {
  "folder": "Invoice",
  "name": "Delete",
  "method": "POST",
  "path": "/invoice",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"130\",\n    \"SyncToken\": \"10\"\n}",
  "contentType": "application/json",
  "description": "Delete an invoice object by Id"
 },
 {
  "folder": "Invoice",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from invoice startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all invoice objects using the 'Query' endpoint"
 },
 {
  "folder": "Invoice",
  "name": "Void",
  "method": "POST",
  "path": "/invoice",
  "query": "operation=void",
  "body": "{\n    \"Id\": \"173\",\n    \"SyncToken\": \"2\"\n}",
  "contentType": "application/json",
  "description": "Void an invoice object by Id"
 },
 {
  "folder": "Item",
  "name": "Create",
  "method": "POST",
  "path": "/item",
  "query": "",
  "body": "{\n  \"Name\": \"Garden Supplies1\",\n  \"IncomeAccountRef\": {\n    \"value\": \"79\",\n    \"name\": \"Sales of Product Income\"\n  },\n  \"ExpenseAccountRef\": {\n    \"value\": \"80\",\n    \"name\": \"Cost of Goods Sold\"\n  },\n  \"AssetAccountRef\": {\n    \"value\": \"81\",\n    \"name\": \"Inventory Asset\"\n  },\n  \"Type\": \"Inventory\",\n  \"TrackQtyOnHand\": true,\n  \"QtyOnHand\": 10,\n  \"InvStartDate\": \"2015-01-01\"\n}",
  "contentType": "application/json",
  "description": "Create an item object"
 },
 {
  "folder": "Item",
  "name": "ReadById",
  "method": "GET",
  "path": "/item/<ID>",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read an Item by Id"
 },
 {
  "folder": "Item",
  "name": "Update",
  "method": "POST",
  "path": "/item",
  "query": "",
  "body": "{\n    \"Name\": \"Garden Supplies-Updated\",\n    \"Active\": true,\n    \"FullyQualifiedName\": \"Garden Supplies-Updated\",\n    \"Taxable\": false,\n    \"UnitPrice\": 0,\n    \"Type\": \"Inventory\",\n    \"IncomeAccountRef\": {\n      \"value\": \"79\",\n      \"name\": \"Sales of Product Income\"\n    },\n    \"PurchaseCost\": 0,\n    \"ExpenseAccountRef\": {\n      \"value\": \"80\",\n      \"name\": \"Cost of Goods Sold\"\n    },\n    \"AssetAccountRef\": {\n      \"value\": \"81\",\n      \"name\": \"Inventory Asset\"\n    },\n    \"TrackQtyOnHand\": true,\n    \"QtyOnHand\": 10,\n    \"InvStartDate\": \"2015-01-01\",\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"20\",\n    \"SyncToken\": \"0\"\n  }",
  "contentType": "application/json",
  "description": "Update an item object"
 },
 {
  "folder": "Item",
  "name": "Delete",
  "method": "POST",
  "path": "/item",
  "query": "",
  "body": "{\n    \"Name\": \"Garden Supplies-Updated\",\n    \"Active\": false,\n    \"FullyQualifiedName\": \"Garden Supplies-Updated\",\n    \"Taxable\": false,\n    \"UnitPrice\": 0,\n    \"Type\": \"Inventory\",\n    \"IncomeAccountRef\": {\n      \"value\": \"79\",\n      \"name\": \"Sales of Product Income\"\n    },\n    \"PurchaseCost\": 0,\n    \"ExpenseAccountRef\": {\n      \"value\": \"80\",\n      \"name\": \"Cost of Goods Sold\"\n    },\n    \"AssetAccountRef\": {\n      \"value\": \"81\",\n      \"name\": \"Inventory Asset\"\n    },\n    \"TrackQtyOnHand\": true,\n    \"QtyOnHand\": 10,\n    \"InvStartDate\": \"2015-01-01\",\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"20\",\n    \"SyncToken\": \"0\"\n  }",
  "contentType": "application/json",
  "description": "Delete an item object"
 },
 {
  "folder": "Item",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from item startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all item objects using the 'Query' endpoint"
 },
 {
  "folder": "JournalEntry",
  "name": "Create",
  "method": "POST",
  "path": "/journalentry",
  "query": "",
  "body": "{\n  \"Line\": [\n    {\n      \"Id\": \"0\",\n      \"Description\": \"nov portion of rider insurance\",\n      \"Amount\": 100.0,\n      \"DetailType\": \"JournalEntryLineDetail\",\n      \"JournalEntryLineDetail\": {\n        \"PostingType\": \"Debit\",\n         \"AccountRef\": {\n                \"value\": \"39\",\n                \"name\": \"Opening Bal Equity\"\n              }\n      }\n    },\n    {\n      \"Description\": \"nov portion of rider insurance\",\n      \"Amount\": 100.0,\n      \"DetailType\": \"JournalEntryLineDetail\",\n      \"JournalEntryLineDetail\": {\n        \"PostingType\": \"Credit\",\n              \"AccountRef\": {\n                \"value\": \"44\",\n                \"name\": \"Notes Payable\"\n              }\n\n      }\n    }\n  ]\n}",
  "contentType": "application/json",
  "description": "Create an journalentry object"
 },
 {
  "folder": "JournalEntry",
  "name": "ReadById",
  "method": "GET",
  "path": "/journalentry/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read an journalentry object by Id"
 },
 {
  "folder": "JournalEntry",
  "name": "Update",
  "method": "POST",
  "path": "/journalentry",
  "query": "",
  "body": "{\n    \"Adjustment\": false,\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"167\",\n    \"SyncToken\": \"0\",\n    \"TxnDate\": \"2016-08-19\",\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"ExchangeRate\": 1,\n    \"Line\": [\n      {\n        \"Id\": \"0\",\n        \"Description\": \"nov portion of rider insurance-updated\",\n        \"Amount\": 100,\n        \"DetailType\": \"JournalEntryLineDetail\",\n        \"JournalEntryLineDetail\": {\n          \"PostingType\": \"Debit\",\n          \"AccountRef\": {\n            \"value\": \"39\",\n            \"name\": \"Truck:Depreciation\"\n          }\n        }\n      },\n      {\n        \"Id\": \"1\",\n        \"Description\": \"nov portion of rider insurance-updated\",\n        \"Amount\": 100,\n        \"DetailType\": \"JournalEntryLineDetail\",\n        \"JournalEntryLineDetail\": {\n          \"PostingType\": \"Credit\",\n          \"AccountRef\": {\n            \"value\": \"44\",\n            \"name\": \"Notes Payable\"\n          }\n        }\n      }\n    ],\n    \"TxnTaxDetail\": {}\n  }",
  "contentType": "application/json",
  "description": "Update an journalentry object"
 },
 {
  "folder": "JournalEntry",
  "name": "Delete",
  "method": "POST",
  "path": "/journalentry",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"167\",\n    \"SyncToken\": \"0\"\n}",
  "contentType": "application/json",
  "description": "Delete an journalentry object"
 },
 {
  "folder": "JournalEntry",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from journalentry startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all journalentry objects using the 'Query' endpoint"
 },
 {
  "folder": "Payment",
  "name": "Create",
  "method": "POST",
  "path": "/payment",
  "query": "",
  "body": "{\n    \"CustomerRef\":\n    {\n        \"value\": \"58\",\n        \"name\": \"TEST123\"\n    },\n    \"TotalAmt\": 100.00,\n    \"Line\": [\n    {\n        \"Amount\": 100.00,\n        \"LinkedTxn\": [\n        {\n            \"TxnId\": \"173\",\n            \"TxnType\": \"Invoice\"\n        }]\n    }]\n}",
  "contentType": "application/json",
  "description": "Create an payment object"
 },
 {
  "folder": "Payment",
  "name": "ReadByID",
  "method": "GET",
  "path": "/payment/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read a payment object by Id"
 },
 {
  "folder": "Payment",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from payment startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all payment objects using the 'Query' endpoint"
 },
 {
  "folder": "Payment",
  "name": "Update",
  "method": "POST",
  "path": "/payment",
  "query": "",
  "body": "{\n    \"CustomerRef\": {\n      \"value\": \"58\",\n      \"name\": \"TEST123\"\n    },\n    \"DepositToAccountRef\": {\n      \"value\": \"4\"\n    },\n    \"TotalAmt\": 100,\n    \"UnappliedAmt\": 0,\n    \"ProcessPayment\": false,\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"174\",\n    \"SyncToken\": \"0\",\n    \"TxnDate\": \"2016-08-29\",\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"ExchangeRate\": 1,\n    \"Line\": [\n      {\n        \"Amount\": 100,\n        \"LinkedTxn\": [\n          {\n            \"TxnId\": \"173\",\n            \"TxnType\": \"Invoice\"\n          }\n        ],\n        \"LineEx\": {\n          \"any\": [\n            {\n              \"name\": \"{http://schema.intuit.com/finance/v3}NameValue\",\n              \"declaredType\": \"com.intuit.schema.finance.v3.NameValue\",\n              \"scope\": \"javax.xml.bind.JAXBElement$GlobalScope\",\n              \"value\": {\n                \"Name\": \"txnId\",\n                \"Value\": \"173\"\n              },\n              \"nil\": false,\n              \"globalScope\": true,\n              \"typeSubstituted\": false\n            },\n            {\n              \"name\": \"{http://schema.intuit.com/finance/v3}NameValue\",\n              \"declaredType\": \"com.intuit.schema.finance.v3.NameValue\",\n              \"scope\": \"javax.xml.bind.JAXBElement$GlobalScope\",\n              \"value\": {\n                \"Name\": \"txnOpenBalance\",\n                \"Value\": \"100.00\"\n              },\n              \"nil\": false,\n              \"globalScope\": true,\n              \"typeSubstituted\": false\n            },\n            {\n              \"name\": \"{http://schema.intuit.com/finance/v3}NameValue\",\n              \"declaredType\": \"com.intuit.schema.finance.v3.NameValue\",\n              \"scope\": \"javax.xml.bind.JAXBElement$GlobalScope\",\n              \"value\": {\n                \"Name\": \"txnReferenceNumber\",\n                \"Value\": \"1043\"\n              },\n              \"nil\": false,\n              \"globalScope\": true,\n              \"typeSubstituted\": false\n            }\n          ]\n        }\n      }\n    ]\n  }",
  "contentType": "application/json",
  "description": "Update an payment object"
 },
 {
  "folder": "Payment",
  "name": "Delete",
  "method": "POST",
  "path": "/payment",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"174\",\n    \"SyncToken\": \"1\"\n}",
  "contentType": "application/json",
  "description": "Delete a payment object"
 },
 {
  "folder": "PaymentMethod",
  "name": "Create",
  "method": "POST",
  "path": "/paymentmethod",
  "query": "",
  "body": "{\n  \"Name\": \"Business Check\"\n}",
  "contentType": "application/json",
  "description": "Create a payment method"
 },
 {
  "folder": "PaymentMethod",
  "name": "ReadById",
  "method": "GET",
  "path": "/paymentmethod/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read a payment method"
 },
 {
  "folder": "PaymentMethod",
  "name": "Update",
  "method": "POST",
  "path": "/paymentmethod",
  "query": "",
  "body": "{\n    \"Name\": \"Business Check-Updated\",\n    \"Active\": true,\n    \"Type\": \"NON_CREDIT_CARD\",\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"8\",\n    \"SyncToken\": \"0\",\n    \"MetaData\": {\n      \"CreateTime\": \"2016-08-23T20:09:50-07:00\",\n      \"LastUpdatedTime\": \"2016-08-23T20:09:50-07:00\"\n    }\n  }",
  "contentType": "application/json",
  "description": "Update a payment method"
 },
 {
  "folder": "PaymentMethod",
  "name": "Delete",
  "method": "POST",
  "path": "/paymentmethod",
  "query": "",
  "body": "{\n    \"Name\": \"Business Check-Updated\",\n    \"Active\": false,\n    \"Type\": \"NON_CREDIT_CARD\",\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"8\",\n    \"SyncToken\": \"0\",\n    \"MetaData\": {\n      \"CreateTime\": \"2016-08-23T20:09:50-07:00\",\n      \"LastUpdatedTime\": \"2016-08-23T20:09:50-07:00\"\n    }\n  }",
  "contentType": "application/json",
  "description": "Delete a payment method"
 },
 {
  "folder": "PaymentMethod",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from paymentmethod startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all paymentmethod objects using the 'Query' endpoint"
 },
 {
  "folder": "Preferences",
  "name": "Preference-ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from preferences ",
  "contentType": "text/plain",
  "description": "Read all preference objects using the 'Query' endpoint"
 },
 {
  "folder": "Preferences",
  "name": "Preference-Read",
  "method": "GET",
  "path": "/preferences",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read the preference object"
 },
 {
  "folder": "Preferences",
  "name": "Preference-Update",
  "method": "POST",
  "path": "/preferences",
  "query": "",
  "body": "{\n        \"AccountingInfoPrefs\": {\n          \"TrackDepartments\": true,\n          \"DepartmentTerminology\": \"Location\",\n          \"ClassTrackingPerTxn\": false,\n          \"ClassTrackingPerTxnLine\": true,\n          \"CustomerTerminology\": \"Customers\"\n        },\n        \"ProductAndServicesPrefs\": {\n          \"ForSales\": true,\n          \"ForPurchase\": true,\n          \"QuantityWithPriceAndRate\": true,\n          \"QuantityOnHand\": true\n        },\n        \"SalesFormsPrefs\": {\n          \"CustomField\": [\n            {\n              \"CustomField\": [\n                {\n                  \"Name\": \"SalesFormsPrefs.UseSalesCustom3\",\n                  \"Type\": \"BooleanType\",\n                  \"BooleanValue\": false\n                },\n                {\n                  \"Name\": \"SalesFormsPrefs.UseSalesCustom2\",\n                  \"Type\": \"BooleanType\",\n                  \"BooleanValue\": false\n                },\n                {\n                  \"Name\": \"SalesFormsPrefs.UseSalesCustom1\",\n                  \"Type\": \"BooleanType\",\n                  \"BooleanValue\": true\n                }\n              ]\n            },\n            {\n              \"CustomField\": [\n                {\n                  \"Name\": \"SalesFormsPrefs.SalesCustomName1\",\n                  \"Type\": \"StringType\",\n                  \"StringValue\": \"Crew #\"\n                }\n              ]\n            }\n          ],\n          \"CustomTxnNumbers\": false,\n          \"AllowDeposit\": true,\n          \"AllowDiscount\": true,\n          \"DefaultDiscountAccount\": \"86\",\n          \"AllowEstimates\": true,\n          \"ETransactionEnabledStatus\": \"NotApplicable\",\n          \"ETransactionAttachPDF\": false,\n          \"ETransactionPaymentEnabled\": false,\n          \"IPNSupportEnabled\": false,\n          \"AllowServiceDate\": false,\n          \"AllowShipping\": false,\n          \"DefaultTerms\": {\n            \"value\": \"3\"\n          },\n          \"DefaultCustomerMessage\": \"Thank you for your business and have a great day!\"\n        },\n        \"EmailMessagesPrefs\": {\n          \"InvoiceMessage\": {\n            \"Subject\": \"Invoice from Craig's Design and Landscaping Services\",\n            \"Message\": \"Your invoice is attached.  Please remit payment at your earliest convenience.\\nThank you for your business - we appreciate it very much.\\n\\nSincerely,\\nCraig's Design and Landscaping Services\"\n          },\n          \"EstimateMessage\": {\n            \"Subject\": \"Estimate from Craig's Design and Landscaping Services\",\n            \"Message\": \"Please review the estimate below.  Feel free to contact us if you have any questions.\\nWe look forward to working with you.\\n\\nSincerely,\\nCraig's Design and Landscaping Services\"\n          },\n          \"SalesReceiptMessage\": {\n            \"Subject\": \"Sales Receipt from Craig's Design and Landscaping Services\",\n            \"Message\": \"Your sales receipt is attached.\\nThank you for your business - we appreciate it very much.\\n\\nSincerely,\\nCraig's Design and Landscaping Services\"\n          },\n          \"StatementMessage\": {\n            \"Subject\": \"Statement from Craig's Design and Landscaping Services\",\n            \"Message\": \"Your statement is attached.  Please remit payment at your earliest convenience.\\nThank you for your business - we appreciate it very much.\\n\\nSincerely,\\nCraig's Design and Landscaping Services\"\n          }\n        },\n        \"VendorAndPurchasesPrefs\": {\n          \"TrackingByCustomer\": true,\n          \"BillableExpenseTracking\": true,\n          \"POCustomField\": [\n            {\n              \"CustomField\": [\n                {\n                  \"Name\": \"PurchasePrefs.UsePurchaseCustom3\",\n                  \"Type\": \"BooleanType\",\n                  \"BooleanValue\": false\n                },\n                {\n                  \"Name\": \"PurchasePrefs.UsePurchaseCustom2\",\n                  \"Type\": \"BooleanType\",\n                  \"BooleanValue\": true\n                },\n                {\n                  \"Name\": \"PurchasePrefs.UsePurchaseCustom1\",\n                  \"Type\": \"BooleanType\",\n                  \"BooleanValue\": true\n                }\n              ]\n            },\n            {\n              \"CustomField\": [\n                {\n                  \"Name\": \"PurchasePrefs.PurchaseCustomName2\",\n                  \"Type\": \"StringType\",\n                  \"StringValue\": \"Sales Rep\"\n                },\n                {\n                  \"Name\": \"PurchasePrefs.PurchaseCustomName1\",\n                  \"Type\": \"StringType\",\n                  \"StringValue\": \"Crew #\"\n                }\n              ]\n            }\n          ]\n        },\n        \"TimeTrackingPrefs\": {\n          \"UseServices\": true,\n          \"BillCustomers\": true,\n          \"ShowBillRateToAll\": false,\n          \"WorkWeekStartDate\": \"Monday\",\n          \"MarkTimeEntriesBillable\": true\n        },\n        \"TaxPrefs\": {\n          \"UsingSalesTax\": true,\n          \"TaxGroupCodeRef\": {\n            \"value\": \"2\"\n          }\n        },\n        \"CurrencyPrefs\": {\n          \"MultiCurrencyEnabled\": true,\n          \"HomeCurrency\": {\n            \"value\": \"USD\"\n          }\n        },\n        \"ReportPrefs\": {\n          \"ReportBasis\": \"Accrual\",\n          \"CalcAgingReportFromTxnDate\": false\n        },\n        \"OtherPrefs\": {\n          \"NameValue\": [\n            {\n              \"Name\": \"SalesFormsPrefs.DefaultCustomerMessage\",\n              \"Value\": \"Thank you for your business and have a great day!\"\n            },\n            {\n              \"Name\": \"SalesFormsPrefs.DefaultItem\",\n              \"Value\": \"1\"\n            },\n            {\n              \"Name\": \"DTXCopyMemo\",\n              \"Value\": \"false\"\n            },\n            {\n              \"Name\": \"UncategorizedAssetAccountId\",\n              \"Value\": \"32\"\n            },\n            {\n              \"Name\": \"UncategorizedIncomeAccountId\",\n              \"Value\": \"30\"\n            },\n            {\n              \"Name\": \"UncategorizedExpenseAccountId\",\n              \"Value\": \"31\"\n            },\n            {\n              \"Name\": \"MasAccountId\",\n              \"Value\": \"35\"\n            },\n            {\n              \"Name\": \"SFCEnabled\",\n              \"Value\": \"true\"\n            }\n          ]\n        },\n        \"domain\": \"QBO\",\n        \"sparse\": false,\n        \"Id\": \"1\",\n        \"SyncToken\": \"4\",\n        \"MetaData\": {\n          \"CreateTime\": \"2016-01-13T01:07:08-08:00\",\n          \"LastUpdatedTime\": \"2016-08-23T20:12:45-07:00\"\n        }\n      }",
  "contentType": "application/json",
  "description": "Update the preference object endpoint"
 },
 {
  "folder": "Purchase",
  "name": "Create",
  "method": "POST",
  "path": "/purchase",
  "query": "",
  "body": "{\n  \"AccountRef\": {\n    \"value\": \"42\",\n    \"name\": \"Visa\"\n  },\n  \"PaymentType\": \"CreditCard\",\n  \"Line\": [\n    {\n      \"Amount\": 10.00,\n      \"DetailType\": \"AccountBasedExpenseLineDetail\",\n      \"AccountBasedExpenseLineDetail\": {\n       \"AccountRef\": {\n          \"name\": \"Meals and Entertainment\",\n          \"value\": \"13\"\n        }\n      }\n    }\n  ]\n}",
  "contentType": "application/json",
  "description": "Create a puchase object"
 },
 {
  "folder": "Purchase",
  "name": "Update",
  "method": "POST",
  "path": "/purchase",
  "query": "",
  "body": "{\n    \"AccountRef\": {\n      \"value\": \"42\",\n      \"name\": \"Visa\"\n    },\n    \"PaymentType\": \"CreditCard\",\n    \"Credit\": false,\n    \"TotalAmt\": 100,\n    \"PurchaseEx\": {\n      \"any\": [\n        {\n          \"name\": \"{http://schema.intuit.com/finance/v3}NameValue\",\n          \"declaredType\": \"com.intuit.schema.finance.v3.NameValue\",\n          \"scope\": \"javax.xml.bind.JAXBElement$GlobalScope\",\n          \"value\": {\n            \"Name\": \"TxnType\",\n            \"Value\": \"54\"\n          },\n          \"nil\": false,\n          \"globalScope\": true,\n          \"typeSubstituted\": false\n        }\n      ]\n    },\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"175\",\n    \"SyncToken\": \"0\",\n    \"MetaData\": {\n      \"CreateTime\": \"2016-08-23T22:52:14-07:00\",\n      \"LastUpdatedTime\": \"2016-08-23T22:52:14-07:00\"\n    },\n    \"CustomField\": [],\n    \"TxnDate\": \"2016-08-23\",\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"ExchangeRate\": 1,\n    \"Line\": [\n      {\n        \"Id\": \"1\",\n        \"Amount\": 100,\n        \"DetailType\": \"AccountBasedExpenseLineDetail\",\n        \"AccountBasedExpenseLineDetail\": {\n          \"AccountRef\": {\n            \"value\": \"13\",\n            \"name\": \"Meals and Entertainment\"\n          },\n          \"BillableStatus\": \"NotBillable\",\n          \"TaxCodeRef\": {\n            \"value\": \"NON\"\n          }\n        }\n      }\n    ]\n  }",
  "contentType": "application/json",
  "description": "Create a puchase object"
 },
 {
  "folder": "Purchase",
  "name": "ReadById",
  "method": "GET",
  "path": "/purchase/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read a puchase object by Id"
 },
 {
  "folder": "Purchase",
  "name": "Delete",
  "method": "POST",
  "path": "/purchase",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"175\",\n    \"SyncToken\": \"1\"\n}",
  "contentType": "application/json",
  "description": "Delete a puchase object"
 },
 {
  "folder": "Purchase",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from purchase startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all purchase objects using the 'Query' endpoint"
 },
 {
  "folder": "PurchaseOrder",
  "name": "Create",
  "method": "POST",
  "path": "/purchaseorder",
  "query": "",
  "body": "{\n    \"Line\": [{\n        \"Amount\": 25.0,\n        \"DetailType\": \"ItemBasedExpenseLineDetail\",\n        \"ItemBasedExpenseLineDetail\": {\n            \"CustomerRef\": {\n                \"value\": \"3\",\n                \"name\": \"Cool Cars\"\n            },\n            \"BillableStatus\": \"NotBillable\",\n            \"ItemRef\": {\n                \"value\": \"11\",\n                \"name\": \"Pump\"\n            },\n            \"UnitPrice\": 25,\n            \"Qty\": 1,\n            \"TaxCodeRef\": {\n                \"value\": \"NON\"\n            }\n        }\n    }],\n    \"VendorRef\": {\n        \"value\": \"41\",\n        \"name\": \"Hicks Hardware\"\n    },\n    \"APAccountRef\": {\n        \"value\": \"33\",\n        \"name\": \"Accounts Payable (A/P)\"\n    },\n    \"TotalAmt\": 25.0\n}\n",
  "contentType": "application/json",
  "description": "Create a puchase-order object"
 },
 {
  "folder": "PurchaseOrder",
  "name": "Update",
  "method": "POST",
  "path": "/purchaseorder",
  "query": "",
  "body": "{\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"179\",\n    \"SyncToken\": \"0\",\n    \"MetaData\": {\n      \"CreateTime\": \"2016-08-23T23:18:26-07:00\",\n      \"LastUpdatedTime\": \"2016-08-23T23:18:26-07:00\"\n    },\n    \"CustomField\": [\n      {\n        \"DefinitionId\": \"1\",\n        \"Name\": \"Crew #\",\n        \"Type\": \"StringType\"\n      },\n      {\n        \"DefinitionId\": \"2\",\n        \"Name\": \"Sales Rep\",\n        \"Type\": \"StringType\"\n      }\n    ],\n    \"DocNumber\": \"1006-Updated\",\n    \"TxnDate\": \"2016-08-23\",\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"ExchangeRate\": 1,\n    \"Line\": [\n      {\n        \"Id\": \"1\",\n        \"Amount\": 25,\n        \"DetailType\": \"ItemBasedExpenseLineDetail\",\n        \"ItemBasedExpenseLineDetail\": {\n          \"CustomerRef\": {\n            \"value\": \"3\",\n            \"name\": \"Cool Cars\"\n          },\n          \"BillableStatus\": \"NotBillable\",\n          \"ItemRef\": {\n            \"value\": \"11\",\n            \"name\": \"Pump\"\n          },\n          \"UnitPrice\": 25,\n          \"Qty\": 1,\n          \"TaxCodeRef\": {\n            \"value\": \"NON\"\n          }\n        }\n      }\n    ],\n    \"VendorRef\": {\n      \"value\": \"41\",\n      \"name\": \"Hicks Hardware\"\n    },\n    \"APAccountRef\": {\n      \"value\": \"33\",\n      \"name\": \"Accounts Payable (A/P)\"\n    },\n    \"TotalAmt\": 25\n  }",
  "contentType": "application/json",
  "description": "Update a puchase-order object"
 },
 {
  "folder": "PurchaseOrder",
  "name": "ReadById",
  "method": "GET",
  "path": "/purchaseorder/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read a puchase-order object"
 },
 {
  "folder": "PurchaseOrder",
  "name": "Delete",
  "method": "POST",
  "path": "/purchaseorder",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"179\",\n    \"SyncToken\": \"1\"\n}",
  "contentType": "application/json",
  "description": "Delete a puchaseorder object"
 },
 {
  "folder": "PurchaseOrder",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from purchaseorder startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all purchase objects using the 'Query' endpoint"
 },
 {
  "folder": "RefundReceipt",
  "name": "Create",
  "method": "POST",
  "path": "/refundreceipt",
  "query": "",
  "body": "{\n  \"Line\": [\n    {\n      \"Amount\": 420.00,\n      \"DetailType\": \"SalesItemLineDetail\",\n      \"SalesItemLineDetail\": {\n        \"ItemRef\": {\n          \"value\": \"2\"\n        }\n      }\n    }\n  ],\n  \"DepositToAccountRef\": {\n    \"value\": \"35\",\n    \"name\": \"Checking\"\n  }\n}",
  "contentType": "application/json",
  "description": "Create a refund-receipt object"
 },
 {
  "folder": "RefundReceipt",
  "name": "Update",
  "method": "POST",
  "path": "/refundreceipt",
  "query": "",
  "body": "{\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"180\",\n    \"SyncToken\": \"0\",\n    \"MetaData\": {\n      \"CreateTime\": \"2016-08-23T23:38:22-07:00\",\n      \"LastUpdatedTime\": \"2016-08-23T23:38:22-07:00\"\n    },\n    \"CustomField\": [\n      {\n        \"DefinitionId\": \"1\",\n        \"Name\": \"Crew #\",\n        \"Type\": \"StringType\"\n      }\n    ],\n    \"DocNumber\": \"1044-Updated\",\n    \"TxnDate\": \"2016-08-23\",\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"ExchangeRate\": 1,\n    \"Line\": [\n      {\n        \"Id\": \"1\",\n        \"LineNum\": 1,\n        \"Amount\": 420,\n        \"DetailType\": \"SalesItemLineDetail\",\n        \"SalesItemLineDetail\": {\n          \"ItemRef\": {\n            \"value\": \"2\",\n            \"name\": \"Hours\"\n          },\n          \"TaxCodeRef\": {\n            \"value\": \"NON\"\n          }\n        }\n      },\n      {\n        \"Amount\": 420,\n        \"DetailType\": \"SubTotalLineDetail\",\n        \"SubTotalLineDetail\": {}\n      }\n    ],\n    \"TxnTaxDetail\": {\n      \"TotalTax\": 0\n    },\n    \"TotalAmt\": 420,\n    \"HomeTotalAmt\": 420,\n    \"ApplyTaxAfterDiscount\": false,\n    \"PrintStatus\": \"NeedToPrint\",\n    \"Balance\": 0,\n    \"PaymentRefNum\": \"To Print\",\n    \"DepositToAccountRef\": {\n      \"value\": \"35\",\n      \"name\": \"Checking\"\n    }\n  }",
  "contentType": "application/json",
  "description": "Update a refund-receipt object"
 },
 {
  "folder": "RefundReceipt",
  "name": "Delete",
  "method": "POST",
  "path": "/refundreceipt",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"180\",\n    \"SyncToken\": \"1\"\n}",
  "contentType": "application/json",
  "description": "Delete a refund-receipt object by Id"
 },
 {
  "folder": "RefundReceipt",
  "name": "ReadById",
  "method": "GET",
  "path": "/refundreceipt/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read a refund-receipt object"
 },
 {
  "folder": "RefundReceipt",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from refundreceipt startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all refundreceipt objects using the 'Query' endpoint"
 },
 {
  "folder": "Reports",
  "name": "Report-AccountList",
  "method": "GET",
  "path": "/reports/AccountList",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - Account list detail"
 },
 {
  "folder": "Reports",
  "name": "Report-AccountList Copy",
  "method": "GET",
  "path": "/reports/AccountList",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - Account list detail"
 },
 {
  "folder": "Reports",
  "name": "Report-AgedPayableDetail",
  "method": "GET",
  "path": "/reports/AgedPayableDetail",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - AgedPayable aging detail"
 },
 {
  "folder": "Reports",
  "name": "Report-AgedPayables",
  "method": "GET",
  "path": "/reports/AgedPayables",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - AgedPayable aging summary"
 },
 {
  "folder": "Reports",
  "name": "Report-AgedReceivableDetail",
  "method": "GET",
  "path": "/reports/AgedReceivableDetail",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - AgedReceivableDetail aging detail"
 },
 {
  "folder": "Reports",
  "name": "Report-AgedReceivables",
  "method": "GET",
  "path": "/reports/AgedReceivables",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - AgedReceivable aging summary"
 },
 {
  "folder": "Reports",
  "name": "Report-BalanceSheet",
  "method": "GET",
  "path": "/reports/BalanceSheet",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - BalanceSheet"
 },
 {
  "folder": "Reports",
  "name": "Report-CashFlow",
  "method": "GET",
  "path": "/reports/CashFlow",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - CashFlow"
 },
 {
  "folder": "Reports",
  "name": "Report-CashSales",
  "method": "GET",
  "path": "/reports/ClassSales",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - CashSales"
 },
 {
  "folder": "Reports",
  "name": "Report-CustomerBalance",
  "method": "GET",
  "path": "/reports/CustomerBalance",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - CustomerBalance"
 },
 {
  "folder": "Reports",
  "name": "Report-CustomerBalanceDetail",
  "method": "GET",
  "path": "/reports/CustomerBalanceDetail",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - CustomerBalance Detail"
 },
 {
  "folder": "Reports",
  "name": "Report-CustomerIncome",
  "method": "GET",
  "path": "/reports/CustomerIncome",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - Customer Income"
 },
 {
  "folder": "Reports",
  "name": "Report-CustomerSales",
  "method": "GET",
  "path": "/reports/CustomerSales",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - Customer Sales"
 },
 {
  "folder": "Reports",
  "name": "Report-DepartmentSales",
  "method": "GET",
  "path": "/reports/DepartmentSales",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - Department Sales"
 },
 {
  "folder": "Reports",
  "name": "Report-GeneralLedger",
  "method": "GET",
  "path": "/reports/GeneralLedger",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - General Ledger"
 },
 {
  "folder": "Reports",
  "name": "Report-InventoryValuationSummary",
  "method": "GET",
  "path": "/reports/InventoryValuationSummary",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - Inventory Valuation Summary"
 },
 {
  "folder": "Reports",
  "name": "Report-ItemSales",
  "method": "GET",
  "path": "/reports/ItemSales",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - Item Sales"
 },
 {
  "folder": "Reports",
  "name": "Report-ProfitAndLoss",
  "method": "GET",
  "path": "/reports/ProfitAndLoss",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - Profit and Loss"
 },
 {
  "folder": "Reports",
  "name": "Report-ProfitAndLossDetail",
  "method": "GET",
  "path": "/reports/ProfitAndLossDetail",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - Profit and Loss Detail"
 },
 {
  "folder": "Reports",
  "name": "Report-TrialBalance",
  "method": "GET",
  "path": "/reports/TrialBalance",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - Trial Balance "
 },
 {
  "folder": "Reports",
  "name": "Report-TransactionList",
  "method": "GET",
  "path": "/reports/TransactionList",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - Trial List "
 },
 {
  "folder": "Reports",
  "name": "Report-VendorBalance",
  "method": "GET",
  "path": "/reports/VendorBalance",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - Vendor Balance "
 },
 {
  "folder": "Reports",
  "name": "Report-VendorBalanceDetail",
  "method": "GET",
  "path": "/reports/VendorBalanceDetail",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - Vendor Balance Detail"
 },
 {
  "folder": "Reports",
  "name": "Report-VendorExpense",
  "method": "GET",
  "path": "/reports/VendorExpenses",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Report - Vendor Expense"
 },
 {
  "folder": "SalesReceipt",
  "name": "Create",
  "method": "POST",
  "path": "/salesreceipt",
  "query": "",
  "body": "{\n    \"Line\": [{\n        \"Id\": \"1\",\n        \"LineNum\": 1,\n        \"Description\": \"Pest Control Services\",\n        \"Amount\": 35.0,\n        \"DetailType\": \"SalesItemLineDetail\",\n        \"SalesItemLineDetail\": {\n            \"ItemRef\": {\n                \"value\": \"10\",\n                \"name\": \"Pest Control\"\n            },\n            \"UnitPrice\": 35,\n            \"Qty\": 1,\n            \"TaxCodeRef\": {\n                \"value\": \"NON\"\n            }\n        }\n    }]\n}\n",
  "contentType": "application/json",
  "description": "Create an salesreceipt object"
 },
 {
  "folder": "SalesReceipt",
  "name": "ReadByID",
  "method": "GET",
  "path": "/salesreceipt/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Create an salesreceipt object"
 },
 {
  "folder": "SalesReceipt",
  "name": "Update",
  "method": "POST",
  "path": "/salesreceipt",
  "query": "",
  "body": "{\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"181\",\n    \"SyncToken\": \"0\",\n    \"CustomField\": [\n      {\n        \"DefinitionId\": \"1\",\n        \"Name\": \"Crew #\",\n        \"Type\": \"StringType\"\n      }\n    ],\n    \"DocNumber\": \"1045-Updated\",\n    \"TxnDate\": \"2016-09-02\",\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"ExchangeRate\": 1,\n    \"Line\": [\n      {\n        \"Id\": \"1\",\n        \"LineNum\": 1,\n        \"Description\": \"Pest Control Services\",\n        \"Amount\": 35,\n        \"DetailType\": \"SalesItemLineDetail\",\n        \"SalesItemLineDetail\": {\n          \"ItemRef\": {\n            \"value\": \"10\",\n            \"name\": \"Pest Control\"\n          },\n          \"UnitPrice\": 35,\n          \"Qty\": 1,\n          \"TaxCodeRef\": {\n            \"value\": \"NON\"\n          }\n        }\n      },\n      {\n        \"Amount\": 35,\n        \"DetailType\": \"SubTotalLineDetail\",\n        \"SubTotalLineDetail\": {}\n      }\n    ],\n    \"TxnTaxDetail\": {\n      \"TotalTax\": 0\n    },\n    \"TotalAmt\": 35,\n    \"HomeTotalAmt\": 35,\n    \"ApplyTaxAfterDiscount\": false,\n    \"PrintStatus\": \"NeedToPrint\",\n    \"EmailStatus\": \"NotSet\",\n    \"Balance\": 0,\n    \"DepositToAccountRef\": {\n      \"value\": \"4\",\n      \"name\": \"Undeposited Funds\"\n    }\n  }",
  "contentType": "application/json",
  "description": "Update a salesreceipt object"
 },
 {
  "folder": "SalesReceipt",
  "name": "Delete",
  "method": "POST",
  "path": "/salesreceipt",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"181\",\n    \"SyncToken\": \"1\"\n}",
  "contentType": "application/json",
  "description": "Delete a salesreceipt object"
 },
 {
  "folder": "SalesReceipt",
  "name": "SalesrRceipt-ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from salesreceipt startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all salesreceipt objects using the 'Query' endpoint"
 },
 {
  "folder": "SalesReceipt",
  "name": "Void",
  "method": "POST",
  "path": "/salesreceipt",
  "query": "include=void",
  "body": "{\n    \"sparse\": true,\n    \"Id\": \"188\",\n    \"SyncToken\": \"0\"\n}",
  "contentType": "application/json",
  "description": "Void a salesreceipt object"
 },
 {
  "folder": "TaxAgency",
  "name": "Create",
  "method": "POST",
  "path": "/taxagency",
  "query": "",
  "body": "{\n  \"DisplayName\": \"CityTaxAgency\"\n}",
  "contentType": "application/json",
  "description": "Create a tax-agency object"
 },
 {
  "folder": "TaxAgency",
  "name": "ReadByID",
  "method": "GET",
  "path": "/taxagency/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Get a tax-agency object by ID"
 },
 {
  "folder": "TaxAgency",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from taxagency startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all taxagency objects using the 'Query' endpoint"
 },
 {
  "folder": "TaxCode",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from taxcode startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all taxcode objects using the 'Query' endpoint"
 },
 {
  "folder": "TaxCode",
  "name": "ReadById",
  "method": "GET",
  "path": "/taxcode/{id}",
  "query": "",
  "body": "",
  "contentType": "text/plain",
  "description": "Read a taxcode by Id"
 },
 {
  "folder": "TaxRate",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from taxrate startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all taxrate objects using the 'Query' endpoint"
 },
 {
  "folder": "TaxRate",
  "name": "ReadById",
  "method": "GET",
  "path": "/taxrate/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read a taxRate by Id"
 },
 {
  "folder": "TaxService",
  "name": "Create",
  "method": "POST",
  "path": "/taxservice/taxcode",
  "query": "",
  "body": "{\n  \"TaxCode\": \"MyTaxCodeName\",\n  \"TaxRateDetails\": [\n    {\n      \"TaxRateName\": \"myNewTaxRateName\",\n      \"RateValue\": \"8\",\n      \"TaxAgencyId\": \"1\",\n      \"TaxApplicableOn\": \"Sales\"\n    }\n  ]\n}",
  "contentType": "application/json",
  "description": "Use TaxService to create taxcode and corresponding taxrates"
 },
 {
  "folder": "Term",
  "name": "Create",
  "method": "POST",
  "path": "/term",
  "query": "",
  "body": "{\n  \"Name\": \"Term120\",\n  \"DueDays\": \"120\"\n}",
  "contentType": "application/json",
  "description": "Create a term object"
 },
 {
  "folder": "Term",
  "name": "ReadById",
  "method": "GET",
  "path": "/term/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read a term object by Id"
 },
 {
  "folder": "Term",
  "name": "Update",
  "method": "POST",
  "path": "/term",
  "query": "",
  "body": "{\n    \"Name\": \"Term1120-Updated\",\n    \"Active\": true,\n    \"Type\": \"STANDARD\",\n    \"DiscountPercent\": 0,\n    \"DueDays\": 120,\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"8\",\n    \"SyncToken\": \"0\"\n  }",
  "contentType": "application/json",
  "description": "Update a term object"
 },
 {
  "folder": "Term",
  "name": "Delete",
  "method": "POST",
  "path": "/term",
  "query": "",
  "body": "{\n    \"Name\": \"Term1120-Updated\",\n    \"Active\": false,\n    \"Type\": \"STANDARD\",\n    \"DiscountPercent\": 0,\n    \"DueDays\": 120,\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"8\",\n    \"SyncToken\": \"1\"\n  }",
  "contentType": "application/json",
  "description": "Update a term object"
 },
 {
  "folder": "Term",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from term startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all term objects using the 'Query' endpoint"
 },
 {
  "folder": "TimeActivity",
  "name": "Create",
  "method": "POST",
  "path": "/timeactivity",
  "query": "",
  "body": "{\n    \"NameOf\": \"Employee\",\n    \"EmployeeRef\": {\n        \"value\": \"55\",\n        \"name\": \"Emily Platt\"\n    },\n    \"StartTime\": \"2015-07-05T08:00:00-08:00\",\n    \"EndTime\": \"2013-07-05T17:00:00-08:00\"\n}\n",
  "contentType": "application/json",
  "description": "Create a term object"
 },
 {
  "folder": "TimeActivity",
  "name": "Update",
  "method": "POST",
  "path": "/timeactivity",
  "query": "",
  "body": "{\n    \"TxnDate\": \"2016-09-03\",\n    \"NameOf\": \"Employee\",\n    \"EmployeeRef\": {\n      \"value\": \"55\",\n      \"name\": \"Emily Platt\"\n    },\n    \"ItemRef\": {\n      \"value\": \"2\",\n      \"name\": \"Hours\"\n    },\n    \"BillableStatus\": \"NotBillable\",\n    \"Taxable\": false,\n    \"HourlyRate\": 0,\n    \"StartTime\": \"2016-09-02T09:00:00-07:00\",\n    \"EndTime\": \"2016-09-02T18:00:00-07:00\",\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"6\",\n    \"SyncToken\": \"0\"\n  }",
  "contentType": "application/json",
  "description": "Update a term object"
 },
 {
  "folder": "TimeActivity",
  "name": "ReadById",
  "method": "POST",
  "path": "/timeactivity",
  "query": "",
  "body": "{\n    \"TxnDate\": \"2016-09-03\",\n    \"NameOf\": \"Employee\",\n    \"EmployeeRef\": {\n      \"value\": \"55\",\n      \"name\": \"Emily Platt\"\n    },\n    \"ItemRef\": {\n      \"value\": \"2\",\n      \"name\": \"Hours\"\n    },\n    \"BillableStatus\": \"NotBillable\",\n    \"Taxable\": false,\n    \"HourlyRate\": 0,\n    \"StartTime\": \"2016-09-02T09:00:00-07:00\",\n    \"EndTime\": \"2016-09-02T18:00:00-07:00\",\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"6\",\n    \"SyncToken\": \"0\"\n  }",
  "contentType": "application/json",
  "description": "Read a term object by Id"
 },
 {
  "folder": "TimeActivity",
  "name": "Delete",
  "method": "POST",
  "path": "/timeactivity",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"6\",\n    \"SyncToken\": \"1\"\n}",
  "contentType": "application/json",
  "description": "Delete a time-activity object by Id"
 },
 {
  "folder": "TimeActivity",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from timeactivity startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all timeactivity objects using the 'Query' endpoint"
 },
 {
  "folder": "Transfer",
  "name": "Create",
  "method": "POST",
  "path": "/transfer",
  "query": "",
  "body": "{\n    \"FromAccountRef\": {\n        \"value\": \"35\",\n        \"name\": \"Checking\"\n    },\n    \"ToAccountRef\": {\n        \"value\": \"36\",\n        \"name\": \"Savings\"\n    },\n    \"Amount\": \"120.00\"\n}\n",
  "contentType": "application/json",
  "description": "Create a transfer object"
 },
 {
  "folder": "Transfer",
  "name": "ReadById",
  "method": "GET",
  "path": "/transfer/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read a transfer object by Id"
 },
 {
  "folder": "Transfer",
  "name": "Update",
  "method": "POST",
  "path": "/transfer",
  "query": "",
  "body": "{\n    \"FromAccountRef\": {\n      \"value\": \"35\",\n      \"name\": \"Checking\"\n    },\n    \"ToAccountRef\": {\n      \"value\": \"36\",\n      \"name\": \"Savings\"\n    },\n    \"Amount\": 120,\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"183\",\n    \"SyncToken\": \"0\",\n    \"TxnDate\": \"2016-09-03\",\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"ExchangeRate\": 1\n  }",
  "contentType": "application/json",
  "description": "Update a transfer object"
 },
 {
  "folder": "Transfer",
  "name": "Delete",
  "method": "POST",
  "path": "/transfer",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"183\",\n    \"SyncToken\": \"1\"\n}",
  "contentType": "application/json",
  "description": "Delete a transfer object"
 },
 {
  "folder": "Transfer",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from transfer startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all transfer objects using the 'Query' endpoint"
 },
 {
  "folder": "Vendor",
  "name": "Create",
  "method": "POST",
  "path": "/vendor",
  "query": "",
  "body": "{\n    \"BillAddr\": {\n        \"Line1\": \"Dianne's Auto Shop\",\n        \"Line2\": \"Dianne Bradley\",\n        \"Line3\": \"29834 Mustang Ave.\",\n        \"City\": \"Millbrae\",\n        \"Country\": \"U.S.A\",\n        \"CountrySubDivisionCode\": \"CA\",\n        \"PostalCode\": \"94030\"\n    },\n    \"TaxIdentifier\": \"99-5688293\",\n    \"AcctNum\": \"35372649\",\n    \"Title\": \"Ms.\",\n    \"GivenName\": \"Dianne\",\n    \"FamilyName\": \"Bradley\",\n    \"Suffix\": \"Sr.\",\n    \"CompanyName\": \"Dianne's Auto Shop\",\n    \"DisplayName\": \"Dianne's Auto Shop\",\n    \"PrintOnCheckName\": \"Dianne's Auto Shop\",\n    \"PrimaryPhone\": {\n        \"FreeFormNumber\": \"(650) 555-2342\"\n    },\n    \"Mobile\": {\n        \"FreeFormNumber\": \"(650) 555-2000\"\n    },\n    \"PrimaryEmailAddr\": {\n        \"Address\": \"dbradley@myemail.com\"\n    },\n    \"WebAddr\": {\n        \"URI\": \"http://DiannesAutoShop.com\"\n    }\n}\n",
  "contentType": "application/json",
  "description": "Create a vendor object"
 },
 {
  "folder": "Vendor",
  "name": "Update",
  "method": "POST",
  "path": "/vendor",
  "query": "",
  "body": "{\n    \"BillAddr\": {\n      \"Id\": \"111\",\n      \"Line1\": \"Dianne's Auto Shop\",\n      \"Line2\": \"Dianne Bradley\",\n      \"Line3\": \"29834 Mustang Ave.\",\n      \"City\": \"Millbrae\",\n      \"Country\": \"U.S.A\",\n      \"CountrySubDivisionCode\": \"CA\",\n      \"PostalCode\": \"94030\"\n    },\n    \"TaxIdentifier\": \"XXXXXX8293\",\n    \"Balance\": 0,\n    \"AcctNum\": \"35372649\",\n    \"Vendor1099\": false,\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"70\",\n    \"SyncToken\": \"0\",\n    \"Title\": \"Ms.\",\n    \"GivenName\": \"Dianne\",\n    \"FamilyName\": \"Bradley\",\n    \"Suffix\": \"Sr.\",\n    \"CompanyName\": \"Dianne's Auto Shop\",\n    \"DisplayName\": \"Dianne's Auto Shop-Updated\",\n    \"PrintOnCheckName\": \"Dianne's Auto Shop\",\n    \"Active\": true,\n    \"PrimaryPhone\": {\n      \"FreeFormNumber\": \"(650) 555-2342\"\n    },\n    \"Mobile\": {\n      \"FreeFormNumber\": \"(650) 555-2000\"\n    },\n    \"PrimaryEmailAddr\": {\n      \"Address\": \"dbradley@myemail.com\"\n    },\n    \"WebAddr\": {\n      \"URI\": \"http://DiannesAutoShop.com\"\n    }\n  }",
  "contentType": "application/json",
  "description": "Update a vendor object"
 },
 {
  "folder": "Vendor",
  "name": "ReadById",
  "method": "GET",
  "path": "/vendor/{id}",
  "query": "",
  "body": "",
  "contentType": "application/json",
  "description": "Read a vendor object by Id"
 },
 {
  "folder": "Vendor",
  "name": "Delete",
  "method": "POST",
  "path": "/vendor",
  "query": "",
  "body": "{\n    \"BillAddr\": {\n      \"Id\": \"111\",\n      \"Line1\": \"Dianne's Auto Shop\",\n      \"Line2\": \"Dianne Bradley\",\n      \"Line3\": \"29834 Mustang Ave.\",\n      \"City\": \"Millbrae\",\n      \"Country\": \"U.S.A\",\n      \"CountrySubDivisionCode\": \"CA\",\n      \"PostalCode\": \"94030\"\n    },\n    \"TaxIdentifier\": \"XXXXXX8293\",\n    \"Balance\": 0,\n    \"AcctNum\": \"35372649\",\n    \"Vendor1099\": false,\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"70\",\n    \"SyncToken\": \"0\",\n    \"Title\": \"Ms.\",\n    \"GivenName\": \"Dianne\",\n    \"FamilyName\": \"Bradley\",\n    \"Suffix\": \"Sr.\",\n    \"CompanyName\": \"Dianne's Auto Shop\",\n    \"DisplayName\": \"Dianne's Auto Shop-Updated\",\n    \"PrintOnCheckName\": \"Dianne's Auto Shop\",\n    \"Active\": false,\n    \"PrimaryPhone\": {\n      \"FreeFormNumber\": \"(650) 555-2342\"\n    },\n    \"Mobile\": {\n      \"FreeFormNumber\": \"(650) 555-2000\"\n    },\n    \"PrimaryEmailAddr\": {\n      \"Address\": \"dbradley@myemail.com\"\n    },\n    \"WebAddr\": {\n      \"URI\": \"http://DiannesAutoShop.com\"\n    }\n  }",
  "contentType": "application/json",
  "description": "Delete a vendor object"
 },
 {
  "folder": "Vendor",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from vendor startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all vendor objects using the 'Query' endpoint"
 },
 {
  "folder": "VendorCredit",
  "name": "ReadAll",
  "method": "POST",
  "path": "/query",
  "query": "",
  "body": "select * from vendorcredit startposition 1 maxresults 5",
  "contentType": "text/plain",
  "description": "Read all vendorcredit objects using the 'Query' endpoint"
 },
 {
  "folder": "VendorCredit",
  "name": "Create",
  "method": "POST",
  "path": "/vendorcredit",
  "query": "",
  "body": "{\n        \"TxnDate\":\"2014-12-23\",\n        \"Line\":[\n        {\n            \"Id\":\"1\",\n            \"Amount\":90.00,\n            \"DetailType\":\"AccountBasedExpenseLineDetail\",\n            \"AccountBasedExpenseLineDetail\":\n            {\n                \"CustomerRef\":\n                {\n                    \"value\":\"1\",\n                    \"name\":\"Amy's Bird Sanctuary\"\n                },\n                \"AccountRef\":\n                {\n                    \"value\":\"8\",\n                    \"name\":\"Bank Charges\"\n                },\n                \"BillableStatus\":\"Billable\",\n                \"TaxCodeRef\":\n                {\n                    \"value\":\"TAX\"\n                }\n            }\n        }\n        ],\n        \"VendorRef\":\n        {\n            \"value\":\"30\",\n            \"name\":\"Books by Bessie\"\n        },\n        \"APAccountRef\":\n        {\n            \"value\":\"33\",\n            \"name\":\"Accounts Payable (A/P)\"\n        },\n        \"TotalAmt\":90.00\n    }\n    ]\n}",
  "contentType": "application/json",
  "description": "Create a vendorcredit object"
 },
 {
  "folder": "VendorCredit",
  "name": "Update",
  "method": "POST",
  "path": "/vendorcredit",
  "query": "",
  "body": "{\n    \"domain\": \"QBO\",\n    \"sparse\": false,\n    \"Id\": \"185\",\n    \"SyncToken\": \"0\",\n    \"MetaData\": {\n      \"CreateTime\": \"2016-09-02T03:09:34-07:00\",\n      \"LastUpdatedTime\": \"2016-09-02T03:09:34-07:00\"\n    },\n    \"TxnDate\": \"2014-04-23\",\n    \"CurrencyRef\": {\n      \"value\": \"USD\",\n      \"name\": \"United States Dollar\"\n    },\n    \"ExchangeRate\": 1,\n    \"Line\": [\n      {\n        \"Id\": \"1\",\n        \"Amount\": 90,\n        \"DetailType\": \"AccountBasedExpenseLineDetail\",\n        \"AccountBasedExpenseLineDetail\": {\n          \"CustomerRef\": {\n            \"value\": \"1\",\n            \"name\": \"Amy's Bird Sanctuary\"\n          },\n          \"AccountRef\": {\n            \"value\": \"8\",\n            \"name\": \"Bank Charges\"\n          },\n          \"BillableStatus\": \"Billable\",\n          \"TaxCodeRef\": {\n            \"value\": \"TAX\"\n          }\n        }\n      }\n    ],\n    \"VendorRef\": {\n      \"value\": \"30\",\n      \"name\": \"Books by Bessie\"\n    },\n    \"APAccountRef\": {\n      \"value\": \"33\",\n      \"name\": \"Accounts Payable (A/P)\"\n    },\n    \"TotalAmt\": 90\n  }",
  "contentType": "application/json",
  "description": "Update a vendorcredit object"
 },
 {
  "folder": "VendorCredit",
  "name": "ReadById",
  "method": "GET",
  "path": "/vendorcredit/{id}",
  "query": "",
  "body": "",
  "contentType": "",
  "description": "Read a vendorcredit object by Id"
 },
 {
  "folder": "VendorCredit",
  "name": "Delete",
  "method": "POST",
  "path": "/vendorcredit",
  "query": "operation=delete",
  "body": "{\n    \"Id\": \"185\",\n    \"SyncToken\": \"1\"\n}",
  "contentType": "application/json",
  "description": "Delete a vendorcredit object by Id"
 }
];
