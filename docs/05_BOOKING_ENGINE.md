# Booking Engine

## Booking route and text standards

Every new booking captures three distinct route fields:

- `travellingFrom` — journey origin
- `travellingTo` — journey destination
- `pickupReportingAddress` — the exact pickup/reporting address or location

All three fields are required when a booking is created. The API stores them in
`bookings.travelling_from`, `bookings.travelling_to`, and
`bookings.pickup_reporting_address`.

All human-readable booking text is normalized to Title Case in the backend
service layer on both create and update. Identifiers, enum values, package
codes, phone numbers, dates, times, and other machine-readable values are not
case-transformed.

Version: 1.0

Status: Approved Requirements Baseline (Frozen)

Baseline Date: 20 July 2026

## Purpose

This document defines the booking workflow for Cablix ERP tenant operations.

Bookings are tenant-owned records and must always be scoped by tenant.

## Booking Number

Before creating its first booking, each tenant configures a booking prefix.

- Prefix is exactly four uppercase alphanumeric characters.
- Prefix is globally unique across tenants.
- The backend generates a random number between `100000` and `999999`.
- The six-digit random number is globally unique across bookings.
- The frontend must never generate or submit the booking number.

Format:

```text
<PREFIX>-<SIX_DIGIT_RANDOM_NUMBER>
```

Example:

```text
CMFP-265381
```

The database applies uniqueness to the complete `booking_id`. Because every
tenant has a globally unique four-character booking prefix, this guarantees
that every generated Booking ID is unique without storing the six-digit part
in a second column. Creation retries safely when a generated Booking ID
collides.

## Booking Scope

Booking captures:

- Customer and traveller details
- Booking type
- Service city
- Route
- Start date
- End date
- Pickup/reporting time
- Requested vehicle type
- Assignment source
- Vendor/vehicle/driver assignment
- Pricing inputs
- Closure and billing data

## Booking Types

Supported booking types:

- Package
- Local
- Airport Transfer
- Railway Station Transfer
- Outstation

Local package variations:

- 8 Hrs 80 Kms
- 12 Hrs 120 Kms
- 12 Hrs 200 Kms

Outstation minimum KM options:

- 200 km per day
- 250 km per day
- 300 km per day

These booking variations should be captured during booking creation so closure and billing can calculate correctly.

## Booking Lifecycle

Recommended statuses:

- Draft
- Confirmed
- Assigned
- Running
- Completed
- Closed
- Cancelled

Lifecycle:

```text
Draft
  |
  v
Confirmed
  |
  v
Assigned
  |
  v
Running
  |
  v
Completed
  |
  v
Closed
```

Cancellation can happen before closure:

```text
Draft / Confirmed / Assigned / Running -> Cancelled
```

Closed booking should not remain in current, ongoing, or in-transit lists. Closed bookings should have a separate list/report.

### Lifecycle enforcement

Lifecycle changes are backend-controlled and cannot be made through the
general booking update API:

- Draft → Confirmed through the confirm action.
- Confirmed → Assigned through duty assignment.
- Assigned → Running through duty start.
- Running → Completed through duty completion.
- Draft, Confirmed, Assigned, or Running → Cancelled with a mandatory reason.
- Completed → Closed is handled by the separate booking-closing workflow.

Starting duty requires an assigned active vehicle and driver. Opening and
closing odometer readings are mandatory for own vehicles and optional for
vendor vehicles. A closing reading cannot be lower than its opening reading.
The API calculates actual distance from the two readings.

Lifecycle timestamps, odometer readings, execution remarks, cancellation
details, and the acting tenant user audit record are stored in PostgreSQL.

## Customer And Traveller

Booking should support:

- Individual customer
- Corporate customer
- Travel agent

Customer type and billing customer should be separate fields.

If the customer does not exist, booking form should allow adding a new customer using a modal.

New customer modal should support:

- Individuals
- Corporate
- Travel Agent
- Gender

Gender can be used to prefix traveller display name with Mr or Ms where applicable.

Corporate employees should be linked under the company. If a booking request comes for a new employee of an existing company, the employee should be addable under that company.

## Duty Assignment

Booking can be assigned to:

- Own vehicle
- Vendor vehicle

Assignment source should drive closure and profit logic.

Own vehicle assignment:

- `vehicle_id` references an `OWN` central Vehicle with no Vendor.
- `driver_id` references an `OWN` central Driver with no Vendor.
- `vendor_id` is null.

Vendor vehicle assignment:

- Vehicle and Driver reference central VENDOR resources.
- Both resources must belong to the assigned Vendor by default.
- Vendor rate and vendor payable should be captured.

Vendor rates are separate from customer billing rates.

## Unified Resource Rule

Duty assignment stores `vehicle_id`, `driver_id`, and nullable `vendor_id`.
It must not introduce separate own/vendor ID columns. Vehicle ownership uses
`ownership_type`; Driver engagement uses `engagement_type`. If both selected
resources are Vendor-linked, they must belong to the same Vendor unless a
separate cross-Vendor workflow is explicitly approved.

## Booking Closure

Closure is used after trip completion to calculate customer billing and profit.

Closure sections:

- Booking Summary
- Trip Running Details
- Recoverable Charges
- Customer Billing Summary
- Profit Calculation
- Closing Notes

Booking Summary may collapse after page load to reduce screen space, with manual expand/collapse.

## KM Calculation

Actual running KM:

```text
Actual Running KM = End KM - Start KM
```

Billing KM:

```text
Billing KM = max(Actual Running KM, Minimum Billing KM)
```

For outstation:

```text
Minimum Billing KM = Number of Days * Minimum KM Per Day
```

Example:

- Booking duration: 3 days
- Minimum KM per day: 250
- Minimum billing KM: 750
- Actual running KM: 450
- Billing KM: 750

If actual running KM is 1350, billing KM is 1350.

## Recoverable Charges

Recoverable charges are billed to customer but should not reduce vehicle profit.

Examples:

- Toll
- Parking
- State tax
- Entry fee
- Driver night allowance / DA when billed to customer

These charges are pass-through charges.

## Customer Billing Summary

Closure should show a simple rough/diary-style customer billing summary that can be shared on WhatsApp.

The rough billing summary should show only non-zero lines.

Recommended line sequence:

- Total/Billing KM
- Rate per KM
- Toll tax
- Parking
- Driver night
- Other recoverable charges
- Total payable

GST and base fare should not be shown in the rough diary summary unless explicitly needed.

The formal invoice handles GST and final tax calculation.

## Profit Calculation

Own vehicle booking profit:

```text
Vehicle Revenue = Base Fare / Package Fare only
Net Vehicle Profit = Vehicle Revenue - Fuel Cost - Maintenance - Driver Cost - Allocated Office Expense
```

Do not deduct:

- Toll
- Parking
- State tax
- Entry fee
- Recoverable driver night / DA
- GST

Vendor vehicle booking profit:

```text
Vendor Booking Profit = Customer Base Fare - Vendor Payable Amount
```

Vendor booking profit must not be mixed with own vehicle profit.

## Status Transition Rules

Close Booking action should be available when booking status is:

- Confirmed
- Assigned
- Completed

Collection action should show after invoice or bill amount exists.

Profit action should show after booking is closed.

Closed bookings should be visible in closed booking lists and profit reports.

## Implemented Backend APIs

The initial database-backed Booking and Duty Assignment APIs are:

```text
GET    /api/v1/tenant/bookings/settings
PATCH  /api/v1/tenant/bookings/settings
GET    /api/v1/tenant/bookings
POST   /api/v1/tenant/bookings
GET    /api/v1/tenant/bookings/:bookingId
PATCH  /api/v1/tenant/bookings/:bookingId
DELETE /api/v1/tenant/bookings/:bookingId
PATCH  /api/v1/tenant/bookings/:bookingId/assignment
PATCH  /api/v1/tenant/bookings/:bookingId/confirm
PATCH  /api/v1/tenant/bookings/:bookingId/duty/start
PATCH  /api/v1/tenant/bookings/:bookingId/duty/complete
PATCH  /api/v1/tenant/bookings/:bookingId/cancel
POST   /api/v1/tenant/bookings/:bookingId/close
GET    /api/v1/tenant/bookings/:bookingId/profit
POST   /api/v1/tenant/bookings/:bookingId/collections
PATCH  /api/v1/tenant/bookings/:bookingId/collections/:collectionId/verify
DELETE /api/v1/tenant/bookings/:bookingId/collections/:collectionId
```

The assignment service validates tenant ownership, OWN/VENDOR classification,
same-Vendor consistency, active resources, and overlapping assigned/running
duties.

Bookings should store:

- tenant_id
- booking_id
- customer_id
- traveller_id
- booking_type
- booking_package
- service_city
- start_date
- end_date
- pickup_reporting_time
- from_location
- to_location
- requested_vehicle_type
- assignment_source
- vendor_id
- vehicle_id
- driver_id
- customer_rate
- vendor_rate
- vendor_payable_amount
- status
- confirmed_at
- assigned_at
- duty_started_at
- duty_completed_at
- opening_odometer
- closing_odometer
- duty_start_remarks
- duty_completion_remarks
- cancelled_at
- cancellation_reason
- created_at
- updated_at

Booking closure is persisted separately as an immutable billing and profitability
snapshot. Closing creates one draft invoice in the same database transaction.
Collections are separate records and never overwrite the closure totals.
