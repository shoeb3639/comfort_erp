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

Booking closing and collection are database-backed. A collection can be recorded,
verified, or voided without changing the immutable booking closure:

```text
POST   /api/v1/tenant/bookings/:bookingId/collections
PATCH  /api/v1/tenant/bookings/:bookingId/collections/:collectionId/verify
DELETE /api/v1/tenant/bookings/:bookingId/collections/:collectionId
```

The service rejects collection totals above the booking invoice amount. Collection
summary (`total`, `balance`, and payment state) is calculated from non-void records.

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

## Manager Ledger

Manager Ledger is a running wallet/account for operational expenses.

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

Transactions record money movement in manager ledger.

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
