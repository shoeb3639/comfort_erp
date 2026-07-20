# Cablix ERP System Architecture

Version: 1.0

Status: Approved Living Document

Project Name: Cablix ERP

Product Type: Multi-Tenant SaaS ERP for Car Rental & Fleet Management Companies

Platform Owner: Cablix

Prepared By: System Architecture Team

## Document Purpose

This document defines the official high-level SaaS architecture of Cablix ERP before backend implementation begins.

Every developer, AI coding assistant, technical consultant, or future contributor must read this document before making any modification to the system.

If the source code conflicts with this document, this document takes precedence until officially revised.

## Current Project Status

The existing React frontend already contains mock-data CRUD screens for the Tenant ERP area:

- Customers
- Vendors
- Bookings
- Booking Closure
- Invoices
- Accounts

These screens represent the operational ERP used by a tenant after login. They should not be deleted, redesigned, or unnecessarily modified while platform-level SaaS architecture is being added.

The backend is not implemented yet. The current frontend uses mock JSON data and browser localStorage for testing. Backend development must treat the current tenant ERP screens as the tenant-side application area.

## Official SaaS Hierarchy

The final SaaS architecture is:

```text
Cablix (Application / Platform Owner)
        |
        v
SaaS Platform Admin
        |
        v
Tenant / Car Rental Company
        |
        v
Subscription
        |
        v
Owner Login
        |
        v
Tenant ERP
```

This hierarchy is mandatory. Platform owner and tenant must not be mixed.

## Platform Owner: Cablix

Cablix is the SaaS provider and platform owner.

Cablix owns:

- ERP platform
- Subscription plans
- Tenant onboarding
- Tenant activation and suspension
- Billing records
- Trial management
- Platform administrators
- SaaS-level reports
- Support controls

Cablix must not be treated as a tenant. It is the platform owner that controls the SaaS platform.

Platform-level records belong to Cablix, not to any tenant.

Examples of platform-level records:

- Platform admin user
- Subscription plans
- Tenant accounts
- Tenant subscription records
- Tenant activation/suspension history
- SaaS billing records
- Trial records
- Platform support notes
- Platform-level audit logs

## SaaS Platform Admin

The SaaS Platform Admin area is used by Cablix to manage the SaaS business.

Initial platform admin scope:

- Manage tenants
- Create tenants
- Activate tenants
- Suspend tenants
- Manage subscription plans
- Assign subscription plan to tenant
- Set subscription start and expiry
- Create owner user for tenant
- View tenant status
- View SaaS-level reports
- Access support controls

The platform admin must not operate as a tenant user. Platform admin should not directly create bookings, invoices, customers, vendors, or tenant accounts data except through controlled support/admin flows.

## Tenant

A tenant is a customer company using the ERP.

Examples:

- Comfort Cars
- ABC Travels
- Royal Cab Services
- Sharma Tours

Each tenant represents one subscribed ERP account.

A tenant owns its own:

- Company profile
- Branches / locations
- GST registrations
- Invoice series
- Users
- Customers
- Vendors
- Vehicles
- Drivers
- Bookings
- Invoices
- Collections
- Accounts
- Manager ledgers
- Reports
- Settings

No tenant can access another tenant's data.

Every tenant-owned business table must include tenant isolation in backend design. Tenant data must be filtered by tenant context from authentication, not by user-supplied request data.

## Recommended SaaS Tree

```text
Platform
|
|-- Platform Admin
|-- Subscription Plans
|-- Tenants
    |
    |-- Comfort Cars
    |   |-- Subscription
    |   |-- Owner User
    |   |-- Employees
    |   |-- ERP Data
    |
    |-- ABC Travels
    |   |-- Subscription
    |   |-- Owner User
    |   |-- ERP Data
    |
    |-- Royal Cab Services
        |-- Subscription
        |-- Owner User
        |-- ERP Data
```

## Tenant Creation Details

When Platform Owner adds a new car rental company, the SaaS Platform Admin form should capture the fields below.

### Basic Company Information

- Company legal name
- Trade name
- Tenant code
- Business type
- Email
- Mobile number
- Alternate number
- Website
- Logo
- Address
- City
- State
- PIN code
- Country

### Legal And Tax Information

- GSTIN
- PAN
- Company registration number
- State code
- Tax registration type
- Billing address

GSTIN may remain optional for small or unregistered businesses.

### Primary Owner Details

- Owner name
- Owner email
- Owner mobile
- Designation
- Login username/email

### Operational Settings

- Default currency
- Time zone
- Financial year
- Date format
- Invoice prefix
- Invoice number length
- Tax settings

### Subscription Information

- Plan
- Billing cycle
- Start date
- Expiry date
- Trial period
- User limit
- Vehicle limit
- Booking limit
- Storage limit
- Subscription status
- Payment status
- Amount
- Discount
- Tax
- Final amount

Tenant creation should create the tenant record, subscription record, owner user, and initial setup status in one controlled onboarding workflow.

## Subscription

Subscription connects a tenant to the SaaS platform.

Subscription should control:

- Plan name
- Plan limits
- Trial status
- Subscription start date
- Subscription expiry date
- Billing cycle
- Payment status
- Tenant activation status
- Feature availability

Subscription status should affect tenant access.

Use controlled statuses:

- TRIAL
- ACTIVE
- GRACE_PERIOD
- EXPIRED
- SUSPENDED
- CANCELLED

Suggested lifecycle:

```text
TRIAL
  |
  v
ACTIVE
  |
  v
GRACE_PERIOD
  |
  v
EXPIRED
```

Manual controls:

```text
ACTIVE -> SUSPENDED
SUSPENDED -> ACTIVE
ACTIVE -> CANCELLED
```

Status definitions:

| Status | Meaning |
| --- | --- |
| TRIAL | Free evaluation period |
| ACTIVE | Subscription is valid |
| GRACE_PERIOD | Expired but temporarily accessible |
| EXPIRED | ERP access restricted |
| SUSPENDED | Disabled by platform admin |
| CANCELLED | Subscription terminated |

If subscription is expired or suspended, tenant users should not access the full ERP unless platform policy allows read-only or grace-period access.

## Owner Login

Every tenant must have one initial owner user.

The owner user is created during onboarding by SaaS Platform Admin.

Owner responsibilities:

- First tenant login
- Complete company setup
- Configure users
- Configure roles and permissions
- Configure company profile
- Configure GST registrations
- Configure invoice series
- Start using Tenant ERP

Owner belongs to a tenant. Owner is not a platform admin.

## Login Flow

The login screen can be common for all users.

Login fields:

- Email
- Password

Backend determines whether the user is:

- Platform user
- Tenant user

After login:

```text
Platform Admin
    |
    v
Platform Dashboard
```

```text
Tenant Owner or Employee
    |
    v
Tenant ERP Dashboard
```

JWT/session context for tenant users should contain:

```json
{
  "user_id": 101,
  "user_type": "TENANT",
  "tenant_id": 12,
  "role_id": 2,
  "permissions": [
    "booking.view",
    "booking.create",
    "invoice.generate"
  ]
}
```

JWT/session context for platform users should contain:

```json
{
  "user_id": 1,
  "user_type": "PLATFORM",
  "tenant_id": null,
  "role_id": 1,
  "permissions": [
    "tenant.create",
    "tenant.suspend",
    "subscription.manage"
  ]
}
```

Rules:

- `user_type` controls which application area the user can enter.
- Platform users go to Platform Dashboard.
- Tenant users go to Tenant ERP Dashboard.
- Tenant users must always carry tenant context.
- Platform users must have `tenant_id: null`.
- Backend must not allow a tenant user to switch or spoof tenant context.

## Tenant ERP

Tenant ERP is the existing operational application area already represented by the current React mock screens.

Tenant ERP includes:

- Dashboard
- Customers
- Vendors
- Vehicles
- Drivers
- Bookings
- Booking Closure
- Booking Collection
- Invoices
- Accounts
- Manager Ledger
- Transactions / Expense Entry
- Booking Cash Deposit
- Daily Closing
- Audit & Verification
- Reports
- Settings
- Users, Roles, Permissions
- GST Registrations

Tenant ERP must always run inside tenant context.

## User Categories

The system has two main user categories.

## 1. Platform Users

Platform users belong to Cablix.

Initial platform user scope:

- Super Admin

Platform Super Admin manages:

- Tenants
- Subscriptions
- Plans
- Tenant activation/suspension
- Trial management
- SaaS-level billing records
- Platform support controls
- SaaS-level reports

Platform users do not belong to a tenant.

Platform users must not be authorized using tenant roles such as Owner, Booking Manager, or Accounts Manager.

## 2. Tenant Users

Tenant users belong to a car rental company tenant.

Examples:

- Owner
- Admin
- Booking Manager
- Accounts Manager
- Fleet Manager
- Operator
- Viewer

Tenant users can access only their own tenant's ERP data.

Tenant users must never access:

- Another tenant's data
- Platform subscription plans management
- Platform billing records
- SaaS tenant onboarding controls
- Platform support controls, unless a specific support flow is later designed

## Authorization Principle

Do not hardcode authorization only by role name.

Incorrect:

```text
if role == "admin"
```

Correct:

```text
can("booking.view")
can("booking.create")
can("booking.close")
can("invoice.generate")
can("expense.create")
can("deposit.verify")
```

Roles should act as collections of permissions.

There should be separate permission namespaces for platform and tenant areas.

Examples:

```text
platform.tenant.create
platform.tenant.suspend
platform.subscription.plan.manage
platform.subscription.assign
platform.report.view

tenant.booking.view
tenant.booking.create
tenant.booking.close
tenant.invoice.generate
tenant.expense.create
tenant.deposit.verify
tenant.user.manage
```

## Tenant Onboarding Flow

The official tenant onboarding flow is:

```text
Customer purchases subscription
        |
        v
Platform Admin creates Tenant
        |
        v
Enter company details
        |
        v
Select subscription plan
        |
        v
Set subscription start and expiry
        |
        v
Create Owner account
        |
        v
Send login credentials or activation link
        |
        v
Owner logs in
        |
        v
Complete company setup
        |
        v
ERP becomes active
```

## Tenant Onboarding Data Captured

Platform Admin should capture:

- Tenant legal/company name
- Trade name
- Owner name
- Owner mobile
- Owner email
- Business address
- City
- State
- Country
- Subscription plan
- Subscription start date
- Subscription expiry date
- Trial flag if applicable
- Tenant status

Owner account should capture:

- Name
- Email
- Mobile
- Password or activation token
- Tenant ID
- Owner role
- Status

After owner login, tenant setup can capture:

- Company profile
- Branches / locations
- GST registration
- Invoice series
- Bank accounts
- Taxes and GST settings
- Users and roles

## Data Isolation Rules

Tenant isolation is mandatory.

Backend rules:

- Every tenant ERP table must contain `tenant_id`.
- Tenant context must come from authenticated session/token.
- API handlers must never trust a frontend-supplied `tenant_id` for access control.
- Queries must always be scoped by tenant.
- Cross-tenant reports should exist only in Platform Admin area and should not expose tenant operational data unless explicitly designed.

Tenant-owned records:

- Customers
- Travellers
- Vendors
- Vehicles
- Drivers
- Bookings
- Invoices
- Collections
- Booking cash deposits
- Accounts transactions
- Manager ledger entries
- Daily closings
- Audit exceptions
- GST registrations
- Invoice series
- Tenant users
- Tenant roles and permissions

## Tenant Fleet Ownership Rules

Vendors act as the parent record for vehicles and drivers.

Each tenant should have one internal company parent record for its own fleet. For example, Comfort Cars should exist as the tenant's own company parent record. Own vehicles and own drivers are added under this parent record.

External vendors are separate parent records. Vendor vehicles and vendor drivers are added under the corresponding external vendor record.

UI wording:

- Display label should be `Ownership`.
- UI values should be simple: `Own` and `Vendor`.

Backend/database wording:

- Use `ownership_type` for vehicles and drivers.
- Use a vendor parent classification such as `record_type` or `vendor_type` to identify the tenant's own company parent versus external vendors.

Recommended values:

- Vendor parent classification: `own_company`, `external_vendor`
- Vehicle/driver ownership type: `own`, `vendor`

Rules:

- A tenant should not create multiple own-company parent records.
- Own vehicles and own drivers must be linked to the own-company parent record.
- Vendor vehicles and vendor drivers must be linked to an external vendor parent record.
- Vehicle and driver ownership should be inherited from the selected parent record in the UI.
- The own-company parent record should not be deletable after setup because operational records depend on it.

## Vendor Vehicle Booking Profit Rules

Some bookings are fulfilled using external vendor vehicles. In that case, the tenant charges the customer at the customer rate and pays the vendor at the vendor rate.

Vendor booking profit should be calculated separately from own vehicle profit.

Formula:

```text
Vendor Booking Profit = Customer Base Fare - Vendor Payable Amount
```

Rules:

- Vendor booking profit is tenant revenue from vendor-supplied trips.
- Vendor booking profit must not be mixed with own vehicle profit.
- Own vehicle profit should continue to use vehicle operating logic: base fare minus fuel, maintenance, driver cost, and allocated office expense.
- Recoverable charges such as toll, parking, state tax, entry fee, driver night allowance, and GST are pass-through charges and should not reduce vehicle profit or vendor booking profit if billed to the customer.
- Booking closure and booking profit screens should show the correct calculation branch based on assignment source: own vehicle or vendor vehicle.

Platform-owned records:

- Tenants
- Subscription plans
- Tenant subscriptions
- Platform users
- SaaS billing records
- Trial records
- Platform reports
- Platform support records

## Recommended Database Structure

The first backend schema should separate platform-owned data from tenant-owned ERP data.

### Platform-Level Tables

```text
platform_users
subscription_plans
tenants
tenant_subscriptions
subscription_payments
tenant_usage
platform_audit_logs
```

### Tenant-Level Tables

```text
users
roles
permissions
customers
vendors
vehicles
drivers
bookings
invoices
expenses
collections
```

Every tenant-owned record must contain:

```text
tenant_id
```

Backend queries for tenant-owned tables must always be scoped by authenticated tenant context.

Minimum ownership fields for fleet tables:

```text
vendors
-------
id
tenant_id
name
record_type          -- own_company / external_vendor
phone
city
status

vehicles
--------
id
tenant_id
vendor_id
ownership_type       -- own / vendor
registration_number
vehicle_type
make_model
status

drivers
-------
id
tenant_id
vendor_id
ownership_type       -- own / vendor
name
mobile
license_number
status
```

For display, the frontend should show only `Ownership`. The backend can store this as `ownership_type`.

## Suggested Tenant Table

```text
tenants
-------
id
tenant_code
legal_name
trade_name
email
mobile
gstin
pan
address_line_1
address_line_2
city
state
postal_code
country
logo_url
timezone
currency
financial_year_start_month
invoice_prefix
status
onboarding_status
created_at
updated_at
```

Tenant status may be:

- PENDING_SETUP
- ACTIVE
- SUSPENDED
- CLOSED

## Suggested Subscription Plan Table

```text
subscription_plans
------------------
id
plan_code
plan_name
description
billing_cycle
base_price
user_limit
vehicle_limit
booking_limit
storage_limit_mb
trial_days
is_active
created_at
updated_at
```

Example plans:

| Plan | Users | Vehicles | Monthly bookings |
| --- | ---: | ---: | ---: |
| Starter | 3 | 10 | 300 |
| Growth | 10 | 50 | 2,000 |
| Enterprise | Custom | Custom | Custom |

Avoid overcomplicating plan limits in the first release. Start with users, vehicles, and validity.

## Suggested Tenant Subscription Table

```text
tenant_subscriptions
--------------------
id
tenant_id
plan_id
start_date
end_date
trial_end_date
billing_cycle
base_amount
discount_amount
tax_amount
final_amount
payment_status
subscription_status
grace_period_end_date
auto_renew
created_at
updated_at
```

## Access Control Based On Subscription

Every authenticated tenant request should pass through:

```text
Authentication
        |
        v
Tenant resolution
        |
        v
Subscription validation
        |
        v
Permission validation
        |
        v
Business API
```

Example middleware sequence:

```text
authenticateUser
resolveTenant
checkTenantStatus
checkSubscription
authorizePermission
```

When a subscription expires, do not immediately delete or hide data.

Recommended behavior:

- Allow login
- Show subscription-expired screen
- Allow invoice and report downloads
- Disable new bookings and write operations
- Give renewal option
- Restore full access after payment

This is safer and more professional than completely blocking the account.

## Application Areas

The final product should have two clearly separated application areas.

The existing mock CRUD screens should not be discarded. They should become the Tenant ERP area.

Add two new application areas around the existing ERP:

1. Authentication
2. Platform Administration
3. Tenant ERP, which is the existing UI

## 1. SaaS Platform Admin Area

Purpose:

Used by Cablix to manage the SaaS business.

Initial modules:

- Platform Dashboard
- Tenant Management
- Subscription Plans
- Tenant Subscriptions
- Tenant Activation / Suspension
- Trial Management
- SaaS Billing Records
- Platform Admin Users
- SaaS Reports
- Support Controls

### Platform Admin Dashboard

Platform Owner Cablix should have a separate dashboard. This dashboard must be separate from the car rental ERP dashboard.

Recommended cards:

- Total tenants
- Active subscriptions
- Trial tenants
- Subscriptions expiring soon
- Expired subscriptions
- Suspended tenants
- Monthly recurring revenue
- Outstanding payments

Recommended menus:

- Dashboard
- Tenants
- Subscription Plans
- Subscriptions
- Payments
- Users
- Support
- Audit Logs
- Platform Settings

Suggested future routes:

```text
/platform/dashboard
/platform/tenants
/platform/tenants/new
/platform/tenants/:tenantId
/platform/subscription-plans
/platform/subscriptions
/platform/billing
/platform/support
/platform/reports
/platform/admin-users
```

## 2. Tenant ERP Area

Purpose:

Used by car rental company users to run their business.

Current frontend screens already belong here.

Current routes include:

```text
/dashboard
/customers
/vendors
/bookings
/bookings/new
/bookings/:id/close
/invoices
/accounts/manager-ledger
/accounts/transactions
/accounts/booking-cash-deposit
/accounts/daily-closing
/accounts/audit-verification
/settings
/settings/gst-registrations
/settings/users
/settings/roles
/settings/permissions
```

These tenant ERP screens should continue to work as they do today while backend and platform admin modules are introduced.

## Suggested Frontend Structure

The current frontend can be reorganized gradually into this structure. Do not move all files at once unless the routes and working screens are preserved.

```text
src/
|-- auth/
|   |-- login
|   |-- forgot-password
|   |-- reset-password
|
|-- platform/
|   |-- dashboard
|   |-- tenants
|   |-- plans
|   |-- subscriptions
|   |-- payments
|
|-- tenant/
|   |-- dashboard
|   |-- bookings
|   |-- customers
|   |-- vendors
|   |-- invoices
|   |-- accounts
|   |-- settings
|
|-- shared/
```

Until this restructure is explicitly started, the current `src/pages` structure remains valid and should not be broken.

### Tenant Owner First-Login Flow

After the owner logs in for the first time:

```text
Welcome screen
    |
    v
Verify company details
    |
    v
Upload logo
    |
    v
Configure GST and taxes
    |
    v
Configure invoice series
    |
    v
Add bank account
    |
    v
Invite users
    |
    v
Add vehicles and drivers
    |
    v
Start using ERP
```

The Tenant ERP should show a setup checklist until the primary setup is complete.

Example checklist:

| Setup Item | Status |
| --- | --- |
| Company profile | Completed |
| Tax settings | Pending |
| Invoice series | Pending |
| Bank account | Pending |
| First user invited | Pending |
| First vehicle added | Pending |

The first-login flow belongs to Tenant ERP, not Platform Admin. Platform Admin creates the tenant and owner account; the owner completes tenant setup after login.

## Backend Implementation Direction

Before implementing backend code, design the backend around these bounded contexts:

- Platform Administration
- Tenant Management
- Subscription Management
- Identity and Access
- Tenant ERP Settings
- Customers and Travellers
- Vendors, Vehicles, and Drivers
- Booking Operations
- Booking Closure
- Invoice and GST
- Collections
- Accounts and Ledgers
- Audit and Verification
- Reports

The backend should not treat Cablix as a tenant. Cablix owns the platform. Tenants are customer companies using the platform.

## Minimum Backend Tables For First SaaS Phase

Platform tables:

```text
platform_users
tenants
subscription_plans
tenant_subscriptions
tenant_status_history
tenant_onboarding_records
platform_payment_records
platform_audit_logs
```

Tenant identity tables:

```text
tenant_users
roles
permissions
role_permissions
user_branches
```

Tenant setup tables:

```text
company_profiles
branches
gst_registrations
invoice_series
bank_accounts
tax_settings
tenant_setup_checklist
```

Existing tenant ERP tables should be added after tenant/subscription foundation is ready.

## Recommended Implementation Order

The next implementation sequence should be:

### Phase 1 - SaaS Foundation

- Platform user login
- Tenant registration
- Subscription plan
- Tenant subscription
- Tenant owner creation
- Tenant activation/suspension

### Phase 2 - Tenant Authentication

- Owner login
- Tenant context
- Roles
- Permissions
- Subscription middleware

### Phase 3 - Company Setup

- Company profile
- Tax settings
- Invoice settings
- Bank account
- Users

### Phase 4 - Connect Existing ERP UI

- Customers
- Vendors
- Vehicles
- Drivers
- Bookings
- Invoices
- Accounts

### Phase 5 - Subscription Automation

- Expiry reminders
- Grace period
- Renewal records
- Payment history
- Usage limits

## Final Architecture Decision

The system is now frozen around this interpretation:

```text
Cablix
        =
Platform Owner

Car Rental Company
        =
Tenant

Company Owner
        =
Primary Tenant User

Tenant Subscription
        =
Controls validity and access

Existing ERP UI
        =
Tenant operational application
```

## Development Rules Going Forward

- Do not delete or redesign the current tenant ERP screens without explicit instruction.
- Do not mix platform-owner logic with tenant ERP logic.
- Do not treat Cablix as a tenant.
- Do not allow any tenant to access another tenant's data.
- Do not implement backend endpoints before confirming whether they belong to Platform Admin or Tenant ERP.
- Use permission-based authorization, not role-name-only checks.
- Keep current mock-data screens working while backend modules are added.
- Document major architecture changes before implementation.

## Current Development Interpretation

All development completed so far is associated with the Tenant ERP module.

That includes:

- Booking module
- Invoice module
- Customer module
- Vendor, vehicle, and driver module
- Accounts module
- GST registration settings
- Users, roles, and permissions UI
- Dashboard and reports UI

The next stage should introduce the SaaS Platform Admin foundation without disrupting the Tenant ERP.
