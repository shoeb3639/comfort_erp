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

Create and registration requests automatically store `plan_id`, `tenant_id`,
`subscription_id`, and Phase 3 record IDs for subsequent requests. Change unique
plan, tenant, role, user email, account number, and GSTIN values before rerunning
their create requests.

The collection follows the approved API boundaries: Public, Authentication, Platform, and Tenant. Every new backend endpoint must be added to its corresponding folder when it is implemented.
