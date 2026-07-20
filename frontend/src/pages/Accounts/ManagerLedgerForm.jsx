import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { createMockRecord, getMockData } from '../../services/api'
import { Section, fieldClass, toNumber } from './accountUtils'

function ManagerLedgerFormPage() {
  const navigate = useNavigate()
  const managers = useMemo(() => getMockData('managers'), [])
  const locations = useMemo(() => getMockData('locations'), [])
  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    defaultValues: {
      transactionDate: new Date().toISOString().slice(0, 10),
      manager: '',
      location: '',
      amount: '',
      paymentMode: 'Cash',
      referenceNumber: '',
      releasedBy: 'Admin',
      purpose: '',
      remarks: '',
      attachmentName: '',
    },
  })

  function releaseAmount(values) {
    const amount = toNumber(values.amount)
    createMockRecord('accountsTransactions', {
      id: `TXN-${Date.now()}`,
      ...values,
      transactionType: 'Fund Release',
      category: 'Company Fund Released',
      amount,
      ledgerImpact: ['Manager Ledger Credit'],
      status: 'Verified',
    })
    createMockRecord('managerLedgerEntries', {
      id: `MLE-${Date.now()}`,
      date: values.transactionDate,
      manager: values.manager,
      location: values.location,
      transactionType: 'Fund Released',
      description: values.purpose || values.referenceNumber,
      credit: amount,
      debit: 0,
      runningBalance: amount,
      reference: values.referenceNumber,
    })
    navigate('/accounts/manager-ledger')
  }

  return (
    <form id="manager-ledger-release-form" className="space-y-5" onSubmit={handleSubmit(releaseAmount)}>
      <Section title="Release Amount">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            <select className={fieldClass} {...register('location', { required: 'Location is required' })}>
              <option value="">Select location</option>
              {locations.map((location) => <option key={location.id}>{location.name}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Amount</span>
            <input className={fieldClass} type="number" step="0.01" {...register('amount', { required: 'Amount is required', min: 1 })} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Payment Mode</span>
            <select className={fieldClass} {...register('paymentMode')}>
              <option>Cash</option>
              <option>UPI</option>
              <option>Bank Transfer</option>
              <option>Cheque</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Reference Number</span>
            <input className={fieldClass} {...register('referenceNumber')} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Released By</span>
            <input className={fieldClass} {...register('releasedBy', { required: 'Released by is required' })} />
          </label>
          <label className="xl:col-span-2">
            <span className="text-sm font-medium text-slate-700">Purpose</span>
            <input className={fieldClass} {...register('purpose', { required: 'Purpose is required' })} />
          </label>
          <label className="md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Remarks</span>
            <textarea className={`${fieldClass} min-h-24 resize-y`} {...register('remarks')} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Attachment Upload</span>
            <input className="mt-2 block w-full text-sm text-slate-600" type="file" onChange={(event) => setValue('attachmentName', event.target.files?.[0]?.name || '')} />
          </label>
        </div>
      </Section>
    </form>
  )
}

export default ManagerLedgerFormPage
