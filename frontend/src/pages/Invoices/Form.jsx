import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import InvoiceItemTable, { createInvoiceLineItem } from './components/InvoiceItemTable'
import {
  calculateInvoiceTotals,
  companyDetails,
  createInvoiceNumber,
  defaultBankDetails,
  formatMoney,
  getInvoiceById,
  getInvoiceSettings,
  getNextInvoiceId,
  saveInvoiceSettings,
} from './invoiceUtils'
import { createMockRecord, getMockData, updateMockRecord } from '../../services/api'
import { InvoiceLogo, InvoiceSignature } from './components/InvoiceVisuals'

const fieldClass =
  'mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-950 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

const selectClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

const labelClass = 'text-[11px] font-bold uppercase tracking-wide text-slate-500'

const quickChargeConfig = {
  'Toll Tax': { unit: 'Actual', rate: 0 },
  Parking: { unit: 'Actual', rate: 0 },
  'Driver Allowance': { unit: 'Night', rate: 300 },
  'Service Charge': { unit: 'Actual', rate: 0 },
  Discount: { unit: 'Discount', rate: -500 },
}

function EditableField({ label, error, multiline = false, children }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children || (multiline ? null : null)}
      {error && <span className="mt-1 block text-xs font-semibold text-rose-600">{error.message}</span>}
    </label>
  )
}

function TaxSummary({ totals, gstType, register }) {
  const rows = [
    ['Subtotal', totals.subtotal],
    ['Taxable Amount', totals.taxableAmount],
    ['CGST 2.5%', totals.cgst],
    ['SGST 2.5%', totals.sgst],
    ['IGST 5%', totals.igst],
    ['Total GST', totals.totalTax],
  ]

  return (
    <div className="text-sm">
      <label className="mb-4 block">
        <span className={labelClass}>GST Type</span>
        <select className={`${selectClass} mt-1 w-full`} {...register('gstType')}>
          <option>No GST</option>
          <option>CGST + SGST</option>
          <option>IGST</option>
        </select>
      </label>
      <div className="space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className={`flex justify-between gap-4 py-1 ${value || label.includes('Amount') || gstType === 'No GST' ? '' : 'text-slate-400'}`}>
            <span>{label}</span>
            <span className="font-semibold">₹ {formatMoney(value)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between gap-4 border-t border-slate-900 py-2 text-base font-extrabold">
          <span>Net Payable</span>
          <span>₹ {formatMoney(totals.netPayable)}</span>
        </div>
      </div>
    </div>
  )
}

function createDefaultInvoiceValues(settings, invoice) {
  const source = invoice?.invoiceSource || invoice?.invoice_source || 'booking'

  return {
    invoiceSource: source,
    customerType: invoice?.customerType || invoice?.customer_type || 'Retail',
    customerMode: 'existing',
    directCustomerId: invoice?.directCustomerId || invoice?.billing_customer_id || '',
    directTravellerId: invoice?.directTravellerId || invoice?.traveller_id || '',
    newCustomerName: '',
    newContactPerson: '',
    newMobile: '',
    newEmail: '',
    newGstin: '',
    newBillingAddress: '',
    invoiceEmail: invoice?.invoiceEmail || '',
    paymentTerms: invoice?.paymentTerms || '',
    referenceNumber: invoice?.referenceNumber || invoice?.reference_number || '',
    placeOfSupply: invoice?.placeOfSupply || invoice?.location_id || settings.placeOfSupply || 'Uttar Pradesh',
    servicePeriod: invoice?.servicePeriod || '',
    directFromLocation: invoice?.directFromLocation || '',
    directToLocation: invoice?.directToLocation || '',
    vehicleId: invoice?.vehicleId || invoice?.vehicle_id || '',
    driverId: invoice?.driverId || invoice?.driver_id || '',
    includeVehiclePnL: invoice?.includeVehiclePnL === true || invoice?.includeVehiclePnL === 'Yes' ? 'Yes' : 'No',
    billingType: invoice?.billingType || 'Outstation',
    billingName: invoice?.billingName || invoice?.traveller || invoice?.billingCustomer || '',
    billingCustomer: invoice?.billingCustomer || '',
    billingAddress: invoice?.billingAddress || '',
    customerGstin: invoice?.customerGstin || '',
    mobileNumber: invoice?.mobileNumber || '',
    email: invoice?.email || '',
    invoiceNumber: invoice?.invoiceNumber || createInvoiceNumber(settings),
    invoiceDate: invoice?.invoiceDate || new Date().toISOString().slice(0, 10),
    bookingId: invoice?.bookingId || '',
    traveller: invoice?.traveller || '',
    vehicle: invoice?.vehicle || '',
    gstType: invoice?.gstType || 'IGST',
  }
}

function InvoiceFormPage() {
  const navigate = useNavigate()
  const { invoiceId } = useParams()
  const settings = getInvoiceSettings()
  const editingInvoice = useMemo(() => (invoiceId ? getInvoiceById(invoiceId) : null), [invoiceId])
  const isEditMode = Boolean(invoiceId)
  const bookings = useMemo(() => getMockData('bookings'), [])
  const [customers, setCustomers] = useState(() => getMockData('customers'))
  const [travellers, setTravellers] = useState(() => getMockData('travellers'))
  const vehicles = useMemo(() => getMockData('vehicles'), [])
  const drivers = useMemo(() => getMockData('drivers'), [])
  const [items, setItems] = useState(() =>
    editingInvoice?.items?.length
      ? editingInvoice.items
      : [
          createInvoiceLineItem({
            serviceDate: '2026-07-18',
            description: 'Prayagraj To Rewa Dropping',
            qty: 340,
            unit: 'KM',
            rate: 11,
            amount: 3740,
          }),
        ],
  )
  const [lastDraftId, setLastDraftId] = useState('')

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: createDefaultInvoiceValues(settings, editingInvoice),
  })

  const values = watch()
  const totals = calculateInvoiceTotals(items, values.gstType)
  const directCustomerOptions = customers.filter((customer) => customer.type === values.customerType)
  const directTravellerOptions = travellers.filter(
    (traveller) => traveller.customer_id === values.directCustomerId && traveller.status === 'Active',
  )
  const isDirectInvoice = values.invoiceSource === 'direct'
  const isNewCustomerMode = values.customerMode === 'new'

  function handleBookingChange(bookingId) {
    const booking = bookings.find((item) => item.id === bookingId)
    setValue('bookingId', bookingId)
    if (!booking) return

    const customer = customers.find((item) => item.id === booking.billing_customer_id)
    const traveller = travellers.find((item) => item.id === booking.traveller_id)
    const route = [booking.pickupLocation, booking.dropLocation || booking.routeStops].filter(Boolean).join(' To ')
    const isPackage = booking.booking_type === 'package'
    const isLocal = booking.booking_type === 'local'

    setValue('billingType', isPackage ? 'Package' : isLocal ? 'Local' : 'Outstation')
    setValue('billingName', traveller?.name || booking.customer || '')
    setValue('billingCustomer', customer?.billingName || customer?.displayName || booking.customer || '')
    setValue('billingAddress', customer?.address || '')
    setValue('customerGstin', customer?.gstin || '')
    setValue('mobileNumber', customer?.phone || traveller?.phone || '')
    setValue('email', customer?.email || traveller?.email || '')
    setValue('traveller', traveller?.name || booking.customer || '')
    setValue('vehicle', `${booking.vehicleType || ''} ${booking.vehicleRegistrationNo || ''}`.trim())

    setItems([
      createInvoiceLineItem({
        serviceDate: booking.startDate || booking.pickupDate || '',
        description: isPackage ? booking.packageDetails || route : route || `Booking ${booking.id}`,
        qty: booking.estimatedKm || 1,
        unit: booking.estimatedKm ? 'KM' : isPackage ? 'Package' : 'Trip',
        rate: booking.estimatedKm ? booking.ratePerKm || 0 : booking.amount || booking.fixedAmount || 0,
      }),
    ])
  }

  function handleInvoiceSourceChange(source) {
    setValue('invoiceSource', source)
    if (source === 'direct') {
      setValue('bookingId', '')
      setValue('billingType', 'Outstation')
      setItems([createInvoiceLineItem({ description: '', qty: 1, unit: 'Trip', rate: 0 })])
      return
    }
  }

  function handleDirectCustomerChange(customerId) {
    setValue('directCustomerId', customerId)
    setValue('directTravellerId', '')
    const customer = customers.find((item) => item.id === customerId)
    if (!customer) return

    const firstTraveller = travellers.find((traveller) => traveller.customer_id === customerId && traveller.status === 'Active')
    setValue('billingName', customer.type === 'Retail' ? customer.displayName || customer.name : firstTraveller?.name || customer.contacts?.[0]?.name || '')
    setValue('billingCustomer', customer.billingName || customer.displayName || customer.name || '')
    setValue('billingAddress', customer.address || '')
    setValue('customerGstin', customer.gstin || '')
    setValue('mobileNumber', firstTraveller?.phone || customer.phone || '')
    setValue('email', customer.email || firstTraveller?.email || '')
  }

  function handleDirectTravellerChange(travellerId) {
    setValue('directTravellerId', travellerId)
    const traveller = travellers.find((item) => item.id === travellerId)
    if (!traveller) return

    setValue('billingName', traveller.name || '')
    setValue('mobileNumber', traveller.phone || '')
    setValue('email', traveller.email || '')
  }

  function handleVehicleChange(vehicleId) {
    setValue('vehicleId', vehicleId)
    const vehicle = vehicles.find((item) => item.id === vehicleId)
    if (vehicle) setValue('vehicle', `${vehicle.type || ''} ${vehicle.plate || ''}`.trim())
  }

  function createDirectCustomerIfNeeded(formValues) {
    if (!isDirectInvoice) return formValues
    if (formValues.customerMode === 'existing') {
      return { ...formValues, billing_customer_id: formValues.directCustomerId }
    }

    const timestamp = Date.now()
    const name = formValues.newCustomerName || formValues.billingCustomer || formValues.billingName
    const billingName = formValues.customerType === 'Retail' ? name : formValues.newCustomerName || name
    const contactName = formValues.newContactPerson || name
    const customer = {
      id: `CUST-${timestamp}`,
      type: formValues.customerType,
      name,
      displayName: name,
      billingName,
      email: formValues.newEmail || formValues.email,
      phone: formValues.newMobile || formValues.mobileNumber,
      city: formValues.placeOfSupply || '',
      gstin: formValues.newGstin || formValues.customerGstin,
      address: formValues.newBillingAddress || formValues.billingAddress,
      status: 'Active',
      creditLimit: 0,
      outstanding: 0,
      contacts: [{ name: contactName, role: 'Primary', phone: formValues.newMobile || '', email: formValues.newEmail || '' }],
      travellers: contactName ? [contactName] : [],
      rateCards: [],
      bookings: [],
      invoices: [],
      payments: [],
      documents: [],
    }

    createMockRecord('customers', customer)
    setCustomers((currentCustomers) => [customer, ...currentCustomers])

    const traveller = {
      id: `TRV-${timestamp}`,
      customer_id: customer.id,
      traveller_type: formValues.customerType === 'Travel Agent' ? 'Guest' : formValues.customerType === 'Retail' ? 'Retail' : 'Employee',
      name: contactName,
      phone: formValues.newMobile || '',
      email: formValues.newEmail || '',
      department: '',
      employee_id: '',
      notes: 'Created from direct invoice.',
      status: 'Active',
    }

    createMockRecord('travellers', traveller)
    setTravellers((currentTravellers) => [traveller, ...currentTravellers])

    return {
      ...formValues,
      billing_customer_id: customer.id,
      directCustomerId: customer.id,
      directTravellerId: traveller.id,
      billingName: formValues.billingName || contactName,
      billingCustomer: formValues.billingCustomer || billingName,
      billingAddress: formValues.billingAddress || customer.address,
      customerGstin: formValues.customerGstin || customer.gstin,
      mobileNumber: formValues.mobileNumber || customer.phone,
      email: formValues.email || customer.email,
    }
  }

  function handleAddDirectTraveller() {
    const customer = customers.find((item) => item.id === values.directCustomerId)
    if (!customer || !values.billingName) return

    const traveller = {
      id: `TRV-${Date.now()}`,
      customer_id: customer.id,
      traveller_type: customer.type === 'Travel Agent' ? 'Guest' : customer.type === 'Retail' ? 'Retail' : 'Employee',
      name: values.billingName,
      phone: values.mobileNumber || '',
      email: values.email || '',
      department: '',
      employee_id: '',
      notes: 'Added from direct invoice.',
      status: 'Active',
    }

    createMockRecord('travellers', traveller)
    setTravellers((currentTravellers) => [traveller, ...currentTravellers])
    updateMockRecord('customers', customer.id, {
      ...customer,
      travellers: Array.from(new Set([...(customer.travellers || []), traveller.name])),
    })
    setValue('directTravellerId', traveller.id)
  }

  function handleQuickAdd(label) {
    const config = quickChargeConfig[label]
    setItems((currentItems) => [
      ...currentItems,
      createInvoiceLineItem({
        serviceDate: '',
        description: label,
        qty: 1,
        unit: config.unit,
        rate: config.rate,
      }),
    ])
  }

  function buildInvoice(formValues, status) {
    const isGenerated = status === 'Generated'
    const previousStatus = editingInvoice?.invoiceStatus || editingInvoice?.status
    const shouldConsumeNumber = isGenerated && (!isEditMode || previousStatus !== 'Generated')
    const invoiceNumber = isGenerated
      ? shouldConsumeNumber
        ? createInvoiceNumber(settings)
        : editingInvoice?.invoiceNumber || formValues.invoiceNumber
      : isEditMode
        ? editingInvoice?.invoiceNumber || formValues.invoiceNumber || 'Draft - not generated'
        : 'Draft - not generated'
    const source = formValues.invoiceSource === 'direct' ? 'direct' : 'booking'
    const booking = source === 'booking' ? bookings.find((item) => item.id === formValues.bookingId) : null

    return {
      id: isEditMode ? editingInvoice.id : getNextInvoiceId(),
      ...formValues,
      invoice_source: source,
      invoiceSource: source,
      booking_id: source === 'booking' ? formValues.bookingId : null,
      bookingId: source === 'booking' ? formValues.bookingId : '',
      billing_customer_id: formValues.billing_customer_id || formValues.directCustomerId || '',
      customer_type: source === 'direct' ? formValues.customerType : formValues.customer_type,
      traveller_id: source === 'direct' ? formValues.directTravellerId || null : formValues.traveller_id,
      vehicle_id: formValues.vehicleId || null,
      driver_id: formValues.driverId || null,
      location_id: formValues.placeOfSupply || '',
      invoice_series_id: settings.prefix,
      invoice_number: invoiceNumber,
      invoice_date: formValues.invoiceDate,
      reference_number: formValues.referenceNumber || '',
      serviceCity: source === 'booking' ? booking?.serviceCity || '' : formValues.placeOfSupply || '',
      service_city: source === 'booking' ? booking?.serviceCity || '' : formValues.placeOfSupply || '',
      includeVehiclePnL: formValues.includeVehiclePnL === 'Yes',
      invoiceNumber,
      invoiceStatus: status,
      status,
      items,
      totals,
      hsnCode: settings.hsnCode,
      terms: settings.terms,
      bankDetails: settings.bankDetails || defaultBankDetails,
      logoUrl: settings.logoUrl,
      signatureUrl: settings.signatureUrl,
      stampUrl: settings.stampUrl,
      billingCustomer: formValues.billingCustomer,
      customerGstin: formValues.customerGstin,
      total: `₹${totals.netPayable.toFixed(2)}`,
      booking: source === 'booking' ? formValues.bookingId : '',
      dueDate: formValues.invoiceDate,
      createdAt: editingInvoice?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  function persistInvoice(formValues, status, redirectTarget = '') {
    const preparedValues = createDirectCustomerIfNeeded(formValues)
    const previousStatus = editingInvoice?.invoiceStatus || editingInvoice?.status
    const shouldConsumeNumber = status === 'Generated' && (!isEditMode || previousStatus !== 'Generated')
    const invoicePayload = buildInvoice(preparedValues, status)
    const invoice = isEditMode
      ? updateMockRecord('invoices', editingInvoice.id, invoicePayload)
      : createMockRecord('invoices', invoicePayload)

    if (shouldConsumeNumber) {
      saveInvoiceSettings({ ...settings, nextNumber: Number(settings.nextNumber || 1) + 1 })
      if (!isEditMode && preparedValues.invoiceSource === 'direct' && preparedValues.billing_customer_id) {
        const customer = getMockData('customers').find((item) => item.id === preparedValues.billing_customer_id)
        if (customer) {
          const updatedCustomer = {
            ...customer,
            outstanding: Number(customer.outstanding || 0) + Number(totals.netPayable || 0),
            invoices: Array.from(new Set([...(customer.invoices || []), invoice.id])),
          }
          updateMockRecord('customers', customer.id, updatedCustomer)
          setCustomers((currentCustomers) =>
            currentCustomers.map((item) => (item.id === customer.id ? updatedCustomer : item)),
          )
        }
      }
    }

    if (redirectTarget === 'preview') {
      navigate(`/invoices/${invoice.id}/preview`)
      return
    }

    if (redirectTarget === 'print') {
      navigate(`/invoices/${invoice.id}/print`)
      return
    }

    setLastDraftId(invoice.id)
  }

  const bank = settings.bankDetails || defaultBankDetails
  const defaultSaveStatus = isEditMode ? editingInvoice?.invoiceStatus || editingInvoice?.status || 'Draft' : 'Draft'
  const primaryActionLabel = isEditMode && defaultSaveStatus === 'Generated' ? 'Update Invoice' : 'Generate Invoice'

  if (invoiceId && !editingInvoice) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Invoice not found.
        <button type="button" className="ml-2 font-semibold text-brand-600" onClick={() => navigate('/invoices')}>
          Back to invoices
        </button>
      </div>
    )
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit((formValues) => persistInvoice(formValues, defaultSaveStatus))}>
      {lastDraftId && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {isEditMode ? `Invoice ${lastDraftId} updated.` : `Draft saved as ${lastDraftId}. Invoice number was not consumed.`}
        </div>
      )}

      <article className="w-full bg-white p-5 font-['Lato',Arial,Helvetica,sans-serif] text-[14px] leading-6 text-black shadow-sm print:w-full print:p-0 print:shadow-none">
        <div className="border border-black">
          <div className="border-b border-black p-[5px] text-center text-[18px] font-bold uppercase leading-6">Tax Invoice</div>

          <header className="grid grid-cols-[150px_1fr] border-b border-black px-2.5 py-0.5">
            <div className="flex items-center">
              <InvoiceLogo src={settings.logoUrl} className="h-[150px] w-[150px] object-contain" />
            </div>
            <div className="text-right text-[14px] leading-6">
              <h1 className="text-[34px] font-bold leading-10">{companyDetails.name}</h1>
              <p>{companyDetails.subtitle}</p>
              <p>{companyDetails.address}</p>
              <p>Website: {companyDetails.website}</p>
              <p>Mobile No.: {companyDetails.mobile}</p>
              <p className="font-semibold">
                GSTIN : {companyDetails.gstNumber} | HSN CODE: {settings.hsnCode} | Category: {companyDetails.category}
              </p>
            </div>
          </header>

          <section className="border-b border-black px-[15px] py-[8px]">
            <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
              <label className="block">
                <span className={labelClass}>Invoice Source</span>
                <select
                  className={`${selectClass} mt-1 w-full`}
                  {...register('invoiceSource')}
                  onChange={(event) => handleInvoiceSourceChange(event.target.value)}
                >
                  <option value="booking">From Existing Booking</option>
                  <option value="direct">Direct Invoice</option>
                </select>
              </label>

              {!isDirectInvoice && (
                <label className="block">
                  <span className={labelClass}>Select Booking</span>
                  <select
                    className={`${selectClass} mt-1 w-full`}
                    value={values.bookingId}
                    onChange={(event) => handleBookingChange(event.target.value)}
                  >
                    <option value="">Select booking</option>
                    {bookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {booking.id} - {booking.customer}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {isDirectInvoice && (
                <div className="grid gap-3 lg:grid-cols-4">
                  <label className="block">
                    <span className={labelClass}>Customer Type</span>
                    <select className={`${selectClass} mt-1 w-full`} {...register('customerType')}>
                      <option>Retail</option>
                      <option>Corporate</option>
                      <option>Travel Agent</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClass}>Customer Mode</span>
                    <select className={`${selectClass} mt-1 w-full`} {...register('customerMode')}>
                      <option value="existing">Select Existing Customer</option>
                      <option value="new">Add New Customer</option>
                    </select>
                  </label>

                  {!isNewCustomerMode && (
                    <>
                      <label className="block lg:col-span-2">
                        <span className={labelClass}>Billing Customer</span>
                        <select
                          className={`${selectClass} mt-1 w-full`}
                          {...register('directCustomerId', {
                            validate: (value) => (isDirectInvoice && !isNewCustomerMode && !value ? 'Billing customer is required' : true),
                          })}
                          onChange={(event) => handleDirectCustomerChange(event.target.value)}
                        >
                          <option value="">Select customer</option>
                          {directCustomerOptions.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.displayName || customer.name}
                            </option>
                          ))}
                        </select>
                        {errors.directCustomerId && <span className="mt-1 block text-xs font-semibold text-rose-600">{errors.directCustomerId.message}</span>}
                      </label>
                      {(values.customerType === 'Corporate' || values.customerType === 'Travel Agent') && (
                        <div className="block lg:col-span-2">
                          <span className={labelClass}>Traveller / Guest</span>
                          <div className="mt-1 flex gap-2">
                            <select
                              className={`${selectClass} w-full`}
                              value={values.directTravellerId}
                              onChange={(event) => handleDirectTravellerChange(event.target.value)}
                            >
                              <option value="">Optional - select traveller</option>
                              {directTravellerOptions.map((traveller) => (
                                <option key={traveller.id} value={traveller.id}>
                                  {traveller.name} {traveller.phone ? `- ${traveller.phone}` : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                              onClick={handleAddDirectTraveller}
                            >
                              Add New
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {isNewCustomerMode && (
                    <>
                      <label className="block lg:col-span-2">
                        <span className={labelClass}>{values.customerType === 'Retail' ? 'Name' : values.customerType === 'Corporate' ? 'Company Name' : 'Agent / Company Name'}</span>
                        <input className={fieldClass} {...register('newCustomerName', { validate: (value) => (isDirectInvoice && isNewCustomerMode && !value ? 'Name is required' : true) })} />
                        {errors.newCustomerName && <span className="mt-1 block text-xs font-semibold text-rose-600">{errors.newCustomerName.message}</span>}
                      </label>
                      {values.customerType !== 'Retail' && (
                        <label className="block">
                          <span className={labelClass}>Contact Person</span>
                          <input className={fieldClass} {...register('newContactPerson')} />
                        </label>
                      )}
                      <label className="block">
                        <span className={labelClass}>Mobile</span>
                        <input className={fieldClass} {...register('newMobile', { validate: (value) => (isDirectInvoice && isNewCustomerMode && !value ? 'Mobile is required' : true) })} />
                        {errors.newMobile && <span className="mt-1 block text-xs font-semibold text-rose-600">{errors.newMobile.message}</span>}
                      </label>
                      <label className="block">
                        <span className={labelClass}>Email</span>
                        <input className={fieldClass} type="email" {...register('newEmail')} />
                      </label>
                      <label className="block">
                        <span className={labelClass}>GSTIN</span>
                        <input className={fieldClass} {...register('newGstin')} />
                      </label>
                      <label className="block lg:col-span-2">
                        <span className={labelClass}>Payment Terms</span>
                        <input className={fieldClass} placeholder="Immediate / 15 days / 30 days" {...register('paymentTerms')} />
                      </label>
                      <label className="block lg:col-span-4">
                        <span className={labelClass}>Billing Address</span>
                        <textarea className={`${fieldClass} min-h-14 resize-none`} {...register('newBillingAddress', { validate: (value) => (isDirectInvoice && isNewCustomerMode && !value ? 'Billing address is required' : true) })} />
                        {errors.newBillingAddress && <span className="mt-1 block text-xs font-semibold text-rose-600">{errors.newBillingAddress.message}</span>}
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="grid border-b border-black lg:grid-cols-[3fr_2fr]">
            <div className="space-y-1.5 px-[15px] py-[5px]">
              <p className="font-semibold uppercase">Bill To</p>
              <div className="grid gap-2 md:grid-cols-[1.4fr_1fr]">
                <EditableField label="Traveller Name" error={errors.billingName}>
                  <input className={fieldClass} {...register('billingName', {
                    validate: (value) => (!isDirectInvoice || !isNewCustomerMode) && !value ? 'Traveller name is required' : true,
                  })} />
                </EditableField>
                <EditableField label="GST Number">
                  <input className={fieldClass} {...register('customerGstin')} />
                </EditableField>
              </div>
              <EditableField label="Company Name" error={errors.billingCustomer}>
                <input className={fieldClass} {...register('billingCustomer', {
                  validate: (value) => (!isDirectInvoice || !isNewCustomerMode) && !value ? 'Company name is required' : true,
                })} />
              </EditableField>
              <EditableField label="Billing Address" error={errors.billingAddress}>
                <textarea className={`${fieldClass} min-h-14 resize-none`} {...register('billingAddress', {
                  validate: (value) => (!isDirectInvoice || !isNewCustomerMode) && !value ? 'Billing address is required' : true,
                })} />
              </EditableField>
            </div>

            <div className="space-y-1.5 border-t border-black px-[15px] py-[5px] lg:border-l lg:border-t-0">
              <p className="font-semibold uppercase">Invoice Details</p>
              <EditableField label="Invoice Number">
                <input className={`${fieldClass} font-bold`} readOnly {...register('invoiceNumber')} />
              </EditableField>
              <EditableField label="Invoice Date">
                <input className={fieldClass} type="date" {...register('invoiceDate', { required: 'Invoice date is required' })} />
              </EditableField>
              {!isDirectInvoice && (
                <div className="grid gap-2 md:grid-cols-2">
                  <EditableField label="Booking ID">
                    <input className={fieldClass} readOnly {...register('bookingId', { required: 'Booking is required' })} />
                  </EditableField>
                  <EditableField label="Vehicle Details">
                    <input className={fieldClass} {...register('vehicle')} />
                  </EditableField>
                </div>
              )}
              {isDirectInvoice && (
                <div className="space-y-1.5">
                  <div className="grid gap-2 md:grid-cols-2">
                    <EditableField label="Reference / Work Order">
                      <input className={fieldClass} {...register('referenceNumber')} />
                    </EditableField>
                    <EditableField label="Place of Supply">
                      <input className={fieldClass} {...register('placeOfSupply')} />
                    </EditableField>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <EditableField label="Include in Vehicle P&L">
                      <select className={fieldClass} {...register('includeVehiclePnL')}>
                        <option>No</option>
                        <option>Yes</option>
                      </select>
                    </EditableField>
                    <EditableField label="Vehicle">
                      <select
                        className={fieldClass}
                        {...register('vehicleId', {
                          validate: (value) => (isDirectInvoice && values.includeVehiclePnL === 'Yes' && !value ? 'Vehicle is required for Vehicle P&L' : true),
                        })}
                        onChange={(event) => handleVehicleChange(event.target.value)}
                      >
                        <option value="">Optional - select vehicle</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.type} - {vehicle.plate}
                          </option>
                        ))}
                      </select>
                      {errors.vehicleId && <span className="mt-1 block text-xs font-semibold text-rose-600">{errors.vehicleId.message}</span>}
                    </EditableField>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <EditableField label="Driver">
                      <select className={fieldClass} {...register('driverId')}>
                        <option value="">Optional - select driver</option>
                        {drivers.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.name}
                          </option>
                        ))}
                      </select>
                    </EditableField>
                    <EditableField label="Invoice Email">
                      <input className={fieldClass} type="email" {...register('invoiceEmail')} />
                    </EditableField>
                  </div>
                </div>
              )}
            </div>
          </section>

          {isDirectInvoice && (
            <section className="grid gap-2 border-b border-black px-[15px] py-[5px] md:grid-cols-3">
              <EditableField label="Service Period">
                <input className={fieldClass} placeholder="18-07-2026 or 27-06-2026 to 29-06-2026" {...register('servicePeriod')} />
              </EditableField>
              <EditableField label="From Location">
                <input className={fieldClass} {...register('directFromLocation')} />
              </EditableField>
              <EditableField label="To Location">
                <input className={fieldClass} {...register('directToLocation')} />
              </EditableField>
            </section>
          )}

          <section className="border-b-2 border-black">
            <InvoiceItemTable items={items} onChange={setItems} onQuickAdd={handleQuickAdd} />
            <div className="flex justify-between border-y-2 border-black px-[5px] py-[3px] font-semibold">
              <span>TOTAL</span>
              <span>₹ {formatMoney(totals.subtotal)}/-</span>
            </div>
          </section>

          <section className="grid lg:grid-cols-[7fr_5fr]">
            <div className="border-b border-black px-2.5 pb-2.5 pt-0 lg:border-b-0">
              <p className="font-semibold">Bank Details</p>
              <dl className="grid max-w-xl grid-cols-[40%_1fr] gap-y-0.5">
                <dt className="font-bold">Name:</dt>
                <dd>{bank.accountName}</dd>
                <dt className="font-bold">Account No.:</dt>
                <dd>{bank.accountNumber}</dd>
                <dt className="font-bold">Bank Name:</dt>
                <dd>{bank.bankName}</dd>
                <dt className="font-bold">IFSC Code:</dt>
                <dd>{bank.ifscCode}</dd>
                <dt className="font-bold">UPI ID:</dt>
                <dd>{bank.upiId}</dd>
              </dl>
            </div>

            <div className="px-2.5 pb-2.5 pt-0">
              <TaxSummary totals={totals} gstType={values.gstType} register={register} />
              <div className="mt-[15px] text-right">
                <InvoiceSignature src={settings.signatureUrl} className="ml-auto h-[100px] w-[150px] object-contain" />
              </div>
            </div>
          </section>
        </div>
      </article>

      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur print:hidden sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={() => navigate('/invoices')}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {isEditMode ? 'Save Changes' : 'Save Draft'}
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={handleSubmit((formValues) => persistInvoice(formValues, defaultSaveStatus, 'preview'))}
        >
          Preview
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={handleSubmit((formValues) => persistInvoice(formValues, 'Generated', 'print'))}
        >
          Print
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={handleSubmit((formValues) => persistInvoice(formValues, 'Generated', 'print'))}
        >
          Download PDF
        </button>
        <button
          type="button"
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          onClick={handleSubmit((formValues) => persistInvoice(formValues, 'Generated', 'preview'))}
        >
          {primaryActionLabel}
        </button>
      </div>
    </form>
  )
}

export default InvoiceFormPage
