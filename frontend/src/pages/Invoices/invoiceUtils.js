export const companyDetails = {
  name: 'COMFORT CARS',
  subtitle: 'Taxi Service in Prayagraj',
  address: '129/10A, Chakiya Prayagraj Uttar Pradesh.',
  website: 'www.comfortcars.com',
  mobile: '+91 7505579212, +91 9450965103',
  gstNumber: '09BCCPH5235B1Z2',
  category: "Rent-a-Cab-Operator",
}

export const defaultBankDetails = {
  accountName: 'COMFORT CARS',
  accountNumber: '50200078410530',
  bankName: 'HDFC Bank',
  ifscCode: 'HDFC0008885',
  upiId: 'comfortcars@upi',
}

export const defaultInvoiceSettings = {
  prefix: 'INV',
  financialYear: '2026-27',
  nextNumber: 11,
  hsnCode: '996601',
  placeOfSupply: 'Uttar Pradesh',
  logoUrl: '/invoice-assets/comfort-cars-logo.png',
  signatureUrl: '/invoice-assets/digital-signature-stamp.jpeg',
  stampUrl: '',
  bankDetails: defaultBankDetails,
  terms: 'This invoice is issued by the recipient on behalf of the supplier under the provisions of Reverse Charge Mechanism (RCM) as per the GST Act.',
}

export function getInvoiceSettings() {
  return defaultInvoiceSettings
}

export function saveInvoiceSettings(settings) {
  return settings
}

export function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

export function createInvoiceNumber(settings = getInvoiceSettings()) {
  return `${settings.prefix}/${settings.financialYear}/${String(settings.nextNumber).padStart(4, '0')}`
}

export function getNextInvoiceId() {
  return ''
}

export function calculateInvoiceTotals(items = [], gstType = 'No GST') {
  const subtotal = items.reduce((total, item) => total + Number(item.amount || 0), 0)
  const taxableAmount = Math.max(0, subtotal)
  const cgst = gstType === 'CGST + SGST' ? taxableAmount * 0.025 : 0
  const sgst = gstType === 'CGST + SGST' ? taxableAmount * 0.025 : 0
  const igst = gstType === 'IGST' ? taxableAmount * 0.05 : 0
  const totalTax = cgst + sgst + igst
  const netPayable = taxableAmount + totalTax

  return { subtotal, taxableAmount, cgst, sgst, igst, totalTax, netPayable }
}

export function normalizeInvoice(invoice) {
  const numericTotal = Number(String(invoice.total || '').replace(/[^0-9.]/g, '')) || 0
  const source = invoice.invoice_source || invoice.invoiceSource || (invoice.bookingId || invoice.booking ? 'booking' : 'direct')
  const rawItems = invoice.items || [
    {
      id: `${invoice.id || 'item'}-line-1`,
      description: `Booking ${invoice.booking || invoice.bookingId || ''}`,
      qty: 1,
      rate: numericTotal,
      amount: numericTotal,
    },
  ]
  const items = rawItems.map((item) => ({
    dateType: item.dateType || 'single',
    serviceDate: item.serviceDate || invoice.dateOfService || invoice.bookingDate || invoice.invoiceDate || invoice.dueDate || '',
    serviceStartDate: item.serviceStartDate || '',
    serviceEndDate: item.serviceEndDate || '',
    unit: item.unit || 'Trip',
    qty: item.qty ?? item.quantity ?? 1,
    ...item,
  }))
  const totals = invoice.totals || calculateInvoiceTotals(items, invoice.gstType || 'No GST')

  return {
    invoice_source: source,
    invoiceSource: source,
    invoiceNumber: invoice.invoiceNumber || invoice.id,
    invoiceDate: invoice.invoiceDate || invoice.dueDate || '',
    bookingId: source === 'direct' ? '' : invoice.bookingId || invoice.booking || invoice.booking_id || '',
    billingCustomer: invoice.billingCustomer || invoice.customerName || invoice.customer || 'Customer',
    invoiceStatus: invoice.invoiceStatus || invoice.status || 'Draft',
    gstType: invoice.gstType || 'No GST',
    items,
    totals,
    bankDetails: invoice.bankDetails || defaultBankDetails,
    ...invoice,
  }
}

export function getInvoiceById(invoiceId) {
  return undefined
}
