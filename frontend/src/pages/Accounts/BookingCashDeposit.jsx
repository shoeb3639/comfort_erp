import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { createMockRecord, getMockData, saveMockData } from '../../services/api'
import {
  FilterBar,
  Section,
  StatusBadge,
  SummaryCard,
  TableShell,
  fieldClass,
  money,
  toNumber,
} from './accountUtils'

function BookingCashDepositPage() {
  const [deposits, setDeposits] = useState(() => getMockData('bookingCashDeposits'))
  const bookings = useMemo(() => getMockData('bookings'), [])
  const managers = useMemo(() => getMockData('managers'), [])
  const [search, setSearch] = useState('')
  const {
    register,
    reset,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      bookingId: '',
      collectionDate: new Date().toISOString().slice(0, 10),
      amountCollected: '',
      paymentMode: 'Cash',
      collectedBy: 'Driver',
      receivedByManager: '',
      depositDate: '',
      depositMode: 'Cash Deposit',
      depositReferenceNumber: '',
      depositedBy: '',
      verifiedBy: '',
      remarks: '',
      attachmentName: '',
      depositStatus: 'Collected',
    },
  })

  const filteredDeposits = deposits.filter((deposit) =>
    [deposit.bookingId, deposit.customer, deposit.vehicle, deposit.collectedBy, deposit.receivedByManager, deposit.depositReferenceNumber, deposit.depositStatus]
      .join(' ')
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  )
  const totalCashCollected = deposits.reduce((sum, deposit) => sum + toNumber(deposit.amountCollected), 0)
  const cashWithManager = deposits
    .filter((deposit) => ['Collected', 'With Manager'].includes(deposit.depositStatus))
    .reduce((sum, deposit) => sum + toNumber(deposit.amountCollected), 0)
  const depositedAmount = deposits
    .filter((deposit) => ['Deposited', 'Verified'].includes(deposit.depositStatus))
    .reduce((sum, deposit) => sum + toNumber(deposit.depositedAmount || deposit.amountCollected), 0)
  const verifiedAmount = deposits
    .filter((deposit) => deposit.depositStatus === 'Verified')
    .reduce((sum, deposit) => sum + toNumber(deposit.depositedAmount || deposit.amountCollected), 0)
  const mismatchAmount = deposits
    .filter((deposit) => deposit.depositStatus === 'Mismatch')
    .reduce((sum, deposit) => sum + Math.abs(toNumber(deposit.amountCollected) - toNumber(deposit.depositedAmount)), 0)

  function addDeposit(values) {
    const booking = bookings.find((item) => item.id === values.bookingId)
    const status = values.depositReferenceNumber ? 'Deposited' : values.receivedByManager ? 'With Manager' : 'Collected'
    const record = {
      id: `BCD-${Date.now()}`,
      ...values,
      customer: booking?.customer || '',
      vehicle: booking?.vehicleRegistrationNo || booking?.vehicleType || '',
      amountCollected: toNumber(values.amountCollected),
      depositStatus: status,
    }
    createMockRecord('bookingCashDeposits', record)
    setDeposits((current) => [record, ...current])
    reset({
      bookingId: '',
      collectionDate: new Date().toISOString().slice(0, 10),
      amountCollected: '',
      paymentMode: 'Cash',
      collectedBy: 'Driver',
      receivedByManager: '',
      depositDate: '',
      depositMode: 'Cash Deposit',
      depositReferenceNumber: '',
      depositedBy: '',
      verifiedBy: '',
      remarks: '',
      attachmentName: '',
      depositStatus: 'Collected',
    })
  }

  function verifyDeposit(id) {
    const nextDeposits = deposits.map((deposit) =>
      deposit.id === id ? { ...deposit, depositStatus: 'Verified', verifiedBy: deposit.verifiedBy || 'Accounts' } : deposit,
    )
    saveMockData('bookingCashDeposits', nextDeposits)
    setDeposits(nextDeposits)
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Total Cash Collected" value={totalCashCollected} />
        <SummaryCard label="Cash With Manager" value={cashWithManager} tone="warning" />
        <SummaryCard label="Deposited Amount" value={depositedAmount} tone="success" />
        <SummaryCard label="Verified Amount" value={verifiedAmount} tone="success" />
        <SummaryCard label="Pending Deposit" value={totalCashCollected - depositedAmount} tone="danger" />
        <SummaryCard label="Mismatch Amount" value={mismatchAmount} tone={mismatchAmount > 0 ? 'danger' : 'success'} />
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={handleSubmit(addDeposit)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Add Deposit Entry</h3>
            <p className="mt-1 text-sm text-slate-500">Cash booking amount should never be used for expenses.</p>
          </div>
          <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Save Entry</button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label>
            <span className="text-sm font-medium text-slate-700">Booking ID</span>
            <select className={fieldClass} {...register('bookingId', { required: 'Booking is required' })}>
              <option value="">Select booking</option>
              {bookings.map((booking) => <option key={booking.id}>{booking.id}</option>)}
            </select>
            {errors.bookingId && <p className="mt-1 text-xs text-rose-600">{errors.bookingId.message}</p>}
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Collection Date</span>
            <input className={fieldClass} type="date" {...register('collectionDate', { required: true })} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Amount Collected</span>
            <input className={fieldClass} type="number" step="0.01" {...register('amountCollected', { required: 'Amount is required', min: 1 })} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Payment Mode</span>
            <input className={fieldClass} value="Cash" readOnly {...register('paymentMode')} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Collected By</span>
            <select className={fieldClass} {...register('collectedBy')}>
              <option>Driver</option>
              <option>Manager</option>
              <option>Admin</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Receiver Manager</span>
            <select className={fieldClass} {...register('receivedByManager')}>
              <option value="">Select manager</option>
              {managers.map((manager) => <option key={manager.id}>{manager.name}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Deposit Date</span>
            <input className={fieldClass} type="date" {...register('depositDate')} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Deposit Mode</span>
            <select className={fieldClass} {...register('depositMode')}>
              <option>Cash Deposit</option>
              <option>UPI</option>
              <option>Bank Transfer</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Deposit Reference No</span>
            <input className={fieldClass} {...register('depositReferenceNumber')} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Deposited By</span>
            <input className={fieldClass} {...register('depositedBy')} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Verified By</span>
            <input className={fieldClass} {...register('verifiedBy')} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Attachment Upload</span>
            <input className="mt-2 block w-full text-sm text-slate-600" type="file" onChange={(event) => setValue('attachmentName', event.target.files?.[0]?.name || '')} />
            <input type="hidden" {...register('attachmentName')} />
          </label>
          <label className="md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Remarks</span>
            <textarea className={`${fieldClass} min-h-20 resize-y`} {...register('remarks')} />
          </label>
        </div>
      </form>

      <Section title="Booking Cash Deposit List" actions={<FilterBar search={search} onSearch={setSearch} />}>
        <TableShell
          columns={['Booking ID', 'Customer', 'Vehicle', 'Amount Collected', 'Collected By', 'Received By Manager', 'Collection Date', 'Deposit Date', 'Deposit Mode', 'Deposit Reference', 'Deposit Status', 'Actions']}
          minWidth="1400px"
          empty={filteredDeposits.length === 0}
        >
          {filteredDeposits.map((deposit) => (
            <tr key={deposit.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-900">{deposit.bookingId}</td>
              <td className="px-4 py-3 text-slate-600">{deposit.customer}</td>
              <td className="px-4 py-3 text-slate-600">{deposit.vehicle}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">₹ {money(deposit.amountCollected)}</td>
              <td className="px-4 py-3 text-slate-600">{deposit.collectedBy}</td>
              <td className="px-4 py-3 text-slate-600">{deposit.receivedByManager || '-'}</td>
              <td className="px-4 py-3 text-slate-600">{deposit.collectionDate}</td>
              <td className="px-4 py-3 text-slate-600">{deposit.depositDate || '-'}</td>
              <td className="px-4 py-3 text-slate-600">{deposit.depositMode || '-'}</td>
              <td className="px-4 py-3 text-slate-600">{deposit.depositReferenceNumber || '-'}</td>
              <td className="px-4 py-3"><StatusBadge status={deposit.depositStatus} /></td>
              <td className="px-4 py-3">
                {deposit.depositStatus !== 'Verified' ? (
                  <button className="font-semibold text-brand-600 hover:text-brand-700" type="button" onClick={() => verifyDeposit(deposit.id)}>
                    Verify
                  </button>
                ) : (
                  <span className="text-slate-400">Verified</span>
                )}
              </td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  )
}

export default BookingCashDepositPage
