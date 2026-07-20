import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { createMockRecord, updateMockRecord } from '../../../services/api'
import ActionNotice from '../../../components/ActionNotice'

const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

function FieldError({ message }) {
  if (!message) return null

  return <p className="mt-1 text-xs font-medium text-rose-600">{message}</p>
}

function CustomerForm({ customer, mode = 'create' }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitSuccessful },
  } = useForm({
    defaultValues: {
      type: customer?.type || '',
      name: customer?.name || '',
      billingName: customer?.billingName || '',
      email: customer?.email || '',
      phone: customer?.phone || '',
      city: customer?.city || '',
      gstin: customer?.gstin || '',
      address: customer?.address || '',
      creditLimit: customer?.creditLimit || 0,
    },
  })

  function onSubmit(values) {
    const payload = {
      ...values,
      id: customer?.id || `CUST-${Date.now()}`,
      status: customer?.status || 'Active',
      displayName: values.name,
      outstanding: customer?.outstanding || 0,
      contacts: customer?.contacts || [
        { name: values.name, role: 'Primary', phone: values.phone, email: values.email },
      ],
      travellers: customer?.travellers || [],
      rateCards: customer?.rateCards || [],
      bookings: customer?.bookings || [],
      invoices: customer?.invoices || [],
      payments: customer?.payments || [],
      documents: customer?.documents || [],
    }

    if (mode === 'edit') {
      updateMockRecord('customers', customer.id, payload)
    } else {
      createMockRecord('customers', payload)
    }

    console.log(`${mode} customer`, payload)
  }

  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={handleSubmit(onSubmit)}>
      <ActionNotice
        message={isSubmitSuccessful ? `Customer ${mode === 'edit' ? 'updated' : 'created'} successfully.` : ''}
      />

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <label>
          <span className="text-sm font-medium text-slate-700">Customer Type</span>
          <select className={fieldClass} {...register('type', { required: 'Customer type is required' })}>
            <option value="">Select type</option>
            <option value="Retail">Retail</option>
            <option value="Corporate">Corporate</option>
            <option value="Travel Agent">Travel Agent</option>
          </select>
          <FieldError message={errors.type?.message} />
        </label>

        <label>
          <span className="text-sm font-medium text-slate-700">Customer / Company Name</span>
          <input
            className={fieldClass}
            placeholder="Amit Sharma, Infosys, B4T Holidays"
            {...register('name', {
              required: 'Customer name is required',
              minLength: { value: 2, message: 'Enter at least 2 characters' },
            })}
          />
          <FieldError message={errors.name?.message} />
        </label>

        <label>
          <span className="text-sm font-medium text-slate-700">Billing Name</span>
          <input
            className={fieldClass}
            placeholder="Legal billing name"
            {...register('billingName', {
              required: 'Billing name is required',
              minLength: { value: 2, message: 'Enter at least 2 characters' },
            })}
          />
          <FieldError message={errors.billingName?.message} />
        </label>

        <label>
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            className={fieldClass}
            type="email"
            placeholder="billing@example.com"
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
            })}
          />
          <FieldError message={errors.email?.message} />
        </label>

        <label>
          <span className="text-sm font-medium text-slate-700">Phone</span>
          <input
            className={fieldClass}
            placeholder="+91 98765 43210"
            {...register('phone', {
              required: 'Phone is required',
              minLength: { value: 8, message: 'Enter a valid phone number' },
            })}
          />
          <FieldError message={errors.phone?.message} />
        </label>

        <label>
          <span className="text-sm font-medium text-slate-700">City</span>
          <input className={fieldClass} placeholder="Delhi" {...register('city', { required: 'City is required' })} />
          <FieldError message={errors.city?.message} />
        </label>

        <label>
          <span className="text-sm font-medium text-slate-700">GSTIN</span>
          <input className={fieldClass} placeholder="Optional for Retail" {...register('gstin')} />
        </label>

        <label>
          <span className="text-sm font-medium text-slate-700">Credit Limit</span>
          <input
            className={fieldClass}
            type="number"
            min="0"
            {...register('creditLimit', {
              valueAsNumber: true,
              min: { value: 0, message: 'Credit limit cannot be negative' },
            })}
          />
          <FieldError message={errors.creditLimit?.message} />
        </label>

        <label className="md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Billing Address</span>
          <textarea
            className={`${fieldClass} min-h-24 resize-y`}
            placeholder="Full billing address"
            {...register('address', { required: 'Billing address is required' })}
          />
          <FieldError message={errors.address?.message} />
        </label>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          to="/customers"
          className="inline-flex justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          {mode === 'edit' ? 'Update Customer' : 'Create Customer'}
        </button>
      </div>
    </form>
  )
}

export default CustomerForm
