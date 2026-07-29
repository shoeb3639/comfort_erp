# Authentication And Security

Version: 1.0

Status: Approved Requirements Baseline (Frozen)

Baseline Date: 20 July 2026

## Purpose

This document defines login, JWT/session context, roles, permissions, tenant isolation, and middleware rules for Cablix ERP.

## Login

The login screen can be common for both platform users and tenant users.

Login fields:

- Email
- Password

The backend determines whether the user is:

- Platform user
- Tenant user

After login:

```text
Platform user
        |
        v
Platform Admin Dashboard

Tenant user
        |
        v
Tenant ERP Dashboard
```

## User Categories

There are two main user categories.

Platform users:

- Belong to Cablix.
- Manage SaaS tenants and subscriptions.
- Do not belong to any tenant.

Tenant users:

- Belong to one tenant.
- Access only their tenant's ERP data.
- Examples: Owner, Admin, Booking Manager, Accounts Manager, Fleet Manager, Operator, Viewer.

## JWT / Session Context

Tenant user token example:

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

Platform user token example:

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

Security rules:

- Tenant ID must come from the authenticated token/session.
- API requests must not trust frontend-supplied `tenant_id`.
- Platform users and tenant users must use separate authorization scopes.

## Roles

Roles are collections of permissions.

Initial tenant roles:

- Super Admin
- Admin
- Operations Manager
- Booking Executive
- Accountant
- Fleet Manager
- Driver

Partner role can remain a future placeholder.

Do not hardcode authorization using role names.

Do not use:

```text
if role == "admin"
```

Use permission checks:

```text
can("booking.view")
can("booking.create")
can("booking.close")
can("invoice.generate")
can("expense.create")
can("deposit.verify")
```

## Permissions

Permission format:

```text
module.action
```

Examples:

- booking.view
- booking.create
- booking.assign
- booking.close
- invoice.view
- invoice.create
- invoice.generate
- collection.create
- deposit.verify
- expense.create
- manager_ledger.view
- user.manage

Recommended permission structures:

User:

- id
- name
- email
- mobile
- role_id
- branch_ids
- status
- last_login
- created_at

Role:

- id
- name
- code
- description
- is_system_role
- status

Permission:

- id
- module
- action
- permission_key
- description

RolePermission:

- role_id
- permission_id

## Tenant Isolation

Tenant isolation is mandatory.

Every tenant-owned table must contain:

```text
tenant_id
```

Rules:

- Tenant users can access only their own tenant data.
- Tenant filtering must happen in backend queries.
- Tenant context must come from authenticated session/token.
- No tenant can access another tenant's customers, bookings, invoices, accounts, vehicles, or reports.
- Platform reports should not expose tenant operational data unless explicitly designed.

## Middleware Sequence

Every authenticated tenant request should pass through:

```text
authenticateUser
        |
        v
resolveTenant
        |
        v
checkTenantStatus
        |
        v
checkSubscription
        |
        v
authorizePermission
        |
        v
businessApiHandler
```

Middleware responsibilities:

- authenticateUser: Verify login/session/JWT.
- resolveTenant: Resolve tenant context from token.
- checkTenantStatus: Ensure tenant is active or allowed.
- checkSubscription: Validate subscription lifecycle and access mode.
- authorizePermission: Check permission key.
- businessApiHandler: Execute tenant-scoped business logic.

Platform request sequence:

```text
authenticateUser
        |
        v
checkPlatformUser
        |
        v
authorizePlatformPermission
        |
        v
platformApiHandler
```

Platform users must not pass through tenant business APIs unless a controlled support mode is explicitly designed.

## Access Restriction Behaviour

When a tenant subscription expires:

- Allow login.
- Show subscription-expired screen.
- Allow read-only access for invoices and reports if business policy allows.
- Disable create/update/delete operations.
- Allow renewal/payment action.

When a tenant is suspended:

- Restrict Tenant ERP access.
- Show suspension message.
- Preserve all tenant data.
- Allow Platform Admin to reactivate.

Data should not be deleted due to expiry or suspension.

## Initial Authentication Implementation

The first backend authentication implementation uses the following approved rules:

- Passwords are hashed with Argon2id and are never stored or logged in plain text.
- Access tokens are signed JWTs with a short lifetime of 15 minutes.
- Refresh tokens are signed JWTs with a lifetime of 7 days. Only a SHA-256 hash of each refresh token is stored in the database.
- Refresh tokens are single-use and are rotated atomically. Reuse of a revoked token is rejected.
- Access and refresh tokens use separate secrets and explicitly validate the issuer, audience, signing algorithm, and token type.
- Authentication context contains the user type, user ID, role ID, permissions, and tenant ID for tenant users.
- Tenant ID is accepted only from the verified authentication context. Headers, query parameters, and request bodies cannot override it.
- Platform and tenant routes use separate middleware chains. Platform users cannot enter tenant operations, and tenant users cannot enter platform APIs.
- Every protected request rechecks the current user, role, tenant status, and subscription state instead of trusting token claims alone.
- Suspended or closed tenants cannot use operational APIs. Expired subscriptions cannot perform write operations.
- Login endpoints are rate limited, and all authentication input is validated before it reaches the service layer.
- Authentication and tenant-isolation integration tests run against a dedicated test database.

Initial endpoints:

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh-token
POST /api/v1/auth/logout
GET  /api/v1/platform/me
GET  /api/v1/tenant/me
GET  /api/v1/tenant/access
POST /api/v1/platform/tenants
GET  /api/v1/platform/tenants
GET  /api/v1/platform/tenants/:tenantId
GET  /api/v1/platform/subscription-plans
POST /api/v1/platform/subscription-plans
PATCH /api/v1/platform/subscription-plans/:planId
DELETE /api/v1/platform/subscription-plans/:planId
GET  /api/v1/platform/tenant-subscriptions
POST /api/v1/platform/tenant-subscriptions
PATCH /api/v1/platform/tenant-subscriptions/:subscriptionId
POST /api/v1/platform/tenants/:tenantId/owners
PATCH /api/v1/platform/tenants/:tenantId/status
GET/PATCH /api/v1/tenant/setup/company-profile
GET/PATCH /api/v1/tenant/setup/tax-settings
GET/PATCH /api/v1/tenant/setup/invoice-settings
GET       /api/v1/tenant/setup/onboarding
GET/POST  /api/v1/tenant/setup/locations
PATCH     /api/v1/tenant/setup/locations/:recordId
GET/POST  /api/v1/tenant/setup/bank-accounts
PATCH     /api/v1/tenant/setup/bank-accounts/:recordId
GET/POST  /api/v1/tenant/setup/gst-registrations
PATCH     /api/v1/tenant/setup/gst-registrations/:recordId
GET/POST  /api/v1/tenant/setup/users
PATCH     /api/v1/tenant/setup/users/:recordId
GET/POST  /api/v1/tenant/setup/roles
PATCH     /api/v1/tenant/setup/roles/:recordId
PATCH     /api/v1/tenant/setup/roles/:recordId/permissions
GET       /api/v1/tenant/setup/permissions
GET/POST  /api/v1/tenant/customers
GET/PATCH /api/v1/tenant/customers/:customerId
POST      /api/v1/tenant/customers/:customerId/travellers
GET/PATCH /api/v1/tenant/customers/:customerId/travellers/:travellerId
GET/POST  /api/v1/tenant/vendors
GET/PATCH/DELETE /api/v1/tenant/vendors/:vendorId
GET/POST  /api/v1/tenant/vehicles
GET/PATCH/DELETE /api/v1/tenant/vehicles/:vehicleId
GET       /api/v1/tenant/vehicles/types
GET/POST  /api/v1/tenant/drivers
GET/PATCH/DELETE /api/v1/tenant/drivers/:driverId
POST      /api/v1/tenant/vendors/:vendorId/vehicles
PATCH/DELETE /api/v1/tenant/vendors/:vendorId/vehicles/:childId
POST      /api/v1/tenant/vendors/:vendorId/drivers
PATCH/DELETE /api/v1/tenant/vendors/:vendorId/drivers/:childId
```

`POST /api/v1/platform/tenants` requires the `tenant.create` platform
permission. It creates the tenant, subscription, primary owner, tenant system
roles and permissions, onboarding checklist, and platform audit record in one
database transaction.

Subscription-plan deletion is a non-destructive deactivation. Tenant
subscription updates enforce the documented status transitions. A tenant can
be activated only after it has a primary owner and a usable subscription;
suspension preserves all tenant data. All mutations create platform audit
records.

`GET /api/v1/tenant/me` supports the restricted-read policy for expired
subscriptions. The frontend uses the stricter `GET /api/v1/tenant/access`
before entering or navigating within the write-capable Tenant ERP.

Phase 3 company-setup APIs derive tenant scope exclusively from the verified
tenant token. They require an active tenant and usable subscription, enforce
resource permissions, and record every mutation in the tenant audit log.
Company profile, tax and invoice settings, GST registrations, bank accounts,
locations, users, roles, permission assignments, and onboarding progress are
stored in PostgreSQL. System roles and the primary owner are protected from
unsafe changes, and tenant-user creation enforces the subscription user limit.

The Customer module uses the same tenant middleware chain. Customers,
contacts, and employees/travellers are permanent business records after
creation: users can view and modify them, but no delete API is exposed.
All records are tenant-scoped and cross-tenant IDs return `404`.

Human-readable Customer module strings are normalized to Title Case before
database writes. For example, `NEW DELHI` is stored as `New Delhi`. Technical
identifiers—including emails, GSTINs, phone numbers, passwords, URLs, UUIDs,
and generated codes—are excluded from this transformation. Person records
support the optional `MR`/`MS` salutation and store it separately from the
person's normalized name.

Vendor, Vehicle, and Driver records follow the same tenant isolation, audit
logging, Title Case, and identifier-preservation rules. Drivers support
`MR`/`MS`. Central Vehicle and Driver services enforce nullable Vendor linkage
for OWN resources and mandatory same-tenant Vendor linkage for VENDOR
resources. Deleting a Vendor is blocked while active resources reference it.
