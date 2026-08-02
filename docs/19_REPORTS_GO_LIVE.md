# Reports Go-Live

## Scope

The first production release supports exactly:

1. Business Summary
2. Booking Register
3. Invoice Register
4. Outstanding Invoices
5. Expense Register
6. Vehicle Utilization
7. Vendor Duty Report

Fuel, maintenance, accident, document-expiry, fleet-health, and extended ledger
reports are outside this release because their complete authoritative source
modules are not yet available.

## Access

- Tenant route: `/reports`
- API root: `/api/v1/tenant/reports`
- Required permission: `reports.view`
- Tenant identity is derived only from the authenticated request.
- Report access remains read-only for subscriptions in restricted-read mode.

The permission is assigned by migration to Super Admin, Admin, Operations
Manager, Accountant, and Fleet Manager system roles. Custom roles can receive
it through normal role management.

## Workflow

1. User selects one report from the approved catalog.
2. User optionally filters by date, customer, Vendor, Vehicle, assignment
   source, or search text.
3. Backend validates every filter and scopes every query to the authenticated
   tenant.
4. Backend derives rows and summary values from the authoritative transaction
   tables.
5. UI displays generation time, summary cards, detailed rows, and pagination.
6. User can drill into Bookings or Invoices.
7. User can print or export the displayed result to CSV.

## Authoritative Sources

| Report               | Sources and rules                                                 |
| -------------------- | ----------------------------------------------------------------- |
| Business Summary     | Approved report aggregates below                                  |
| Booking Register     | Non-deleted Bookings and Booking Closure economics                |
| Invoice Register     | Tenant Invoices and non-void Booking Collections                  |
| Outstanding Invoices | Generated Invoices minus non-void Collections                     |
| Expense Register     | Account Transactions where type is EXPENSE and direction is DEBIT |
| Vehicle Utilization  | OWN, non-deleted Vehicles and non-cancelled duties                |
| Vendor Duty          | VENDOR-assigned Bookings, Vendor, and closure payable snapshots   |

Cancelled financial and operational records are excluded where the report
definition requires authoritative posted activity. Draft invoices appear in
the Invoice Register but never in Outstanding Invoices.

## API

```text
GET /tenant/reports/catalog
GET /tenant/reports/options
GET /tenant/reports/:reportKey
```

Common query parameters:

```text
dateFrom
dateTo
status
customerId
vendorId
vehicleId
assignmentSource
search
page
limit
```

The maximum page size is 500. Invalid report keys, UUIDs, date ranges, enum
values, and page sizes return the standardized validation response.

## Export Safety

CSV values are quoted and escaped. Values beginning with spreadsheet formula
characters are prefixed before export to prevent CSV formula execution.

## Acceptance

- A user without `reports.view` receives `403`.
- Cross-tenant identifiers never return another tenant's records.
- Date ranges apply to the authoritative business date for each report.
- Vehicle Utilization includes OWN Vehicles only.
- Vendor Duty includes VENDOR assignments only.
- Outstanding never becomes negative.
- Empty results remain valid reports with zero summaries.
- Loading, error, empty, pagination, print, and CSV states are supported.
