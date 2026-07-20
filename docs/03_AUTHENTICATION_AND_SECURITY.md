# Authentication And Security

Version: 1.0

Status: Approved Living Document

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
