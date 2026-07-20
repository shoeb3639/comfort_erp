import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { getMockData } from '../../services/api'

const readOnlyClass =
  'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800'

function toNumber(value) {
  if (typeof value === 'number') return value
  return Number(String(value || 0).replace(/[^0-9.-]/g, '')) || 0
}

function money(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function formatLabel(value) {
  return value ? String(value).replaceAll('_', ' ') : '-'
}

function getBillingValues(booking, invoice) {
  const closeDetails = booking?.closeDetails || {}
  const baseFare =
    toNumber(closeDetails.baseFare) ||
    toNumber(invoice?.totals?.taxableAmount) ||
    (booking?.billing_model === 'rate_per_km'
      ? toNumber(booking.estimatedKm) * toNumber(booking.ratePerKm)
      : toNumber(booking?.fixedAmount || booking?.amount))

  const tollTax = toNumber(closeDetails.tollTax)
  const parking = toNumber(closeDetails.parking)
  const driverAllowance = toNumber(closeDetails.driverAllowance)
  const otherRecoverableCharges = toNumber(closeDetails.otherRecoverableCharges)
  const gst = toNumber(closeDetails.gst || invoice?.totals?.totalGst)
  const totalBillAmount =
    toNumber(closeDetails.totalBillAmount) ||
    toNumber(invoice?.totals?.netPayable) ||
    baseFare + tollTax + parking + driverAllowance + otherRecoverableCharges + gst

  return {
    baseFare,
    tollTax,
    parking,
    driverAllowance,
    otherRecoverableCharges,
    gst,
    totalBillAmount,
  }
}

function getProfitValues(booking, billing) {
  const closeDetails = booking?.closeDetails || {}
  const assignmentType = closeDetails.assignmentType || booking?.assignmentType || booking?.assignment_type || 'own_vehicle'
  const isVendorVehicle = assignmentType === 'vendor_vehicle'
  const dieselCost = toNumber(closeDetails.dieselCost)
  const directVehicleExpense = toNumber(closeDetails.directVehicleExpense)
  const driverCost = toNumber(closeDetails.driverCost)
  const vehicleRevenue = isVendorVehicle ? 0 : billing.baseFare
  const netVehicleProfit = isVendorVehicle ? 0 : vehicleRevenue - dieselCost - directVehicleExpense - driverCost
  const vendorPayableAmount = toNumber(closeDetails.vendorPayableAmount || booking?.vendorPayableAmount)
  const vendorExtraCharges = toNumber(closeDetails.vendorExtraCharges)
  const vendorDeduction = toNumber(closeDetails.vendorDeduction)
  const finalVendorPayable =
    toNumber(closeDetails.finalVendorPayable) || vendorPayableAmount + vendorExtraCharges - vendorDeduction
  const vendorBookingProfit = isVendorVehicle ? billing.baseFare - finalVendorPayable : 0
  const netProfit = isVendorVehicle ? vendorBookingProfit : netVehicleProfit
  const profitMargin = billing.baseFare > 0 ? (netProfit / billing.baseFare) * 100 : 0

  return {
    assignmentType,
    isVendorVehicle,
    vehicleRevenue,
    dieselCost,
    directVehicleExpense,
    driverCost,
    netVehicleProfit,
    vendorPayableAmount,
    vendorExtraCharges,
    vendorDeduction,
    finalVendorPayable,
    vendorBookingProfit,
    netProfit,
    profitMargin,
  }
}

function getExpenseRows(booking, expenses, profit) {
  const linkedRows = expenses.filter(
    (expense) =>
      expense.bookingId === booking.id ||
      expense.booking_id === booking.id ||
      expense.vehicle === booking.vehicleRegistrationNo ||
      expense.driver === booking.driver,
  )

  if (linkedRows.length > 0) {
    return linkedRows.map((expense) => ({
      id: expense.id,
      date: expense.date,
      category: expense.category || expense.expenseCategory,
      vehicle: expense.vehicle || booking.vehicleRegistrationNo,
      driver: expense.driver || booking.driver,
      amount: toNumber(expense.amount),
      description: expense.description || expense.vendor || '-',
    }))
  }

  return [
    {
      id: 'MOCK-DIESEL',
      date: booking.closeDetails?.closedAt?.slice(0, 10) || booking.pickupDate,
      category: 'Diesel',
      vehicle: booking.vehicleRegistrationNo,
      driver: booking.driver,
      amount: profit.dieselCost,
      description: 'Diesel cost linked to trip closing',
    },
    {
      id: 'MOCK-VEHICLE-EXPENSE',
      date: booking.closeDetails?.closedAt?.slice(0, 10) || booking.pickupDate,
      category: 'Vehicle Repair',
      vehicle: booking.vehicleRegistrationNo,
      driver: booking.driver,
      amount: profit.directVehicleExpense,
      description: 'Direct vehicle expense linked to booking',
    },
    {
      id: 'MOCK-DRIVER-COST',
      date: booking.closeDetails?.closedAt?.slice(0, 10) || booking.pickupDate,
      category: 'Driver Cost',
      vehicle: booking.vehicleRegistrationNo,
      driver: booking.driver,
      amount: profit.driverCost,
      description: 'Driver cost linked to trip',
    },
  ].filter((expense) => expense.amount > 0)
}

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={readOnlyClass}>{value || '-'}</p>
    </div>
  )
}

function Section({ title, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h4 className="text-base font-semibold text-slate-900">{title}</h4>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function AmountLine({ label, value, strong = false, tone = 'default' }) {
  const toneClass =
    tone === 'profit' && value >= 0
      ? 'text-emerald-700'
      : tone === 'profit'
        ? 'text-rose-700'
        : 'text-slate-950'

  return (
    <div className={`flex items-center justify-between gap-4 py-2 ${strong ? 'border-t border-slate-200 pt-3 text-base font-bold' : 'text-sm'}`}>
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${toneClass}`}>₹ {money(value)}</span>
    </div>
  )
}

function MetricCard({ label, value, suffix = '', tone = 'default' }) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-700'
      : tone === 'danger'
        ? 'text-rose-700'
        : tone === 'warning'
          ? 'text-amber-700'
          : 'text-slate-950'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-bold ${toneClass}`}>{suffix ? `${value}${suffix}` : `₹ ${money(value)}`}</p>
    </div>
  )
}

function BookingProfitPage() {
  const params = useParams()
  const bookingId = params.id || params.bookingId
  const bookings = useMemo(() => getMockData('bookings'), [])
  const customers = useMemo(() => getMockData('customers'), [])
  const travellers = useMemo(() => getMockData('travellers'), [])
  const invoices = useMemo(() => getMockData('invoices'), [])
  const expenses = useMemo(() => getMockData('expenses'), [])
  const booking = bookings.find((item) => item.id === bookingId)

  if (!booking) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Booking not found. <Link className="font-semibold text-brand-600" to="/bookings">Back to bookings</Link>
      </div>
    )
  }

  const customer = customers.find((item) => item.id === booking.billing_customer_id)
  const traveller = travellers.find((item) => item.id === booking.traveller_id)
  const invoice = invoices.find((item) => item.booking === booking.id || item.bookingId === booking.id)
  const billing = getBillingValues(booking, invoice)
  const profit = getProfitValues(booking, billing)
  const totalRecoverableCharges =
    billing.tollTax + billing.parking + billing.driverAllowance + billing.otherRecoverableCharges + billing.gst
  const expenseRows = profit.isVendorVehicle ? [] : getExpenseRows(booking, expenses, profit)
  const route = [booking.pickupLocation, booking.dropLocation || booking.routeStops].filter(Boolean).join(' to ')
  const closingDate = booking.closeDetails?.closedAt?.slice(0, 10)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Total Bill Amount" value={billing.totalBillAmount} />
        <MetricCard label={profit.isVendorVehicle ? 'Vendor Revenue Base' : 'Vehicle Revenue'} value={billing.baseFare} tone="success" />
        <MetricCard label="Total Recoverable Charges" value={totalRecoverableCharges} tone="warning" />
        <MetricCard label={profit.isVendorVehicle ? 'Vendor Payable' : 'Diesel Cost'} value={profit.isVendorVehicle ? profit.finalVendorPayable : profit.dieselCost} tone="danger" />
        <MetricCard label="Net Profit" value={profit.netProfit} tone={profit.netProfit >= 0 ? 'success' : 'danger'} />
        <MetricCard label="Profit Margin" value={profit.profitMargin.toFixed(2)} suffix="%" tone={profit.profitMargin >= 0 ? 'success' : 'danger'} />
      </div>

      <Section title="Booking Summary">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReadOnlyField label="Booking ID" value={booking.id} />
          <ReadOnlyField label="Customer" value={customer?.billingName || customer?.displayName || booking.customer} />
          <ReadOnlyField label="Traveller" value={traveller?.name || booking.customer} />
          <ReadOnlyField label="Vehicle" value={[booking.vehicleType, booking.vehicleRegistrationNo].filter(Boolean).join(' ')} />
          <ReadOnlyField label="Driver" value={booking.driver} />
          <ReadOnlyField label="Assignment Source" value={profit.isVendorVehicle ? 'Vendor Vehicle' : 'Own Vehicle'} />
          {profit.isVendorVehicle && <ReadOnlyField label="Vendor" value={booking.vendor} />}
          <ReadOnlyField label="Service City" value={booking.serviceCity || '-'} />
          <ReadOnlyField label="Route" value={route} />
          <ReadOnlyField label="Trip Type" value={formatLabel(booking.trip_type || booking.booking_type)} />
          <ReadOnlyField label="Start Date" value={booking.startDate || booking.pickupDate} />
          <ReadOnlyField label="End Date" value={booking.endDate || booking.startDate || booking.pickupDate} />
          <ReadOnlyField label="Closing Date" value={closingDate || 'Not closed'} />
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Billing Breakdown">
          <AmountLine label="Base Fare" value={billing.baseFare} />
          <AmountLine label="Toll Tax" value={billing.tollTax} />
          <AmountLine label="Parking" value={billing.parking} />
          <AmountLine label="Driver Allowance" value={billing.driverAllowance} />
          <AmountLine label="Other Recoverable Charges" value={billing.otherRecoverableCharges} />
          <AmountLine label="GST" value={billing.gst} />
          <AmountLine label="Total Bill Amount" value={billing.totalBillAmount} strong />
        </Section>

        {!profit.isVendorVehicle && (
          <Section title="Profit Breakdown">
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Toll Tax, Parking, Driver Allowance and GST are pass-through charges and are not treated as vehicle profit.
            </div>
            <div className="mt-3">
              <AmountLine label="Vehicle Revenue = Base Fare" value={profit.vehicleRevenue} />
              <AmountLine label="Diesel Cost" value={profit.dieselCost} />
              <AmountLine label="Direct Vehicle Expense" value={profit.directVehicleExpense} />
              <AmountLine label="Driver Cost" value={profit.driverCost} />
              <AmountLine label="Net Vehicle Profit" value={profit.netVehicleProfit} strong tone="profit" />
            </div>
          </Section>
        )}

        {profit.isVendorVehicle && (
          <Section title="Vendor Profit Breakdown">
            <div className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
              Vendor booking profit is separate revenue margin and is not included in own vehicle profit.
            </div>
            <div className="mt-3">
              <AmountLine label="Customer Base Fare" value={billing.baseFare} />
              <AmountLine label="Vendor Payable Amount" value={profit.vendorPayableAmount} />
              <AmountLine label="Vendor Extra Charges" value={profit.vendorExtraCharges} />
              <AmountLine label="Vendor Deduction" value={profit.vendorDeduction} />
              <AmountLine label="Final Vendor Payable" value={profit.finalVendorPayable} />
              <AmountLine label="Vendor Booking Profit" value={profit.vendorBookingProfit} strong tone="profit" />
            </div>
          </Section>
        )}
      </div>

      {!profit.isVendorVehicle && <Section title="Expense Linked to Booking">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[900px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Expense Category</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Vehicle</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Driver</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {expenseRows.map((expense) => (
                <tr key={expense.id}>
                  <td className="px-4 py-3 text-slate-600">{expense.date || '-'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{expense.category}</td>
                  <td className="px-4 py-3 text-slate-600">{expense.vehicle || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{expense.driver || '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">₹ {money(expense.amount)}</td>
                  <td className="px-4 py-3 text-slate-600">{expense.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {expenseRows.length === 0 && (
            <div className="bg-white px-4 py-10 text-center text-sm text-slate-500">
              No direct diesel, vehicle expense, or driver cost is linked to this booking yet.
            </div>
          )}
        </div>
      </Section>}

      {profit.isVendorVehicle && (
        <Section title="Vendor Cost Linked to Booking">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[760px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Vendor</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Vehicle</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Driver</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Rate Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Payable</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-900">{booking.vendor || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{booking.vehicleRegistrationNo || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{booking.driver || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{booking.vendorRateType || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">₹ {money(profit.finalVendorPayable)}</td>
                  <td className="px-4 py-3 text-slate-600">{booking.vendorNotes || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Notes">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Closing Remarks</p>
            <p className="mt-2 text-sm text-slate-700">{booking.closeDetails?.remarks || booking.notes || 'No closing remarks added.'}</p>
          </div>
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <ClipboardList size={15} />
              Audit History
            </p>
            <p className="mt-2 text-sm text-slate-600">Audit history will show close, collection, deposit verification, and profit revisions after API integration.</p>
          </div>
        </div>
      </Section>
    </div>
  )
}

export default BookingProfitPage
