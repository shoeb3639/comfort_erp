# Own And Vendor Resource Architecture

Version: 1.0

Status: Proposed Implementation Plan — Awaiting Review

Plan Date: 23 July 2026

## Purpose

This document defines the approved target architecture and implementation plan
for managing tenant-owned and vendor-provided vehicles and drivers through one
Vehicle master and one Driver master.

This is a planning document only. No Prisma model, migration, backend API,
frontend workflow, or existing documentation other than this plan is changed as
part of the current task.

## Decision Summary

The system will use:

- One tenant-scoped `vehicles` table and `Vehicle` model.
- One tenant-scoped `drivers` table and `Driver` model.
- `ownership_type` to classify a vehicle as `OWN` or `VENDOR`.
- `engagement_type` to classify a driver as `OWN` or `VENDOR`.
- A nullable `vendor_id` on both masters.
- The same records and APIs in central masters, Vendor profiles, duty
  assignment, and reports.

The following separate resource tables are not permitted:

- Own vehicles
- Vendor vehicles
- Own drivers
- Vendor drivers

The existing `vendor_vehicles` and `vendor_drivers` tables are transitional
current-state structures. Their data must be migrated into the central masters
and the old tables removed only after references have been moved and verified.

## Current-State Assessment

### Documentation

The current frozen architecture documents contain an older parent-record rule:

- `01_SYSTEM_ARCHITECTURE.md`, `04_DATABASE_PRINCIPLES.md`, and
  `05_BOOKING_ENGINE.md` describe one `own_company` Vendor parent per tenant.
- Own vehicles and own drivers are described as children of that Vendor.
- `03_AUTHENTICATION_AND_SECURITY.md` documents Vendor child endpoints.

That rule conflicts with the architecture approved in this document. The new
rule is:

- An `OWN` resource has `vendor_id = NULL`.
- A `VENDOR` resource has a valid external `vendor_id`.
- A tenant's own company is not represented as a Vendor merely to parent its
  fleet or drivers.

The affected frozen documents must be amended during implementation, before
the corresponding code changes are released.

### Database And Prisma

The current Prisma schema has:

- A tenant-scoped `Vendor` model mapped to `vendors`.
- A `recordType` string with `own_company` and `external_vendor` conventions.
- A `VendorVehicle` model mapped to `vendor_vehicles`.
- A `VendorDriver` model mapped to `vendor_drivers`.
- Non-null `vendor_id` on both child tables.
- A composite tenant/vendor foreign key, which correctly prevents a child from
  linking to a Vendor in another tenant.
- Tenant-scoped unique constraints for plate and licence.
- Soft-delete audit columns on Vendors, vendor vehicles, and vendor drivers.

There is no central `Vehicle`, `Driver`, or `VehicleType` Prisma model. There is
also no database-backed Booking model or duty-assignment API in the current
schema.

The current resource fields are only a subset of the approved masters. In
particular, vehicle dates, fuel type, model, variant, and lifecycle documents,
and driver alternate mobile, licence metadata, address, identity details, and
expiry are absent.

### Backend

The existing Vendor backend is mounted at `/api/v1/tenant/vendors` and supports:

- Vendor list, create, detail, update, and soft delete.
- Nested Vendor vehicle create, update, and soft delete.
- Nested Vendor driver create, update, and soft delete.

Important gaps:

- Vehicle and Driver operations are implemented inside the Vendor module.
- There are no central `/tenant/vehicles` or `/tenant/drivers` modules.
- `vendor.service.ts` calls Prisma directly and therefore does not follow the
  documented Repository layer.
- Ownership is inferred from `Vendor.recordType`; this cannot represent the new
  `OWN` rule because every current child requires a Vendor.
- Resource mutations use Vendor permissions rather than distinct Vehicle and
  Driver permissions.
- Input and stored enum values use lowercase/free-text conventions in places,
  rather than controlled `OWN`/`VENDOR` and status enums.
- The current child APIs expose delete operations. The project's recent master
  data policy should be reconciled with soft deletion before those operations
  are retained publicly.

### Frontend

The current frontend has:

- A working Vendor page that displays Vendors and their linked vehicles and
  drivers.
- Vendor-specific add/edit/delete forms backed by the Vendor APIs.
- Placeholder Vehicle and Driver pages backed by `services/api.js` mock data.
- `/vehicles` and `/drivers` routes that redirect to `/vendors`.
- Only Vendors in the tenant master navigation.
- Browser mock datasets for vehicles, drivers, vendors, bookings, invoices,
  transactions, and reports.

The Vendor page currently allows an `own_company` Vendor and derives resource
ownership from it. This convention must be removed from resource creation and
assignment.

### Duty Assignment And Downstream Modules

The booking list contains a browser-only assignment modal. It already holds
concepts resembling `vendorId`, `vehicleId`, and `driverId`, but:

- Booking records are stored through browser mock storage.
- Assignment saves display strings and does not consistently persist resource
  IDs.
- Own resources are filtered through an `own_company` Vendor.
- Cross-vendor resource consistency is enforced only by frontend filtering, not
  by a backend service.

Invoice and Accounts forms also load vehicle and driver choices from mock data.
Reports and dashboard calculations use mock booking/resource values. These are
downstream consumers of the new masters, but their full backend implementation
is outside the first resource-master migration.

## Final Approved Architecture

### Vendor

A Vendor represents an external supplier or service provider. It does not
represent the tenant's own company for the purpose of linking own vehicles or
drivers.

The Vendor profile may show and create linked resources, but these records are
stored in the central `vehicles` and `drivers` tables.

### Vehicle

Every vehicle belongs to exactly one tenant. Its ownership classification is:

| `ownership_type` | `vendor_id` | Meaning |
| --- | --- | --- |
| `OWN` | `NULL` | Vehicle owned or directly operated by the tenant |
| `VENDOR` | Required | Vehicle supplied by the linked Vendor |

Both classes are selectable in duty assignment. Only `OWN` vehicles
automatically participate in tenant fuel, maintenance, insurance-cost,
service-expense, service-schedule, and own-fleet profit-and-loss workflows.

### Driver

Every driver belongs to exactly one tenant. Its engagement classification is:

| `engagement_type` | `vendor_id` | Meaning |
| --- | --- | --- |
| `OWN` | `NULL` | Driver directly engaged by the tenant |
| `VENDOR` | Required | Driver supplied by the linked Vendor |

Both classes are selectable in duty assignment. Only `OWN` drivers
automatically participate in tenant payroll, salary, advance, or own-driver
ledger workflows.

### Shared Resource Principle

Central master screens, Vendor profiles, booking assignment, and reporting must
query the same rows. Vendor profile operations are alternate entry points into
the Vehicle and Driver services, not separate persistence modules.

## Database Changes

### Controlled Types

Use database and Prisma enums:

```text
VehicleOwnershipType: OWN | VENDOR
DriverEngagementType: OWN | VENDOR
```

Define controlled Vehicle and Driver status values before migration based on
the operational states supported by the UI. Do not continue accepting arbitrary
free-text status values. Status availability rules for duty assignment must be
documented with those enums.

The existing `Salutation` enum (`MR`, `MS`) remains reusable for Driver.

### Vehicle Model

Create one `Vehicle` model mapped to `vehicles` with:

| Field | Proposed database type and rule |
| --- | --- |
| `id` | UUID primary key |
| `tenant_id` | UUID, required |
| `ownership_type` | `VehicleOwnershipType`, required |
| `vendor_id` | UUID, nullable |
| `registration_number` | Normalized varchar, required |
| `vehicle_type_id` | UUID, required after type migration |
| `make` | Varchar, nullable if legacy data is incomplete |
| `model` | Varchar, nullable |
| `variant` | Varchar, nullable |
| `fuel_type` | Controlled enum or varchar validated by service |
| `manufacturing_year` | Small integer, nullable with range validation |
| `registration_date` | Date, nullable |
| `insurance_expiry` | Date, nullable |
| `permit_expiry` | Date, nullable |
| `fitness_expiry` | Date, nullable |
| `status` | Controlled enum, required |
| `created_by` | UUID, required where authenticated actor exists |
| `updated_by` | UUID, retained for project audit consistency |
| `deleted_by` | UUID, retained if soft delete is used |
| `created_at` | Timestamptz, required |
| `updated_at` | Timestamptz, required |
| `deleted_at` | Timestamptz, nullable |

Existing `vehicle_code` and `seating_capacity` may be retained if they remain
approved business requirements, but they must not substitute for
`vehicle_type_id`.

Registration numbers must be normalized before comparison and storage. At a
minimum, casing and avoidable separators/spaces must not allow duplicate
physical registrations within a tenant.

### Vehicle Type

Because `vehicle_type_id` is required, introduce or adopt a canonical
`vehicle_types` master rather than retaining the current free-text `type`.
Before implementation, confirm whether Vehicle Types are:

- Tenant-scoped and configurable, or
- Platform-defined with optional tenant activation.

The current UI uses values such as SUV, MUV, and Sedan. The migration must map
each distinct legacy type to a canonical ID. A required foreign key must not be
enforced until all legacy rows are mapped.

### Driver Model

Create one `Driver` model mapped to `drivers` with:

| Field | Proposed database type and rule |
| --- | --- |
| `id` | UUID primary key |
| `tenant_id` | UUID, required |
| `engagement_type` | `DriverEngagementType`, required |
| `vendor_id` | UUID, nullable |
| `salutation` | Existing `Salutation`, nullable |
| `name` | Varchar, required and Title Case normalized |
| `mobile` | Varchar, required and normalized |
| `alternate_mobile` | Varchar, nullable and normalized |
| `licence_number` | Normalized varchar, nullable only if business policy permits |
| `licence_type` | Controlled value or validated varchar, nullable |
| `licence_expiry` | Date, nullable |
| `address` | Text, nullable and Title Case normalized where appropriate |
| `identity_details` | JSONB or existing approved identity structure, nullable |
| `status` | Controlled enum, required |
| `created_by` | UUID, required where authenticated actor exists |
| `updated_by` | UUID, retained for project audit consistency |
| `deleted_by` | UUID, retained if soft delete is used |
| `created_at` | Timestamptz, required |
| `updated_at` | Timestamptz, required |
| `deleted_at` | Timestamptz, nullable |

Existing `driver_code` may be retained as a tenant-facing stable code.

The current project has no database uniqueness rule for Customer phone numbers
and uses phone fields primarily as normalized identifiers. Driver mobile
numbers should therefore not receive a new unique constraint without a
confirmed business rule. The service should normalize them consistently and
the API should return a warning or conflict only if the project's agreed
duplicate-mobile policy requires it.

### Relationships And Constraints

Add:

- `vehicles.tenant_id -> tenants.id`.
- `drivers.tenant_id -> tenants.id`.
- Composite tenant-safe foreign keys
  `(tenant_id, vendor_id) -> vendors(tenant_id, id)`.
- Composite tenant-safe IDs such as unique `(tenant_id, id)` where required by
  downstream composite foreign keys.
- Actor foreign keys consistent with other tenant-owned audited models.

Add PostgreSQL checks:

```sql
CHECK (
  (ownership_type = 'OWN' AND vendor_id IS NULL)
  OR
  (ownership_type = 'VENDOR' AND vendor_id IS NOT NULL)
)
```

```sql
CHECK (
  (engagement_type = 'OWN' AND vendor_id IS NULL)
  OR
  (engagement_type = 'VENDOR' AND vendor_id IS NOT NULL)
)
```

Prisma schema validation is not a replacement for these database constraints.
Raw SQL in the eventual migration may be required for checks and partial
indexes.

### Uniqueness And Indexes

If soft delete remains enabled, use PostgreSQL partial unique indexes:

```sql
CREATE UNIQUE INDEX vehicles_tenant_registration_active_key
ON vehicles (tenant_id, registration_number)
WHERE deleted_at IS NULL;
```

```sql
CREATE UNIQUE INDEX drivers_tenant_licence_active_key
ON drivers (tenant_id, licence_number)
WHERE deleted_at IS NULL AND licence_number IS NOT NULL;
```

This permits reuse only after a record is intentionally soft deleted. If
business policy treats registration or licence identity as permanent, omit the
partial condition and retain uniqueness across deleted history.

Add indexes supporting actual filters and joins:

- Vehicles: `(tenant_id, deleted_at)`,
  `(tenant_id, ownership_type, status)`, `(tenant_id, vendor_id)`,
  `(tenant_id, vehicle_type_id)`.
- Drivers: `(tenant_id, deleted_at)`,
  `(tenant_id, engagement_type, status)`, `(tenant_id, vendor_id)`.
- Vendor reverse lookups: use the composite vendor indexes above.

### Vendor Model Adjustment

Remove resource ownership inference from `Vendor.record_type`.

Recommended end state:

- Vendors are external providers.
- The `own_company` pseudo-Vendor is retired after its resources are migrated.
- `record_type` is removed if it has no remaining independent business use.

If other unreleased code still requires Vendor categories, use category or
capability fields independently of vehicle/driver ownership.

## Backend Module Changes

Follow:

```text
Route
→ Middleware
→ Controller
→ Service
→ Repository
→ Prisma
→ PostgreSQL
```

### Vehicle Module

Create:

```text
backend/src/modules/vehicles/
├── vehicle.routes.ts
├── vehicle.controller.ts
├── vehicle.service.ts
├── vehicle.repository.ts
├── vehicle.schema.ts
├── vehicle.types.ts
├── vehicle.mapper.ts
└── vehicle.integration.test.ts
```

Responsibilities:

- Route: tenant middleware, permission middleware, validation.
- Controller: map HTTP input and authenticated context only.
- Service: ownership rules, Vendor validation, normalization, uniqueness
  conflict mapping, status rules, and audit coordination.
- Repository: every query includes authenticated `tenantId`, `deletedAt`
  policy, and database access only.

### Driver Module

Create the equivalent Driver module with the same layer boundaries.

Driver service owns engagement rules, Vendor validation, salutation/display
name, mobile/licence normalization, duplication policy, and audit coordination.

### Vendor Module

Refactor the Vendor module to use `vendor.repository.ts`.

Vendor detail/list may include counts or linked resources through tenant-scoped
queries, but Vehicle and Driver mutations delegate to their respective
services. Do not call separate VendorVehicle or VendorDriver repositories.

A Vendor-specific create call must force:

```text
Vehicle: ownership_type = VENDOR, vendor_id = path Vendor
Driver:  engagement_type = VENDOR, vendor_id = path Vendor
```

The request body must not be able to override either value. Editing through a
Vendor profile must keep the association vendor-owned. Reclassification to
`OWN` is permitted only through the central master update workflow, where the
service also clears `vendor_id` and validates downstream references.

### Transactions And Audit

Resource creation/update plus audit logging should be atomic. Any future
reclassification that changes Vendor linkage and assignment/reporting
interpretation should be audited with old and new values.

### Permissions

Adopt explicit permissions rather than reusing Vendor permissions:

- `vehicle.view`
- `vehicle.create` or the existing `vehicle.manage`
- `vehicle.update` or the existing `vehicle.manage`
- `driver.view`
- `driver.create` or the existing `driver.manage`
- `driver.update` or the existing `driver.manage`

Before implementation, choose one consistent granularity and update system role
seeding, role-permission UI, authorization tests, and Postman examples.
Destructive resource permissions should be added only if soft deletion remains
an approved public workflow.

## API Changes

All endpoints derive `tenantId` from authenticated tenant context. `tenantId`
must not be accepted in request body, query, or path.

### Central Vehicle APIs

```text
GET    /api/v1/tenant/vehicles
POST   /api/v1/tenant/vehicles
GET    /api/v1/tenant/vehicles/:vehicleId
PATCH  /api/v1/tenant/vehicles/:vehicleId
DELETE /api/v1/tenant/vehicles/:vehicleId  (only if soft-delete workflow is approved)
```

Supported list filters:

```text
ownershipType=OWN|VENDOR
vendorId=<uuid>
vehicleTypeId=<uuid>
status=<approved-status>
search=<registration/make/model>
page=<positive integer>
perPage=10|20|40|50
```

Filter validation:

- Reject unknown `ownershipType`.
- Validate UUID filters.
- If `ownershipType=OWN` and `vendorId` are combined, return a validation error.
- A Vendor filter that does not belong to the tenant returns `404`, preventing
  cross-tenant existence disclosure.

### Central Driver APIs

```text
GET    /api/v1/tenant/drivers
POST   /api/v1/tenant/drivers
GET    /api/v1/tenant/drivers/:driverId
PATCH  /api/v1/tenant/drivers/:driverId
DELETE /api/v1/tenant/drivers/:driverId  (only if soft-delete workflow is approved)
```

Supported list filters:

```text
engagementType=OWN|VENDOR
vendorId=<uuid>
status=<approved-status>
search=<name/mobile/licence>
page=<positive integer>
perPage=10|20|40|50
```

Apply the equivalent enum, UUID, incompatible-filter, and tenant Vendor
validation.

### Vendor Profile Resource APIs

Retain convenient nested entry points while using central storage:

```text
GET  /api/v1/tenant/vendors/:vendorId/vehicles
POST /api/v1/tenant/vendors/:vendorId/vehicles
GET  /api/v1/tenant/vendors/:vendorId/drivers
POST /api/v1/tenant/vendors/:vendorId/drivers
```

Nested update endpoints may remain as aliases for compatibility, but central
resource endpoints should become canonical. Any nested update must verify that
the resource still belongs to the path Vendor.

Vendor detail may embed a limited first page of resources, but separate
paginated linked endpoints are safer for large Vendors.

### Response Conventions

Use the existing standard success, error, and pagination envelopes. API
responses should expose `ownershipType`, `engagementType`, and `vendorId` in the
project's established JSON naming convention, while the database remains
snake_case.

### API Documentation And Postman

During implementation:

- Register Vehicle and Driver OpenAPI definitions and filters.
- Update the Tenant Postman folders with central CRUD/filter requests.
- Keep nested Vendor create requests and show that ownership/vendor fields are
  server-forced.
- Add duty-assignment examples after the Booking API exists.
- Update `docs/postman/README.md` run order.

## Frontend Changes

### Navigation And Routes

Expose the following master navigation:

```text
Masters
├── Vendors
├── Vehicles
└── Drivers
```

Replace redirects with real pages:

- `/vendors`
- `/vehicles`
- `/drivers`

Add route permission handling for the corresponding view permissions. Add page
metadata for Vehicles and Drivers.

### Vehicles Screen

Use the central Vehicle API and provide:

- Tabs or filters: All, Own Fleet, Vendor Vehicles.
- Search by registration, make, or model.
- Vendor and status filters where relevant.
- Pagination using supported page sizes.
- Create, view, and edit workflows.
- Conditional Vendor selector:
  hidden/cleared for `OWN`, required for `VENDOR`.
- Complete approved vehicle fields and expiry dates.

Each tab changes API filters; it does not change the data source or use separate
browser stores.

### Drivers Screen

Use the central Driver API and provide:

- Tabs or filters: All, Own Drivers, Vendor Drivers.
- Search by name, mobile, or licence.
- Vendor and status filters where relevant.
- Pagination.
- Create, view, and edit workflows.
- `MR`/`MS` salutation support using the existing UI convention.
- Conditional Vendor selector:
  hidden/cleared for `OWN`, required for `VENDOR`.

### Vendor Profile

Continue displaying Vendor Vehicles and Vendor Drivers side by side where the
current layout supports it.

Vendor-profile forms:

- Do not display an editable ownership/engagement choice.
- Force the selected Vendor.
- Label the record as Vendor-provided.
- Use central Vehicle/Driver service functions and response mappings.
- Refresh both the Vendor profile data and relevant central master cache after
  mutation.

Remove `own_company` creation/filtering from the Vendor screen.

### Mock Storage Removal

For these resource workflows, remove runtime dependencies on:

- `frontend/src/data/mock/vehicles.json`
- `frontend/src/data/mock/drivers.json`
- Vehicle/Driver exports in `frontend/src/services/api.js`

Do not remove mock resources from downstream unfinished modules until those
modules have been connected. Instead, migrate each downstream consumer to the
central read APIs in the implementation sequence so Bookings, Invoices,
Accounts, Dashboard, and Reports do not break.

## Duty-Assignment Impact

### Target Booking References

Duty assignment references:

```text
vehicle_id
driver_id
vendor_id  (nullable, where assignment is Vendor-linked)
```

Do not add:

```text
own_vehicle_id
vendor_vehicle_id
own_driver_id
vendor_driver_id
```

`assignment_source` may remain a business classification if required for
pricing and reporting, but it must agree with the selected resource ownership.

### Assignment Service Validation

The Booking service must:

1. Load the Vehicle by `(tenant_id, vehicle_id, deleted_at IS NULL)`.
2. Load the Driver by `(tenant_id, driver_id, deleted_at IS NULL)`.
3. Confirm both statuses permit duty assignment.
4. Confirm each resource's ownership/vendor invariant.
5. Derive applicable Vendor information from the selected resources rather
   than trusting a frontend Vendor name or tenant ID.
6. Validate a supplied `vendor_id` belongs to the tenant.
7. If both resources are Vendor-linked, require matching `vendor_id` by default.
8. Reject cross-vendor assignment unless a separately approved workflow,
   permission, reason, and reporting rule are introduced.
9. If only one resource is Vendor-linked, define the duty Vendor as that
   resource's Vendor and flag the mixed-source assignment explicitly.
10. Capture Vendor rate/payable data for a Vendor-sourced duty.

The approved default matrix is:

| Vehicle | Driver | Allowed | Booking `vendor_id` |
| --- | --- | --- | --- |
| OWN | OWN | Yes | `NULL` |
| VENDOR A | VENDOR A | Yes | Vendor A |
| VENDOR A | VENDOR B | No by default | Not applicable |
| OWN | VENDOR A | Yes only if mixed sourcing is approved | Vendor A |
| VENDOR A | OWN | Yes only if mixed sourcing is approved | Vendor A |

Mixed-source rows require an explicit business decision before Booking API
implementation. The safest initial release supports OWN/OWN and same-Vendor
VENDOR/VENDOR only.

### Assignment History

Bookings must reference resource IDs for relational integrity. Because master
details can change later, finalized duties should also preserve an assignment
snapshot where legal/operational history requires the registration, Driver
name, mobile, and Vendor identity as they were at assignment or closure.

Reclassifying an already-used resource must not rewrite historical booking
economics. The booking's assignment source and Vendor payable snapshot remain
historical facts.

## Reporting Impact

### Own Vehicles

Include automatically in:

- Fuel logs
- Maintenance
- Service schedules
- Vehicle expenses
- Insurance, permit, and fitness tracking
- Own-fleet revenue and profit-and-loss

Every expense/service service must reject or explicitly opt in before posting a
Vendor vehicle to these own-fleet workflows.

### Vendor Vehicles

Include in:

- Vendor payable
- Vendor booking margin
- Vendor duty history
- Vendor performance
- Vendor-linked booking analysis

Do not automatically include in tenant fuel, maintenance, insurance-cost,
service-expense, or own-fleet P&L.

### Own Drivers

Include in:

- Driver ledger
- Salary/advance workflows when implemented
- Own-driver duty reports

### Vendor Drivers

Include in:

- Vendor duty history
- Vendor performance
- Vendor-linked booking analysis

Do not automatically include in payroll, salary, employee advance, or own
Driver ledger workflows.

### Report Query Rule

Reports must filter central resources by `ownership_type` or
`engagement_type`, not infer ownership from Vendor presence alone. Vendor
reports join through `vendor_id`. Historical booking financial reports should
prefer the booking assignment snapshot/classification where later
reclassification could otherwise alter prior results.

## Validation Rules

### Common

- Derive `tenant_id` only from verified authentication context.
- Every repository query includes that `tenant_id`.
- Cross-tenant IDs return `404`.
- Normalize human-readable strings to Title Case using the existing shared
  utility.
- Preserve technical identifiers from Title Case conversion.
- Normalize registrations and licences to the agreed uppercase canonical form.
- Validate dates as real date-only values.
- Reject impossible date/year combinations where practical.
- Do not allow inactive/deleted Vendors to receive new resources.
- Do not allow inactive/deleted resources in new duty assignments.

### Vehicle

- `OWN` requires `vendor_id = NULL`.
- `VENDOR` requires `vendor_id`.
- A Vendor must belong to the authenticated tenant.
- Registration is unique within the tenant under the approved soft-delete
  policy.
- Central reclassification to `OWN` atomically clears `vendor_id`.
- Central reclassification to `VENDOR` requires a valid Vendor in the same
  request.
- Vendor-profile create always forces `VENDOR` and the path Vendor.
- Vendor-profile edit cannot change the resource to `OWN`.

### Driver

- `OWN` requires `vendor_id = NULL`.
- `VENDOR` requires `vendor_id`.
- A Vendor must belong to the authenticated tenant.
- Licence is unique within the tenant where present and applicable.
- Mobile follows the agreed existing duplication standard after canonical
  normalization.
- Vendor-profile create always forces `VENDOR` and the path Vendor.
- Vendor-profile edit cannot change the resource to `OWN`.

### Delete And Reclassification

Soft delete or reclassification must be blocked when it would invalidate an
active/running duty. Historical references remain intact. A Vendor cannot be
deleted while active central resources reference it.

## Migration Considerations

No migration is created by this planning task.

The eventual data migration should be staged:

1. Audit existing `vendors`, `vendor_vehicles`, and `vendor_drivers`.
2. Identify the `own_company` Vendor for each tenant.
3. Detect duplicate normalized registration and licence values before adding
   unique indexes.
4. Create enums and new central tables without dropping old tables.
5. Create/map Vehicle Types for every distinct legacy free-text type.
6. Copy `vendor_vehicles`:
   - Rows linked to the tenant's `own_company` become `OWN` with
     `vendor_id = NULL`.
   - Rows linked to an external Vendor become `VENDOR` with the same
     `vendor_id`.
7. Copy `vendor_drivers` using the same parent rule, mapping legacy
   `ownership_type` to `engagement_type`.
8. Preserve IDs where possible. This reduces downstream reference remapping and
   simplifies reconciliation.
9. Map fields:
   - `plate -> registration_number`
   - free-text `type -> vehicle_type_id`
   - `license -> licence_number`
   - `phone -> mobile`
   - legacy `city` into address/structured location only where semantically
     correct; do not fabricate a full address.
10. Leave newly introduced historical dates/details nullable for migrated rows
    until users complete them. Do not invent registration, insurance, permit,
    fitness, or licence dates.
11. Validate row counts, IDs, tenant ownership, Vendor linkage, unique keys, and
    check constraints.
12. Update application reads to central tables.
13. Update writes to central services and stop dual writes.
14. Migrate any Booking or other foreign keys if such tables are introduced
    before this migration is deployed.
15. Observe and reconcile in a controlled deployment window.
16. Drop `vendor_vehicles` and `vendor_drivers` only after all application and
    reporting references are removed and backups are verified.
17. Retire the `own_company` pseudo-Vendor only after confirming it has no other
    legitimate business relationships.

A production rollout should include a backup, migration dry run against a
recent copy, reconciliation SQL, and a rollback strategy. Do not use a
long-lived dual-write design because it creates two sources of truth.

## Affected Files And Components

### Existing Database And Backend Files

- `backend/prisma/schema.prisma`
- `backend/prisma/seed.ts`
- `backend/prisma/migrations/20260723174858_vendor_module/migration.sql`
  (historical migration remains immutable; a new forward migration will be
  added later)
- `backend/src/modules/access/tenant.routes.ts`
- `backend/src/modules/vendors/vendor.routes.ts`
- `backend/src/modules/vendors/vendor.controller.ts`
- `backend/src/modules/vendors/vendor.service.ts`
- `backend/src/modules/vendors/vendor.schemas.ts`
- `backend/src/modules/vendors/vendor.integration.test.ts`
- `backend/src/modules/auth/auth.constants.ts`
- `backend/src/docs/swagger.ts`

### Proposed Backend Files

- `backend/src/modules/vendors/vendor.repository.ts`
- `backend/src/modules/vehicles/*`
- `backend/src/modules/drivers/*`
- A future forward-only Prisma migration for unified resources
- Booking module files when database-backed duty assignment is implemented

### Existing Frontend Files

- `frontend/src/layouts/MainLayout.jsx`
- `frontend/src/routes/AppRoutes.jsx`
- `frontend/src/pages/Vendors/index.jsx`
- `frontend/src/pages/Vehicles/index.jsx`
- `frontend/src/pages/Drivers/index.jsx`
- `frontend/src/services/vendors.js`
- `frontend/src/services/api.js`
- `frontend/src/data/mock/vendors.json`
- `frontend/src/data/mock/vehicles.json`
- `frontend/src/data/mock/drivers.json`
- `frontend/src/pages/Bookings/index.jsx`
- `frontend/src/pages/Bookings/Form.jsx`
- `frontend/src/pages/Bookings/View.jsx`
- `frontend/src/pages/Bookings/Close.jsx`
- `frontend/src/pages/Bookings/Profit.jsx`
- `frontend/src/pages/Invoices/Form.jsx`
- `frontend/src/pages/Accounts/Transactions.jsx`
- `frontend/src/pages/Dashboard/index.jsx`
- `frontend/src/pages/Reports/index.jsx`

### Proposed Frontend Files

- `frontend/src/services/vehicles.js`
- `frontend/src/services/drivers.js`
- Shared Vehicle/Driver form, filter, status, and mapping components where reuse
  is demonstrated.

### Documentation And API Assets To Update During Implementation

- `docs/01_SYSTEM_ARCHITECTURE.md`
- `docs/03_AUTHENTICATION_AND_SECURITY.md`
- `docs/04_DATABASE_PRINCIPLES.md`
- `docs/05_BOOKING_ENGINE.md`
- `docs/08_BACKEND_ARCHITECTURE.md`
- `docs/postman/README.md`
- `docs/postman/Cablix_ERP_API.postman_collection.json`

## Risks And Edge Cases

- Legacy duplicates may fail normalized unique indexes even though current raw
  strings differ by spaces or punctuation.
- The current free-text Vehicle type may not map cleanly to a canonical
  Vehicle Type master.
- Existing records lack several newly required fields; making all fields
  immediately non-null would either fail migration or encourage fabricated
  values.
- The old `own_company` Vendor may have uses beyond resource parenting that
  must be identified before retirement.
- Soft-deleted registration/licence reuse can create ambiguity in historical
  searches unless the UI clearly distinguishes archived records.
- A resource could be reclassified while assigned to a future, running, or
  unclosed booking.
- Cross-vendor or mixed own/vendor assignment affects which Vendor is payable
  and must not be inferred inconsistently.
- A Vendor may be suspended or deleted after a future duty is assigned.
- Current frontend Bookings, Accounts, Invoices, Dashboard, and Reports use
  mock shapes with `plate`, `license`, `phone`, and display strings. API field
  mapping must be deliberate during transition.
- Expiry dates require date-only handling to avoid UTC/time-zone day shifts.
- Driver identity details are sensitive and require field-level access,
  redaction, audit, and retention decisions before implementation.
- Vendor vehicles must not accidentally appear in own-fleet expense selectors.
- Vendor drivers must not accidentally appear in payroll/advance selectors.
- List embedding on Vendor detail can become slow for Vendors with large fleets;
  linked resources should be paginated.
- Prisma does not natively describe every PostgreSQL partial index/check
  constraint, so migration SQL and schema documentation can drift unless tests
  assert the database rules.
- The working tree already contains active Phase 3, Customer, and Vendor work.
  Implementation must preserve unrelated changes and use a forward migration.

## Testing And Acceptance Coverage

Implementation is not complete until tests verify:

- OWN Vehicle succeeds only with no Vendor.
- VENDOR Vehicle requires a same-tenant active Vendor.
- OWN Driver succeeds only with no Vendor.
- VENDOR Driver requires a same-tenant active Vendor.
- Cross-tenant Vendor/resource IDs return `404`.
- Invalid filter enums and UUIDs return standardized validation errors.
- Registration uniqueness is tenant-scoped and normalization-aware.
- Licence uniqueness is tenant-scoped under the agreed nullable/deleted policy.
- Vendor-profile create forces Vendor classification and path Vendor.
- Vendor-profile edit cannot reclassify to OWN.
- Central master can perform an allowed, audited reclassification.
- All repository reads and writes are tenant-scoped.
- Vendor detail shows the same records returned by central Vendor filters.
- All/Own/Vendor tabs call the same central endpoints with different filters.
- Central screens do not read browser mock/local storage.
- Duty assignment rejects unavailable/deleted resources.
- Duty assignment rejects cross-tenant and disallowed cross-Vendor pairs.
- Own resources enter only own operational/reporting workflows.
- Vendor resources enter only Vendor reporting/payable workflows by default.
- Existing Vendor data is reconciled exactly after migration.

## Step-By-Step Implementation Order

1. Review and approve this document, including the unresolved decisions on
   Vehicle Type ownership, status enums, mobile duplication, soft-delete reuse,
   mixed-source duties, and permission granularity.
2. Update the frozen architecture, database, booking, authentication/API, and
   backend documentation to replace the `own_company` parent rule.
3. Inventory and reconcile current production/development Vendor vehicle and
   Driver data; prepare duplicate and type-mapping reports.
4. Define Prisma enums, central Vehicle/Driver/VehicleType models, tenant-safe
   relations, checks, partial unique indexes, and forward migration SQL.
5. Dry-run migration, verify row-by-row reconciliation, and test rollback.
6. Add Vehicle and Driver repositories and service-layer unit tests.
7. Add controllers, Joi schemas, routes, permissions, mappers, audit events,
   OpenAPI definitions, and tenant-isolation integration tests.
8. Refactor Vendor operations through `vendor.repository.ts` and delegate
   linked resource work to the central services.
9. Add central frontend service clients and real Vehicle/Driver pages.
10. Update Masters navigation/routes and remove `/vehicles` and `/drivers`
    redirects.
11. Refactor Vendor profile resource forms to force Vendor linkage and use the
    central services.
12. Remove Vehicle/Driver mock/local-storage dependency from the completed
    master and Vendor workflows.
13. Implement or connect the Booking backend assignment model using
    `vehicle_id`, `driver_id`, and nullable `vendor_id`; add service validation
    and assignment snapshots.
14. Connect booking assignment UI to central filtered resources and the Booking
    API.
15. Migrate Accounts and Invoice resource selectors to central read APIs,
    applying OWN-only restrictions to own-fleet expenses and payroll.
16. Update Dashboard and Reports to use ownership/engagement-aware database
    queries and historical assignment classification.
17. Update Postman collection/environment documentation and run the complete
    tenant-isolation, CRUD, migration, assignment, and reporting test suites.
18. Deploy with backup and reconciliation monitoring; remove transitional
    tables and the `own_company` pseudo-Vendor only after verified cutover.

## Review Gates

Implementation must not begin until the following are approved:

- Vehicle Type master scope.
- Vehicle and Driver status enums.
- Driver mobile duplicate behaviour.
- Licence optionality.
- Registration/licence uniqueness after soft delete.
- Whether public resource delete endpoints remain available.
- Whether mixed OWN/VENDOR duty combinations are allowed.
- Permission-key granularity.
- Retirement timing for existing `own_company` Vendor records.

