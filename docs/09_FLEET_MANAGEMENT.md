# Fleet Management Module

## Purpose

The Fleet Management module is responsible for managing and maintaining the company's **own fleet of vehicles** throughout their operational lifecycle.

This module helps monitor vehicle health, maintenance, operational costs, document validity, and service schedules to ensure maximum vehicle availability and compliance.

> **Important**
>
> The Fleet module manages **only tenant-owned vehicles**.
>
> Vendor vehicles are managed under the **Resources → Vendors** module and are **not** part of Fleet Management unless explicitly supported in future releases.
>
> Both OWN and VENDOR vehicles remain records in the unified central Vehicle
> master defined by `17_OWN_AND_VENDOR_RESOURCE_ARCHITECTURE.md`. Fleet
> workflows must select only records with `ownership_type = OWN`.

---

# Objectives

- Maintain complete lifecycle of company-owned vehicles.
- Record vehicle operating costs.
- Track maintenance history.
- Monitor fuel consumption and mileage.
- Manage legal document renewals.
- Improve fleet utilization.
- Reduce unexpected vehicle breakdowns.
- Generate fleet performance reports.

---

# Module Structure

```text
Fleet Management
│
├── Vehicle Log
├── Fuel Log
├── Maintenance
├── Service Schedule
├── Documents & Renewals
├── Accident & Damage
└── Fleet Dashboard
```

---

# 1. Vehicle Log

## Purpose

Maintains operational history of every company vehicle.

### Information Stored

- Vehicle
- Date
- Opening Odometer
- Closing Odometer
- Distance Travelled
- Booking Reference
- Driver
- Remarks

### Typical Uses

- Daily vehicle utilization
- Kilometer tracking
- Vehicle movement history
- Idle vehicle analysis

---

# 2. Fuel Log

## Purpose

Maintain complete fuel history of every vehicle.

### Information Stored

- Vehicle
- Fuel Date
- Fuel Station
- Quantity (Litres)
- Amount
- Odometer Reading
- Payment Mode
- Invoice/Bill
- Filled By

### Calculations

- Mileage
- Fuel Cost per KM
- Monthly Fuel Expense
- Average Fuel Consumption

### Reports

- Vehicle-wise Fuel Expense
- Monthly Fuel Cost
- Fuel Efficiency
- Mileage Trends

---

# 3. Maintenance

## Purpose

Maintain repair and maintenance records.

### Maintenance Types

- General Service
- Oil Change
- Brake Service
- Clutch Repair
- Suspension
- Engine Repair
- AC Repair
- Electrical
- Tyre Replacement
- Battery Replacement
- Washing & Detailing
- Other Repairs

### Information Stored

- Vehicle
- Service Date
- Vendor / Workshop
- Work Performed
- Parts Changed
- Labour Charges
- Total Cost
- Next Service Due
- Invoice Attachment

### Reports

- Maintenance Cost by Vehicle
- Monthly Maintenance Cost
- Repair Frequency
- Lifetime Maintenance Cost

---

# 4. Service Schedule

## Purpose

Automatically remind users about upcoming periodic services.

### Service Types

- Engine Oil
- General Service
- Wheel Alignment
- Wheel Balancing
- Brake Inspection
- Air Filter
- AC Service
- Gear Oil
- Coolant
- Transmission Service

### Trigger Methods

- Every X Kilometers
- Every X Months
- Fixed Date

### Reminder Levels

- Upcoming
- Due Today
- Overdue

---

# 5. Documents & Renewals

## Purpose

Track expiry of all mandatory vehicle documents.

### Documents

- Registration Certificate (RC)
- Commercial Permit
- Insurance
- Fitness Certificate
- Pollution Certificate (PUC)
- Road Tax
- FASTag (Optional)
- GPS Subscription (Optional)

### Information Stored

- Issue Date
- Expiry Date
- Renewal Date
- Renewal Cost
- Uploaded Copy
- Reminder Before Expiry

### Notifications

- 30 Days Before
- 15 Days Before
- 7 Days Before
- Expired

---

# 6. Accident & Damage

## Purpose

Maintain accident history and insurance claims.

### Information Stored

- Vehicle
- Driver
- Accident Date
- Location
- Description
- Damage Details
- FIR Number
- Insurance Claim Number
- Repair Cost
- Settlement Amount
- Images
- Supporting Documents

### Reports

- Accident History
- Vehicle Damage History
- Insurance Claims
- Repair Cost Analysis

---

# Fleet Dashboard

The dashboard should display:

### Fleet Summary

- Total Vehicles
- Active Vehicles
- In Maintenance
- Under Repair
- Available
- On Duty

### Fuel Summary

- Fuel Cost Today
- Fuel Cost This Month
- Average Mileage

### Maintenance Summary

- Vehicles Due for Service
- Overdue Services
- Maintenance Cost This Month

### Documents

- Insurance Expiring
- Fitness Expiring
- Permit Expiring
- PUC Expiring

### Alerts

- High Fuel Consumption
- Excessive Maintenance
- Vehicles Not Used
- Vehicles with Frequent Breakdowns

---

# Vehicle Lifecycle

```text
Vehicle Purchase
        │
        ▼
Vehicle Registration
        │
        ▼
Document Upload
        │
        ▼
Available for Booking
        │
        ▼
Fuel Entries
        │
        ▼
Maintenance
        │
        ▼
Periodic Service
        │
        ▼
Repair / Accident
        │
        ▼
Back to Operations
        │
        ▼
Retired / Sold
```

---

# Integration

Fleet integrates with:

## Resources

- Vehicles
- Drivers

## Operations

- Bookings
- Duty Assignment

## Accounts

- Fuel Expenses
- Maintenance Expenses
- Vehicle Expenses

## Reports

- Vehicle Profit
- Fuel Analysis
- Maintenance Analysis
- Vehicle Ledger

---

# Business Rules

## Vehicle Eligibility

Only vehicles with:

- Active Status
- Valid Insurance
- Valid Fitness
- Valid Permit
- Valid PUC

can be assigned to a booking.

---

## Maintenance Lock

Vehicles marked as:

- Under Maintenance
- Under Repair

cannot be assigned for new bookings.

---

## Fuel Entries

Fuel entries must:

- Reference a valid vehicle.
- Capture odometer reading.
- Prevent unrealistic mileage calculations.
- Support bill attachment.

---

## Service Reminders

The system should automatically generate reminders based on:

- Date
- Odometer
- Configured service interval

---

## Document Alerts

Expired mandatory documents should generate warnings on:

- Dashboard
- Vehicle Profile
- Booking Assignment Screen

---

# Reports

The Fleet module should support:

- Vehicle Ledger
- Fuel Analysis
- Fuel Cost Report
- Mileage Report
- Maintenance Report
- Vehicle Running Cost
- Document Expiry Report
- Accident Report
- Vehicle Utilization Report
- Fleet Health Dashboard

---

# Future Enhancements

- GPS Tracking
- Live Vehicle Location
- Trip Replay
- Driver Behaviour Analysis
- Tyre Lifecycle
- Battery Lifecycle
- FASTag Auto Import
- Fuel Card Integration
- Predictive Maintenance
- Mobile Inspection Checklist
- QR Code Vehicle Inspection

---

# Design Principles

- Fleet manages only company-owned vehicles.
- Vendor vehicles remain under Vendor Management.
- Fleet expenses directly impact vehicle profitability.
- All actions must be tenant-specific.
- Every fleet transaction must be auditable.
- Support document uploads for all vehicle records.
- Use soft delete wherever applicable.
- Follow the existing modular architecture and coding standards.

---

# Version

Module Version: 1.0

Status: Approved

Owner: Cablix ERP Architecture

Last Updated: July 2026
