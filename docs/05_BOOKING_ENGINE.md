# Booking Engine

Version: 1.0

Status: Approved Living Document

## Purpose

This document defines the booking workflow for Cablix ERP tenant operations.

Bookings are tenant-owned records and must always be scoped by tenant.

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

## Customer And Traveller

Booking should support:

- Retail customer
- Corporate customer
- Travel agent

Customer type and billing customer should be separate fields.

If the customer does not exist, booking form should allow adding a new customer using a modal.

New customer modal should support:

- Retail
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

- Vendor parent should be the tenant's own-company parent record.
- Vehicle ownership should be own.
- Driver ownership should be own unless vendor driver support is explicitly selected later.

Vendor vehicle assignment:

- Vendor parent should be an external vendor.
- Vehicle ownership should be vendor.
- Driver ownership should be vendor or vendor-provided.
- Vendor rate and vendor payable should be captured.

Vendor rates are separate from customer billing rates.

## Vendor Parent Rule

Vendors are parent records for vehicles and drivers.

Each tenant should have one own-company parent record. Own vehicles and own drivers are added under this parent.

External vendors are separate parent records. Vendor vehicles and vendor drivers are added under the selected external vendor.

In UI, display this as `Ownership`.

In backend, store vehicle/driver ownership as `ownership_type`.

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

## Future Backend Notes

Bookings should store:

- tenant_id
- booking_number
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
- created_at
- updated_at
