import { Info, Plus, Trash2 } from 'lucide-react'

export const unitOptions = ['KM', 'Day', 'Days', 'Hour', 'Hours', 'Package', 'Trip', 'Night', 'Actual', 'Discount']

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

function DescriptionHelp() {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:bg-slate-100 focus:text-slate-700 focus:outline-none"
        aria-label="Description examples"
      >
        <Info size={14} />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-7 z-20 hidden w-72 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-medium leading-5 text-slate-600 shadow-lg group-hover:block group-focus-within:block">
        <span className="block font-semibold text-slate-900">Description examples</span>
        <span className="mt-1 block">Outstation: Prayagraj to Varanasi</span>
        <span className="block">Local: 12 Hrs 120 Kms</span>
        <span className="block">Airport: Airport Transfer</span>
      </span>
    </span>
  )
}

export function createInvoiceLineItem(overrides = {}) {
  const qty = Number(overrides.qty ?? 1)
  const rate = Number(overrides.rate ?? 0)
  return {
    id: overrides.id || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    dateType: overrides.dateType || 'single',
    serviceDate: overrides.serviceDate || '',
    serviceStartDate: overrides.serviceStartDate || '',
    serviceEndDate: overrides.serviceEndDate || '',
    description: overrides.description || '',
    qty,
    unit: overrides.unit || 'Trip',
    rate,
    amount: overrides.amount ?? qty * rate,
  }
}

export function formatServicePeriod(item) {
  if (item.dateType === 'range') {
    return [item.serviceStartDate, item.serviceEndDate].filter(Boolean).join(' to ')
  }

  return item.serviceDate || ''
}

function InvoiceItemTable({ items, onChange, editable = true, defaultServiceDate = '', onQuickAdd }) {
  function updateItem(id, field, value) {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item

        const nextItem = { ...item, [field]: value }
        if (field === 'qty' || field === 'rate') {
          nextItem.amount = Number(nextItem.qty || 0) * Number(nextItem.rate || 0)
        }
        return nextItem
      }),
    )
  }

  function addRow() {
    onChange([...items, createInvoiceLineItem({ serviceDate: defaultServiceDate })])
  }

  function deleteRow(id) {
    onChange(items.filter((item) => item.id !== id))
  }

  return (
    <div className="rounded-xl border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Generic Invoice Line Items</p>
          <p className="text-xs text-slate-500">Reusable for outstation, local, package, multi-day tours, corporate billing, and custom charges.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[920px] divide-y divide-slate-200 text-sm">
          <thead className="bg-white">
            <tr>
              <th className="w-44 px-3 py-3 text-left font-semibold text-slate-700">Date of Use</th>
              <th className="px-3 py-3 text-left font-semibold text-slate-700">
                <span className="inline-flex items-center gap-1.5">
                  Description
                  <DescriptionHelp />
                </span>
              </th>
              <th className="w-24 px-3 py-3 text-left font-semibold text-slate-700">Qty</th>
              <th className="w-32 px-3 py-3 text-left font-semibold text-slate-700">Unit</th>
              <th className="w-24 px-3 py-3 text-left font-semibold text-slate-700">Rate</th>
              <th className="w-28 px-3 py-3 text-left font-semibold text-slate-700">Amount</th>
              {editable && <th className="w-16 px-3 py-3 text-right font-semibold text-slate-700">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-3 py-3">
                  {editable ? (
                    <div className="space-y-2">
                      <select className={inputClass} value={item.dateType || 'single'} onChange={(event) => updateItem(item.id, 'dateType', event.target.value)}>
                        <option value="single">Single Date</option>
                        <option value="range">Date Range</option>
                      </select>
                      {(item.dateType || 'single') === 'range' ? (
                        <div className="grid gap-2">
                          <input className={inputClass} type="date" value={item.serviceStartDate || ''} onChange={(event) => updateItem(item.id, 'serviceStartDate', event.target.value)} />
                          <input className={inputClass} type="date" value={item.serviceEndDate || ''} onChange={(event) => updateItem(item.id, 'serviceEndDate', event.target.value)} />
                        </div>
                      ) : (
                        <input className={inputClass} type="date" value={item.serviceDate} onChange={(event) => updateItem(item.id, 'serviceDate', event.target.value)} />
                      )}
                    </div>
                  ) : (
                    formatServicePeriod(item)
                  )}
                </td>
                <td className="px-3 py-3">
                  {editable ? (
                    <input
                      className={inputClass}
                      value={item.description}
                      placeholder="e.g. Prayagraj to Varanasi / 12 Hrs 120 Kms / Airport Transfer"
                      onChange={(event) => updateItem(item.id, 'description', event.target.value)}
                    />
                  ) : (
                    <span className="font-medium text-slate-900">{item.description}</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  {editable ? (
                    <input className={inputClass} type="number" step="0.01" value={item.qty} onChange={(event) => updateItem(item.id, 'qty', Number(event.target.value))} />
                  ) : (
                    item.qty
                  )}
                </td>
                <td className="px-3 py-3">
                  {editable ? (
                    <select className={inputClass} value={item.unit} onChange={(event) => updateItem(item.id, 'unit', event.target.value)}>
                      {unitOptions.map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  ) : (
                    item.unit
                  )}
                </td>
                <td className="px-3 py-3">
                  {editable ? (
                    <input className={inputClass} type="number" step="0.01" value={item.rate} onChange={(event) => updateItem(item.id, 'rate', Number(event.target.value))} />
                  ) : (
                    item.rate
                  )}
                </td>
                <td className="px-3 py-3">
                  {editable ? (
                    <input className={inputClass} type="number" step="0.01" value={item.amount} onChange={(event) => updateItem(item.id, 'amount', Number(event.target.value))} />
                  ) : (
                    <span className="font-semibold text-slate-900">{Number(item.amount || 0).toFixed(2)}</span>
                  )}
                </td>
                {editable && (
                  <td className="px-3 py-3 text-right">
                    <button type="button" aria-label="Delete invoice item" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50" onClick={() => deleteRow(item.id)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-500">No invoice line items added.</div>}

      {editable && (
        <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={addRow}>
            <Plus size={16} />
            Add Service Row
          </button>
          {['Toll Tax', 'Parking', 'Driver Allowance', 'Service Charge', 'Discount'].map((label) => (
            <button
              key={label}
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => onQuickAdd?.(label)}
            >
              <Plus size={16} />
              Add {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default InvoiceItemTable
