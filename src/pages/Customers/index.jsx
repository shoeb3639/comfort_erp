import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Eye, Pencil, Search, Trash2, UserPlus, X } from 'lucide-react'
import { createMockRecord, deleteMockRecord, getMockData, updateMockRecord } from '../../services/api'
import CustomerTypeBadge from './components/CustomerTypeBadge'
import ActionNotice from '../../components/ActionNotice'

const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value || '-'}</p>
    </div>
  )
}

function FieldError({ message }) {
  if (!message) return null

  return <p className="mt-1 text-xs font-medium text-rose-600">{message}</p>
}

function AddEmployeeModal({ customer, onClose, onSave }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      department: '',
      employee_id: '',
      notes: '',
    },
  })

  function onSubmit(values) {
    onSave({
      id: `TRV-${Date.now()}`,
      customer_id: customer.id,
      traveller_type: customer.type === 'Travel Agent' ? 'Guest' : 'Employee',
      name: values.name,
      phone: values.phone,
      email: values.email,
      department: values.department,
      employee_id: values.employee_id,
      notes: values.notes,
      status: 'Active',
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Add Employee</h3>
            <p className="mt-1 text-sm text-slate-500">{customer.displayName}</p>
          </div>
          <button
            type="button"
            aria-label="Close add employee modal"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form className="p-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-slate-700">Employee Name</span>
              <input
                className={fieldClass}
                placeholder="Mr. X"
                {...register('name', {
                  required: 'Employee name is required',
                  minLength: { value: 2, message: 'Enter at least 2 characters' },
                })}
              />
              <FieldError message={errors.name?.message} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Mobile Number</span>
              <input
                className={fieldClass}
                placeholder="+91 98765 43210"
                {...register('phone', {
                  required: 'Mobile number is required',
                  minLength: { value: 8, message: 'Enter a valid mobile number' },
                })}
              />
              <FieldError message={errors.phone?.message} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                className={fieldClass}
                type="email"
                placeholder="employee@company.com"
                {...register('email', {
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
                })}
              />
              <FieldError message={errors.email?.message} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Employee ID</span>
              <input className={fieldClass} placeholder="Optional" {...register('employee_id')} />
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">Department</span>
              <input className={fieldClass} placeholder="Travel Desk, Admin" {...register('department')} />
            </label>

            <label className="sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea className={`${fieldClass} min-h-20 resize-y`} placeholder="Booking preference or remarks" {...register('notes')} />
            </label>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              Add Employee
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CustomerDetailModal({ customer, travellers, onClose, onAddEmployee }) {
  if (!customer) return null

  const linkedTravellers = travellers.filter((traveller) => traveller.customer_id === customer.id)
  const peopleLabel = customer.type === 'Travel Agent' ? 'Guests' : customer.type === 'Corporate' ? 'Employees' : 'Travellers'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold text-slate-900">{customer.displayName}</h3>
              <CustomerTypeBadge type={customer.type} />
            </div>
            <p className="mt-1 text-sm text-slate-500">{customer.billingName}</p>
          </div>
          <div className="flex items-center gap-2">
            {customer.type === 'Corporate' && (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                onClick={() => onAddEmployee(customer)}
              >
                <UserPlus size={16} />
                Add Employee
              </button>
            )}
            <Link
              to={`/customers/${customer.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <Pencil size={16} />
              Edit
            </Link>
            <button
              type="button"
              aria-label="Close customer details"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Email" value={customer.email} />
            <DetailItem label="Phone" value={customer.phone} />
            <DetailItem label="City" value={customer.city} />
            <DetailItem label="GSTIN" value={customer.gstin || 'Not applicable'} />
            <DetailItem label="Credit Limit" value={`₹${Number(customer.creditLimit || 0).toLocaleString()}`} />
            <DetailItem label="Outstanding" value={`₹${Number(customer.outstanding || 0).toLocaleString()}`} />
            <DetailItem label="Bookings" value={customer.bookings?.length || 0} />
            <DetailItem label="Invoices" value={customer.invoices?.length || 0} />
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Billing Address</p>
            <p className="mt-2 rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
              {customer.address || '-'}
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Contacts</p>
              <div className="mt-3 space-y-3">
                {(customer.contacts || []).map((contact) => (
                  <div key={`${contact.name}-${contact.role}`} className="rounded-xl border border-slate-200 p-4 text-sm">
                    <p className="font-semibold text-slate-900">{contact.name}</p>
                    <p className="text-slate-500">{contact.role}</p>
                    <p className="mt-2 text-slate-600">{contact.phone}</p>
                    <p className="text-slate-600">{contact.email}</p>
                  </div>
                ))}
                {!customer.contacts?.length && (
                  <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">No contacts added.</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{peopleLabel}</p>
                {customer.type === 'Corporate' && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => onAddEmployee(customer)}
                  >
                    <UserPlus size={14} />
                    Add
                  </button>
                )}
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                {linkedTravellers.length ? (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Mobile</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">Department</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {linkedTravellers.map((traveller) => (
                        <tr key={traveller.id}>
                          <td className="px-3 py-2 font-semibold text-slate-900">
                            {traveller.name}
                            {traveller.employee_id ? <span className="ml-1 text-xs font-medium text-slate-400">({traveller.employee_id})</span> : null}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{traveller.phone || '-'}</td>
                          <td className="px-3 py-2 text-slate-600">{traveller.department || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="bg-slate-50 px-4 py-3 text-sm text-slate-500">No {peopleLabel.toLowerCase()} added.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CustomersPage() {
  const [customers, setCustomers] = useState(() => getMockData('customers'))
  const [travellers, setTravellers] = useState(() => getMockData('travellers'))
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [employeeCustomer, setEmployeeCustomer] = useState(null)
  const [notice, setNotice] = useState('')

  const travellersByCustomerId = useMemo(() => {
    return travellers.reduce((groups, traveller) => {
      const currentGroup = groups.get(traveller.customer_id) || []
      currentGroup.push(traveller)
      groups.set(traveller.customer_id, currentGroup)
      return groups
    }, new Map())
  }, [travellers])

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return customers.filter((customer) => {
      const linkedTravellers = travellersByCustomerId.get(customer.id) || []
      const matchesType = typeFilter === 'All' || customer.type === typeFilter
      const searchableText = [
        customer.name,
        customer.billingName,
        customer.email,
        customer.phone,
        customer.city,
        ...linkedTravellers.flatMap((traveller) => [traveller.name, traveller.phone, traveller.email, traveller.employee_id]),
      ]
        .join(' ')
        .toLowerCase()

      return matchesType && (!query || searchableText.includes(query))
    })
  }, [customers, search, travellersByCustomerId, typeFilter])

  function handleDeleteCustomer(customer) {
    setCustomers(deleteMockRecord('customers', customer.id))
    if (selectedCustomer?.id === customer.id) setSelectedCustomer(null)
    setNotice(`Customer ${customer.displayName} deleted.`)
  }

  function handleAddEmployee(employee) {
    createMockRecord('travellers', employee)
    setTravellers((currentTravellers) => [employee, ...currentTravellers])

    const customer = customers.find((item) => item.id === employee.customer_id)
    if (customer) {
      const updatedCustomer = {
        ...customer,
        travellers: Array.from(new Set([...(customer.travellers || []), employee.name])),
      }

      updateMockRecord('customers', customer.id, updatedCustomer)
      setCustomers((currentCustomers) =>
        currentCustomers.map((item) => (item.id === customer.id ? updatedCustomer : item)),
      )
      setSelectedCustomer(updatedCustomer)
      setNotice(`${employee.name} added to ${customer.displayName}.`)
    }

    setEmployeeCustomer(null)
  }

  return (
    <div className="space-y-5">
      <ActionNotice message={notice} onDismiss={() => setNotice('')} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-semibold text-slate-900">Customer List</h3>
          <div className="grid gap-3 sm:grid-cols-[minmax(260px,360px)_220px]">
            <label className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              <Search className="mr-2 text-slate-400" size={18} strokeWidth={2.2} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
                placeholder="Search name, billing name, email, city"
              />
            </label>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              <option value="All">All customer types</option>
              <option value="Retail">Retail</option>
              <option value="Corporate">Corporate</option>
              <option value="Travel Agent">Travel Agent</option>
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[980px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Customer</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Contact</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">City</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Outstanding</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{customer.displayName}</p>
                    <p className="text-slate-500">{customer.billingName}</p>
                    {customer.type === 'Corporate' && (
                      <p className="mt-1 text-xs font-medium text-slate-400">
                        {(travellersByCustomerId.get(customer.id) || []).length} employees
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <CustomerTypeBadge type={customer.type} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{customer.email}</p>
                    <p className="text-slate-400">{customer.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{customer.city}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    ₹{customer.outstanding.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex justify-end gap-2">
                      <button
                        type="button"
                        aria-label={`View ${customer.displayName}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedCustomer(customer)
                        }}
                      >
                        <Eye size={16} />
                      </button>
                      <Link
                        to={`/customers/${customer.id}/edit`}
                        aria-label={`Edit ${customer.displayName}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        type="button"
                        aria-label={`Delete ${customer.displayName}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDeleteCustomer(customer)
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCustomers.length === 0 && (
            <div className="bg-white px-4 py-10 text-center text-sm text-slate-500">No customers found.</div>
          )}
        </div>
      </section>

      <CustomerDetailModal
        customer={selectedCustomer}
        travellers={travellers}
        onClose={() => setSelectedCustomer(null)}
        onAddEmployee={setEmployeeCustomer}
      />
      {employeeCustomer && (
        <AddEmployeeModal
          customer={employeeCustomer}
          onClose={() => setEmployeeCustomer(null)}
          onSave={handleAddEmployee}
        />
      )}
    </div>
  )
}

export default CustomersPage
