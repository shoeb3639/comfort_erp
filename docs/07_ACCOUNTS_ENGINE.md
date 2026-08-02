# Accounts Engine

Version: 1.0

Status: Approved Requirements Baseline (Frozen)

Baseline Date: 20 July 2026

## Purpose

This document defines accounts workflow for Cablix ERP tenant operations.

Accounting must keep customer collections and operational expenses separate.

Golden rule:

```text
Customer Collection = Company Revenue
Manager Ledger = Operational Expenses
```

Customer cash must be deposited 100% into the company bank account. It must not be used for diesel, toll, parking, repairs, salary, or other operational expenses.

Operational expenses must be paid only from manager ledger balance.

## Accounts Modules

Tenant ERP accounts modules:

- Manager Ledger
- Transactions / Expense Entry
- Booking Cash Deposit
- Daily Closing
- Audit & Verification

## Implemented Accounts Foundation

Step 1 provides the shared database, API, UI navigation, and permission baseline
used by every Accounts workflow.

Permission keys:

- `accounts.collection.view`
- `accounts.deposit.manage`
- `accounts.ledger.view`
- `accounts.fund.release`
- `accounts.expense.manage`
- `accounts.daily_closing.manage`
- `accounts.audit.verify`

Foundation APIs:

```text
GET  /api/v1/tenant/accounts/foundation
POST /api/v1/tenant/accounts/references/validate
```

The foundation API returns only navigation entries authorized for the
authenticated tenant user. Tenant ID is always taken from authenticated backend
context. Reference checks are tenant-scoped, case-insensitive, normalized, and
also check existing non-void booking collection and deposit references.

Shared financial records follow these policies:

- Common database enums are used for transaction types, payment modes, entry
  direction, expense categories, and reference sources.
- Reference numbers are unique within a tenant and remain reserved after soft
  deletion to protect the audit trail.
- Financial records use `created_by`, `updated_by`, `deleted_by`, `created_at`,
  `updated_at`, and `deleted_at` audit fields where applicable.
- Financial records are soft deleted or voided; they are not hard deleted
  through normal application workflows.

## Collections

Booking collection tracks payment received against booking or invoice.

Collection fields:

- Collection date
- Booking ID
- Invoice ID if available
- Amount
- Payment mode
- Collected by
- Receiver name
- Reference number
- Remarks

Payment modes:

- Cash
- UPI
- Bank Transfer
- Card
- Cheque

Payment statuses:

- Unpaid
- Partially Paid
- Paid
- Cash With Manager
- Deposited
- Verified

Collection is separate from manager expense fund.

Cash booking payment should not increase manager ledger balance.

### Implemented Booking Collection APIs

Booking closing and collection are database-backed. The Accounts collection
register provides tenant-wide filters, paid/partial/unpaid booking balances,
receipt display, and collection audit history:

```text
GET    /api/v1/tenant/accounts/collections
GET    /api/v1/tenant/accounts/collections/:collectionId
POST   /api/v1/tenant/bookings/:bookingId/collections
PATCH  /api/v1/tenant/bookings/:bookingId/collections/:collectionId/verify
DELETE /api/v1/tenant/bookings/:bookingId/collections/:collectionId
```

The service rejects collection totals above the booking invoice amount. Collection
summary (`total`, `balance`, and payment state) is calculated from non-void records.
The register supports collection date range, payment mode, collection status,
booking, customer, and text search filters.

Payment and deposit references are normalized and reserved in the tenant-scoped
Accounts reference registry in the same transaction as collection creation.
Duplicate references are rejected even when concurrent requests race. Voiding a
collection preserves both its reference reservation and audit trail.

Receipt details include booking, customer, invoice, payment/deposit information,
verification state, and ordered CREATE, VERIFY, and VOID audit events.

## Booking Cash Deposit

Booking cash deposit tracks customer cash collected and deposited to company bank.

Deposit statuses:

- Collected
- With Manager
- Deposited
- Verified
- Mismatch

Fields:

- Booking ID
- Collection date
- Amount collected
- Payment mode: Cash
- Collected by
- Receiver manager
- Deposit date
- Deposit mode
- Deposit reference number
- Deposited by
- Verified by
- Remarks
- Attachment

Deposit modes:

- Cash Deposit
- UPI
- Bank Transfer

Summary cards:

- Total Cash Collected
- Cash With Manager
- Deposited Amount
- Verified Amount
- Pending Deposit
- Mismatch Amount

Rule:

Booking cash deposit is monitoring and bank verification. It must not be mixed with manager ledger.

### Implemented Cash-Deposit Register

Every cash-mode booking collection automatically creates one linked cash-deposit
tracking record. Existing cash collections are backfilled during migration.

```text
GET   /api/v1/tenant/accounts/cash-deposits
GET   /api/v1/tenant/accounts/cash-deposits/:depositId
PATCH /api/v1/tenant/accounts/cash-deposits/:depositId/receive
PATCH /api/v1/tenant/accounts/cash-deposits/:depositId/deposit
PATCH /api/v1/tenant/accounts/cash-deposits/:depositId/verify
```

Implemented transition:

```text
Collected → With Manager → Deposited → Verified
                                  └──→ Mismatch
```

The backend validates that the receiver manager is an active manager/admin user
of the authenticated tenant. The deposited amount cannot exceed the linked cash
collection, and the bank-credited amount cannot exceed the deposited amount.
A mismatch reason is mandatory when the verified bank amount differs from cash
collected.

Bank references use the shared tenant-scoped reference registry. Each receive,
deposit, verification, or mismatch transition creates an audit event. Deposit
operations update only the cash-deposit and linked collection records; no
manager-ledger credit or transaction is created.

## Manager Ledger

Manager Ledger is a running wallet/account for operational expenses.

### Implemented Manager Ledger Master

Step 4 is database-backed end to end. One ledger is permitted for each
manager/location combination in a tenant. The manager must be an active
manager, administrator, or accountant in the authenticated tenant, and the
location must be active in that same tenant.

```text
GET   /api/v1/tenant/accounts/manager-ledgers
POST  /api/v1/tenant/accounts/manager-ledgers
GET   /api/v1/tenant/accounts/manager-ledgers/:ledgerId
PATCH /api/v1/tenant/accounts/manager-ledgers/:ledgerId/status
```

List filters include search, status, manager, and location. Read access requires
`accounts.ledger.view`; ledger creation and activation/suspension require
`accounts.fund.release`.

Creation writes the ledger, its opening-balance entry, and its audit event in
one database transaction. The database enforces one ledger per manager and
location, non-negative aggregate credit/debit values, and:

```text
Opening Balance + Credits - Debits = Current Balance
```

Opening balance is not counted again in `total_credits`. Ledger entries preserve
balance before and running balance, and financial ledgers are never hard-deleted
through the API. Inactive ledgers retain all entries and audit history.

Customer cash-deposit monitoring remains separate and never changes a manager
ledger balance.

Formula:

```text
Opening Balance
+ Company Fund Released
- Expenses Paid
+/- Adjustments
= Current Balance
```

Manager Ledger list should show:

- Manager
- Location
- Opening Balance
- Total Released
- Total Expenses
- Current Balance
- Status

Ledger entry columns:

- Date
- Transaction Type
- Description
- Credit
- Debit
- Running Balance
- Reference
- Actions

Examples:

```text
06-Jul | Fund Released | PhonePe transfer | Credit 20000 | Balance 20000
06-Jul | Fuel Expense | Diesel UP70HQ2666 | Debit 4000 | Balance 16000
06-Jul | Driver Payment | Kamlesh Salary | Debit 2500 | Balance 13500
```

## Transactions / Expenses

### Implemented Account Transaction APIs

Operational transactions are persisted and posted atomically to the selected
active manager ledger:

```text
GET  /api/v1/tenant/accounts/transactions
POST /api/v1/tenant/accounts/transactions
```

Every posting locks the ledger, rejects insufficient funds, reserves its
tenant-scoped reference, creates the transaction and running-balance ledger
entry, updates ledger aggregates, and records the audit event in one
serializable transaction. Category-specific vehicle, booking, and driver
references are validated inside the authenticated tenant.

Transactions record money movement in manager ledger.

### Implemented Company Fund Release

Step 5 implements the first real manager-ledger transaction:

```text
Company Fund Release → Verified Ledger Credit
```

```text
GET  /api/v1/tenant/accounts/fund-releases
POST /api/v1/tenant/accounts/fund-releases
GET  /api/v1/tenant/accounts/fund-releases/:releaseId
```

The release date, active manager ledger, positive amount, payment mode,
normalized reference number, description, optional attachment name, and remarks
are persisted. The authenticated tenant user is always stored as `released_by`;
it is never accepted from frontend input.

The first implementation uses immediate verification: the authorized releasing
user is recorded as approver and verifier, and the release is stored with
`VERIFIED` status. The fund-release record, tenant reference reservation,
manager-ledger credit entry, aggregate credit/current balances, and audit event
are written in one serializable transaction while the ledger row is locked.
Concurrent ledger postings are retried safely.

Database checks enforce a positive amount and require every verified release to
have its verifier, verification time, and ledger-entry linkage. References are
unique within the tenant across collections, deposits, fund releases, and other
Accounts transactions. A duplicate returns `DUPLICATE_REFERENCE` without
changing the ledger.

The Fund Release screen no longer uses browser mock storage. It provides the
release form, active ledger choices, release summaries, search, and the
database-backed register.

Transaction types:

- Fund Release
- Expense
- Adjustment
- Fund Return
- Driver Advance
- Driver Recovery
- Partner Withdrawal
- Owner Withdrawal
- Employee Advance

Common fields:

- Transaction date
- Manager
- Transaction type
- Payment mode
- Amount
- Purpose / description
- Category
- Reference number
- Attachment
- Remarks

Ledger impact:

- Fund Release increases manager balance.
- Expense reduces manager balance.
- Driver Advance reduces manager balance.
- Partner Withdrawal reduces manager balance.
- Employee Advance reduces manager balance.
- Fund Return reduces manager balance.
- Adjustment may increase or reduce manager balance.

Expense categories:

- Fuel
- Vehicle Service / Maintenance
- Driver Payment
- Office Expense
- Employee Advance
- Partner / Owner Withdrawal
- Recoverable Trip Charge
- Other

## Expense Category Rules

Fuel:

- Vehicle required.
- Booking ID optional.
- Fuel type required.
- Fuel quantity optional.
- Rate per litre optional.
- Odometer reading optional.
- Impacts manager ledger and vehicle ledger.
- If booking selected, link to booking profit.

Vehicle Service / Maintenance:

- Vehicle required.
- Service type required.
- Odometer reading recommended.
- Vendor optional.
- Impacts manager ledger and vehicle ledger.

Driver Payment:

- Driver required.
- Vehicle optional but recommended.
- Payment type required.
- Impacts manager ledger and driver ledger.
- If vehicle selected, adds to vehicle ledger as driver cost.

Office Expense:

- Location required.
- Vehicle not required.
- Allocation method required.
- Impacts manager ledger and office ledger.
- Should not immediately affect vehicle ledger.
- Allocate to vehicles only during month-end/final vehicle P&L report.

Partner / Owner Withdrawal:

- Partner/owner required.
- Vehicle optional.
- Impacts manager ledger and partner ledger.

Employee Advance:

- Employee required.
- Impacts manager ledger and employee ledger.

Recoverable Trip Charge:

- Booking ID required.
- Vehicle optional.
- Used for toll, parking, state tax, entry fee, driver night/DA if charged to customer.
- Impacts manager ledger if paid by manager.
- Should be marked recoverable/pass-through.
- Should not reduce vehicle profit.

## Daily Closing

Daily closing is database-backed:

```text
GET /api/v1/tenant/accounts/daily-closing
PUT /api/v1/tenant/accounts/daily-closing
```

The read API calculates the date's opening balance, credits, debits, closing
balance, ledger activity, and separately monitored customer cash deposits.
Close and reopen persist a financial snapshot and an audit event.

Daily closing summarizes manager ledger activity and booking cash monitoring for a date.

Filters:

- Date
- Manager
- Location

Manager ledger summary:

- Opening Balance
- Amount Released Today
- Expenses Today
- Fund Returned
- Adjustments
- Closing Balance / Carry Forward

Formula:

```text
Closing Balance = Opening Balance + Amount Released - Expenses - Fund Returned +/- Adjustments
```

Transactions today table:

- Date
- Transaction Type
- Category
- Purpose
- Vehicle
- Booking ID
- Driver / Partner / Employee
- Credit
- Debit
- Balance

Booking cash deposit monitoring:

- Booking ID
- Cash Collected
- Deposited Amount
- Deposit Status
- Reference

Important:

Booking cash is shown only for monitoring. It must not be mixed with manager ledger balance.

Buttons:

- Close Day
- Reopen Day
- Print
- Export PDF
- Export Excel

## Audit & Verification

Audit and exception resolution are database-backed:

```text
GET   /api/v1/tenant/accounts/audit
PATCH /api/v1/tenant/accounts/audit/resolve
```

The audit register derives manager-ledger equations and cash-deposit exceptions
from persisted records. Exception resolutions store the resolving user, time,
and resolution note; they do not rewrite the underlying financial record.

Audit verifies that money movement is correct.

Audit rules:

Booking Collection Audit:

```text
Booking Cash Collected = Company Bank Deposit
```

Manager Ledger Audit:

```text
Opening Balance + Fund Released - Expenses - Fund Return +/- Adjustments = Closing Balance
```

Expense Audit:

- Every expense must have required linkage based on category.

Duplicate Reference Audit:

- Duplicate payment reference numbers should be flagged.

Sections:

- Manager Ledger Verification
- Booking Cash Verification
- Exceptions
- Audit Trail

Exception examples:

- Booking cash not deposited
- Deposit not verified
- Fund balance mismatch
- Expense missing vehicle where required
- Driver payment missing driver
- Fuel expense without vehicle
- Recoverable charge not linked to booking
- Office expense without allocation method
- Duplicate reference number
- Negative manager balance

Actions:

- Verify
- Mark Resolved
- Add Adjustment
- View Details
- Export

## Ledger Impacts

Future reporting should support:

- Manager Ledger
- Vehicle Ledger
- Driver Ledger
- Partner Ledger
- Employee Ledger
- Office Ledger
- Booking Profit Ledger

Examples:

Fuel Expense:

- Manager Ledger Debit
- Vehicle Ledger Debit

Booking Cash Deposit:

- Company Bank Credit
- No Manager Ledger Impact

Partner Withdrawal:

- Manager Ledger Debit
- Partner Ledger Debit

Office Expense:

- Manager Ledger Debit
- Office Ledger Debit
- Vehicle allocation later

Recoverable Toll/Parking:

- Manager Ledger Debit if paid by manager
- Recoverable Charge
- No Vehicle Profit Reduction

## Vehicle Profit Rule

Vehicle profit should use:

```text
Vehicle Revenue = Base Fare / Package Fare only
```

Deduct:

- Fuel
- Vehicle Service / Maintenance
- Driver Cost
- Allocated Office Expense

Do not deduct:

- Toll
- Parking
- State Tax
- Entry Fee
- Recoverable Driver Night / DA
- GST

These are recoverable/pass-through charges if billed to customer.

Vendor booking profit should remain separate from own vehicle profit.
