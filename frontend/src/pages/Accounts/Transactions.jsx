import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { createMockRecord, getMockData } from '../../services/api'
import { FilterBar, Section, StatusBadge, SummaryCard, TableShell, fieldClass, money, toNumber } from './accountUtils'

const transactionTypes = [
  'Fund Release',
  'Expense',
  'Adjustment',
  'Fund Return',
  'Driver Advance',
  'Driver Recovery',
  'Partner Withdrawal',
  'Owner Withdrawal',
  'Employee Advance',
]

const categories = [
  'Fuel',
  'Vehicle Service / Maintenance',
  'Driver Payment',
  'Office Expense',
  'Employee Advance',
  'Partner / Owner Withdrawal',
  'Recoverable Trip Charge',
  'Other',
]

function getDirection(type) {
  if (type === 'Fund Release' || type === 'Driver Recovery') return 'Credit'
  return 'Debit'
}

function getLedgerImpact(values) {
  if (values.category === 'Fuel') return ['Manager Ledger Debit', 'Vehicle Ledger Debit', values.bookingId ? 'Booking Profit Link' : '']
  if (values.category === 'Vehicle Service / Maintenance') return ['Manager Ledger Debit', 'Vehicle Ledger Maintenance Cost']
  if (values.category === 'Driver Payment') return ['Manager Ledger Debit', 'Driver Ledger Update', values.vehicle ? 'Vehicle Ledger Driver Cost' : '']
  if (values.category === 'Office Expense') return ['Manager Ledger Debit', 'Office Ledger Debit', 'Vehicle Allocation Later']
  if (values.category === 'Employee Advance') return ['Manager Ledger Debit', 'Employee Ledger Debit']
  if (values.category === 'Partner / Owner Withdrawal') return ['Manager Ledger Debit', 'Partner Ledger Debit']
  if (values.category === 'Recoverable Trip Charge') return ['Manager Ledger Debit', 'Recoverable Charge', 'No Vehicle Profit Reduction']
  if (values.transactionType === 'Fund Release') return ['Manager Ledger Credit']
  if (values.transactionType === 'Fund Return') return ['Manager Ledger Debit', 'Company Bank Credit']
  return [`Manager Ledger ${getDirection(values.transactionType)}`]
}

function TransactionsPage() {
  const [transactions, setTransactions] = useState(() => getMockData('accountsTransactions'))
  const managers = useMemo(() => getMockData('managers'), [])
  const vehicles = useMemo(() => getMockData('vehicles'), [])
  const drivers = useMemo(() => getMockData('drivers'), [])
  const employees = useMemo(() => getMockData('employees'), [])
  const partners = useMemo(() => getMockData('partners'), [])
  const bookings = useMemo(() => getMockData('bookings'), [])
  const locations = useMemo(() => getMockData('locations'), [])
  const [search, setSearch] = useState('')

  const { control, register, reset, setValue, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      transactionDate: new Date().toISOString().slice(0, 10),
      manager: '',
      location: '',
      transactionType: 'Expense',
      paymentMode: 'Cash',
      amount: '',
      purpose: '',
      category: 'Fuel',
      referenceNumber: '',
      vehicle: '',
      bookingId: '',
      driver: '',
      employee: '',
      partner: '',
      fuelType: 'Diesel',
      fuelQuantity: '',
      ratePerLitre: '',
      odometerReading: '',
      serviceType: 'Repair',
      vendor: '',
      paymentType: 'Salary',
      allocationMethod: 'Not Allocated',
      withdrawalType: '',
      remarks: '',
      attachmentName: '',
    },
  })

  const values = useWatch({ control })
  const filteredTransactions = transactions.filter((transaction) =>
    [
      transaction.manager,
      transaction.transactionType,
      transaction.category,
      transaction.purpose,
      transaction.vehicle,
      transaction.bookingId,
      transaction.driver,
      transaction.referenceNumber,
      transaction.status,
    ]
      .join(' ')
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  )
  const totalCredit = transactions.filter((item) => getDirection(item.transactionType) === 'Credit').reduce((sum, item) => sum + toNumber(item.amount), 0)
  const totalDebit = transactions.filter((item) => getDirection(item.transactionType) === 'Debit').reduce((sum, item) => sum + toNumber(item.amount), 0)

  function addTransaction(formValues) {
    const ledgerImpact = getLedgerImpact(formValues).filter(Boolean)
    const transaction = {
      id: `TXN-${Date.now()}`,
      ...formValues,
      amount: toNumber(formValues.amount),
      ledgerImpact,
      status: 'Pending Verification',
    }
    createMockRecord('accountsTransactions', transaction)
    setTransactions((current) => [transaction, ...current])
    reset({
      transactionDate: new Date().toISOString().slice(0, 10),
      manager: '',
      location: '',
      transactionType: 'Expense',
      paymentMode: 'Cash',
      amount: '',
      purpose: '',
      category: 'Fuel',
      referenceNumber: '',
      vehicle: '',
      bookingId: '',
      driver: '',
      employee: '',
      partner: '',
      fuelType: 'Diesel',
      fuelQuantity: '',
      ratePerLitre: '',
      odometerReading: '',
      serviceType: 'Repair',
      vendor: '',
      paymentType: 'Salary',
      allocationMethod: 'Not Allocated',
      withdrawalType: '',
      remarks: '',
      attachmentName: '',
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Transactions" value={transactions.length} prefix="" />
        <SummaryCard label="Ledger Credits" value={totalCredit} tone="success" />
        <SummaryCard label="Ledger Debits" value={totalDebit} tone="warning" />
        <SummaryCard label="Net Movement" value={totalCredit - totalDebit} tone={totalCredit - totalDebit >= 0 ? 'success' : 'danger'} />
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={handleSubmit(addTransaction)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Add Transaction</h3>
            <p className="mt-1 text-sm text-slate-500">Operational transactions affect Manager Ledger only. Customer collection stays separate.</p>
          </div>
          <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Save Transaction</button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label>
            <span className="text-sm font-medium text-slate-700">Transaction Date</span>
            <input className={fieldClass} type="date" {...register('transactionDate', { required: 'Date is required' })} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Manager</span>
            <select className={fieldClass} {...register('manager', { required: 'Manager is required' })}>
              <option value="">Select manager</option>
              {managers.map((manager) => <option key={manager.id}>{manager.name}</option>)}
            </select>
            {errors.manager && <p className="mt-1 text-xs text-rose-600">{errors.manager.message}</p>}
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Location</span>
            <select className={fieldClass} {...register('location')}>
              <option value="">Select location</option>
              {locations.map((location) => <option key={location.id}>{location.name}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Transaction Type</span>
            <select className={fieldClass} {...register('transactionType')}>
              {transactionTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Payment Mode</span>
            <select className={fieldClass} {...register('paymentMode')}>
              <option>Cash</option>
              <option>UPI</option>
              <option>Bank Transfer</option>
              <option>Card</option>
              <option>Cheque</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Amount</span>
            <input className={fieldClass} type="number" step="0.01" {...register('amount', { required: 'Amount is required', min: 1 })} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Category</span>
            <select className={fieldClass} {...register('category')}>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Reference Number</span>
            <input className={fieldClass} {...register('referenceNumber')} />
          </label>
          <label className="xl:col-span-2">
            <span className="text-sm font-medium text-slate-700">Purpose / Description</span>
            <input className={fieldClass} {...register('purpose', { required: 'Purpose is required' })} />
          </label>

          {['Fuel', 'Vehicle Service / Maintenance'].includes(values.category) && (
            <>
              <label>
                <span className="text-sm font-medium text-slate-700">Vehicle</span>
                <select className={fieldClass} {...register('vehicle', { required: 'Vehicle is required' })}>
                  <option value="">Select vehicle</option>
                  {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.plate}>{vehicle.type} - {vehicle.plate}</option>)}
                </select>
                {errors.vehicle && <p className="mt-1 text-xs text-rose-600">{errors.vehicle.message}</p>}
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">Odometer Reading</span>
                <input className={fieldClass} {...register('odometerReading')} />
              </label>
            </>
          )}

          {values.category === 'Fuel' && (
            <>
              <label>
                <span className="text-sm font-medium text-slate-700">Booking ID</span>
                <select className={fieldClass} {...register('bookingId')}>
                  <option value="">Optional</option>
                  {bookings.map((booking) => <option key={booking.id}>{booking.id}</option>)}
                </select>
              </label>
              <label>
                <span className="text-sm font-medium text-slate-700">Fuel Type</span>
                <select className={fieldClass} {...register('fuelType', { required: true })}>
                  <option>Diesel</option>
                  <option>Petrol</option>
                  <option>CNG</option>
                </select>
              </label>
              <label><span className="text-sm font-medium text-slate-700">Fuel Quantity</span><input className={fieldClass} type="number" step="0.01" {...register('fuelQuantity')} /></label>
              <label><span className="text-sm font-medium text-slate-700">Rate Per Litre</span><input className={fieldClass} type="number" step="0.01" {...register('ratePerLitre')} /></label>
            </>
          )}

          {values.category === 'Vehicle Service / Maintenance' && (
            <>
              <label>
                <span className="text-sm font-medium text-slate-700">Service Type</span>
                <select className={fieldClass} {...register('serviceType', { required: true })}>
                  {['Repair', 'Service', 'Tyre', 'Battery', 'Insurance', 'PUC', 'Permit', 'Fitness', 'Other'].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label><span className="text-sm font-medium text-slate-700">Vendor</span><input className={fieldClass} {...register('vendor')} /></label>
            </>
          )}

          {values.category === 'Driver Payment' && (
            <>
              <label>
                <span className="text-sm font-medium text-slate-700">Driver</span>
                <select className={fieldClass} {...register('driver', { required: 'Driver is required' })}>
                  <option value="">Select driver</option>
                  {drivers.map((driver) => <option key={driver.id}>{driver.name}</option>)}
                </select>
              </label>
              <label><span className="text-sm font-medium text-slate-700">Vehicle</span><select className={fieldClass} {...register('vehicle')}><option value="">Recommended</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.plate}>{vehicle.plate}</option>)}</select></label>
              <label><span className="text-sm font-medium text-slate-700">Payment Type</span><select className={fieldClass} {...register('paymentType')}>{['Salary', 'Advance', 'Recovery', 'Allowance', 'Incentive'].map((item) => <option key={item}>{item}</option>)}</select></label>
            </>
          )}

          {values.category === 'Office Expense' && (
            <>
              <label><span className="text-sm font-medium text-slate-700">Location</span><select className={fieldClass} {...register('location', { required: 'Location is required' })}><option value="">Select location</option>{locations.map((location) => <option key={location.id}>{location.name}</option>)}</select></label>
              <label><span className="text-sm font-medium text-slate-700">Allocation Method</span><select className={fieldClass} {...register('allocationMethod')}><option>Not Allocated</option><option>Equal Split Across Active Vehicles</option><option>Revenue Based Allocation</option><option>KM Based Allocation</option></select></label>
            </>
          )}

          {values.category === 'Employee Advance' && (
            <label><span className="text-sm font-medium text-slate-700">Employee</span><select className={fieldClass} {...register('employee', { required: true })}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id}>{employee.name}</option>)}</select></label>
          )}

          {values.category === 'Partner / Owner Withdrawal' && (
            <>
              <label><span className="text-sm font-medium text-slate-700">Partner / Owner</span><select className={fieldClass} {...register('partner', { required: true })}><option value="">Select partner / owner</option>{partners.map((partner) => <option key={partner.id}>{partner.name}</option>)}</select></label>
              <label><span className="text-sm font-medium text-slate-700">Withdrawal Type</span><select className={fieldClass} {...register('withdrawalType')}><option>Personal</option><option>Against Vehicle</option><option>Profit Share</option><option>Adjustment</option></select></label>
            </>
          )}

          {values.category === 'Recoverable Trip Charge' && (
            <>
              <label><span className="text-sm font-medium text-slate-700">Booking ID</span><select className={fieldClass} {...register('bookingId', { required: 'Booking is required' })}><option value="">Select booking</option>{bookings.map((booking) => <option key={booking.id}>{booking.id}</option>)}</select></label>
              <label><span className="text-sm font-medium text-slate-700">Vehicle</span><select className={fieldClass} {...register('vehicle')}><option value="">Optional</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.plate}>{vehicle.plate}</option>)}</select></label>
            </>
          )}

          <label className="md:col-span-2"><span className="text-sm font-medium text-slate-700">Remarks</span><textarea className={`${fieldClass} min-h-20 resize-y`} {...register('remarks')} /></label>
          <label><span className="text-sm font-medium text-slate-700">Attachment Upload</span><input className="mt-2 block w-full text-sm text-slate-600" type="file" onChange={(event) => setValue('attachmentName', event.target.files?.[0]?.name || '')} /></label>
        </div>
      </form>

      <Section title="Transactions" actions={<FilterBar search={search} onSearch={setSearch} />}>
        <TableShell columns={['Date', 'Manager', 'Type', 'Payment Mode', 'Category', 'Purpose', 'Vehicle', 'Booking ID', 'Amount', 'Ledger Impact', 'Status']} minWidth="1400px" empty={filteredTransactions.length === 0}>
          {filteredTransactions.map((transaction) => (
            <tr key={transaction.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-600">{transaction.transactionDate}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">{transaction.manager}</td>
              <td className="px-4 py-3 text-slate-600">{transaction.transactionType}</td>
              <td className="px-4 py-3 text-slate-600">{transaction.paymentMode}</td>
              <td className="px-4 py-3 text-slate-600">{transaction.category}</td>
              <td className="px-4 py-3 text-slate-600">{transaction.purpose}</td>
              <td className="px-4 py-3 text-slate-600">{transaction.vehicle || '-'}</td>
              <td className="px-4 py-3 text-slate-600">{transaction.bookingId || '-'}</td>
              <td className={`px-4 py-3 font-semibold ${getDirection(transaction.transactionType) === 'Credit' ? 'text-emerald-700' : 'text-rose-700'}`}>₹ {money(transaction.amount)}</td>
              <td className="px-4 py-3 text-slate-600">{(transaction.ledgerImpact || []).join(', ')}</td>
              <td className="px-4 py-3"><StatusBadge status={transaction.status} /></td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  )
}

export default TransactionsPage
