# Customer payments held by drivers

A customer payment and the driver's use of that money are separate records.
For a ₹10,000 booking, a ₹3,000 payment reduces the customer's outstanding
balance to ₹7,000. If the driver uses ₹2,500 for fuel, the driver holds ₹500.
Receiving that ₹500 back does not create a second customer collection.

## Closing a booking

1. Under **Payment at Closing**, select **Driver** as the payment recipient.
   This applies to cash, the driver's UPI account, or the driver's bank account.
   Select **Company / Office** for payments received directly by the company.
2. Enter the full amount paid, payment date, mode, reference and driver's name
   in **Collected By**. A driver must be assigned to the booking; their ID and
   name are retained so the balance appears in the correct driver's accounts.
3. Enter **Fuel spent from this payment**. This cannot exceed the payment.
4. Upload the actual fuel receipt (PDF, JPEG, PNG or WebP). Upload must finish
   before closing. The server checks that the file belongs to this booking
   and tenant and is a fuel receipt.
5. Review total diesel cost and the calculated driver balance, then close.

Fuel allocation is part of total diesel cost, not a second expense. For hired
vehicles it is included in vendor deduction and recorded as fuel cost when
calculating vendor profit, preventing the deduction from inflating profit.

## Receiving money back and verification

Open **Accounts → Collections → View**, or the booking's Collections page.
The driver settlement section displays payment, fuel expense, returned funds,
remaining driver balance and the downloadable receipt.

An accounts user with `accounts.deposit.manage` records actual receipt into
company cash, UPI or bank with date, amount and a unique handover/transaction
reference. Partial returns are supported. Each return records the receiving
user and details in the collection audit trail. The form records a completed
handover; it does not initiate a bank transfer.

After all remaining funds have been received, Accounts reviews the fuel proof
and verifies the collection. Pending driver balances and unverified settlements
remain visible in Audit & Verification with a link to the collection.
The register shows totals by booking and by driver across the selected bookings.

## Driver Accounts

Open **Drivers → Accounts** next to a driver. The page shows their customer
payments, fuel spent, returns and **Still with driver** balance. Select
**View settlement** to download proof and record a return; the totals refresh
after the return. In the example, the balance moves from ₹500 to ₹300 after a
₹200 return, and to ₹0 after the remaining ₹300 is received.

Existing advance, recovery and expense entries linked to the driver are also
shown. Operating advances remain separate from customer collections, avoiding
double counting. Access requires `driver.view` and `accounts.ledger.view`;
recording returns and verifying still requires `accounts.deposit.manage`.

Driver-held customer payments are excluded from the existing gross cash-deposit
queue: fuel spending is not missing cash. Company handovers are tracked in the
driver settlement and its audit history, separately from manager operating funds.

## Integrity and rollout

- A customer receives credit for the full non-void payment even before settlement.
- Returns cannot exceed the balance. Concurrent returns are serialized, and
  duplicate references cannot create a second return.
- Fuel receipts cannot be reused for another collection or deleted once linked.
- A collection with fuel spending or recorded returns cannot be voided through
  the existing void action, preserving both expense and handover evidence.
- Receipt uploads/downloads use the existing file permissions and storage limits.
- Migration `20260907120000_driver_collection_settlement` adds fields and
  constraints; existing collections retain their previous company/deposit flow.
- Fuel allocation is captured at closing. Later editing of that allocation and
  transferring driver balances between bookings are not part of this workflow.

The integration tests cover Cash, UPI and vendor bookings, receipt retention,
partial/duplicate/concurrent returns, verification and customer balance totals.
