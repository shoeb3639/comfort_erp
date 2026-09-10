# Independent dashboard card filters

Each Business Overview card has a calendar button alongside its existing icon.
Filters default to today in the company timezone and apply only to that card.
Presets include Today, Yesterday, This Month (to date), and This Year (to date).
Custom ranges include both start and end dates. Reset returns the card to today.
Filters last while the dashboard is open; reloading resets them.

Activity cards use a date range. Pending Collections and Manager Ledger Balance
use an as-of date because they include balances carried forward from earlier dates.

| Card | Date basis and amount |
| --- | --- |
| Bookings | Service start date; excludes cancelled/deleted bookings |
| Revenue | Invoice date; net payable including drafts, excluding cancellations |
| Collections | Collection date; cash/UPI/bank customer payments, including driver-held money, excluding voids and driver returns |
| Expenses | Expense transaction date plus collection-date fuel spending; excludes void collections |
| Business Profit | Service start date; own closure net vehicle profit plus vendor booking profit/commission, with both amounts shown separately; excludes missing historical profit |
| Pending Collections | All invoices through the end date less payments through that date, clamped per invoice to zero; cancellation and void timestamps respected |
| Cash Pending Deposit | Cash collected in the range still awaiting deposit or verification now, less recorded fuel spending and returns; this is not a historical cash custody snapshot |
| Manager Ledger Balance | Opening balances plus dated ledger movements through the end date, without double-counting opening entries |

`GET /api/v1/tenant/dashboard/card?metric=bookings&start=YYYY-MM-DD&end=YYYY-MM-DD`
requires `reports.view` and tenant authentication. Allowed metric keys are
`bookings`, `revenue`, `collections`, `expenses`, `profit`, `pending`, `cash`,
and `manager`. Server aggregation covers all matching records, independently
of the record lists loaded elsewhere on the dashboard. Queries are parameterized.

Historical balance calculations use invoice amounts and ledger opening balances
currently stored, not immutable snapshots of subsequent edits.
