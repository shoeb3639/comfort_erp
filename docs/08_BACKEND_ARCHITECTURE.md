# Backend Architecture

Version: 1.0

Status: Approved Requirements Baseline (Frozen)

Baseline Date: 20 July 2026

## Purpose

This document defines the backend architecture for Cablix ERP.

The backend must support a multi-tenant SaaS platform with separate Platform Admin and Tenant ERP areas.

## Technology Stack

Runtime:

- Node.js

Language:

- TypeScript

Framework:

- Express.js

Database:

- PostgreSQL

ORM:

- Prisma

Validation:

- Joi

Authentication:

- JWT + Refresh Token

Logging:

- Winston

API Documentation:

- Swagger / OpenAPI

Testing:

- Jest

## Architecture Style

Use modular layered architecture.

Request flow:

```text
Request
   |
   v
Route
   |
   v
Middleware
   |
   v
Controller
   |
   v
Service
   |
   v
Repository
   |
   v
Prisma ORM
   |
   v
PostgreSQL
```

Each layer has a strict responsibility.

## Layer Responsibilities

### Routes

Routes define HTTP endpoints and attach middleware.

Responsibilities:

- Register endpoint path and HTTP method.
- Attach authentication middleware.
- Attach authorization middleware.
- Attach request validation middleware.
- Call controller method.

Routes should not contain business logic.

Example:

```text
POST /api/bookings
GET /api/bookings
GET /api/bookings/:id
PATCH /api/bookings/:id
POST /api/bookings/:id/close
```

### Middleware

Middleware handles cross-cutting request concerns.

Middleware examples:

- authenticate_user
- resolve_tenant
- check_tenant_status
- check_subscription
- authorize_permission
- validate_request
- rate_limit
- request_logger
- error_handler

Tenant request middleware sequence:

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
validateRequest
        |
        v
controller
```

Platform request middleware sequence:

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
validateRequest
        |
        v
controller
```

### Controllers

Controllers handle HTTP request and response mapping.

Responsibilities:

- Read request params, query, body, and authenticated context.
- Call service methods.
- Return consistent HTTP responses.
- Avoid direct database access.
- Avoid business logic beyond request mapping.

Controllers should not call Prisma directly.

### Services

Services contain business logic.

Responsibilities:

- Apply business rules.
- Coordinate multiple repositories.
- Perform calculations.
- Enforce workflow rules.
- Handle transaction boundaries when needed.

Examples:

- Booking closure calculation
- Invoice finalization and number assignment
- Manager ledger balance calculation
- Subscription lifecycle validation
- Vendor booking profit calculation

Services should not depend on Express request/response objects.

### Repositories

Repositories isolate database access.

Responsibilities:

- Call Prisma client.
- Apply tenant-scoped database filters.
- Encapsulate query details.
- Return domain-friendly data to services.

Repositories should not contain business workflow logic.

### Prisma ORM

Prisma handles database mapping and schema migrations.

Responsibilities:

- Prisma schema definition
- Type-safe database access
- Migrations
- Query execution

All tenant-owned repository queries must include tenant context.

### PostgreSQL

PostgreSQL is the system of record.

Database design must follow:

- Multi-tenancy rules
- Audit fields
- Soft delete rules
- Foreign key standards
- Controlled statuses
- Decimal money fields

Refer to `04_DATABASE_PRINCIPLES.md`.

## Modular Structure

Backend code should be organized by business module.

Recommended structure:

```text
backend/
|-- src/
|   |-- app.ts
|   |-- server.ts
|   |
|   |-- config/
|   |   |-- env.ts
|   |   |-- prisma.ts
|   |   |-- logger.ts
|   |
|   |-- middlewares/
|   |   |-- authenticate-user.middleware.ts
|   |   |-- resolve-tenant.middleware.ts
|   |   |-- authorize-permission.middleware.ts
|   |   |-- validate-request.middleware.ts
|   |   |-- error-handler.middleware.ts
|   |
|   |-- shared/
|   |   |-- errors/
|   |   |-- responses/
|   |   |-- utils/
|   |   |-- constants/
|   |
|   |-- modules/
|   |   |-- auth/
|   |   |-- platform/
|   |   |-- tenants/
|   |   |-- subscriptions/
|   |   |-- users/
|   |   |-- customers/
|   |   |-- vendors/
|   |   |-- vehicles/
|   |   |-- drivers/
|   |   |-- bookings/
|   |   |-- invoices/
|   |   |-- collections/
|   |   |-- accounts/
|   |   |-- reports/
|   |
|   |-- docs/
|   |   |-- swagger.ts
|   |
|   |-- tests/
|
|-- prisma/
|   |-- schema.prisma
|   |-- migrations/
|
|-- package.json
|-- tsconfig.json
```

Every business module should follow the same internal structure. The bookings
module is the reference pattern:

```text
modules/bookings/
|-- booking.routes.ts       # Defines endpoints and attaches middleware.
|-- booking.controller.ts   # Reads request data and returns HTTP responses.
|-- booking.service.ts      # Contains booking business rules and workflows.
|-- booking.repository.ts   # Contains Prisma queries and database access.
|-- booking.schema.ts       # Contains request validation schemas.
|-- booking.types.ts        # Contains TypeScript types and interfaces.
|-- booking.mapper.ts       # Transforms database records into API responses.
|-- booking.constants.ts    # Contains module-specific constants.
|-- booking.test.ts         # Contains module unit and integration tests.
```

Other modules should use the same naming and responsibility pattern, replacing
`booking` with the singular module name. Files that are not required for a
module may be omitted, but responsibilities must not be moved into unrelated
layers.

## Unified Vehicle And Driver Masters

Vehicles and drivers are independent tenant modules and follow the complete
Route → Middleware → Controller → Service → Repository → Prisma flow.

- One `vehicles` table stores OWN and VENDOR vehicles.
- One `drivers` table stores OWN and VENDOR drivers.
- OWN resources have no Vendor link.
- VENDOR resources require a same-tenant Vendor link.
- Vendor-profile nested endpoints delegate to the central Vehicle or Driver
  service; they do not own separate child tables.
- Central list APIs validate `ownershipType`, `engagementType`, and `vendorId`
  filters before repository access.

## Platform and Tenant Separation

The backend must clearly separate:

- Platform APIs
- Tenant APIs
- Public APIs
- Authentication APIs

Recommended versioned URL structure:

```text
/api/v1/auth/*
/api/v1/platform/*
/api/v1/tenant/*
/api/v1/public/*
```

Examples:

```text
POST /api/v1/auth/login
GET  /api/v1/platform/tenants
POST /api/v1/platform/tenants
GET  /api/v1/tenant/bookings
POST /api/v1/tenant/bookings
```

Access-isolation requirements:

- Platform users must not automatically access tenant operational data.
- Tenant users must never access platform administration APIs.
- A tenant must never access another tenant's data.
- Users must not access endpoints for which they lack permission.
- Platform users must not accidentally enter tenant operations.
- Suspended tenants must not create transactions.

These boundaries must be enforced by authentication, tenant resolution,
tenant-status checks, and permission middleware. URL separation alone is not a
security boundary.

## Authentication

Use JWT access tokens and refresh tokens.

Access token:

- Short lived.
- Sent with API requests.
- Contains user identity, user type, tenant context if tenant user, role, and permissions.

Refresh token:

- Longer lived.
- Stored securely.
- Used to issue new access tokens.
- Can be revoked on logout/password change/suspicious activity.

Tenant token example:

```json
{
  "user_id": 101,
  "user_type": "TENANT",
  "tenant_id": 12,
  "role_id": 2,
  "permissions": ["booking.view", "booking.create"]
}
```

Platform token example:

```json
{
  "user_id": 1,
  "user_type": "PLATFORM",
  "tenant_id": null,
  "role_id": 1,
  "permissions": ["tenant.create", "subscription.manage"]
}
```

## Authorization

Use permission-based authorization.

Do not hardcode role names for access control.

Correct:

```text
can("booking.create")
can("invoice.generate")
can("deposit.verify")
```

Incorrect:

```text
if role == "admin"
```

## Validation

Use Joi for request validation.

Validation should run before controller execution.

Validation responsibilities:

- Required fields
- Field types
- Enum values
- Date formats
- Money format
- GSTIN format where applicable
- Status values

Validation should not replace service-level business rules.

Example:

- Joi validates that `amount` is numeric.
- Service validates that amount does not exceed available manager ledger balance unless overdraft is allowed.

## Error Handling

Use centralized error handling middleware.

Error response should be consistent.

Recommended shape:

```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": []
}
```

Common error codes:

- VALIDATION_ERROR
- UNAUTHORIZED
- FORBIDDEN
- NOT_FOUND
- CONFLICT
- SUBSCRIPTION_EXPIRED
- TENANT_SUSPENDED
- INTERNAL_SERVER_ERROR

Do not expose stack traces in production responses.

## Logging

Use Winston for application logging.

Log:

- API errors
- Authentication failures
- Permission denials
- Subscription access blocks
- Financial workflow actions
- Invoice finalization and cancellation
- Booking closure
- Deposit verification
- Tenant activation/suspension

Do not log:

- Passwords
- Refresh tokens
- Full JWT tokens
- Sensitive payment secrets

## Swagger / OpenAPI

Use Swagger/OpenAPI for API documentation.

Swagger should document:

- Endpoint path
- HTTP method
- Request body
- Query params
- Path params
- Auth requirements
- Permission requirements
- Response examples
- Error responses

Keep Swagger definitions close to modules where practical.

## Testing

Use Jest.

Test levels:

- Unit tests for services and utilities.
- Repository tests where practical.
- Integration tests for API flows.
- Authorization tests for permission rules.
- Tenant isolation tests.

Critical tests:

- Tenant cannot access another tenant data.
- Expired subscription blocks write operations.
- Invoice draft does not consume invoice number.
- Invoice finalization locks number.
- Booking closure calculates billing KM correctly.
- Vendor booking profit is separate from own vehicle profit.
- Booking cash deposit does not increase manager ledger.

## Transactions

Use database transactions for multi-step financial and workflow operations.

Examples:

- Invoice finalization and sequence assignment.
- Booking closure and profit ledger creation.
- Manager ledger transaction creation and running balance update.
- Deposit verification.
- Tenant creation with owner and subscription.

Transactions should be handled in service layer.

## API Response Standard

Success response:

```json
{
  "success": true,
  "data": {},
  "message": "Request completed successfully"
}
```

Paginated response:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

Supported `per_page` options should align with frontend:

- 10
- 20
- 40
- 50

## Environment Configuration

Use environment variables for:

- NODE_ENV
- PORT
- DATABASE_URL
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET
- ACCESS_TOKEN_TTL
- REFRESH_TOKEN_TTL
- LOG_LEVEL
- CORS_ORIGIN

Environment variables should be validated at startup.

## Security Principles

- Hash passwords with a strong algorithm.
- Never store plain-text passwords.
- Use HTTPS in production.
- Use secure refresh token storage.
- Rate limit authentication endpoints.
- Validate all incoming requests.
- Scope tenant data by authenticated tenant context.
- Use permission-based authorization.
- Keep audit logs for critical actions.

## Backend Implementation Order

Recommended first backend sequence:

1. Project scaffold with TypeScript, Express, Prisma, Joi, Winston, Swagger, Jest.
2. PostgreSQL connection and Prisma setup.
3. Platform auth and platform user login.
4. Tenant, subscription plan, and tenant subscription modules.
5. Tenant owner creation.
6. Tenant auth and tenant context middleware.
7. Roles and permissions.
8. Subscription and tenant status middleware.
9. Connect existing Tenant ERP modules gradually.

Existing React mock screens should remain working while backend APIs are introduced.

# Immutable Backend Rules

1. Controllers must not contain business logic.

2. Routes must not directly access the database.

3. Tenant ID must come only from authenticated backend context.

4. Every tenant-owned database query must include tenant isolation.

5. Financial posting operations must use database transactions.

6. Posted financial records must not be directly edited or deleted.

7. Invoice numbers must be generated only during finalization.

8. Draft invoices must not consume invoice numbers.

9. Customer collection and manager operational funds must remain separate.

10. Authorization must be permission-based.

11. External input must always be validated.

12. Errors must use standardized application error codes.

13. Sensitive data must never appear in logs or API errors.

14. Business rules must remain in the service layer.

15. Reports should derive data from approved transactional records.

16. All important business actions must be auditable.

17. No module may bypass the approved booking, invoice, or accounting workflow.

18. Any architectural change must first be reflected in the documentation.
