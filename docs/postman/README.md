# Cablix Postman Collection

Import both JSON files in this directory into Postman and select the **Cablix Local** environment.

Set `login_password` to the local administrator password from `backend/.env`.
Set `tenant_owner_password` and `tenant_new_user_password` to strong test
passwords of at least 12 characters. Passwords are intentionally excluded from
source control.

Suggested Phase 1 run order:

1. **Authentication APIs / Login**
2. **Platform APIs / Subscription Plans / Create Subscription Plan**
3. **Platform APIs / Tenants / Register Tenant**
4. **Platform APIs / Tenants / Activate Tenant**
5. Change `login_email` and `login_password` to the new owner credentials.
6. **Authentication APIs / Login**
7. **Tenant APIs / Get Tenant Context**

Suggested Phase 3 run order after tenant activation and owner login:

1. Update Company Profile, Tax Settings, and Invoice Settings.
2. Create Location.
3. Create Bank Account.
4. Create GST Registration.
5. List Permissions.
6. Create Role, then Create Tenant User.
7. Get Onboarding Status. It becomes `COMPLETED` after all five setup checklist
   items have been persisted.

Suggested Phase 4 Customer module run order:

1. **Tenant APIs / Customers / Create Customer**
2. **Get Customer** and **Update Customer**
3. **Add Customer Traveller**, then Get and Update Employee as needed.
4. **List Customers** to test search and filters
5. Customers and employees are permanent after creation; deletion is not
   available.

Suggested Vendor module run order:

1. Create Vendor.
2. Create and Update Vendor Vehicle.
3. Create and Update Vendor Driver.
4. List/Get Vendor to verify relationships.
5. Delete child records before Delete Vendor.

Suggested unified resource run order:

1. Create a Vendor and a nested Vendor Vehicle so a Vehicle Type exists.
2. List Vehicle Types, then Create Own Vehicle.
3. List Own and Vendor Vehicles to verify the central filters.
4. Create Own Driver.
5. List Own and Vendor Drivers to verify the central filters.
6. Confirm Vendor-profile resources are the same IDs returned by central APIs.

Suggested booking financial lifecycle run order:

1. Create, confirm, assign, start, and complete a booking.
2. Close Booking; this persists the closure/profit snapshot and draft invoice.
3. Get Booking Profit.
4. Add Collection, then Verify Collection (or Void it when testing corrections).
5. List Invoices and Generate Invoice.
6. Get Invoice to verify the generated number and display snapshot.

Suggested Accounts Step 1 run order:

1. Get Accounts Foundation to verify the current user's authorized navigation,
   enums, and financial record policies.
2. Validate Account Reference with a new reference.
3. Repeat with a reference already used by a booking collection to verify that
   tenant-scoped duplication is detected.

Suggested Accounts Step 2 run order:

1. Close a booking and add one or more partial collections.
2. List Account Collections with date, payment mode, status, booking, and
   customer filters.
3. Get Collection Receipt using `collection_id`.
4. Attempt another collection with the same payment/deposit reference and
   confirm the API returns `DUPLICATE_REFERENCE`.
5. Verify the collection and get the receipt again to inspect its audit trail.
6. Void the collection and confirm its reference remains reserved.

Suggested Accounts Step 3 run order:

1. Add a cash-mode booking collection; its cash-deposit tracking record is
   created automatically.
2. List Cash Deposits and copy the generated `cash_deposit_id`.
3. Assign Cash to Receiver Manager.
4. Record Company Bank Deposit with amount, mode, bank reference, and optional
   attachment name.
5. Verify Bank Credit. Use a smaller verified amount plus a mismatch reason to
   test the Mismatch path.
6. Get Cash Deposit Detail to inspect its complete audit trail.

Suggested Accounts Step 4 run order:

1. Ensure `tenant_user_id` identifies an active manager/admin/accountant and
   `location_id` identifies an active tenant location.
2. Create Manager Ledger; the response stores `manager_ledger_id`.
3. List Manager Ledgers and test manager, location, status, and search filters.
4. Get Manager Ledger Detail to verify its opening entry and running balance.
5. Update Manager Ledger Status to `INACTIVE`, then retrieve detail again to
   inspect the audit event.
6. Repeat creation for the same manager/location and confirm
   `MANAGER_LEDGER_EXISTS`.

Suggested Accounts Step 5 run order:

1. Create or select an active manager ledger and copy `manager_ledger_id`.
2. Create Company Fund Release; the response stores `fund_release_id`.
3. Get Fund Release Detail to inspect released-by, verification, ledger-entry,
   and audit data.
4. List Fund Releases with ledger, date, payment-mode, status, or search
   filters.
5. Get Manager Ledger Detail and confirm credits/current balance increased.
6. Submit the same reference again and confirm `DUPLICATE_REFERENCE` without a
   second ledger credit.

Create and registration requests automatically store `plan_id`, `tenant_id`,
`subscription_id`, and Phase 3 record IDs for subsequent requests. Change unique
plan, tenant, role, user email, account number, and GSTIN values before rerunning
their create requests.

The collection follows the approved API boundaries: Public, Authentication, Platform, and Tenant. Every new backend endpoint must be added to its corresponding folder when it is implemented.
