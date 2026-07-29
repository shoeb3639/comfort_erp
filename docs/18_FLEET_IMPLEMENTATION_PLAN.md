# Fleet Management Implementation Plan

Version: 1.0

Status: Proposed Implementation Plan — Awaiting Review

Plan Date: 24 July 2026

## Purpose And Current Task Boundary

This document assesses the current Comfort ERP/Cablix ERP implementation and
defines the implementation plan for Fleet Management.

Fleet Management applies only to tenant-owned vehicles from the unified central
Vehicle master. A Fleet workflow must reject a vehicle unless:

```text
vehicle.tenant_id = authenticated tenant
vehicle.ownership_type = OWN
vehicle.vendor_id IS NULL
vehicle.deleted_at IS NULL
```

Vendor vehicles remain central Vehicle records for resource assignment and
Vendor reporting, but they do not participate in Fleet fuel, maintenance,
service, document-renewal, accident, or own-fleet expense workflows.

This is an analysis-only deliverable. No backend code, frontend code, Prisma
schema, migration, API, navigation, or unrelated documentation is changed in
this task.

## Source Documents And Naming Issues

Every Markdown file currently present under `/docs` was reviewed before this
plan was created.

The attached request names `docs/11_FLEET_MANAGEMENT.md`, but that file is not
present. The available approved Fleet requirements are in:

```text
docs/09_FLEET_MANAGEMENT.md
```

That Fleet document references
`17_OWN_AND_VENDOR_RESOURCE_ARCHITECTURE.md`, while the repository currently
contains:

```text
docs/09_OWN_AND_VENDOR_RESOURCE_ARCHITECTURE.md
```

This plan treats the content of the available Fleet and unified-resource
documents as authoritative. Their numbering and cross-reference should be
corrected in a separate documentation housekeeping change after the intended
canonical filenames are confirmed.

There is also a stale own-company Vendor rule in `docs/00_README.md`. The
implemented schema and the later architecture documents use the approved
unified rule: OWN vehicles have no Vendor; VENDOR vehicles require a Vendor.
Fleet design follows the later unified rule.

## Current-State Assessment

### Database And Prisma

The current PostgreSQL/Prisma schema contains database-backed:

- Tenants, subscriptions, authentication, roles, permissions, and audit logs.
- Company setup, locations, bank accounts, and GST registrations.
- Customers, contacts, and travellers.
- Vendors.
- One central `vehicles` table and `Vehicle` model.
- One central `drivers` table and `Driver` model.
- Tenant-scoped `vehicle_types`.

The Vehicle model already provides:

- `id`
- `tenant_id`
- `ownership_type`
- nullable `vendor_id`
- `registration_number`
- `vehicle_type_id`
- `make`
- `model`
- `variant`
- `fuel_type`
- `manufacturing_year`
- `registration_date`
- `insurance_expiry`
- `permit_expiry`
- `fitness_expiry`
- `seating_capacity`
- lifecycle `status`
- create/update/delete audit fields

The database migration already enforces the OWN/VENDOR Vendor-link invariant
and active-row tenant-scoped registration uniqueness.

Missing database-backed operational areas:

- Bookings and duty assignments.
- Expenses/account transactions and ledgers.
- Vehicle logs and authoritative odometer history.
- Fuel logs.
- Maintenance records and parts/items.
- Service schedules.
- Normalized vehicle documents and renewal history.
- Accidents and damage claims.
- File metadata/attachment ownership.
- Fleet alerts or alert acknowledgement.
- Fleet reports and dashboard aggregates.

The existing `insurance_expiry`, `permit_expiry`, and `fitness_expiry` fields on
Vehicle can provide transition data, but they cannot store document copies,
issue/renewal history, renewal cost, reminder configuration, PUC, road tax,
FASTag, GPS subscription, or multiple document versions.

The existing Vehicle `status` uses `SetupRecordStatus` (`ACTIVE`/`INACTIVE`).
It cannot distinguish Available, On Duty, Under Maintenance, Under Repair,
Out of Service, Retired, or Sold.

### Backend

Reusable backend foundations:

- Express tenant API namespace under `/api/v1/tenant`.
- Middleware sequence:
  authentication, tenant resolution, tenant status, subscription, permission,
  Joi validation, controller.
- Centralized errors and consistent response envelopes.
- Tenant audit log.
- Prisma transactions.
- Shared Title Case normalization.
- Vehicle Route/Controller/Service/Repository module.
- Driver and Vendor modules.
- System permission catalog and role seeding.
- Jest integration-test pattern with a dedicated PostgreSQL test database.
- Swagger discovery over module route files.

The Vehicle repository consistently scopes records by `tenantId` and
`deletedAt`. The Vehicle service owns resource validation and audit
coordination. These are the patterns Fleet must reuse.

Backend gaps:

- There is no `fleet` module.
- There is no Booking, Accounts, Reports, or Attachment backend module.
- No current service can determine active duty conflicts.
- No current canonical expense posting service exists.
- No object-storage/file upload service exists.
- Vehicle status is insufficient for assignment locks.
- Current Vehicle delete/reclassification logic does not yet check Fleet
  history or active duties.

### Frontend

Reusable frontend foundations:

- React Router tenant application under `MainLayout`.
- Expandable sidebar groups and route metadata.
- Tailwind visual conventions.
- `ActionNotice` bottom-right animated, focusable, 20-second toast.
- Axios services using the authenticated stored session.
- Real central Vehicle and Driver pages/services.
- Reusable Accounts display helpers:
  `Section`, `SummaryCard`, `TableShell`, `FilterBar`, `StatusBadge`,
  field styling, and money utilities.
- React Hook Form patterns for operational forms.
- Dashboard widget components and chart helpers.

Current frontend gaps:

- No Fleet navigation or routes.
- No Fleet pages or service client.
- Booking records remain browser/localStorage mocks, although assignment
  resource choices are loaded from real Vehicle/Driver APIs.
- Accounts Transactions, expenses, and ledgers remain browser mocks.
- Reports is only a placeholder.
- Existing file inputs save a filename only; file bytes and secure metadata are
  not persisted.
- The global dashboard derives fuel and maintenance estimates from mock expense
  data, not Fleet transactions.

### Existing Booking And Duty Assignment

The Booking UI uses real central Vehicle and Driver choices, but the Booking
record itself remains in browser mock storage. There is no database-backed
Booking/Duty model or backend assignment service.

Therefore:

- Fleet Vehicle Log cannot yet safely reference a database Booking.
- Available/On Duty counts cannot be authoritative.
- Maintenance locks cannot be transactionally checked by Booking assignment.
- Vehicle utilization and booking-linked mileage remain incomplete.

The Fleet plan must define the interface, but implementation of hard
assignment enforcement depends on the Booking backend.

### Existing Accounts

The Accounts Transaction UI already captures useful Fleet-shaped inputs:

- Fuel and Vehicle Service/Maintenance categories.
- Vehicle.
- Odometer.
- Fuel type, quantity, and rate.
- Service type and workshop/vendor.
- Manager, payment mode, amount, reference, remarks, and attachment filename.

However, all of this is mock/localStorage data. There is no canonical Expense,
Account Transaction, Manager Ledger Entry, or Vehicle Ledger model/API.

Fleet must not create a second independent financial transaction. The Fleet
service and future Accounts service must coordinate one operational Fleet
record with one canonical financial posting.

### Existing Reports

The Reports screen is a placeholder. The main Dashboard calculates mock
fuel/maintenance/profit figures. No backend report repository exists.

Fleet reports should query approved Fleet operational rows and canonical
Accounts postings, not scrape frontend state or maintain duplicated report
tables.

## Final Module Boundary

### Fleet Owns

- OWN-vehicle operating/odometer history.
- Fuel-specific operational details.
- Maintenance work and item details.
- Service reminder definitions and due-state calculation.
- Vehicle document identity and renewal/version history.
- Accident, damage, and insurance-claim operational history.
- Fleet-specific eligibility evaluation and alerts.
- Fleet dashboard and Fleet report read models.

### Resources Owns

- Vehicle identity and classification.
- Vehicle type, registration, make, model, variant, fuel type, and core status.
- Driver identity and engagement.
- Vendor identity and Vendor-linked resources.

Fleet never creates a duplicate Vehicle record.

### Booking Operations Owns

- Booking and duty identity.
- Assigned `vehicle_id`, `driver_id`, and applicable `vendor_id`.
- Duty lifecycle.
- Assignment conflict checks and assignment snapshots.

Fleet provides OWN-vehicle eligibility and lock information; Booking performs
the final assignment transaction.

### Accounts Owns

- Expense/payment transaction.
- Manager ledger impact.
- Verification and reversal.
- Financial attachment/reference where appropriate.
- Vehicle ledger financial posting.

Fleet stores operational quantity, odometer, maintenance work, and document
context. It references the canonical expense instead of independently posting
money.

### Reports Owns

- Cross-module report endpoints or orchestration.

Fleet may provide Fleet-specific dashboard/report queries, but it must not
persist duplicate reporting totals.

## Proposed Database Design

The following tables are recommended after inspecting the existing schema.
They must be added through a new forward-only migration after this plan is
approved.

### Vehicle Enhancements

Extend the existing `vehicles` table rather than creating a Fleet vehicle table.

Proposed fields:

| Field | Purpose |
| --- | --- |
| `operational_status` | `AVAILABLE`, `ON_DUTY`, `UNDER_MAINTENANCE`, `UNDER_REPAIR`, `OUT_OF_SERVICE`, `RETIRED`, `SOLD` |
| `current_odometer` | Transactionally maintained latest accepted odometer |
| `operational_status_updated_at` | Lock/status age and audit support |

Keep existing `status` for master lifecycle (`ACTIVE`/`INACTIVE`). A vehicle is
assignable only if both lifecycle and operational status permit it.

Do not place fuel, maintenance, document, or accident arrays/JSON inside
Vehicle.

### `vehicle_logs` — Required

Purpose:

- Immutable odometer and movement history for OWN vehicles.
- Manual/non-booking movements.
- Link to Booking/Duty when that backend exists.
- Source for current odometer, utilization, and idle analysis.

Proposed fields:

```text
id
tenant_id
vehicle_id
log_date
opening_odometer
closing_odometer
distance_travelled
booking_id              -- nullable until Booking exists
driver_id               -- nullable
entry_source             -- MANUAL, DUTY_START, DUTY_CLOSE, IMPORT, CORRECTION
supersedes_log_id        -- nullable correction chain
correction_reason        -- required for correction
remarks
status                   -- POSTED, CORRECTED, CANCELLED
created_by
created_at
updated_at
cancelled_by
cancelled_at
cancellation_reason
```

Rules:

- `distance_travelled = closing - opening` is calculated by the service or a
  stored/generated field; do not trust frontend calculation.
- Posted history is not edited or deleted.
- Correction creates a new entry linked to the corrected entry.
- `opening_odometer <= closing_odometer`.
- Accepted closing odometer cannot be below the vehicle's latest accepted
  odometer unless the actor has correction permission and provides a reason.
- When Booking exists, use tenant-safe composite foreign keys.

Indexes:

- `(tenant_id, vehicle_id, log_date DESC)`
- `(tenant_id, booking_id)`
- `(tenant_id, driver_id, log_date)`

### `fuel_logs` — Required

Fuel has operational fields not represented by a generic Expense, so a separate
Fleet record is justified.

Proposed fields:

```text
id
tenant_id
vehicle_id
fuel_date
fuel_station
fuel_type
quantity_litres
rate_per_litre
odometer_reading
full_tank
filled_by_user_id
booking_id              -- nullable
expense_id              -- nullable until Accounts exists; unique when set
invoice_number
remarks
status                   -- POSTED, CANCELLED
created_by
created_at
updated_at
cancelled_by
cancelled_at
cancellation_reason
```

Financial amount is posted once in the canonical Accounts Expense. Fleet can
calculate a request total from quantity × rate for validation/display, but the
approved financial amount comes from the linked Expense.

Rules:

- Vehicle and odometer are required.
- Quantity and rate must be positive when cost is posted.
- Fuel type should agree with the Vehicle unless an authorized exception is
  recorded.
- Odometer validation uses the same central odometer service as Vehicle Log.
- One fuel log maps to at most one canonical Expense.
- Cancellation reverses/cancels the linked Accounts posting through the
  Accounts service; it never hard-deletes it.

Indexes:

- `(tenant_id, vehicle_id, fuel_date DESC)`
- `(tenant_id, expense_id)`
- `(tenant_id, booking_id)`

### `maintenance_records` — Required

Purpose:

- Maintenance/repair work order header.
- Vehicle lock lifecycle.
- Workshop, dates, totals, next-service information, and expense linkage.

Proposed fields:

```text
id
tenant_id
vehicle_id
maintenance_number
maintenance_type
service_date
odometer_reading
workshop_vendor_id       -- nullable; ordinary Vendor/workshop if applicable
workshop_name_snapshot
work_performed
labour_cost
parts_cost
other_cost
total_cost
started_at
completed_at
next_service_date
next_service_odometer
expense_id               -- nullable until financial posting; unique when set
status                   -- DRAFT, IN_PROGRESS, COMPLETED, CANCELLED
remarks
created_by
updated_by
created_at
updated_at
cancelled_by
cancelled_at
cancellation_reason
```

Rules:

- Total cost is required and non-negative.
- Service recalculates `total_cost = labour + parts + other`; frontend total is
  not trusted.
- An IN_PROGRESS maintenance/repair record locks the vehicle.
- Completing the last active lock returns the vehicle to AVAILABLE only when
  there is no active duty, other lock, or out-of-service status.
- Posted/completed records are not deleted.

### `maintenance_items` — Required

Needed because parts changed and work lines are repeatable and reportable.

```text
id
tenant_id
maintenance_record_id
item_type                -- PART, LABOUR, SERVICE, OTHER
description
quantity
unit_cost
amount
part_number
sort_order
created_at
```

The header total must reconcile to item totals plus explicit header-only costs.
Choose one calculation convention before implementation to avoid double
counting labour/parts.

### `service_schedules` — Required

Proposed fields:

```text
id
tenant_id
vehicle_id
service_type
trigger_type             -- DATE, ODOMETER, BOTH
interval_months
interval_kilometres
next_due_date
next_due_odometer
reminder_days_before
reminder_kilometres_before
last_completed_maintenance_id
status                   -- ACTIVE, PAUSED, COMPLETED, CANCELLED
created_by
updated_by
created_at
updated_at
cancelled_by
cancelled_at
cancellation_reason
```

Rules:

- DATE requires date or interval-month configuration.
- ODOMETER requires odometer due/interval.
- BOTH requires both dimensions.
- Due state is derived:
  `UPCOMING`, `DUE_TODAY/DUE_NOW`, or `OVERDUE`.
- Completing linked maintenance advances the next due values in one
  transaction.
- Do not persist a reminder row every time the dashboard is opened.

### `vehicle_documents` — Required

Represents the document identity/configuration for a Vehicle:

```text
id
tenant_id
vehicle_id
document_type            -- RC, PERMIT, INSURANCE, FITNESS, PUC, ROAD_TAX, FASTAG, GPS, OTHER
document_number
issuing_authority
is_mandatory
reminder_days_before
status                   -- ACTIVE, INACTIVE
created_by
updated_by
created_at
updated_at
```

Recommended uniqueness:

```text
unique active (tenant_id, vehicle_id, document_type, document_number)
```

Whether multiple simultaneous policies/permits of the same type are allowed
must be confirmed before final uniqueness is chosen.

### `document_renewals` — Required

Separate immutable version/history table:

```text
id
tenant_id
vehicle_document_id
issue_date
expiry_date
renewal_date
renewal_cost
expense_id               -- nullable/unique when financially posted
attachment_id            -- nullable
version_number
status                   -- CURRENT, SUPERSEDED, CANCELLED
created_by
created_at
cancelled_by
cancelled_at
cancellation_reason
```

Creating a renewal supersedes the prior current version transactionally.
Document validity uses the latest non-cancelled current version.

The existing Vehicle expiry fields should be handled in one of two ways:

1. Preferred: migrate them into initial document renewal records and deprecate
   the duplicated Vehicle columns after consumers are moved.
2. Transitional: maintain them as explicitly documented cached values updated
   only by the Document service.

They must not become an independent second source of truth.

### `vehicle_accidents` — Required

Proposed fields:

```text
id
tenant_id
vehicle_id
driver_id                -- nullable
booking_id               -- nullable
accident_number
accident_date_time
location
description
damage_details
fir_number
insurance_claim_number
claim_status
estimated_repair_cost
actual_repair_cost
settlement_amount
maintenance_record_id    -- nullable repair link
expense_id               -- nullable/unique when posted
status                   -- REPORTED, UNDER_REVIEW, REPAIRING, SETTLED, CLOSED, CANCELLED
created_by
updated_by
created_at
updated_at
cancelled_by
cancelled_at
cancellation_reason
```

An accident may move the vehicle to UNDER_REPAIR. Closing an accident does not
automatically release the vehicle if an active maintenance/repair lock remains.

### `accident_documents` — Do Not Create Initially

There is no database-backed attachment model today, and documents are needed
by Fuel, Maintenance, Vehicle Documents, Accidents, Booking closure, Accounts,
and other modules.

Create one approved shared attachment/file metadata module instead of a
Fleet-only `accident_documents` table. The exact relational approach must
preserve tenant ownership and referential integrity. Preferred options:

- Dedicated relation tables per owner domain pointing to one `attachments`
  table; or
- A carefully validated polymorphic attachment link if the team accepts its
  weaker database foreign-key guarantees.

The shared attachment record should contain:

```text
id
tenant_id
storage_key
original_filename
content_type
size_bytes
checksum
uploaded_by
created_at
deleted_at
```

Object bytes belong in approved object storage, not PostgreSQL and not browser
localStorage. Upload/download must use authenticated, short-lived URLs and
tenant checks.

### `fleet_alerts` — Not Required Initially

Most Fleet alerts are deterministic projections of:

- Document expiry.
- Service due date/odometer.
- Maintenance lock/status.
- Vehicle inactivity.
- Fuel/mileage anomaly rules.

Compute them in dashboard/report queries instead of duplicating state.

If acknowledgement, assignment, notification delivery, or escalation history
is later required, add a narrowly scoped `fleet_alert_events` or
`fleet_alert_acknowledgements` table keyed by a stable alert fingerprint. Do
not add a generic mutable alerts table before that workflow is approved.

### Accounts Expense Dependency

No Expense model currently exists. Before Fleet financial posting, Accounts
must introduce or approve a canonical expense/transaction model with:

- Tenant and actor.
- Manager ledger/payment source.
- Category.
- Amount and currency.
- Transaction/reference date.
- Vehicle/Booking links where applicable.
- Verification/reversal status.
- Audit fields.

Fleet records reference that canonical `expense_id`. A unique relation prevents
the same Fleet event from posting twice.

Recommended creation flow:

```text
Fleet request
  → Fleet service validates OWN vehicle and operational details
  → Accounts service validates manager ledger/payment data
  → One Prisma transaction creates Fleet record + Expense + ledger entries
  → Audit events are written
```

The Fleet repository must not directly implement ledger business rules.

## Proposed Prisma Models And Relationships

Proposed models:

- `VehicleLog`
- `FuelLog`
- `MaintenanceRecord`
- `MaintenanceItem`
- `ServiceSchedule`
- `VehicleDocument`
- `DocumentRenewal`
- `VehicleAccident`
- Shared `Attachment` and relation models after attachment design approval
- Canonical Accounts `Expense`/transaction models owned by Accounts

Key relationships:

```text
Tenant 1 ── * VehicleLog
Tenant 1 ── * FuelLog
Tenant 1 ── * MaintenanceRecord
Tenant 1 ── * ServiceSchedule
Tenant 1 ── * VehicleDocument
Tenant 1 ── * VehicleAccident

Vehicle(OWN) 1 ── * VehicleLog
Vehicle(OWN) 1 ── * FuelLog
Vehicle(OWN) 1 ── * MaintenanceRecord
Vehicle(OWN) 1 ── * ServiceSchedule
Vehicle(OWN) 1 ── * VehicleDocument
Vehicle(OWN) 1 ── * VehicleAccident

MaintenanceRecord 1 ── * MaintenanceItem
VehicleDocument 1 ── * DocumentRenewal
MaintenanceRecord 0..1 ── 0..1 Expense
FuelLog 0..1 ── 0..1 Expense
DocumentRenewal 0..1 ── 0..1 Expense
VehicleAccident 0..1 ── 0..1 Expense
```

Every cross-tenant relation should use composite tenant-safe foreign keys where
the existing Prisma pattern supports them:

```text
(tenant_id, vehicle_id) -> vehicles(tenant_id, id)
(tenant_id, driver_id) -> drivers(tenant_id, id)
(tenant_id, booking_id) -> bookings(tenant_id, id)
(tenant_id, expense_id) -> expenses(tenant_id, id)
```

Database foreign keys cannot assert `vehicles.ownership_type = OWN`.
Repositories scope the lookup; services enforce ownership; integration tests
prove rejection; and optional PostgreSQL triggers should be considered only if
service enforcement proves insufficient.

## Backend Module Plan

Recommended structure:

```text
backend/src/modules/fleet/
├── fleet.routes.ts
├── fleet.controller.ts
├── fleet.service.ts
├── fleet.repository.ts
├── fleet.schema.ts
├── fleet.types.ts
├── fleet.mapper.ts
├── fleet.constants.ts
├── fleet-dashboard.service.ts
├── fleet-dashboard.repository.ts
├── odometer.service.ts
├── vehicle-log.service.ts
├── fuel-log.service.ts
├── maintenance.service.ts
├── service-schedule.service.ts
├── vehicle-document.service.ts
├── accident.service.ts
└── fleet.integration.test.ts
```

If these files become too large, split repositories and schemas by subsection
while keeping one Fleet route namespace. Do not put Prisma access into the
sub-services.

Layer responsibilities:

- Route: paths, middleware, permission, Joi validation.
- Controller: extract params/query/body/auth context and map HTTP responses.
- Service: OWN eligibility, odometer sequencing, calculations, lock workflow,
  schedule advancement, document validity, Accounts coordination, audit, and
  transaction boundaries.
- Repository: tenant-scoped Prisma queries only.
- Mapper: dates, decimals, derived due states, and response shapes.

### Shared OWN-Vehicle Guard

Create one Fleet service/repository guard:

```text
getEligibleOwnVehicle(tenantId, vehicleId)
```

It must filter:

- authenticated `tenantId`
- Vehicle `id`
- `ownershipType = OWN`
- `vendorId = null`
- `deletedAt = null`

Mutation workflows additionally require active lifecycle status. Read-history
endpoints may continue to show inactive/retired OWN vehicles.

Return `404` for cross-tenant or Vendor-linked IDs to avoid resource existence
disclosure. Return a domain conflict for a same-tenant OWN vehicle whose
lifecycle/operational state prevents the requested action.

### Odometer Coordination

All odometer-bearing workflows must call one service:

- Vehicle Log.
- Fuel Log.
- Maintenance.
- Duty start/close.
- Accident/inspection where applicable.

The service should:

1. Lock or transactionally compare the Vehicle's current odometer.
2. Validate the proposed value.
3. Create the source operational record.
4. Update `Vehicle.currentOdometer` when the value advances.
5. Write the audit record.

Use a transaction isolation/locking strategy that prevents two concurrent
entries from both validating against a stale value.

Authorized corrections never silently overwrite history.

## API Plan

Base namespace:

```text
/api/v1/tenant/fleet
```

Every route uses the existing tenant middleware sequence. Tenant ID is never
accepted from frontend input.

### Fleet Dashboard

```text
GET /api/v1/tenant/fleet/dashboard
GET /api/v1/tenant/fleet/alerts
```

Filters:

- `asOf`
- `dateFrom`
- `dateTo`
- `vehicleId`
- `locationId` when Vehicle/location ownership exists

Dashboard is summary-only and uses repository aggregates. Alert results are
derived and paginated when necessary.

### Vehicle Log

```text
GET  /api/v1/tenant/fleet/vehicle-logs
POST /api/v1/tenant/fleet/vehicle-logs
GET  /api/v1/tenant/fleet/vehicle-logs/:logId
POST /api/v1/tenant/fleet/vehicle-logs/:logId/corrections
POST /api/v1/tenant/fleet/vehicle-logs/:logId/cancel
```

Filters:

- `vehicleId`
- `driverId`
- `bookingId`
- `dateFrom`, `dateTo`
- `status`
- `entrySource`
- `page`, `perPage`
- `sortBy=logDate|createdAt|closingOdometer`
- `sortOrder=asc|desc`

Posted logs have no generic PATCH or DELETE.

### Fuel Log

```text
GET  /api/v1/tenant/fleet/fuel-logs
POST /api/v1/tenant/fleet/fuel-logs
GET  /api/v1/tenant/fleet/fuel-logs/:fuelLogId
PATCH /api/v1/tenant/fleet/fuel-logs/:fuelLogId       -- draft only
POST /api/v1/tenant/fleet/fuel-logs/:fuelLogId/cancel
```

Filters:

- Vehicle, Booking, fuel type, status.
- Date range.
- Minimum/maximum odometer.
- Page, page size, approved sort fields.

Creation may accept an `expense` sub-object when Accounts integration is ready.
The service creates both records transactionally.

### Maintenance

```text
GET  /api/v1/tenant/fleet/maintenance
POST /api/v1/tenant/fleet/maintenance
GET  /api/v1/tenant/fleet/maintenance/:maintenanceId
PATCH /api/v1/tenant/fleet/maintenance/:maintenanceId
POST /api/v1/tenant/fleet/maintenance/:maintenanceId/start
POST /api/v1/tenant/fleet/maintenance/:maintenanceId/complete
POST /api/v1/tenant/fleet/maintenance/:maintenanceId/cancel
```

Filters:

- Vehicle.
- Maintenance type.
- Status.
- Workshop Vendor.
- Service/due date range.
- Page and sorting.

Item lines are created/updated only while the record is DRAFT. Start, complete,
and cancel are explicit service transitions.

### Service Schedules

```text
GET  /api/v1/tenant/fleet/service-schedules
POST /api/v1/tenant/fleet/service-schedules
GET  /api/v1/tenant/fleet/service-schedules/:scheduleId
PATCH /api/v1/tenant/fleet/service-schedules/:scheduleId
POST /api/v1/tenant/fleet/service-schedules/:scheduleId/pause
POST /api/v1/tenant/fleet/service-schedules/:scheduleId/resume
POST /api/v1/tenant/fleet/service-schedules/:scheduleId/cancel
```

Filters:

- Vehicle.
- Service type.
- Trigger type.
- Derived due state.
- Due date window.
- Status, pagination, and sorting.

### Documents And Renewals

```text
GET  /api/v1/tenant/fleet/documents
POST /api/v1/tenant/fleet/documents
GET  /api/v1/tenant/fleet/documents/:documentId
PATCH /api/v1/tenant/fleet/documents/:documentId
POST /api/v1/tenant/fleet/documents/:documentId/renewals
POST /api/v1/tenant/fleet/documents/:documentId/deactivate
POST /api/v1/tenant/fleet/document-renewals/:renewalId/cancel
```

Filters:

- Vehicle.
- Document type.
- Mandatory flag.
- Valid/expiring/expired state.
- Expiry range.
- Pagination and sorting.

Attachment flow should be separately versioned:

```text
POST /api/v1/tenant/attachments/upload-intent
POST /api/v1/tenant/attachments/:attachmentId/complete
GET  /api/v1/tenant/attachments/:attachmentId/download-url
```

Do not send unbounded file bytes through JSON Fleet endpoints.

### Accident And Damage

```text
GET  /api/v1/tenant/fleet/accidents
POST /api/v1/tenant/fleet/accidents
GET  /api/v1/tenant/fleet/accidents/:accidentId
PATCH /api/v1/tenant/fleet/accidents/:accidentId
POST /api/v1/tenant/fleet/accidents/:accidentId/start-repair
POST /api/v1/tenant/fleet/accidents/:accidentId/settle
POST /api/v1/tenant/fleet/accidents/:accidentId/close
POST /api/v1/tenant/fleet/accidents/:accidentId/cancel
```

Filters:

- Vehicle.
- Driver.
- Booking.
- Accident/claim status.
- Date range.
- Page and sorting.

Generic PATCH is limited to mutable pre-settlement fields. Financial
settlement, repair, close, and cancel use explicit workflow endpoints.

### Common API Behaviour

- Validate all params, query, and bodies with Joi.
- Allow only whitelisted `sortBy` values.
- Use `perPage`: 10, 20, 40, or 50.
- Return standardized success/error envelopes.
- Cross-tenant or Vendor vehicle IDs return `404`.
- Workflow conflicts return `409` with stable domain codes.
- Do not expose deleted/cancelled rows by default; allow approved status filters
  for history.
- Document every endpoint in OpenAPI and Postman during implementation.

## Validation Rules

### OWN-Only Eligibility

- Every Fleet create/update/workflow operation loads Vehicle by authenticated
  tenant plus `ownershipType=OWN`, `vendorId=null`, `deletedAt=null`.
- Vendor-linked and cross-tenant vehicles are rejected.
- The frontend OWN filter is usability only, never a security boundary.

### Vehicle Assignment Eligibility

An OWN vehicle is assignable only when:

- Master status is ACTIVE.
- Operational status is AVAILABLE.
- No active maintenance/repair/accident lock exists.
- No overlapping active duty exists.
- Every mandatory document required by policy is valid at the duty start/end
  date.

Document expiry should produce warnings before expiry and a hard block after
expiry only according to an approved tenant/platform policy. The current Fleet
requirements say valid mandatory documents are required, so the default plan
is a hard assignment block for expired mandatory documents.

### Odometer

- Vehicle and odometer are required for Fuel.
- Numeric, non-negative, reasonable upper bounds.
- Opening cannot exceed closing.
- New readings cannot be lower than latest accepted reading.
- Same reading may be allowed for stationary fuel/maintenance with a reason.
- Correction requires `fleet.odometer.correct` and a reason.
- Concurrent writes must not create a decreasing sequence.
- Unrealistic mileage/fuel efficiency creates a warning or review flag; exact
  thresholds must be configurable rather than hardcoded globally.

### Fuel

- Positive quantity.
- Positive rate/amount where financially posted.
- Fuel date cannot be unreasonably future-dated.
- Fuel type validates against approved values and Vehicle fuel type.
- Duplicate bill/reference detection should warn or conflict according to
  Accounts policy.
- A cancelled fuel record cannot contribute to mileage or reports.

### Maintenance

- OWN active Vehicle required.
- Total cost required; service recalculates it.
- Dates and odometer validated.
- Start sets/maintains a maintenance lock.
- Completion requires work summary and completion data.
- Completed/financially posted history is immutable.
- Cancellation requires reason and linked financial reversal where necessary.

### Service Schedule

- Trigger enum validated.
- DATE requires relevant date/interval.
- ODOMETER requires relevant odometer/interval.
- BOTH requires both.
- Interval values must be positive.
- Next due cannot be earlier than the baseline without correction permission.
- Only one active equivalent schedule per
  tenant/vehicle/service type unless multiple schedules are explicitly
  approved.

### Documents

- Controlled document type.
- Issue date cannot be after expiry.
- Current renewal version is unique per document.
- Mandatory document validity is evaluated for the requested duty period.
- Uploaded content type, size, checksum, and tenant ownership are validated.
- Cancelled/superseded versions remain historical.

### Accidents

- OWN Vehicle required.
- Accident date cannot be unreasonably future-dated.
- Driver and Booking, if supplied, belong to the same tenant.
- Settlement and costs use decimal types and cannot be negative.
- Repair/settlement workflow transitions are controlled.
- A repair lock is not released until all linked active locks are resolved.

### Deletion And Audit

- No hard delete for posted Vehicle Logs, Fuel Logs, Maintenance, Renewals, or
  Accidents.
- Drafts may be cancellable; operational history uses status/correction.
- Every mutation writes `TenantAuditLog`.
- Audit should include old/new values for critical transitions when the shared
  audit structure supports them.
- Reclassification or deletion of a Vehicle with Fleet history must be blocked
  or governed by an approved archive workflow.

## Permissions

Recommended permission keys:

```text
fleet.dashboard.view
fleet.vehicle_log.view
fleet.vehicle_log.manage
fleet.odometer.correct
fleet.fuel.view
fleet.fuel.manage
fleet.maintenance.view
fleet.maintenance.manage
fleet.service_schedule.view
fleet.service_schedule.manage
fleet.document.view
fleet.document.manage
fleet.accident.view
fleet.accident.manage
fleet.report.view
```

Financial creation additionally requires the appropriate Accounts/Expense
permission. Attachment download requires both Fleet resource permission and
attachment ownership validation.

Suggested role defaults:

- Super Admin/Admin: all Fleet permissions.
- Fleet Manager: all Fleet operational permissions; odometer correction may be
  separately withheld.
- Operations Manager: dashboard, Vehicle Log, document warning, maintenance
  status, and assignment eligibility reads.
- Booking Executive: eligibility/document warnings required for assignment,
  not Fleet mutation.
- Accountant: Fleet financial/report reads plus expense verification; no
  operational correction by default.
- Driver: only explicitly approved own duty/vehicle log interactions.

Do not authorize by role name in code.

## Tenant-Isolation Checks

Every Fleet repository method must accept `tenantId` as a required first-class
argument and include it in:

- Primary record lookups.
- Related Vehicle/Driver/Booking/Expense lookups.
- Nested item mutations.
- Aggregates and reports.
- Attachment access.
- Cancellation/correction targets.

Required tests:

- Tenant A cannot read/mutate Tenant B Fleet IDs.
- A Tenant A Fleet record cannot reference Tenant B Vehicle, Driver, Booking,
  Expense, Vendor, or Attachment.
- Supplying `tenantId` in body/query has no effect or is rejected as unknown.
- Platform users cannot use tenant Fleet APIs.
- Suspended tenant and expired subscription behaviour follows current
  middleware policy.

## Frontend Plan

### Navigation

Add one expandable tenant sidebar group:

```text
Fleet Management
├── Dashboard
├── Vehicle Log
├── Fuel Log
├── Maintenance
├── Service Schedule
├── Documents & Renewals
└── Accident & Damage
```

Proposed routes:

```text
/fleet
/fleet/vehicle-logs
/fleet/fuel-logs
/fleet/maintenance
/fleet/service-schedules
/fleet/documents
/fleet/accidents
```

Do not add `/fleet/vehicles` or duplicate the Vehicle master.

### Shared Fleet UI

Reuse:

- MainLayout group navigation and route metadata.
- Accounts `SummaryCard`, `Section`, `TableShell`, `FilterBar`, `StatusBadge`,
  money and field utilities where their API is generic enough.
- ActionNotice.
- Axios authentication convention.
- React Hook Form.
- Dashboard widgets/charts.

Extract generic shared components only when reuse is real; do not make Fleet
depend on Accounts page internals long term. Candidate shared components:

- Paginated data table shell.
- Date range filter.
- OWN Vehicle selector.
- Status badge.
- Money input/display.
- File attachment control.
- Confirmation/cancellation dialog.

The OWN Vehicle selector calls the central API with:

```text
GET /api/v1/tenant/vehicles?ownershipType=OWN
```

Fleet responses still enforce ownership on the backend.

### Fleet Dashboard Screen

Cards:

- Total OWN vehicles.
- Active.
- Available.
- On Duty.
- Under Maintenance.
- Under Repair.
- Out of Service.
- Fuel cost today/month.
- Average mileage.
- Due/overdue services.
- Maintenance cost this month.
- Expiring/expired mandatory documents.

Sections:

- Critical alerts.
- Upcoming services.
- Document expiries.
- High fuel consumption.
- Frequent breakdowns.
- Idle vehicles.

Every card links to a filtered underlying screen.

### Vehicle Log Screen

- OWN Vehicle/date/status filters.
- Opening, closing, calculated distance.
- Booking and Driver links when available.
- Manual entry.
- Correction dialog with reason and permission check.
- Read-only history/timeline.
- No delete action.

### Fuel Log Screen

- Summary cards for litres, cost, mileage, and cost/KM.
- OWN Vehicle/date/fuel filters.
- Create form with required odometer.
- Optional Booking and Accounts posting fields when those APIs exist.
- Bill attachment.
- Detail and cancel actions.
- Anomaly indicator, not silent rejection, for configurable mileage outliers.

### Maintenance Screen

- List with DRAFT/IN_PROGRESS/COMPLETED/CANCELLED.
- Create work order.
- Repeatable item lines.
- Workshop/Vendor lookup.
- Cost reconciliation.
- Start/complete/cancel actions.
- Vehicle lock indicator.
- Next service fields and schedule linkage.

### Service Schedule Screen

- Upcoming, Due, and Overdue tabs.
- Date/Odometer/Both trigger form.
- Vehicle current odometer.
- Progress-to-due visualization.
- Pause/resume/cancel.
- Link completion to Maintenance.

### Documents And Renewals Screen

- Valid, Expiring, Expired tabs.
- Document type and mandatory filters.
- Per-Vehicle document matrix.
- Renewal history.
- Upload/download controls through shared Attachment API.
- 30/15/7-day visual warning levels.

### Accident And Damage Screen

- Accident/claim workflow list.
- Report form.
- Vehicle, Driver, Booking links.
- Damage/claim/cost sections.
- Image/supporting document attachments.
- Start Repair, Settle, Close, and Cancel actions.

### Frontend Data Rules

- No localStorage/mock persistence for Fleet.
- API error messages use ActionNotice.
- Technical identifiers are not Title Cased.
- Forms do not send `tenantId`.
- Dropdowns show only eligible OWN vehicles.
- Permission-aware buttons improve usability, but backend permissions remain
  authoritative.

## Booking-Assignment Impact

Booking assignment must eventually call a shared Fleet eligibility service or
repository projection before assigning an OWN Vehicle.

Recommended eligibility response:

```json
{
  "eligible": false,
  "blockingReasons": [
    "UNDER_MAINTENANCE",
    "INSURANCE_EXPIRED"
  ],
  "warnings": [
    {
      "code": "PUC_EXPIRING",
      "expiresOn": "2026-08-01"
    }
  ]
}
```

Validation must occur in the Booking backend transaction, not only when the
dropdown is loaded. This prevents a vehicle from entering maintenance between
selection and assignment.

Until database-backed Booking/Duty Assignment exists:

- Fleet can expose eligibility endpoints and status.
- The mock Booking UI may display warnings in a later integration phase.
- Hard, race-safe duty conflict enforcement cannot be considered complete.

Duty start/close should create Vehicle Log/odometer events through the shared
odometer service once Booking is implemented. Do not duplicate duty mileage in
an unrelated Fleet table without a Booking reference.

## Accounts Integration

### Single Financial Record Rule

Fuel, Maintenance, document renewal, and accident repair may create expenses.
They must reference one canonical Accounts Expense/Transaction.

Do not:

- Save a Fleet expense and separately ask the user to re-enter it in Accounts.
- Create duplicate Manager Ledger debits.
- Recalculate verified financial history from mutable Fleet values.

### Transaction Boundary

For a paid Fleet action:

1. Fleet validates the OWN vehicle and operational fields.
2. Accounts validates manager/payment source and available balance.
3. Fleet and Accounts records are created in one Prisma transaction coordinated
   by the service layer.
4. Ledger impact and audit entries are created.
5. Failure rolls back all related rows.

If the Fleet user lacks expense permission, allow an operational draft with
`expense_id = NULL` only if business approves a “Pending Financial Posting”
workflow. Otherwise require an authorized Accountant to complete posting.

### Vehicle Profit

- Linked Fuel and Maintenance expenses debit OWN Vehicle ledger/profit.
- Recoverable toll/parking remains outside Fleet cost.
- Vendor Vehicle expenses are rejected.
- Reversed/cancelled expenses do not reduce final Vehicle profit.

## Reporting Integration

Fleet-specific reports:

- Vehicle Ledger.
- Fuel Analysis.
- Fuel Cost.
- Mileage.
- Maintenance.
- Vehicle Running Cost.
- Document Expiry.
- Accident.
- Vehicle Utilization.
- Fleet Health Dashboard.

Report sources:

| Report | Authoritative sources |
| --- | --- |
| Vehicle Ledger | Bookings/Duties + canonical Expenses + Fleet events |
| Fuel Analysis | Fuel logs + Vehicle Logs + linked Expenses |
| Maintenance | Maintenance records/items + linked Expenses |
| Running Cost | Canonical Expenses grouped by OWN Vehicle |
| Document Expiry | Current Document Renewal versions |
| Accident | Vehicle Accidents + Maintenance + claim settlement |
| Utilization | Booking/Duty + Vehicle Logs |
| Fleet Health | Derived service, document, accident, fuel, and idle metrics |

All report queries:

- Filter `Vehicle.ownershipType = OWN`.
- Include authenticated tenant.
- Exclude cancelled financial/operational records by default.
- Use date ranges in tenant timezone while storing event timestamps in UTC.
- Avoid persisted duplicate totals unless a reviewed analytics/materialized
  view strategy is later required.

## Fleet Dashboard Metrics

### Fleet Summary

- Total: active/non-deleted OWN Vehicles.
- Active: OWN Vehicles with master ACTIVE status.
- Available/On Duty/Under Maintenance/Under Repair: operational status.

### Fuel

- Today/month cost: linked non-cancelled canonical Expenses.
- Litres: non-cancelled Fuel Logs.
- Average mileage:
  distance between valid odometer points divided by litres for comparable
  periods; do not average per-entry ratios without weighting.
- Cost/KM: approved fuel expense divided by accepted distance.

### Maintenance

- Due/overdue: derived Service Schedule state.
- Month cost: linked approved Expenses.
- Frequent repair: configurable rolling-window count.

### Documents

- Expiring: latest current mandatory renewal whose expiry is within configured
  30/15/7-day window.
- Expired: latest mandatory renewal before `asOf`, or missing required current
  document according to policy.

### Alerts

- High fuel consumption: configurable deviation from Vehicle historical
  baseline/minimum sample size.
- Excessive maintenance: configurable cost or frequency threshold.
- Not used: no completed duty/Vehicle Log within configured days.
- Frequent breakdown: repair/accident count within rolling window.

Thresholds require tenant settings or approved defaults; do not hardcode
business-critical thresholds in UI components.

## Migration Considerations

No migration is created in this task.

Implementation migration sequence:

1. Confirm canonical doc filenames and unresolved business decisions.
2. Inventory existing OWN Vehicle records and expiry fields.
3. Detect invalid OWN/Vendor combinations and resolve before Fleet foreign keys.
4. Add operational Vehicle status/current odometer fields with safe defaults.
5. Add Fleet enums and tables in a forward migration.
6. Backfill current odometer only from trustworthy sources; current mock data
   must not be promoted automatically.
7. Convert existing Vehicle insurance/permit/fitness expiries into initial
   document/current-renewal records when values exist.
8. Reconcile migrated expiry values before deprecating or caching old columns.
9. Introduce Accounts and Attachment foreign keys only when their canonical
   models exist; use phased nullable columns rather than fake IDs.
10. Add constraints/indexes after backfill validation.
11. Dry-run against a recent database copy.
12. Verify per-tenant counts, OWN-only relationships, dates, costs, and
    document versions.
13. Deploy APIs before switching frontend routes.
14. Preserve rollback and reconciliation scripts.

Do not migrate browser localStorage mock Fuel/Expense/Booking data into
production automatically.

## Testing Strategy

### Unit Tests

- Odometer sequence and correction.
- Distance, mileage, cost/KM.
- Maintenance total reconciliation.
- Service due-state and next-due advancement.
- Document validity for duty date ranges.
- Operational status lock resolution.
- Alert threshold calculations.
- Workflow transition matrices.

### Repository Tests

- Tenant scope on every lookup/list/aggregate.
- OWN filter.
- Soft-delete/cancel filters.
- Pagination and allowed sorting.
- Composite relation safety.

### Integration Tests

- Create/list/detail/update allowed drafts.
- Workflow start/complete/cancel.
- Vendor Vehicle rejected by every Fleet section.
- Cross-tenant IDs return `404`.
- Tenant ID input cannot override auth context.
- Odometer decreasing value rejected.
- Authorized correction preserves history.
- Concurrent odometer writes remain monotonic.
- Maintenance/repair locks assignment.
- Completing last lock restores availability only when safe.
- Expired mandatory document blocks assignment.
- Expiring document returns warning.
- Fleet + Accounts posting is atomic.
- Cancellation creates financial reversal and preserves history.
- File access is tenant-scoped.
- Permission matrix.
- Expired subscription/suspended tenant middleware.

### Frontend Tests

- Routes and navigation.
- OWN-only dropdown.
- Form validation and derived totals.
- Tabs, filters, pagination, and sorting.
- Permission-aware actions.
- Toast/error behaviour.
- No Fleet localStorage writes.
- Empty/loading/error states.
- Responsive tables/forms.

### Migration Tests

- Existing OWN/VENDOR resources retain classification.
- No Fleet row references VENDOR resources.
- Initial document renewals match legacy expiry fields.
- Repeatable/rollback migration rehearsal.

### End-To-End Scenarios

1. Add Fuel for OWN Vehicle and verify one Accounts expense/Vehicle ledger
   impact.
2. Attempt Fuel for VENDOR Vehicle and receive rejection.
3. Start Maintenance, verify vehicle disappears/blocks in assignment, complete
   it, and verify safe availability.
4. Renew Insurance and verify old version remains plus warning clears.
5. Report Accident, start repair, attach documents, settle, and close.
6. Enter decreasing odometer, reject; perform authorized correction and retain
   audit trail.
7. Verify Tenant A cannot access Tenant B Fleet data or files.

## Step-By-Step Implementation Order

1. Review this plan and resolve the open questions below.
2. Correct/approve canonical Fleet and unified-resource document filenames and
   stale cross-references.
3. Approve Vehicle operational status enum and assignment policy.
4. Design and implement the shared Attachment foundation.
5. Design and implement the canonical Accounts Expense/ledger foundation or
   approve a non-financial Fleet-first phase.
6. Add Vehicle operational status/current odometer and Fleet Prisma models in
   one reviewed forward migration.
7. Implement Fleet repository and shared OWN Vehicle/odometer guards.
8. Implement Vehicle Log with correction/cancellation and concurrency tests.
9. Implement Fuel Log plus atomic Accounts posting.
10. Implement Maintenance/items, Vehicle locks, and expense integration.
11. Implement Service Schedules and completion advancement.
12. Implement Documents/Renewals, legacy-expiry migration, uploads, and alerts.
13. Implement Accident/Damage, repair locks, claims, attachments, and expenses.
14. Implement Fleet dashboard aggregates and Fleet report endpoints.
15. Add permissions, role defaults, OpenAPI, Postman, and audit events.
16. Add Fleet frontend service, shared components, routes, and navigation.
17. Build screens in dependency order:
    Vehicle Log, Fuel, Maintenance, Service Schedule, Documents, Accidents,
    Dashboard.
18. Implement database-backed Booking/Duty Assignment if not already complete,
    then integrate transactional Fleet eligibility and odometer events.
19. Connect Accounts, Reports, and global Dashboard to authoritative APIs and
    remove their Fleet-related mock dependencies.
20. Run migration rehearsal, full backend/frontend tests, tenant-isolation
    tests, and end-to-end acceptance.

## Files Expected To Be Created

### Backend

```text
backend/src/modules/fleet/fleet.routes.ts
backend/src/modules/fleet/fleet.controller.ts
backend/src/modules/fleet/fleet.service.ts
backend/src/modules/fleet/fleet.repository.ts
backend/src/modules/fleet/fleet.schema.ts
backend/src/modules/fleet/fleet.types.ts
backend/src/modules/fleet/fleet.mapper.ts
backend/src/modules/fleet/fleet.constants.ts
backend/src/modules/fleet/fleet-dashboard.service.ts
backend/src/modules/fleet/fleet-dashboard.repository.ts
backend/src/modules/fleet/odometer.service.ts
backend/src/modules/fleet/vehicle-log.service.ts
backend/src/modules/fleet/fuel-log.service.ts
backend/src/modules/fleet/maintenance.service.ts
backend/src/modules/fleet/service-schedule.service.ts
backend/src/modules/fleet/vehicle-document.service.ts
backend/src/modules/fleet/accident.service.ts
backend/src/modules/fleet/fleet.integration.test.ts
```

Shared Attachment and Accounts files will be created in their own modules after
their designs are approved, not inside Fleet.

### Database

```text
backend/prisma/migrations/<timestamp>_fleet_management/migration.sql
```

### Frontend

```text
frontend/src/services/fleet.js
frontend/src/pages/Fleet/Dashboard.jsx
frontend/src/pages/Fleet/VehicleLogs.jsx
frontend/src/pages/Fleet/FuelLogs.jsx
frontend/src/pages/Fleet/Maintenance.jsx
frontend/src/pages/Fleet/ServiceSchedules.jsx
frontend/src/pages/Fleet/Documents.jsx
frontend/src/pages/Fleet/Accidents.jsx
frontend/src/pages/Fleet/components/OwnVehicleSelect.jsx
frontend/src/pages/Fleet/components/FleetFilters.jsx
frontend/src/pages/Fleet/components/FleetStatusBadge.jsx
frontend/src/pages/Fleet/components/AttachmentControl.jsx
```

Exact component splits should follow actual reuse and avoid premature
abstraction.

## Files Expected To Be Modified

### Database And Backend

- `backend/prisma/schema.prisma`
- `backend/prisma/seed.ts`
- `backend/src/modules/access/tenant.routes.ts`
- `backend/src/modules/auth/auth.constants.ts`
- `backend/src/modules/vehicles/vehicle.service.ts`
- `backend/src/modules/vehicles/vehicle.repository.ts`
- Vehicle integration tests.
- Booking service/repository/routes when database-backed Booking is implemented.
- Accounts service/repository/routes after canonical Accounts design.
- Reports service/repository/routes when introduced.
- `backend/src/docs/swagger.ts` only if shared Swagger configuration changes.

### Frontend

- `frontend/src/layouts/MainLayout.jsx`
- `frontend/src/routes/AppRoutes.jsx`
- `frontend/src/pages/Vehicles/index.jsx` for Fleet alerts/profile links only;
  do not duplicate the master.
- `frontend/src/pages/Bookings/index.jsx` and later Booking forms for
  eligibility/locks.
- `frontend/src/pages/Accounts/Transactions.jsx` when replacing mock expense
  entry with canonical APIs.
- `frontend/src/pages/Reports/index.jsx`
- `frontend/src/pages/Dashboard/index.jsx`
- Shared UI utilities only where extracted reuse is justified.

### Documentation And API Assets During Implementation

- Canonical Fleet source document after filename decision.
- Unified resource architecture cross-reference.
- `docs/03_AUTHENTICATION_AND_SECURITY.md`
- `docs/04_DATABASE_PRINCIPLES.md`
- `docs/05_BOOKING_ENGINE.md`
- `docs/07_ACCOUNTS_ENGINE.md`
- `docs/08_BACKEND_ARCHITECTURE.md`
- `docs/postman/Cablix_ERP_API.postman_collection.json`
- `docs/postman/README.md`

## Risks And Edge Cases

- The attached request and repository disagree on Fleet document numbering.
- The unified-resource document describes an older pre-implementation state;
  the live schema has already moved beyond it.
- Vehicle `ACTIVE/INACTIVE` is insufficient for operational locks.
- Existing expiry fields could become a conflicting second source of truth.
- PUC and other required documents are absent from Vehicle.
- Booking, Accounts, Reports, and Attachments are not database-backed, so
  several cross-module guarantees cannot be completed by Fleet alone.
- Concurrent odometer entries can violate monotonic history without locking.
- Multiple overlapping maintenance/accident locks can release a vehicle too
  early if represented by one mutable status only.
- Maintenance could begin while a future/running duty exists.
- A duty could be assigned while maintenance starts unless both services check
  conflicts transactionally.
- Document validity may need to cover the full duty period, not only start date.
- Different jurisdictions/vehicle types may require different mandatory
  documents.
- Mileage calculations are invalid across missing, corrected, or non-full-tank
  entries unless calculation policy is precise.
- EV/CNG/multi-fuel vehicles require units beyond litres and may need a future
  energy-log generalization.
- Fuel/maintenance monetary values can diverge from Accounts after
  verification unless financial authority is clearly defined.
- Workshop Vendor semantics differ from a Vendor-provided Vehicle and must not
  change Vehicle ownership.
- Soft-deleted/inactive/retired Vehicles must retain readable history.
- Reclassifying OWN to VENDOR after Fleet history can corrupt report semantics;
  block it or preserve an effective-dated ownership snapshot.
- File uploads create malware, size, retention, authorization, and storage-cost
  risks.
- Alert queries may become expensive; index first and introduce materialized
  views only after measured need.
- Date-only expiry fields can shift by timezone if serialized as timestamps.
- The working tree contains substantial existing uncommitted development.
  Future implementation must preserve unrelated edits.

## Open Questions And Review Gates

Implementation should not start until these decisions are approved:

1. Is `docs/09_FLEET_MANAGEMENT.md` the intended canonical source, or should it
   be renamed to `11_FLEET_MANAGEMENT.md`?
2. Should `docs/09_OWN_AND_VENDOR_RESOURCE_ARCHITECTURE.md` be renamed to the
   referenced `17_...` filename?
3. Approve the Vehicle operational statuses and transition rules.
4. Does an expired mandatory document always hard-block assignment, and must it
   remain valid through the entire duty end date?
5. Which documents are mandatory by default, and can tenants configure them by
   vehicle type/state?
6. Should existing Vehicle expiry columns be deprecated after migration or
   retained as service-maintained caches?
7. Approve odometer correction permission and audit workflow.
8. What threshold makes mileage “unrealistic,” and is it a warning or hard
   block?
9. Are electric charging and non-litre fuel units in the first release?
10. Can Fleet operational drafts exist without an Accounts expense, or must
    financial posting be atomic at creation?
11. Which Accounts transaction/expense schema is canonical?
12. Which object storage provider, file limits, allowed content types, and
    retention rules apply?
13. Can multiple active documents of the same type exist for one Vehicle?
14. Can an OWN Vehicle with Fleet history ever be reclassified to VENDOR?
15. May maintenance be scheduled over an existing future duty, or must the
    duty be reassigned first?
16. Should alert thresholds be tenant-configurable in the first release?
17. Is Driver allowed to enter Vehicle Log/Fuel data, and under which
    permissions?

