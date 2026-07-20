# Cablix SaaS Platform

Version: 1.0

Status: Approved Living Document

## Purpose

This document defines the SaaS platform layer of Cablix ERP.

Cablix is the platform owner. A car rental company using the ERP is a tenant. Platform Admin and Tenant ERP must remain separate application areas.

## Platform Admin

Platform Admin is used by Cablix to manage the SaaS business.

Platform Admin responsibilities:

- Tenant creation
- Tenant activation and suspension
- Subscription plan management
- Tenant subscription assignment
- Trial and grace period management
- Subscription payment tracking
- Platform user management
- SaaS-level reports
- Support controls
- Platform audit logs

Platform Admin must not be treated as a tenant. Platform users should not create tenant bookings, invoices, customers, vehicles, or accounting records except through controlled support tools.

Recommended Platform Admin menus:

- Dashboard
- Tenants
- Subscription Plans
- Subscriptions
- Payments
- Users
- Support
- Audit Logs
- Platform Settings

## Tenant Onboarding

Tenant onboarding creates a subscribed ERP account for a car rental company.

Flow:

```text
Customer purchases subscription
        |
        v
Platform Admin creates tenant
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
Create owner account
        |
        v
Send credentials or activation link
        |
        v
Owner logs in
        |
        v
Owner completes company setup
        |
        v
Tenant ERP becomes active
```

Tenant creation should create:

- Tenant record
- Tenant subscription record
- Primary owner user
- Initial onboarding status
- Default setup checklist

## Tenant Creation Data

Basic company information:

- Legal company name
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

Legal and tax information:

- GSTIN
- PAN
- Company registration number
- State code
- Tax registration type
- Billing address

GSTIN may remain optional for unregistered businesses.

Primary owner details:

- Owner name
- Owner email
- Owner mobile
- Designation
- Login username/email

Operational settings:

- Default currency
- Time zone
- Financial year
- Date format
- Invoice prefix
- Invoice number length
- Tax settings

Subscription information:

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

## Subscription Plans

Subscription plans define what a tenant can use.

First release should keep limits simple:

- User limit
- Vehicle limit
- Subscription validity
- Trial days

Avoid overcomplicating the first release with advanced usage metering unless required.

Example plans:

| Plan | Users | Vehicles | Monthly Bookings |
| --- | ---: | ---: | ---: |
| Starter | 3 | 10 | 300 |
| Growth | 10 | 50 | 2000 |
| Enterprise | Custom | Custom | Custom |

Plan fields:

- Plan code
- Plan name
- Description
- Billing cycle
- Base price
- User limit
- Vehicle limit
- Booking limit
- Storage limit
- Trial days
- Active status

## Subscription Lifecycle

Allowed subscription statuses:

- TRIAL
- ACTIVE
- GRACE_PERIOD
- EXPIRED
- SUSPENDED
- CANCELLED

Normal lifecycle:

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

- TRIAL: Free evaluation period.
- ACTIVE: Subscription is valid.
- GRACE_PERIOD: Expired but temporarily accessible.
- EXPIRED: ERP access is restricted.
- SUSPENDED: Disabled by Platform Admin.
- CANCELLED: Subscription is terminated.

Expired subscription behaviour:

- Allow login.
- Show subscription expired screen.
- Allow invoice and report downloads.
- Disable new bookings and write operations.
- Show renewal option.
- Restore access after payment.

## Tenant Lifecycle

Tenant statuses:

- PENDING_SETUP
- ACTIVE
- SUSPENDED
- CLOSED

PENDING_SETUP:

- Tenant is created.
- Owner account exists.
- Company setup is incomplete.

ACTIVE:

- Tenant can use ERP based on subscription status and permissions.

SUSPENDED:

- Access is restricted by Platform Admin.
- Data should not be deleted.

CLOSED:

- Tenant is no longer operational.
- Data retention rules should apply.

Tenant status and subscription status are separate:

- Tenant status controls whether the company account is administratively allowed.
- Subscription status controls payment/trial/expiry access.

Both must be checked before allowing Tenant ERP write operations.
