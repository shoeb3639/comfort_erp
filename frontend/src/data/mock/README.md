# Mock Data

This folder contains frontend-only JSON seed data used before backend integration.

- `bookings.json`
- `customers.json`
- `travellers.json`
- `vendors.json`
- `drivers.json`
- `vehicles.json`
- `invoices.json`
- `expenses.json`

`src/services/api.js` loads these files and mirrors them into browser `localStorage`.
Forms and list actions can add, edit, or delete records during testing without changing
these source JSON files.

To reset browser test data, clear localStorage keys that start with:

```text
booking_admin_mock_
```
