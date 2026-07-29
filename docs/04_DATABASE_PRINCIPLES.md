# Database Principles

## Human-readable text casing

Human-readable text must be normalized to Title Case by the backend service
layer before every create or update operation. This rule applies consistently
to tenant-facing modules, including Company Setup, Customers, Vendors,
Vehicles, Drivers, Bookings, Invoices, and future operational masters.

Do not case-transform machine-readable values such as IDs, UUIDs, email
addresses, passwords, URLs, registration numbers, tax identifiers, enum values,
permission keys, prefix/code fields, phone numbers, dates, or times.

Version: 1.0

Status: Approved Requirements Baseline (Frozen)

Baseline Date: 20 July 2026

## Purpose

This document defines database standards for Cablix ERP before backend implementation.

The database must support multi-tenant SaaS, tenant isolation, auditability, and future reporting.

## Naming Standards

Use lowercase snake_case for:

- Tables
- Columns
- Indexes
- Foreign keys
- Enum values where practical

Examples:

- tenant_id
- created_at
- invoice_number
- ownership_type
- booking_status

Table names should be plural:

- tenants
- users
- customers
- vendors
- vehicles
- bookings
- invoices
- manager_ledger_entries

## Primary Keys

Every table must have a primary key.

Recommended:

```text
id
```

Primary keys may use UUIDs or database-generated IDs. The final backend decision should be consistent across the application.

Business-facing numbers should not be used as primary keys.

Examples:

- invoice_number is not the invoice primary key.
- booking_id is not the booking primary key; the internal `id` UUID remains the
  primary key.
- tenant_code is not the tenant primary key.

## Foreign Keys

Use foreign keys for important relationships.

Examples:

- users.tenant_id -> tenants.id
- vehicles.vendor_id -> vendors.id
- bookings.customer_id -> customers.id
- bookings.vehicle_id -> vehicles.id
- invoices.booking_id -> bookings.id
- manager_ledger_entries.manager_id -> users.id

Foreign keys should be indexed when used for filtering or joins.

## Multi-Tenancy Rules

Every tenant-owned table must contain:

```text
tenant_id
```

Tenant-owned examples:

- users
- roles
- customers
- vendors
- vehicles
- drivers
- bookings
- invoices
- collections
- manager_ledger_entries
- expenses
- booking_cash_deposits

Rules:

- Backend queries must always filter by authenticated tenant context.
- API handlers must not trust frontend-supplied `tenant_id`.
- Unique constraints for tenant-owned data should usually include `tenant_id`.

Examples:

```text
unique(tenant_id, invoice_number)
unique(tenant_id, vehicle_registration_number)
unique(tenant_id, customer_mobile)
```

Platform-owned tables do not belong to tenants:

- platform_users
- subscription_plans
- tenants
- tenant_subscriptions
- subscription_payments
- platform_audit_logs

## Soft Deletes

Use soft deletes for operational ERP records where historical references matter.

Recommended field:

```text
deleted_at
```

Rules:

- Do not hard-delete bookings, invoices, accounting transactions, or generated financial records.
- Use inactive/cancelled statuses where business meaning is important.
- Hard delete may be allowed for draft/setup records only after business approval.

Records that should generally be soft deleted:

- Customers
- Vendors
- Vehicles
- Drivers
- Users
- Bookings
- Invoices
- Expenses
- Collections

Records that should generally not be deleted:

- Final invoices
- Ledger entries
- Audit logs
- Subscription payments
- Booking closure records

## Audit Fields

Standard audit fields:

```text
created_at
created_by
updated_at
updated_by
deleted_at
deleted_by
```

Financial and critical workflow records should also support audit trails:

- Invoice finalized
- Invoice cancelled
- Booking closed
- Deposit verified
- Manager ledger adjusted
- Tenant suspended
- Subscription changed

Audit trail fields:

```text
action
module
reference_id
old_values
new_values
remarks
created_at
created_by
```

## Status Fields

Use controlled status values.

Avoid free-text statuses in core business tables.

Examples:

Booking status:

- Draft
- Confirmed
- Assigned
- Running
- Completed
- Closed
- Cancelled

Invoice status:

- Draft
- Generated
- Sent
- Paid
- Cancelled

Subscription status:

- TRIAL
- ACTIVE
- GRACE_PERIOD
- EXPIRED
- SUSPENDED
- CANCELLED

## Money Fields

Money fields should use decimal types, not floating point.

Recommended:

```text
numeric(12,2)
```

All money in the tenant ERP currently uses Indian Rupee.

Store currency at tenant/subscription level for future expansion.

## Date And Time

Store timestamps in UTC.

Display dates according to tenant time zone and date format settings.

Recommended:

- Use `date` for date-only business fields.
- Use `timestamp with time zone` for event timestamps.

Examples:

- booking_start_date: date
- booking_end_date: date
- pickup_reporting_time: time or timestamp depending on final backend design
- created_at: timestamp with time zone

## Ownership Fields

Fleet ownership should use display label `Ownership` in UI.

Backend/database field:

```text
ownership_type
```

Vehicle values:

- `OWN`
- `VENDOR`

Driver engagement uses `engagement_type` with the same values.

OWN resources have `vendor_id = NULL`. VENDOR resources require a composite
tenant-safe foreign key to an external Vendor in the same tenant. PostgreSQL
check constraints enforce both rules. Vehicles and drivers use one central
table each; do not create ownership-specific tables.

## Indexing

Add indexes for:

- tenant_id
- status
- created_at
- booking_id
- invoice_id
- customer_id
- vehicle_id
- vendor_id
- manager_id
- payment reference fields where search is common

Composite indexes should reflect actual query patterns.

Examples:

```text
(tenant_id, status)
(tenant_id, booking_date)
(tenant_id, invoice_number)
(tenant_id, vehicle_id, booking_date)
```

## Initial Platform and Authentication Schema Decisions

Implementation decision date: 21 July 2026

The initial Prisma/PostgreSQL foundation uses:

- UUID primary keys consistently for platform and tenant records.
- Separate platform-user and tenant-user tables and authorization scopes.
- Separate platform and tenant role, permission-assignment, refresh-token, and
  audit-log tables.
- A shared tenant permission catalog with tenant-owned role assignments.
- Composite tenant foreign keys for tenant users, roles, refresh tokens,
  onboarding records, and audit actors. These prevent a relationship from
  referencing a record owned by another tenant.
- PostgreSQL `numeric(12,2)` columns for subscription and payment amounts.
- PostgreSQL `timestamp with time zone` columns for event timestamps.
- Prisma ORM 7 with an explicit PostgreSQL driver adapter and generated-client
  output.

The initial migration defines the platform, tenancy, subscription,
authentication, authorization, onboarding, payment, and audit foundations. ERP
operational models such as customers, vendors, bookings, invoices, and accounts
will be added in their respective implementation phases.
