# Dashboard vehicle performance

The Top 10 Most Profitable Vehicles table uses tenant-scoped server aggregation
across finalized CLOSED bookings, ordered by net profit with stable vehicle/ID ties.
It does not use the customer rate or the dashboard's capped booking list.

- Revenue = closure total bill − toll − parking − driver allowance.
- Fuel cost = closing diesel cost + additional unlinked vehicle fuel expenses.
- Vehicle expenses = closing direct vehicle expenses + unlinked maintenance expenses.
- Driver cost = closing driver cost + unlinked driver-payment expenses.
- Other costs = office allocation + vendor payable less the same excluded charges,
  plus unlinked vehicle office/other expenses.
- Net profit = revenue − all four cost columns.
- Profit percentage = net profit / revenue × 100; unavailable when revenue is zero.

Only the three specified charges are removed from total billing: GST and other
recoverable charges remain included under this requested dashboard rule.
Driver-collection fuel is already represented by closing diesel cost and is not
added a second time. Booking-linked Accounts expenses are not added again; closure
costs are the source for bookings, consistent with the existing vehicle ledger.
Unlinked vehicle expenses use their assigned vehicle, never a shared allocation.

Unclosed bookings and cancelled/deleted bookings are excluded. Historical closure
records without available profit data are excluded and a Partial indicator appears
on affected included vehicles. Vehicles with no recorded revenue or standalone
expense activity do not appear. Negative profits remain visible when in the top ten.

Endpoint: `GET /api/v1/tenant/dashboard/vehicle-performance`, requires `reports.view`.
This changes the dashboard table only; it does not rewrite invoices or stored closure
profits. Other reports retain their existing calculation rules.

The table defaults to Own Vehicle. `ownership=OWN|VENDOR` filters the vehicle
master's ownership before ranking; omitting it defaults to OWN. Vendor columns
show billing revenue, vendor payable excluding the three recoverable charges,
company-paid fuel, additional costs, profit/commission, and profit percentage.
Additional costs combine recorded maintenance, driver and office/other costs;
vendor payable is displayed separately. Switching ownership reloads the table.

The default date range is the current company month through today. Optional
`start=YYYY-MM-DD&end=YYYY-MM-DD` parameters must be supplied together. Both
boundaries are inclusive. Booking totals use service start date; unlinked vehicle
expenses use transaction date. The header calendar filters both ownership views;
switching ownership retains the selected range. Reset restores month to date.
